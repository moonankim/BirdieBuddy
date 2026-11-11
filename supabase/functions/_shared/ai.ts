import type { FilterCategory } from "./ai/categories.ts";
import { clusterQuestions } from "./ai/cluster.ts";
import { envDeps } from "./ai/deps.ts";
import { moderateAndScore } from "./ai/moderate.ts";
import { summarize } from "./ai/summarize.ts";

export type MessageId = string;
export type Verdict = "pass" | "suggest" | "block";
export type { FilterCategory };

export interface AiAdapter {
  moderateAndScore(input: {
    body: string;
    disabledFilters: string[]; // FilterCategory 값만 온다
    senderType?: "user" | "influencer"; // 없으면 user
    signal: AbortSignal;
  }): Promise<{
    verdict: Verdict;
    category: string | null; // FilterCategory 값만 돌려준다
    reason: string | null; // adapter는 항상 null. 최종 안내문은 category별 고정 문구로 홍주P가 만든다
    rewrite: string | null;
    quality: number; // 0~100
    passesAllFilters: boolean; // disabledFilters를 적용하지 않아도 pass인지
    rewriteQuality: number | null; // 수정 문장의 품질 점수, rewrite가 null이면 null
  }>;
  clusterQuestions(input: {
    messages: { id: MessageId; body: string }[];
    signal: AbortSignal;
  }): Promise<{ representative: string; messageIds: MessageId[] }[]>;
  summarize(input: {
    messages: { id: MessageId; body: string; sender: string }[];
    signal: AbortSignal;
  }): Promise<string>;
}

export type ModerationResult = Awaited<ReturnType<AiAdapter["moderateAndScore"]>>;

export function createAiAdapter(): AiAdapter {
  return {
    // async: envDeps()의 동기 예외도 거부된 Promise로 나가게 한다.
    moderateAndScore: async (input) => moderateAndScore(input, envDeps()),
    clusterQuestions: async (input) => clusterQuestions(input, envDeps()),
    summarize: async (input) => summarize(input, envDeps()),
  };
}
