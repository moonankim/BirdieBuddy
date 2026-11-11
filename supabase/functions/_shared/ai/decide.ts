import type { Verdict } from "../ai.ts";
import { CATEGORIES, CATEGORY_KEYS, FLAG_THRESHOLD, type FilterCategory } from "./categories.ts";

export type Decision = {
  verdict: Verdict;
  category: FilterCategory | null;
  passesAllFilters: boolean;
  flagged: FilterCategory[];
};

// 불변식: category는 항상 차단 항목이거나 disabledFilters에 없는 선택 항목이다.
export function decide(
  scores: Record<FilterCategory, number>,
  disabledFilters: readonly string[],
): Decision {
  const flagged = CATEGORY_KEYS.filter((key) => scores[key] >= FLAG_THRESHOLD);
  const applicable = flagged.filter((key) =>
    CATEGORIES[key].scope === "mandatory" || !disabledFilters.includes(key)
  );
  const rank = (key: FilterCategory) => CATEGORIES[key].scope === "mandatory" ? 0 : 1;
  // flagged가 CATEGORY_KEYS 순서이고 정렬이 안정적이라 동점은 키 순서로 정해진다.
  const top = [...applicable].sort((a, b) => rank(a) - rank(b) || scores[b] - scores[a])[0];

  return {
    verdict: top === undefined ? "pass" : rank(top) === 0 ? "block" : "suggest",
    category: top ?? null,
    passesAllFilters: flagged.length === 0,
    flagged,
  };
}

export function toQuality(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score * 25)));
}
