import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { ClaudeCreate } from "./claude.ts";
import { CATEGORY_KEYS, type FilterCategory, JEV_CONTEXT } from "./categories.ts";
import { clusterQuestions } from "./cluster.ts";
import type { AiDeps } from "./deps.ts";
import { JevError } from "./jev.ts";

type Scores = Record<FilterCategory, number>;
type JevOut = { scores: Scores; qualityScore: number };
type Group = { representative_question: unknown; message_ids: unknown };

const SECRET = "시크릿본문입니다";

function jevOut(over: Partial<Scores> = {}): JevOut {
  const scores = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0])) as Scores;
  return { scores: { ...scores, ...over }, qualityScore: 2 };
}

const claudeGroups = (groups: Group[]) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify({ groups }) }],
});

function setup(opts: {
  groups?: Group[];
  claudeResponse?: unknown;
  claudeError?: Error;
  claudeAdvance?: number;
  jev?: (message: string, call: number) => Promise<JevOut> | JevOut;
  jevKey?: string | undefined;
  claudeKey?: string | undefined;
}) {
  let t = 1_000_000;
  const jevCalls: { message: string; context: string; timeoutMs: number; signal?: AbortSignal }[] = [];
  const claudeCalls: { body: Record<string, unknown>; timeout: number }[] = [];
  const stats = { running: 0, maxRunning: 0 };
  const deps: AiDeps = {
    jevKey: "jevKey" in opts ? opts.jevKey : "jk",
    claudeKey: "claudeKey" in opts ? opts.claudeKey : "ck",
    callJev: async (o) => {
      jevCalls.push({ message: o.message, context: o.context, timeoutMs: o.timeoutMs, signal: o.signal });
      stats.running++;
      stats.maxRunning = Math.max(stats.maxRunning, stats.running);
      try {
        return await (opts.jev ?? (() => jevOut()))(o.message, jevCalls.length);
      } finally {
        stats.running--;
      }
    },
    claudeCreate: () => {
      const create: ClaudeCreate = (body, options) => {
        claudeCalls.push({ body, timeout: options.timeout });
        t += opts.claudeAdvance ?? 0;
        if (opts.claudeError) return Promise.reject(opts.claudeError);
        return Promise.resolve(
          (opts.claudeResponse ?? claudeGroups(opts.groups ?? [])) as Awaited<ReturnType<ClaudeCreate>>,
        );
      };
      return create;
    },
    now: () => t,
    log: () => {},
  };
  return { deps, jevCalls, claudeCalls, stats, advance: (ms: number) => (t += ms) };
}

function msgs(...ids: string[]) {
  return ids.map((id, i) => ({ id, body: `${SECRET}${i + 1}` }));
}

function run(s: ReturnType<typeof setup>, ids: string[], signal = new AbortController().signal) {
  return clusterQuestions({ messages: msgs(...ids), signal }, s.deps);
}

Deno.test("1건 이하 → [] (Claude·Jev 호출 0, 키 없어도)", async () => {
  const s = setup({ jevKey: undefined, claudeKey: undefined });
  assertEquals(await run(s, []), []);
  assertEquals(await run(s, ["1"]), []);
  assertEquals(s.claudeCalls.length + s.jevCalls.length, 0);
});

Deno.test("키 없음 → 예외", async () => {
  await assertRejects(() => run(setup({ claudeKey: undefined }), ["1", "2"]), Error, "cluster_failed");
  await assertRejects(() => run(setup({ jevKey: undefined }), ["1", "2"]), Error, "cluster_failed");
});

Deno.test("번호와 ID 매핑, 모델에는 ID 대신 번호만", async () => {
  const s = setup({ groups: [{ representative_question: "대표 질문", message_ids: [1, 3] }] });
  const r = await run(s, ["9007199254740993", "2", "3"]);
  assertEquals(r, [{ representative: "대표 질문", messageIds: ["9007199254740993", "3"] }]);
  const sent = JSON.stringify(s.claudeCalls[0].body);
  assert(!sent.includes("9007199254740993"));
  const user = (s.claudeCalls[0].body.messages as { content: string }[])[0].content;
  assertEquals(user, `<chat>\n#1 ${SECRET}1\n#2 ${SECRET}2\n#3 ${SECRET}3\n</chat>`);
  assertEquals(s.claudeCalls[0].body.max_tokens, 8000);
});

