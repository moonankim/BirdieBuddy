import { CATEGORY_KEYS, type FilterCategory } from "./categories.ts";
import { deobfuscate, latinTokens, plainForm } from "./deobfuscate.ts";

// 문환P_plan 6.5 표 그대로. [결정] A-07에서 quality 그룹 오탐 0건이 되도록 조정한다.
export const KEYWORDS: Readonly<Partial<Record<FilterCategory, readonly string[]>>> = {
  profanity: ["씨발", "시발", "병신", "개새끼", "존나", "지랄"],
  hate: ["한남", "김치녀", "틀딱"],
  threat: ["죽여버", "가만안둬"],
  sexual_harassment: ["섹스", "벗어봐", "야동"],
  illegal_ad: ["토토", "바카라", "카지노", "슬롯", "홀덤", "꽁머니", "먹튀"],
};

// 공백 단위 영문 토큰 안에 포함되면 적중. 한글 금칙어와 달리 공백을 지운 문자열에는 대지 않는다
// ("R 샤프트"처럼 단어 경계를 넘어 우연히 이어지는 것을 막기 위해서다).
export const LATIN_KEYWORDS: Readonly<Partial<Record<FilterCategory, readonly string[]>>> = {
  illegal_ad: ["toto", "casino", "baccarat", "bacara", "slot", "holdem"],
};

// 정규화가 공백을 지우므로 "출시 발표"처럼 단어 경계를 넘어 금칙어("시발")가 생기는 정상 복합어를
// 먼저 가려 오탐을 막는다. 지우지 않고 자리표시자로 바꾸는 것은 앞뒤 글자가 이어져 새 금칙어가 생기는 것을 막기 위해서다.
// [결정] Task 7: quality 그룹 100문장 오탐 0건이라 기존 목록은 초기값 그대로 두고, 우회 목록 추가분("토토로", "홀덤으로")만 더한다.
export const KEYWORD_EXCEPTIONS: readonly string[] = ["출시발", "시발점", "시발역", "유니섹스", "토토로", "홀덤으로"];

// \p{L}·\p{N}이 아니라서 정규화 결과와 섞이지 않고, 어떤 금칙어에도 들어 있지 않다.
const MASK = "_";

function maskExceptions(matching: string): string {
  let masked = matching;
  for (const exception of KEYWORD_EXCEPTIONS) masked = masked.replaceAll(exception, MASK);
  return masked;
}

/** 적중한 금칙어 문자열(항목별). 한글은 정규화본, 영문은 토큰 기준이다. */
function hitWords(matching: string, tokens: string[]): Map<FilterCategory, Set<string>> {
  const masked = maskExceptions(matching);
  const found = new Map<FilterCategory, Set<string>>();
  for (const key of CATEGORY_KEYS) {
    const words = new Set<string>();
    for (const word of KEYWORDS[key] ?? []) if (masked.includes(word)) words.add(word);
    for (const word of LATIN_KEYWORDS[key] ?? []) if (tokens.some((t) => t.includes(word))) words.add(word);
    if (words.size) found.set(key, words);
  }
  return found;
}

// 변환 대조본: 원문 기호 제거본(plain)은 evasionHits의 비교 기준으로 따로 둔다.
// 받침 붙이기 전·후 두 형태를 모두 대는 이유는 deobfuscate의 attachFinals 설명 참고.
function transformedHits(text: string): Map<FilterCategory, Set<string>>[] {
  const tokens = latinTokens(text);
  return [
    hitWords(deobfuscate(text, KEYWORD_EXCEPTIONS, false), tokens),
    hitWords(deobfuscate(text, KEYWORD_EXCEPTIONS), tokens),
  ];
}

function plainHits(text: string): Map<FilterCategory, Set<string>> {
  return hitWords(plainForm(text), latinTokens(text, false));
}

/** 원문 기호 제거본, 받침 붙이기 전 복원본, 받침까지 붙인 복원본, 영문 토큰 기준 적중의 합집합. 폴백이 쓴다. */
export function keywordHits(text: string): FilterCategory[] {
  const forms = [plainHits(text), ...transformedHits(text)];
  return CATEGORY_KEYS.filter((key) => forms.some((f) => f.has(key)));
}

/**
 * 변환을 거쳐야만 드러나는 적중. 항목 단위가 아니라 금칙어 단위로 비교한다:
 * 항목의 어떤 금칙어가 변환본에서는 적중하는데 원문 기호 제거본에서는 적중하지 않으면 그 항목을 돌려준다.
 * ("ㅋr지노 먹튀"처럼 원문에 흔한 금칙어가 섞여 있어도 우회 금칙어를 놓치지 않기 위해서다.)
 */
export function evasionHits(text: string): FilterCategory[] {
  const plain = plainHits(text);
  const transformed = transformedHits(text);
  return CATEGORY_KEYS.filter((key) =>
    transformed.some((f) => [...(f.get(key) ?? [])].some((word) => !plain.get(key)?.has(word)))
  );
}
