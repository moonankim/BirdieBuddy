import { createClaudeCreate, type ClaudeCreate } from "./claude.ts";
import { callJev } from "./jev.ts";

export type AiDeps = {
  jevKey: string | undefined;
  claudeKey: string | undefined;
  callJev: typeof callJev;
  claudeCreate: (apiKey: string) => ClaudeCreate;
  now: () => number;
  log: (line: string) => void;
};

// 호출할 때마다 키를 읽는다. import 시점에는 Deno.env를 건드리지 않는다.
export function envDeps(): AiDeps {
  return {
    jevKey: Deno.env.get("TYPESAFE_API_KEY"),
    claudeKey: Deno.env.get("ANTHROPIC_API_KEY"),
    callJev,
    claudeCreate: createClaudeCreate,
    now: Date.now,
    log: console.log,
  };
}
