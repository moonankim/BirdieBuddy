import { assert, assertEquals, assertInstanceOf } from "jsr:@std/assert@1";
import { CATEGORIES, CATEGORY_KEYS, SPAM_INFLUENCER_NOTE } from "./categories.ts";
import { buildJevRequest, callJev, JEV_URL, JevError, parseJevAnswers } from "./jev.ts";

function okBody(): { answers: Record<string, Record<string, number>> } {
  return {
    answers: {
      ...Object.fromEntries(CATEGORY_KEYS.map((k) => [k, { noul: 0.1 }])),
      quality: { score: 2.5 },
    },
  };
}

function assertJevError(fn: () => unknown, reason: "timeout" | "provider_error") {
  try {
    fn();
  } catch (e) {
    assertInstanceOf(e, JevError);
    assertEquals(e.reason, reason);
    return;
  }
  throw new Error("JevError가 던져지지 않았다");
}

async function assertJevRejects(p: Promise<unknown>, reason: "timeout" | "provider_error") {
  try {
    await p;
  } catch (e) {
    assertInstanceOf(e, JevError);
    assertEquals(e.reason, reason);
    return e;
  }
  throw new Error("JevError가 던져지지 않았다");
}

const baseOpts = { apiKey: "k", message: "m", context: "c", timeoutMs: 1000 };

Deno.test("요청: 모델, 문맥·본문, 항목 10개 noul과 quality score", () => {
  const body = buildJevRequest("본문", "문맥") as {
    model: string;
    state: unknown;
    questions: Record<string, { type: string; instructions: string; criteria?: string[] }>;
  };
  assertEquals(body.model, "jev-latest");
  assertEquals(body.state, { context: "문맥", message: "본문" });
  assertEquals(Object.keys(body.questions).length, 11);
  assertEquals(body.questions.threat, {
    type: "noul",
    instructions: "이 메시지에 다음 내용이 포함되어 있는가: " + CATEGORIES.threat.description,
  });
  assertEquals(body.questions.quality.type, "score");
  assertEquals(body.questions.quality.criteria?.length, 5);
});

Deno.test("응답 정상", () => {
  const r = parseJevAnswers(okBody());
  assertEquals(r.scores.threat, 0.1);
  assertEquals(r.qualityScore, 2.5);
});

Deno.test("응답에 모르는 key가 더 있어도 정상", () => {
  const raw = okBody();
  raw.answers.extra = { noul: 0.9 };
  assertEquals(parseJevAnswers(raw).qualityScore, 2.5);
});

Deno.test("응답 불량은 provider_error", () => {
  const bad = (mutate: (r: ReturnType<typeof okBody>) => void) => {
    const r = okBody();
    mutate(r);
    assertJevError(() => parseJevAnswers(r), "provider_error");
  };
  assertJevError(() => parseJevAnswers(null), "provider_error");
  assertJevError(() => parseJevAnswers({}), "provider_error");
  bad((r) => delete r.answers.spam);
  bad((r) => (r.answers.threat.noul = "0.3" as unknown as number));
  bad((r) => (r.answers.threat.noul = 1.2));
  bad((r) => (r.answers.threat.noul = -0.1));
  bad((r) => delete r.answers.quality);
  bad((r) => (r.answers.quality.score = 4.5));
  bad((r) => (r.answers.quality.score = "2" as unknown as number));
});

Deno.test("호출: POST, Bearer 키, JSON 본문", async () => {
  let seen: { url: string; init: RequestInit } | undefined;
  const fetchFn = ((url: string, init: RequestInit) => {
    seen = { url, init };
    return Promise.resolve(Response.json(okBody()));
  }) as unknown as typeof fetch;
  const r = await callJev({ ...baseOpts, fetchFn });
  assertEquals(seen?.url, JEV_URL);
  assertEquals(seen?.init.method, "POST");
  const headers = seen?.init.headers as Record<string, string>;
  assertEquals(headers["Authorization"], "Bearer k");
  assertEquals(headers["Content-Type"], "application/json");
  assertEquals(JSON.parse(seen?.init.body as string), buildJevRequest("m", "c"));
  assertEquals(r, parseJevAnswers(okBody()));
});

