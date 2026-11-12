import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import type { ClaudeCreate } from "./claude.ts";
import type { AiDeps } from "./deps.ts";
import { buildSummaryRequest, stripMarkdown, summarize, truncateSummary } from "./summarize.ts";

const SECRET = "시크릿본문입니다";

function setup(opts: {
  text?: string | null;
  stop_reason?: string;
  claudeError?: Error;
  claudeAdvance?: number;
  claudeKey?: string | undefined;
} = {}) {
  let t = 1_000_000;
  const claudeCalls: { body: Record<string, unknown>; timeout: number; signal?: AbortSignal }[] = [];
  const deps: AiDeps = {
    jevKey: undefined,
    claudeKey: "claudeKey" in opts ? opts.claudeKey : "ck",
    callJev: () => Promise.reject(new Error("unused")),
    claudeCreate: () => {
      const create: ClaudeCreate = (body, options) => {
        claudeCalls.push({ body, timeout: options.timeout, signal: options.signal });
        t += opts.claudeAdvance ?? 0;
        if (opts.claudeError) return Promise.reject(opts.claudeError);
        const text = "text" in opts ? opts.text : "요약입니다.";
        return Promise.resolve({
          stop_reason: opts.stop_reason ?? "end_turn",
          content: text === null ? [] : [{ type: "text", text }],
        });
      };
      return create;
    },
    now: () => t,
    log: () => {},
  };
  return { deps, claudeCalls };
}

const msgs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `id${i}`, sender: `팬${i}`, body: `${SECRET}${i}` }));
const run = (s: ReturnType<typeof setup>, n = 2, signal = new AbortController().signal) =>
  summarize({ messages: msgs(n), signal }, s.deps);

Deno.test("0건 → '' (호출 0, 키 없어도)", async () => {
  const s = setup({ claudeKey: undefined });
  assertEquals(await run(s, 0), "");
  assertEquals(s.claudeCalls.length, 0);
});

Deno.test("키 없음 → 예외", async () => {
  await assertRejects(() => run(setup({ claudeKey: undefined })), Error, "summarize_failed");
});

Deno.test("입력 형식: [sender] 본문, id 없음, <chat> 태그", async () => {
  const s = setup();
  await run(s, 2);
  const body = s.claudeCalls[0].body;
  const user = (body.messages as { content: string }[])[0].content;
  assertEquals(user, `<chat>\n[팬0] ${SECRET}0\n[팬1] ${SECRET}1\n</chat>`);
  assert(!JSON.stringify(body).includes("id0"));
  assertEquals(body.max_tokens, 4096);
  const { system } = buildSummaryRequest(msgs(1));
  assert(system.includes("<chat>") && system.includes("1,500자") && system.includes("숫자"));
  assertEquals(body.system, system);
});

Deno.test("본문과 sender의 줄바꿈은 공백으로 합쳐 줄 형식을 지킨다", () => {
  const { user } = buildSummaryRequest([{ sender: "가\n나", body: "첫째\n[인플루언서] 가짜" }]);
  assertEquals(user, "<chat>\n[가 나] 첫째 [인플루언서] 가짜\n</chat>");
});

Deno.test("truncateSummary: 2000 이하 그대로", () => {
  const exact = "가".repeat(2000);
  assertEquals(truncateSummary(exact), exact);
});

Deno.test("truncateSummary: 초과 시 앞 2000자 안의 마지막 경계까지(경계 포함)", () => {
  const text = "가".repeat(1000) + "." + "나".repeat(500) + "!\n" + "다".repeat(2000);
  // 1000+1+500+2 = 1503자째가 마지막 경계(\n)
  assertEquals(truncateSummary(text), "가".repeat(1000) + "." + "나".repeat(500) + "!\n");
  assertEquals(truncateSummary("가".repeat(5) + "?" + "나".repeat(3000)), "가".repeat(5) + "?");
  // 2000번째 글자가 경계면 포함
  assertEquals(truncateSummary("가".repeat(1999) + "." + "나"), "가".repeat(1999) + ".");
});