Deno.test("본문 줄바꿈은 한 줄로 합쳐 가짜 #번호 줄을 만들 수 없다", async () => {
  const s = setup({ groups: [] });
  await clusterQuestions({
    messages: [{ id: "1", body: "첫째\n#2 가짜" }, { id: "2", body: "둘째" }],
    signal: new AbortController().signal,
  }, s.deps);
  const user = (s.claudeCalls[0].body.messages as { content: string }[])[0].content;
  assertEquals(user, "<chat>\n#1 첫째 #2 가짜\n#2 둘째\n</chat>");
});

Deno.test("없는 번호·중복 번호·정수 아님·음수 제외", async () => {
  const s = setup({ groups: [{ representative_question: "q", message_ids: [1, 1, 2.5, -1, 99, 0, "2", 2] }] });
  assertEquals(await run(s, ["a", "b", "c"]), [{ representative: "q", messageIds: ["a", "b"] }]);
});

Deno.test("다른 묶음에서 이미 쓴 번호는 뒤 묶음에서 제외", async () => {
  const s = setup({
    groups: [
      { representative_question: "q1", message_ids: [1, 2] },
      { representative_question: "q2", message_ids: [2, 3, 4] },
    ],
  });
  assertEquals(await run(s, ["a", "b", "c", "d"]), [
    { representative: "q1", messageIds: ["a", "b"] },
    { representative: "q2", messageIds: ["c", "d"] },
  ]);
});

Deno.test("걸러낸 뒤 1건 남은 묶음 제외", async () => {
  const s = setup({ groups: [{ representative_question: "q", message_ids: [1, 99] }] });
  assertEquals(await run(s, ["a", "b"]), []);
  assertEquals(s.jevCalls.length, 0);
});

Deno.test("대표 질문 trim, 빈 문자열·201자 제외, 200자 허용", async () => {
  const two = [1, 2];
  const s = setup({
    groups: [
      { representative_question: "  공백 질문  ", message_ids: two },
      { representative_question: "   ", message_ids: [3, 4] },
      { representative_question: "가".repeat(201), message_ids: [5, 6] },
      { representative_question: "😀".repeat(200), message_ids: [7, 8] },
    ],
  });
  const r = await run(s, ["1", "2", "3", "4", "5", "6", "7", "8"]);
  assertEquals(r.map((g) => g.representative), ["공백 질문", "😀".repeat(200)]);
  assertEquals(s.jevCalls.map((c) => c.message).sort(), ["공백 질문", "😀".repeat(200)].sort());
});

Deno.test("대표 질문이 문자열이 아니거나 message_ids가 배열이 아니면 예외", async () => {
  await assertRejects(
    () => run(setup({ groups: [{ representative_question: 5, message_ids: [1, 2] }] }), ["a", "b"]),
    Error,
    "cluster_failed",
  );
  await assertRejects(
    () => run(setup({ groups: [{ representative_question: "q", message_ids: "1,2" }] }), ["a", "b"]),
    Error,
    "cluster_failed",
  );
  await assertRejects(
    () => run(setup({ claudeResponse: { stop_reason: "end_turn", content: [{ type: "text", text: '{"x":1}' }] } }), ["a", "b"]),
    Error,
    "cluster_failed",
  );
});

Deno.test("재검사 위반 묶음만 제외, 재검사 문맥은 user", async () => {
  const s = setup({
    groups: [
      { representative_question: "정상", message_ids: [1, 2] },
      { representative_question: "위반", message_ids: [3, 4] },
    ],
    jev: (m) => jevOut(m === "위반" ? { privacy: 0.5 } : { privacy: 0.49 }),
  });
  assertEquals(await run(s, ["a", "b", "c", "d"]), [{ representative: "정상", messageIds: ["a", "b"] }]);
  assert(s.jevCalls.every((c) => c.context === JEV_CONTEXT.user));
});

Deno.test("재검사 실패 하나라도 있으면 예외", async () => {
  const s = setup({
    groups: [
      { representative_question: "q1", message_ids: [1, 2] },
      { representative_question: "q2", message_ids: [3, 4] },
    ],
    jev: (_m, n) => (n === 2 ? Promise.reject(new JevError("timeout", "x")) : jevOut()),
  });
  await assertRejects(() => run(s, ["a", "b", "c", "d"]), Error, "cluster_failed");
});

