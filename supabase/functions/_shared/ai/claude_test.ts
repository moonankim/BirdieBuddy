import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import { callClaudeJson, callClaudeText, CLAUDE_MODEL, type ClaudeCreate } from "./claude.ts";

type Recorded = { body: Record<string, unknown>; options: { timeout: number; signal?: AbortSignal } };

function fakeCreate(
  response: Awaited<ReturnType<ClaudeCreate>>,
  recorded?: Recorded[],
): ClaudeCreate {
  return (body, options) => {
    recorded?.push({ body, options });
    return Promise.resolve(response);
  };
}

const schema = { type: "object", properties: { rewritten: { type: "string" } } };
const baseReq = { system: "sys", user: "usr", maxTokens: 300, schema, timeoutMs: 5000 };
const okResponse = {
  stop_reason: "end_turn",
  content: [{ type: "text", text: '{"rewritten":"안녕하세요"}' }],
};

Deno.test("공통 옵션", async () => {
  const recorded: Recorded[] = [];
  const signal = new AbortController().signal;
  await callClaudeJson(fakeCreate(okResponse, recorded), { ...baseReq, signal });
  const { body, options } = recorded[0];
  assertEquals(body.model, CLAUDE_MODEL);
  assertEquals(body.model, "claude-haiku-5-5");
  assertEquals(body.thinking, { type: "disabled" });
  assertEquals(body.output_config, { effort: "low", format: { type: "json_schema", schema } });
  assertEquals(body.max_tokens, 300);
  assertEquals(body.system, "sys");
  assertEquals(body.messages, [{ role: "user", content: "usr" }]);
  assertEquals(options.timeout, 5000);
  assertEquals(options.signal === signal, true);
});

Deno.test("end_turn이면 JSON을 읽음", async () => {
  const result = await callClaudeJson<{ rewritten: string }>(fakeCreate(okResponse), baseReq);
  assertEquals(result, { rewritten: "안녕하세요" });
});

Deno.test("end_turn이 아니면 null", async () => {
  for (const stop_reason of ["refusal", "max_tokens"]) {
    const result = await callClaudeJson(fakeCreate({ ...okResponse, stop_reason }), baseReq);
    assertEquals(result, null);
  }
});

Deno.test("텍스트가 JSON이 아니면 null", async () => {
  const response = { stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] };
  assertEquals(await callClaudeJson(fakeCreate(response), baseReq), null);
});

Deno.test("create 오류는 그대로 전파", async () => {
  const create: ClaudeCreate = () => Promise.reject(new Error("boom"));
  await assertRejects(() => callClaudeJson(create, baseReq), Error, "boom");
});

Deno.test("callClaudeText: format 없음, effort low, thinking disabled, end_turn 아니면 null, 텍스트 이어붙임", async () => {
  const recorded: Recorded[] = [];
  const signal = new AbortController().signal;
  const response = {
    stop_reason: "end_turn",
    content: [{ type: "text", text: "가" }, { type: "thinking" }, { type: "text", text: "나" }],
  };
  const req = { system: "sys", user: "usr", maxTokens: 4096, timeoutMs: 5000, signal };
  assertEquals(await callClaudeText(fakeCreate(response, recorded), req), "가나");
  const { body, options } = recorded[0];
  assertEquals(body.model, CLAUDE_MODEL);
  assertEquals(body.thinking, { type: "disabled" });
  assertEquals(body.output_config, { effort: "low" });
  assertEquals(body.max_tokens, 4096);
  assertEquals(body.system, "sys");
  assertEquals(body.messages, [{ role: "user", content: "usr" }]);
  assertEquals(options.timeout, 5000);
  assertEquals(options.signal === signal, true);
  for (const stop_reason of ["refusal", "max_tokens", null]) {
    assertEquals(await callClaudeText(fakeCreate({ ...response, stop_reason }), req), null);
  }
  const boom: ClaudeCreate = () => Promise.reject(new Error("boom"));
  await assertRejects(() => callClaudeText(boom, req), Error, "boom");
});
