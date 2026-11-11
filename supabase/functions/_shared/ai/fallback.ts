import type { ModerationResult } from "../ai.ts";
import { CATEGORY_KEYS, type FilterCategory } from "./categories.ts";
import { decide } from "./decide.ts";
import { keywordHits } from "./keywords.ts";

export function fallbackModerate(
  body: string,
  disabledFilters: readonly string[],
): ModerationResult {
  const hits = keywordHits(body);
  const scores = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, hits.includes(key) ? 1 : 0]),
  ) as Record<FilterCategory, number>;
  const { verdict, category } = decide(scores, disabledFilters);
  return {
    verdict,
    category,
    reason: null,
    rewrite: null,
    quality: 50,
    passesAllFilters: false,
    rewriteQuality: null,
  };
}