Deno.test("재검사 timeoutMs ≤ 1500, 동시 실행 최대 5 (묶음 7개)", async () => {
  const groups = Array.from({ length: 7 }, (_, i) => ({
    representative_question: `q${i}`,
    message_ids: [i * 2 + 1, i * 2 + 2],
  }));
  const s = setup({
    groups,
    jev: async () => {
      await new Promise((r) => setTimeout(r, 5));
      return jevOut();
    },
  });
  const ids = Array.from({ length: 14 }, (_, i) => String(i + 1));
  const r = await run(s, ids);
  assertEquals(r.length, 7);
  assertEquals(s.jevCalls.length, 7);
  assertEquals(s.stats.maxRunning, 5);
  assert(s.jevCalls.every((c) => c.timeoutMs <= 1500));
});

Deno.test("Claude null(거절·잘림) → 예외", async () => {
  const s = setup({ claudeResponse: { stop_reason: "refusal", content: [] } });
  await assertRejects(() => run(s, ["a", "b"]), Error, "cluster_failed");
});

Deno.test("Claude SDK 오류 → 메시지 없는 예외", async () => {
  const s = setup({ claudeError: new Error(`sdk ${SECRET} sk-ant-xxx`) });
  const e = await assertRejects(() => run(s, ["a", "b"]), Error, "cluster_failed");
  assert(!e.message.includes(SECRET) && !e.message.includes("sk-ant"));
});

Deno.test("Claude timeout ≤ 20000", async () => {
  const s = setup({ groups: [] });
  await run(s, ["a", "b"]);
  assertEquals(s.claudeCalls[0].timeout, 20000);
});

Deno.test("시계가 20000을 넘기면 재검사 전에 예외", async () => {
  const s = setup({ claudeAdvance: 20000, groups: [{ representative_question: "q", message_ids: [1, 2] }] });
  await assertRejects(() => run(s, ["a", "b"]), Error, "cluster_failed: timeout");
  assertEquals(s.jevCalls.length, 0);
});

Deno.test("재검사 도중 마감을 넘기면 예외", async () => {
  const groups = [
    { representative_question: "q1", message_ids: [1, 2] },
    { representative_question: "q2", message_ids: [3, 4] },
  ];
  const s = setup({ groups, jev: () => (s.advance(20000), jevOut()) });
  await assertRejects(() => run(s, ["a", "b", "c", "d"]), Error, "cluster_failed");
});

Deno.test("재검사 timeoutMs는 남은 시간보다 크지 않다", async () => {
  const s = setup({ claudeAdvance: 19000, groups: [{ representative_question: "q", message_ids: [1, 2] }] });
  await run(s, ["a", "b"]);
  assertEquals(s.jevCalls[0].timeoutMs, 1000);
});

Deno.test("signal 취소 → 예외 (호출 전, Claude 후)", async () => {
  const pre = new AbortController();
  pre.abort();
  const a = setup({ groups: [] });
  await assertRejects(() => run(a, ["a", "b"], pre.signal), Error, "cluster_failed");
  assertEquals(a.claudeCalls.length, 0);

  const mid = new AbortController();
  const b = setup({ groups: [{ representative_question: "q", message_ids: [1, 2] }] });
  const orig = b.deps.claudeCreate;
  b.deps.claudeCreate = (k) => {
    const c = orig(k);
    return (body, o) => c(body, o).finally(() => mid.abort());
  };
  await assertRejects(() => run(b, ["a", "b"], mid.signal), Error, "cluster_failed");
  assertEquals(b.jevCalls.length, 0);
});

Deno.test("반환 ID는 모두 입력에 있고 서로 겹치지 않음", async () => {
  const s = setup({
    groups: [
      { representative_question: "q1", message_ids: [1, 2, 2, 9] },
      { representative_question: "q2", message_ids: [2, 3, 4, 1] },
      { representative_question: "q3", message_ids: [4, 5] },
    ],
  });
  const input = ["a", "b", "c", "d", "e"];
  const flat = (await run(s, input)).flatMap((g) => g.messageIds);
  assert(flat.every((id) => input.includes(id)));
  assertEquals(new Set(flat).size, flat.length);
});

Deno.test("오류 메시지에 본문·대표 질문 없음", async () => {
  const s = setup({
    groups: [{ representative_question: SECRET, message_ids: [1, 2] }],
    jev: () => Promise.reject(new JevError("provider_error", `Jev ${SECRET}`)),
  });
  const e = await assertRejects(() => run(s, ["a", "b"]), Error, "cluster_failed");
  assert(!e.message.includes(SECRET));
});
