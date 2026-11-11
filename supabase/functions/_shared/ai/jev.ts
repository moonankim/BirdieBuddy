import { CATEGORIES, CATEGORY_KEYS, type FilterCategory, QUALITY_QUESTION, SPAM_INFLUENCER_NOTE } from "./categories.ts";

export const JEV_URL = "https://api.typesafe.ai/v1/systemone";

export type JevScores = { scores: Record<FilterCategory, number>; qualityScore: number };

export class JevError extends Error {
  readonly reason: "timeout" | "provider_error";
  constructor(reason: "timeout" | "provider_error", message: string) {
    super(message);
    this.name = "JevError";
    this.reason = reason;
  }
}

export type SenderType = "user" | "influencer";

function describe(key: FilterCategory, senderType: SenderType): string {
  const base = CATEGORIES[key].description;
  return key === "spam" && senderType === "influencer" ? `${base}. ${SPAM_INFLUENCER_NOTE}` : base;
}

export function buildJevRequest(
  message: string,
  context: string,
  senderType: SenderType = "user",
): Record<string, unknown> {
  const questions: Record<string, unknown> = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [
      key,
      { type: "noul", instructions: `이 메시지에 다음 내용이 포함되어 있는가: ${describe(key, senderType)}` },
    ]),
  );
  questions.quality = {
    type: "score",
    instructions: QUALITY_QUESTION.instructions,
    criteria: [...QUALITY_QUESTION.criteria],
  };
  return { model: "jev-latest", state: { context, message }, questions };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function inRange(v: unknown, max: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
}

export function parseJevAnswers(raw: unknown): JevScores {
  const answers = isRecord(raw) ? raw.answers : undefined;
  if (!isRecord(answers)) throw new JevError("provider_error", "Jev response malformed");

  const scores = {} as Record<FilterCategory, number>;
  for (const key of CATEGORY_KEYS) {
    const noul = isRecord(answers[key]) ? answers[key].noul : undefined;
    if (!inRange(noul, 1)) throw new JevError("provider_error", "Jev response malformed");
    scores[key] = noul;
  }
  const qualityScore = isRecord(answers.quality) ? answers.quality.score : undefined;
  if (!inRange(qualityScore, 4)) throw new JevError("provider_error", "Jev response malformed");
  return { scores, qualityScore };
}

export async function callJev(opts: {
  apiKey: string;
  message: string;
  context: string;
  senderType?: SenderType;
  timeoutMs: number;
  signal?: AbortSignal;
  fetchFn?: typeof fetch;
}): Promise<JevScores> {
  if (opts.signal?.aborted) throw new JevError("timeout", "Jev call aborted");

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(onAbort, opts.timeoutMs);

  try {
    const response = await (opts.fetchFn ?? fetch)(JEV_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildJevRequest(opts.message, opts.context, opts.senderType)),
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new JevError("provider_error", `Jev HTTP ${response.status}`);
    }
    return parseJevAnswers(await response.json());
  } catch (e) {
    if (controller.signal.aborted) throw new JevError("timeout", "Jev call timed out or aborted");
    if (e instanceof JevError) throw e;
    throw new JevError("provider_error", "Jev call failed");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", onAbort);
  }
}
