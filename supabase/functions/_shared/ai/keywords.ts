import { CATEGORY_KEYS, type FilterCategory } from "./categories.ts";

// 문환P_plan 6.5 표 그대로. [결정] A-07에서 quality 그룹 오탐 0건이 되도록 조정한다.
export const KEYWORDS: Readonly<Partial<Record<FilterCategory, readonly string[]>>> = {
  profanity: ["씨발", "시발", "병신", "개새끼", "존나", "지랄"],
  hate: ["한남", "김치녀", "틀딱"],
  threat: ["죽여버", "가만안둬"],
  sexual_harassment: ["섹스", "벗어봐", "야동"],
  illegal_ad: ["토토", "바카라", "카지노"],
};

// 정규화가 공백을 지우므로 "출시 발표"처럼 단어 경계를 넘어 금칙어("시발")가 생기는 정상 복합어를
// 먼저 가려 오탐을 막는다. 지우지 않고 자리표시자로 바꾸는 것은 앞뒤 글자가 이어져 새 금칙어가 생기는 것을 막기 위해서다.
// [결정] Task 7: quality 그룹 100문장 오탐 0건이라 목록은 초기값 그대로 둔다.
export const KEYWORD_EXCEPTIONS: readonly string[] = ["출시발", "시발점", "시발역", "유니섹스"];

// \p{L}·\p{N}이 아니라서 normalize 결과와 섞이지 않고, 어떤 금칙어에도 들어 있지 않다.
const MASK = "_";

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function keywordHits(text: string): FilterCategory[] {
  let normalized = normalize(text);
  for (const exception of KEYWORD_EXCEPTIONS) normalized = normalized.replaceAll(exception, MASK);
  return CATEGORY_KEYS.filter((key) => KEYWORDS[key]?.some((word) => normalized.includes(word)));
}
