import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";

export const CLAUDE_MODEL = "claude-haiku-5-5";

export type ClaudeCreate = (
  body: Record<string, unknown>,
  options: { timeout: number; signal?: AbortSignal },
) => Promise<{
  stop_reason: string | null;
  content: Array<{ type: string; text?: string }>;
}>;

export function createClaudeCreate(apiKey: string): ClaudeCreate {
  const client = new Anthropic({ apiKey, maxRetries: 0 });
  return (body, options) =>
    client.messages.create(body as unknown as Anthropic.MessageCreateParamsNonStreaming, options);
}

export async function callClaudeJson<T>(
  create: ClaudeCreate,
  req: {
    system: string;
    user: string;
    maxTokens: number;
    schema: Record<string, unknown>;
    timeoutMs: number;
    signal?: AbortSignal;
  },
): Promise<T | null> {
  const response = await create(
    {
      model: CLAUDE_MODEL,
      max_tokens: req.maxTokens,
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: { type: "json_schema", schema: req.schema } },
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    },
    { timeout: req.timeoutMs, signal: req.signal },
  );
  if (response.stop_reason !== "end_turn") return null;
  const text = response.content.map((block) => block.text ?? "").join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function callClaudeText(
  create: ClaudeCreate,
  req: { system: string; user: string; maxTokens: number; timeoutMs: number; signal?: AbortSignal },
): Promise<string | null> {
  const response = await create(
    {
      model: CLAUDE_MODEL,
      max_tokens: req.maxTokens,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system: req.system,
      messages: [{ role: "user", content: req.user }],
    },
    { timeout: req.timeoutMs, signal: req.signal },
  );
  if (response.stop_reason !== "end_turn") return null;
  return response.content.map((block) => block.text ?? "").join("");
}
