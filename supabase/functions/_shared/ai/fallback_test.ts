import { assertEquals } from "jsr:@std/assert@1";
import { fallbackModerate } from "./fallback.ts";

Deno.test("항목별 적중", () => {
  const cases = [
    ["씨발", "suggest", "profanity"],
    ["죽여버릴거야", "block", "threat"],
    ["섹스", "block", "sexual_harassment"],
    ["한남들", "block", "hate"],
    ["토토 사이트", "block", "illegal_ad"],
  ] as const;
  for (const [body, verdict, category] of cases) {
    const r = fallbackModerate(body, []);
    assertEquals([r.verdict, r.category], [verdict, category], body);
  }
});

Deno.test("우회 표기", () => {
  assertEquals(fallbackModerate("씨 . 발", []).category, "profanity");
  assertEquals(fallbackModerate("죽 여 버 려", []).category, "threat");
});

Deno.test("꺼 둔 선택 항목은 pass", () => {
  const r = fallbackModerate("병신", ["profanity"]);
  assertEquals([r.verdict, r.category], ["pass", null]);
});

Deno.test("항상 차단은 꺼도 block", () => {
  assertEquals(fallbackModerate("바카라", ["illegal_ad"]).verdict, "block");
});

Deno.test("여러 항상 차단 → 정의 순서 앞선 쪽", () => {
  assertEquals(fallbackModerate("죽여버려 한남", []).category, "threat");
});

Deno.test("반환 고정값", () => {
  for (const body of ["씨발", "죽여버려", "병신", "드라이버 비거리"]) {
    const r = fallbackModerate(body, ["profanity"]);
    assertEquals(
      [r.quality, r.rewrite, r.rewriteQuality, r.reason, r.passesAllFilters],
      [50, null, null, null, false],
      body,
    );
  }
});

Deno.test("정상 복합어 예외", () => {
  for (const body of ["신제품 출시 발표 언제예요?", "시발점이 어디죠", "유니섹스 골프웨어 추천"]) {
    assertEquals(fallbackModerate(body, []).verdict, "pass", body);
  }
});

Deno.test("정상 문장", () => {
  assertEquals(fallbackModerate("드라이버 비거리 늘리는 법 알려주세요", []).verdict, "pass");
});

Deno.test("예외 복합어와 실제 금칙어가 한 문장에 있으면 금칙어는 적중", () => {
  const r = fallbackModerate("시발점 병신", []);
  assertEquals([r.verdict, r.category], ["suggest", "profanity"]);
});

Deno.test("예외 복합어를 가려도 앞뒤 글자가 이어져 금칙어가 생기지 않음", () => {
  assertEquals(fallbackModerate("시발점 토 토", []).category, "illegal_ad");
  assertEquals(fallbackModerate("씨 시발점 발", []).verdict, "pass");
});
