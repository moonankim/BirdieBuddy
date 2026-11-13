// Typesafe Jev와 Claude Haiku 5.5의 같은 메시지 판정 비교 (속도·토큰·정확도). 유료 호출이다(1회 실행 약 $0.015).
// 두 모델 모두 같은 10개 항목 질문과 품질 질문을 받고, 판정은 같은 decide()로 낸다.
// 우회 광고 정규화(evasionHits)·수정 문장 생성은 양쪽 모두 빼고 모델 판정만 비교한다.
// 레포 package.json 의존성 설치를 피하려고 설정 자동 감지를 끄고 실행한다:
//   DENO_NO_PACKAGE_JSON=1 deno run --no-config --allow-net=api.typesafe.ai,api.anthropic.com,registry.npmjs.org \
//     --allow-env --allow-read --allow-write=lib/ai/tests/results --env-file=lib/ai/tests/.env lib/ai/tests/compare-jev-claude.ts
// 단가: Claude Haiku 5.5 입력 $0.10·출력 $0.50(100만 토큰당, 공식). Jev 입력 $0.042(제3자 가격 자료, 출력 무료)이며
// Jev 호출당 입력 토큰은 응답에 없어 사용량 기록 평균 996을 쓴다.
import Anthropic from "npm:@anthropic-ai/sdk@1.6.0";
import { buildJevRequest, JEV_URL, parseJevAnswers } from "../../../supabase/functions/_shared/ai/jev.ts";
import { decide } from "../../../supabase/functions/_shared/ai/decide.ts";
import {
  CATEGORIES,
  CATEGORY_KEYS,
  type FilterCategory,
  JEV_CONTEXT,
  QUALITY_QUESTION,
} from "../../../supabase/functions/_shared/ai/categories.ts";

const HAIKU_IN = 0.10 / 1e6, HAIKU_OUT = 0.50 / 1e6, JEV_IN = 0.042 / 1e6;
const jevKey = Deno.env.get("TYPESAFE_API_KEY")!;
const claude = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY")!, maxRetries: 0 });

type Item = { text: string; expected: string; disabled: string[]; source: string; tier?: string };
const demo = JSON.parse(await Deno.readTextFile("lib/ai/tests/data/demo-messages.json"));
const set = JSON.parse(await Deno.readTextFile("lib/ai/tests/data/moderation-test-set.json"));
const items: Item[] = demo.map((d: any) => ({ text: d.text, expected: d.expected_verdict, disabled: d.disabledFilters ?? [], source: "demo" }));
for (const [verdict, n] of [["pass", 15], ["suggest", 12], ["block", 16]] as const) {
  const pool = set.filter((x: any) => x.expected_verdict === verdict).sort((a: any, b: any) => a.id - b.id);
  for (let i = 0; i < n; i++) {
    const x = pool[Math.floor((i * pool.length) / n)];
    items.push({ text: x.text, expected: x.expected_verdict, disabled: [], source: `set#${x.id}`, tier: x.quality_tier });
  }
}

async function runJev(text: string) {
  const t = performance.now();
  const res = await fetch(JEV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jevKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildJevRequest(text, JEV_CONTEXT.user, "user")),
  });
  const raw = await res.json();
  const ms = performance.now() - t;
  const parsed = parseJevAnswers(raw);
  return { ms, scores: parsed.scores, quality: parsed.qualityScore };
}

const schema = {
  type: "object",
  properties: {
    ...Object.fromEntries(CATEGORY_KEYS.map((k) => [k, { type: "number" }])),
    quality: { type: "integer" },
  },
  required: [...CATEGORY_KEYS, "quality"],
  additionalProperties: false,
};
const system =
  "너는 스크린골프 인플루언서 팬 채팅방의 메시지 안전 판정기다. 각 항목마다 메시지에 그 내용이 포함되어 있을 확률을 0에서 1 사이 숫자로, quality는 아래 기준의 번호(0~4 정수)로 JSON만 답한다.";