Deno.test("5xx는 provider_error이고 오류 메시지에 응답 본문이 없음", async () => {
  const fetchFn = (() => Promise.resolve(new Response("SECRET-BODY", { status: 503 }))) as unknown as typeof fetch;
  const e = await assertJevRejects(callJev({ ...baseOpts, fetchFn }), "provider_error");
  assert(!(e as Error).message.includes("SECRET-BODY"));
});

Deno.test("200 비JSON 본문은 provider_error", async () => {
  const fetchFn = (() => Promise.resolve(new Response("not json", { status: 200 }))) as unknown as typeof fetch;
  await assertJevRejects(callJev({ ...baseOpts, fetchFn }), "provider_error");
});

Deno.test("fetch 실패(TypeError)는 provider_error", async () => {
  const fetchFn = (() => Promise.reject(new TypeError("network"))) as unknown as typeof fetch;
  await assertJevRejects(callJev({ ...baseOpts, fetchFn }), "provider_error");
});

function waitForAbort(_url: string, init: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });
}

Deno.test("시한 초과는 timeout", async () => {
  await assertJevRejects(
    callJev({ ...baseOpts, timeoutMs: 10, fetchFn: waitForAbort as unknown as typeof fetch }),
    "timeout",
  );
});

Deno.test("호출 중 signal 취소는 timeout", async () => {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);
  await assertJevRejects(
    callJev({ ...baseOpts, timeoutMs: 5000, signal: controller.signal, fetchFn: waitForAbort as unknown as typeof fetch }),
    "timeout",
  );
});

Deno.test("이미 취소된 signal은 fetch 없이 timeout", async () => {
  let calls = 0;
  const fetchFn = (() => {
    calls++;
    return Promise.resolve(Response.json(okBody()));
  }) as unknown as typeof fetch;
  await assertJevRejects(callJev({ ...baseOpts, signal: AbortSignal.abort(), fetchFn }), "timeout");
  assertEquals(calls, 0);
});

type Questions = Record<string, { instructions: string }>;

Deno.test("spam 설명: influencer 발신에만 인플루언서 공지 제외 문장이 붙는다", () => {
  const q = (sender?: "user" | "influencer") =>
    (buildJevRequest("m", "c", sender) as { questions: Questions }).questions;
  assert(q("influencer").spam.instructions.endsWith(SPAM_INFLUENCER_NOTE));
  assert(!q("user").spam.instructions.includes(SPAM_INFLUENCER_NOTE));
  assert(!q().spam.instructions.includes(SPAM_INFLUENCER_NOTE));
});

Deno.test("spam 외 항목 설명은 발신자와 무관", () => {
  const a = (buildJevRequest("m", "c", "influencer") as { questions: Questions }).questions;
  const b = (buildJevRequest("m", "c", "user") as { questions: Questions }).questions;
  for (const k of CATEGORY_KEYS) if (k !== "spam") assertEquals(a[k], b[k]);
  assertEquals(a.quality, b.quality);
});

Deno.test("callJev는 senderType을 요청에 반영한다", async () => {
  let sent = "";
  const fetchFn = ((_url: string, init: RequestInit) => {
    sent = String(init.body);
    return Promise.resolve(new Response(JSON.stringify(okBody()), { status: 200 }));
  }) as typeof fetch;
  await callJev({ ...baseOpts, senderType: "influencer", fetchFn });
  assert(sent.includes(SPAM_INFLUENCER_NOTE));
  await callJev({ ...baseOpts, fetchFn });
  assert(!sent.includes(SPAM_INFLUENCER_NOTE));
});
