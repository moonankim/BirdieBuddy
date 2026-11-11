import { assertEquals, assertInstanceOf, assertRejects } from "jsr:@std/assert@1";
import { createAiAdapter } from "../ai.ts";
import { CATEGORY_KEYS, CATEGORIES } from "./categories.ts";

Deno.test("adapter는 세 함수를 모두 제공", () => {
  const ai = createAiAdapter();
  // moderateAndScore는 호출하지 않는다(env를 읽는데 이 시험에는 권한이 없다).
  assertEquals(Object.values(ai).map((f) => typeof f), ["function", "function", "function"]);
});

Deno.test("항목 구분은 prd 기준: 선택 3개, 항상 차단 7개(hate 포함)", () => {
  assertEquals(CATEGORY_KEYS.filter((k) => CATEGORIES[k].scope === "optional"), ["profanity", "belittling", "appearance"]);
  assertEquals(CATEGORIES.hate.scope, "mandatory");
});

Deno.test("envDeps가 동기로 던져도 adapter 메서드는 거부된 Promise를 돌려준다", async () => {
  const original = Deno.env.get;
  Deno.env.get = () => {
    throw new Error("env_unavailable");
  };
  try {
    const ai = createAiAdapter();
    const signal = new AbortController().signal;
    const calls = [
      ai.moderateAndScore({ body: "x", disabledFilters: [], signal }),
      ai.clusterQuestions({ messages: [], signal }),
      ai.summarize({ messages: [], signal }),
    ];
    for (const p of calls) {
      assertInstanceOf(p, Promise);
      await assertRejects(() => p, Error, "env_unavailable");
    }
  } finally {
    Deno.env.get = original;
  }
});