function claudeUser(text: string): string {
  const qs = CATEGORY_KEYS.map((k) => `- ${k}: 이 메시지에 다음 내용이 포함되어 있는가: ${CATEGORIES[k].description}`).join("\n");
  const criteria = QUALITY_QUESTION.criteria.map((c, i) => `${i}: ${c}`).join("\n");
  return `상황: ${JEV_CONTEXT.user}\n메시지: ${text}\n\n항목:\n${qs}\n\nquality: ${QUALITY_QUESTION.instructions}\n${criteria}`;
}
async function runClaude(text: string) {
  const t = performance.now();
  const r: any = await claude.messages.create({
    model: "claude-haiku-5-5",
    max_tokens: 400,
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content: claudeUser(text) }],
  } as any);
  const ms = performance.now() - t;
  const out = JSON.parse(r.content.map((b: any) => b.text ?? "").join(""));
  const scores = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, Math.min(1, Math.max(0, Number(out[k])))])) as Record<FilterCategory, number>;
  return { ms, scores, quality: Math.min(4, Math.max(0, Number(out.quality))), inTok: r.usage.input_tokens, outTok: r.usage.output_tokens, stop: r.stop_reason };
}

// 워밍업(통계 제외)
await runJev("안녕하세요");
await runClaude("안녕하세요");

const rows: any[] = [];
for (const [i, it] of items.entries()) {
  const order = i % 2 === 0 ? ["jev", "claude"] : ["claude", "jev"];
  const r: any = {};
  for (const m of order) r[m] = m === "jev" ? await runJev(it.text) : await runClaude(it.text);
  const jv = decide(r.jev.scores, it.disabled), cv = decide(r.claude.scores, it.disabled);
  rows.push({ ...it, jev: { ms: r.jev.ms, verdict: jv.verdict, category: jv.category, quality: r.jev.quality }, claude: { ms: r.claude.ms, verdict: cv.verdict, category: cv.category, quality: r.claude.quality, inTok: r.claude.inTok, outTok: r.claude.outTok, stop: r.claude.stop } });
  console.log(`${i + 1}/${items.length} exp=${it.expected} jev=${jv.verdict}(${Math.round(r.jev.ms)}ms) claude=${cv.verdict}(${Math.round(r.claude.ms)}ms)`);
}
await Deno.mkdir("lib/ai/tests/results", { recursive: true });
await Deno.writeTextFile("lib/ai/tests/results/compare-jev-claude.json", JSON.stringify(rows, null, 2));

const stat = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))]; return { median: Math.round(q(0.5)), p90: Math.round(q(0.9)), max: Math.round(s[s.length - 1]), mean: Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) }; };
const acc = (m: "jev" | "claude", f: (r: any) => boolean = () => true) => { const sub = rows.filter(f); return `${sub.filter((r) => r[m].verdict === r.expected).length}/${sub.length}`; };
const missBlock = (m: "jev" | "claude") => rows.filter((r) => r.expected === "block" && r[m].verdict === "pass").length;
const inTok = rows.map((r) => r.claude.inTok), outTok = rows.map((r) => r.claude.outTok);
const avgIn = inTok.reduce((a, b) => a + b, 0) / rows.length, avgOut = outTok.reduce((a, b) => a + b, 0) / rows.length;
console.log(JSON.stringify({
  n: rows.length,
  latencyMs: { jev: stat(rows.map((r) => r.jev.ms)), claude: stat(rows.map((r) => r.claude.ms)) },
  accuracy: {
    jev: { all: acc("jev"), pass: acc("jev", (r) => r.expected === "pass"), suggest: acc("jev", (r) => r.expected === "suggest"), block: acc("jev", (r) => r.expected === "block"), demo: acc("jev", (r) => r.source === "demo"), blockMissedAsPass: missBlock("jev") },
    claude: { all: acc("claude"), pass: acc("claude", (r) => r.expected === "pass"), suggest: acc("claude", (r) => r.expected === "suggest"), block: acc("claude", (r) => r.expected === "block"), demo: acc("claude", (r) => r.source === "demo"), blockMissedAsPass: missBlock("claude") },
  },
  claudeTokensPerCall: { input: Math.round(avgIn), output: Math.round(avgOut) },
  costPerCallUsd: { claudeHaiku: +(avgIn * HAIKU_IN + avgOut * HAIKU_OUT).toFixed(7), jevAt996InputTokens: +(996 * JEV_IN).toFixed(7) },
  qualityByTier: Object.fromEntries([...new Set(rows.map((r) => r.tier).filter(Boolean))].map((t) => { const sub = rows.filter((r) => r.tier === t); const avg = (m: string) => +(sub.reduce((a, r) => a + r[m].quality, 0) / sub.length).toFixed(2); return [t, { n: sub.length, jev: avg("jev"), claude: avg("claude") }]; })),
}, null, 2));
