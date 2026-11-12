import { assertEquals } from "jsr:@std/assert@1";
import { fallbackModerate } from "./fallback.ts";
import { evasionHits } from "./keywords.ts";

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

Deno.test("우회 표기 금칙어는 정규화본으로 적중, 예외 단어는 통과", () => {
  const r = fallbackModerate("ㅂr카라 첫충", []);
  assertEquals([r.verdict, r.category], ["block", "illegal_ad"]);
  assertEquals(fallbackModerate("토토로 보면서 쉬었어요", []).verdict, "pass");
  assertEquals(fallbackModerate("홀 덤으로 하나 더", []).verdict, "pass");
  assertEquals(fallbackModerate("토토로ㅋ", []).verdict, "pass");
});

Deno.test("예외 단어 뒤 낱자 초성은 우회 적중을 만들지 않음", () => {
  for (const text of ["토토로ㅋ", "토토로ㅎ", "홀덤으로ㅋ"]) assertEquals(evasionHits(text), [], text);
});

Deno.test("금칙어 바로 뒤 낱자 초성이 금칙어를 지우지 않음", () => {
  const r = fallbackModerate("토토ㅋ", []);
  assertEquals([r.verdict, r.category], ["block", "illegal_ad"]);
  const p = fallbackModerate("존나ㅋ 웃기네", []);
  assertEquals([p.verdict, p.category], ["suggest", "profanity"]);
  for (const text of ["섹스ㅎ", "카지노ㅋ", "바카라 ㅋ 하자", "꽁머니ㅋ 지급", "토토 ㄱ"]) {
    assertEquals(fallbackModerate(text, []).verdict !== "pass", true, text);
  }
});

Deno.test("우회 표기에 낱자 초성이 붙어도 evasionHits가 잡음", () => {
  for (const text of ["ㅂr카라ㅋ 첫충", "카ㅈ1노ㅎ 오픈", "ㅌㅗㅌㅗ ㅋ", "꽁머ㄴlㅋ 지급"]) {
    assertEquals(evasionHits(text).includes("illegal_ad"), true, text);
  }
});

Deno.test("원문에 흔한 금칙어가 섞여도 우회 금칙어는 금칙어 단위로 잡음", () => {
  const mixed = [
    "ㅋr지노 먹튀 없는 곳",
    "ⓒⓐⓢⓘⓝⓞ 먹튀 없음",
    "ㅌㅗㅌㅗ 먹튀검증",
    "ㅂr카라 TOTO 가입",
    "ㅂr카라 슬롯 첫충",
    "카ㅈ1노 slot 이벤트",
  ];
  for (const text of mixed) assertEquals(evasionHits(text).includes("illegal_ad"), true, text);
  for (const text of ["카지노 로얄 영화", "TOTO 비데처럼", "홀 덤으로 하나 더"]) assertEquals(evasionHits(text), [], text);
});