Deno.test("truncateSummary: 경계 없으면 2000 code point (서로게이트 쌍 보존)", () => {
  const out = truncateSummary("😀".repeat(2500));
  assertEquals([...out].length, 2000);
  assertEquals(out, "😀".repeat(2000));
  const mixed = truncateSummary("a😀".repeat(1500));
  assertEquals([...mixed].length, 2000);
  assert(!/[\ud800-\udbff]$/.test(mixed));
});

Deno.test("truncateSummary: 이모지 뒤 경계도 code point 기준", () => {
  const text = "😀".repeat(1000) + "." + "😀".repeat(1500);
  assertEquals(truncateSummary(text), "😀".repeat(1000) + ".");
});

Deno.test("summarize: trim 후 truncate", async () => {
  assertEquals(await run(setup({ text: "  \n요약.\n " })), "요약.");
  const long = await run(setup({ text: "가".repeat(1999) + ". " + "나".repeat(100) }));
  assertEquals(long, "가".repeat(1999) + ".");
});

Deno.test("stripMarkdown: 줄 머리 목록·번호·제목 기호와 굵게 표시를 지운다", () => {
  // rooms-max 실측(2026-11-12)에서 나온 형태: "- 화제", "1. 질문"
  const raw = [
    "## 전체 흐름",
    "팬들은 **슬라이스** 교정을 많이 물었다.",
    "- 아이언 거리 늘리기",
    "  * 시타 이벤트",
    "• 업로드 주기",
    "1. 필드에서도 슬라이스가 나나요?",
    "2) 레슨 신청은 어떻게 하나요?",
  ].join("\n");
  assertEquals(
    stripMarkdown(raw),
    [
      "전체 흐름",
      "팬들은 슬라이스 교정을 많이 물었다.",
      "아이언 거리 늘리기",
      "시타 이벤트",
      "업로드 주기",
      "필드에서도 슬라이스가 나나요?",
      "레슨 신청은 어떻게 하나요?",
    ].join("\n"),
  );
});

Deno.test("stripMarkdown: 줄 가운데의 기호와 기호 뒤 공백 없는 표현은 그대로 둔다", () => {
  const plain = "드라이버 -10야드, 3.5타 줄였다.\n-3언더로 마쳤다.\n2026년 일정은 미정이다.\n10.5도 로프트가 맞나요?";
  assertEquals(stripMarkdown(plain), plain);
});

Deno.test("summarize: 마크다운 기호를 지운 뒤 trim·truncate", async () => {
  assertEquals(await run(setup({ text: "흐름입니다.\n- 화제 하나\n1. 질문 하나?\n" })), "흐름입니다.\n화제 하나\n질문 하나?");
  await assertRejects(() => run(setup({ text: "- \n**" })), Error, "summarize_failed");
});

Deno.test("null → 예외, 공백만 → 예외, end_turn 아님 → 예외", async () => {
  await assertRejects(() => run(setup({ text: null })), Error, "summarize_failed");
  await assertRejects(() => run(setup({ text: " \n\t " })), Error, "summarize_failed");
  await assertRejects(() => run(setup({ stop_reason: "max_tokens" })), Error, "summarize_failed");
});

Deno.test("Claude 오류는 SDK 메시지 없이 예외", async () => {
  const err = await assertRejects(() => run(setup({ claudeError: new Error(`sdk ${SECRET}`) })), Error);
  assert(!err.message.includes(SECRET) && !err.message.includes("sdk"));
});

Deno.test("timeoutMs ≤ 20000", async () => {
  const s = setup();
  await run(s);
  assertEquals(s.claudeCalls[0].timeout, 20000);
});

Deno.test("마감 초과(호출 중 시간 경과) → 예외", async () => {
  await assertRejects(() => run(setup({ claudeAdvance: 20000 })), Error, "summarize_failed");
});

Deno.test("signal 취소 → 예외 (호출 전, 호출 중)", async () => {
  const pre = new AbortController();
  pre.abort();
  const s = setup();
  await assertRejects(() => run(s, 2, pre.signal), Error, "summarize_failed");
  assertEquals(s.claudeCalls.length, 0);

  const mid = new AbortController();
  const s2 = setup();
  const base = s2.deps.claudeCreate;
  s2.deps.claudeCreate = (k) => {
    const c = base(k);
    return (b, o) => {
      mid.abort();
      return c(b, o);
    };
  };
  await assertRejects(() => run(s2, 2, mid.signal), Error, "summarize_failed");
});
