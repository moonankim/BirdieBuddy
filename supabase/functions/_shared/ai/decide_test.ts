import { assert, assertEquals } from "jsr:@std/assert@1";
import { CATEGORIES, CATEGORY_KEYS, type FilterCategory } from "./categories.ts";
import { decide, toQuality } from "./decide.ts";

function s(partial: Partial<Record<FilterCategory, number>>): Record<FilterCategory, number> {
  const out = {} as Record<FilterCategory, number>;
  for (const key of CATEGORY_KEYS) out[key] = partial[key] ?? 0;
  return out;
}

Deno.test("위반 없음 → pass, category null, passesAllFilters true", () => {
  const d = decide(s({}), []);
  assertEquals(d, { verdict: "pass", category: null, passesAllFilters: true, flagged: [] });
});

Deno.test("선택 항목만 → suggest", () => {
  const d = decide(s({ profanity: 0.8 }), []);
  assertEquals(d.verdict, "suggest");
  assertEquals(d.category, "profanity");
  assertEquals(d.passesAllFilters, false);
});

Deno.test("항상 차단 → block", () => {
  const d = decide(s({ privacy: 0.6 }), []);
  assertEquals(d.verdict, "block");
  assertEquals(d.category, "privacy");
});

Deno.test("항상 차단 + 선택 → block, category는 항상 차단", () => {
  const d = decide(s({ profanity: 0.99, threat: 0.6 }), []);
  assertEquals(d.verdict, "block");
  assertEquals(d.category, "threat");
});

Deno.test("항상 차단 여러 개 → 점수 높은 쪽", () => {
  assertEquals(decide(s({ threat: 0.6, hate: 0.9 }), []).category, "hate");
});

Deno.test("동점이면 CATEGORY_KEYS 순서", () => {
  assertEquals(decide(s({ threat: 0.7, hate: 0.7 }), []).category, "threat");
});

Deno.test("꺼 둔 선택 항목만 → pass, null, passesAllFilters false", () => {
  const d = decide(s({ appearance: 0.9 }), ["appearance"]);
  assertEquals(d.verdict, "pass");
  assertEquals(d.category, null);
  assertEquals(d.passesAllFilters, false);
});

Deno.test("disabledFilters의 항상 차단·없는 key는 무시", () => {
  const d = decide(s({ spam: 0.9 }), ["spam", "nope"]);
  assertEquals(d.verdict, "block");
  assertEquals(d.category, "spam");
});

Deno.test("기준값 경계", () => {
  assertEquals(decide(s({ belittling: 0.5 }), []).verdict, "suggest");
  assertEquals(decide(s({ belittling: 0.4999 }), []).verdict, "pass");
});

Deno.test("flagged는 전 항목 기준", () => {
  const d = decide(s({ profanity: 0.9, spam: 0.1 }), ["profanity"]);
  assertEquals(d.flagged, ["profanity"]);
});

Deno.test("flagged는 CATEGORY_KEYS 순서", () => {
  assertEquals(decide(s({ spam: 0.9, profanity: 0.9, hate: 0.9 }), []).flagged, ["profanity", "hate", "spam"]);
});

Deno.test("category 불변식: disabledFilters 항목은 category가 되지 않는다", () => {
  const scoreSets = [
    CATEGORY_KEYS.map(() => 0.9),
    CATEGORY_KEYS.map((_, i) => (i % 2 === 0 ? 0.9 : 0.1)),
    CATEGORY_KEYS.map((_, i) => 0.5 + i * 0.04),
  ];
  for (const values of scoreSets) {
    const scores = s(Object.fromEntries(CATEGORY_KEYS.map((k, i) => [k, values[i]])));
    for (let mask = 0; mask < 1 << CATEGORY_KEYS.length; mask++) {
      const disabled = CATEGORY_KEYS.filter((_, i) => mask & (1 << i));
      const { category } = decide(scores, disabled);
      assert(
        category === null || CATEGORIES[category].scope === "mandatory" || !disabled.includes(category),
        `mask=${mask} category=${category}`,
      );
    }
  }
});

Deno.test("toQuality", () => {
  assertEquals(toQuality(0), 0);
  assertEquals(toQuality(2.5), 63);
  assertEquals(toQuality(4), 100);
  assertEquals(toQuality(3.24), 81);
  assertEquals(toQuality(5), 100);
  assertEquals(toQuality(-1), 0);
});
