import { assert, assertEquals, assertFalse } from "jsr:@std/assert@1";
import { deobfuscate, latinTokens, plainForm } from "./deobfuscate.ts";

const DEOBFUSCATE_CASES: [string, string, string][] = [
  ["ㅂr카라", "바카라", "초성+r(ㅏ)"],
  ["바ㅋr라", "바카라", "ㅋ+r(ㅏ)"],
  ["ㅌㅗㅌㅗ", "토토", "자모 분해"],
  ["토ㅌㅗ", "토토", "음절+자모"],
  ["㉳카라", "바카라", "원문자 자모"],
  ["바卡라", "바카라", "한자 닮은꼴"],
  ["홀ㄷㅓㅁ", "홀덤", "자모 분해"],
  ["꽁ㅁㅓ니", "꽁머니", "자모 분해"],
  ["카ㅈ1노", "카지노", "ㅈ+1(ㅣ)"],
  ["꽁머ㄴl", "꽁머니", "ㄴ+l(ㅣ)"],
  ["카\u200b지\u200b노", "카지노", "제로폭 문자"],
  ["ⓣⓞⓣⓞ", "toto", "원문자 영문"],
  ["ｃａｓｉｎｏ", "casino", "전각 영문"],
];

for (const [input, expected, label] of DEOBFUSCATE_CASES) {
  Deno.test(`deobfuscate: ${label} ${JSON.stringify(input)} → ${expected}`, () => {
    assert(deobfuscate(input).includes(expected), `got ${deobfuscate(input)}`);
  });
}

Deno.test("deobfuscate: 앞이 자음 낱자가 아니면 영문을 모음으로 치환하지 않는다", () => {
  assertEquals(deobfuscate("H 아이언"), "h아이언");
});

Deno.test("deobfuscate: 뒤가 낱자 초성이면 앞 음절의 받침으로 붙이지 않는다(시바 ㄹㅇ)", () => {
  assertFalse(deobfuscate("시바 ㄹㅇ 귀엽다").includes("시발"));
});

Deno.test("deobfuscate: 뒤가 낱자 초성이면 앞 음절의 받침으로 붙이지 않는다(한나 ㅁㅊ)", () => {
  assertFalse(deobfuscate("한나 ㅁㅊ 잘 치네").includes("한남"));
});

Deno.test("deobfuscate: 받침 없는 음절 뒤 낱자 초성은 받침으로 붙는다", () => {
  assert(deobfuscate("시바ㄹ").includes("시발"));
});

Deno.test("plainForm: 소문자화하고 문자·숫자만 남긴다", () => {
  assertEquals(plainForm("Ca-Si.No 카 지!노 1"), "casino카지노1");
});

Deno.test("latinTokens: leet 치환", () => {
  assert(latinTokens("c4sin0").includes("casino"));
  assert(latinTokens("b@ccarat").includes("baccarat"));
});

Deno.test("latinTokens: 한 글자 토큰 3개 이상은 이어 붙인 토큰도 낸다", () => {
  assert(latinTokens("B A C C A R A T 실시간").includes("baccarat"));
});

Deno.test("latinTokens: 한 글자 토큰 2개는 이어 붙이지 않는다", () => {
  assertFalse(latinTokens("a b 카지노").includes("ab"));
});

Deno.test("latinTokens(transform=false): NFKC·leet 없이 소문자와 [^a-z] 제거만 한다", () => {
  assertFalse(latinTokens("ⓣⓞⓣⓞ", false).includes("toto"));
  assertFalse(latinTokens("c4sin0", false).includes("casino"));
  assert(latinTokens("CASINO", false).includes("casino"));
  assert(latinTokens("B A C C A R A T", false).includes("baccarat"));
});

Deno.test("견고성: 이모지·서로게이트 쌍이 섞인 2,000자 입력은 throw 없이 10ms 이하", () => {
  const unit = "카😀지𝐀노\u200b😀ㅂr";
  const input = unit.repeat(Math.ceil(2000 / [...unit].length)).slice(0, 2000);
  let max = 0;
  for (let i = 0; i < 5; i++) {
    const t = performance.now();
    deobfuscate(input);
    latinTokens(input);
    max = Math.max(max, performance.now() - t);
  }
  assert(max <= 10, `max ${max}ms`);
});
