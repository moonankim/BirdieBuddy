// 회귀 스크립트(문환P_plan 6.8). 사용법: regress.ts <fallback|rooms|full> [--data=<dir>] [--validate]
// fallback은 키를 읽지 않는다(--allow-env 없이 실행). rooms·full은 유료 호출이다.
import { CATEGORIES, FLAG_THRESHOLD, JEV_CONTEXT, type FilterCategory } from "../../../supabase/functions/_shared/ai/categories.ts";
import { CLAUDE_MODEL, createClaudeCreate } from "../../../supabase/functions/_shared/ai/claude.ts";
import { clusterQuestions } from "../../../supabase/functions/_shared/ai/cluster.ts";
import { decide, toQuality } from "../../../supabase/functions/_shared/ai/decide.ts";
import { type AiDeps, envDeps } from "../../../supabase/functions/_shared/ai/deps.ts";
import { callJev, JevError } from "../../../supabase/functions/_shared/ai/jev.ts";
import { KEYWORDS } from "../../../supabase/functions/_shared/ai/keywords.ts";
import { moderateAndScore } from "../../../supabase/functions/_shared/ai/moderate.ts";
import { buildSummaryRequest, summarize } from "../../../supabase/functions/_shared/ai/summarize.ts";

type Verdict = "pass" | "suggest" | "block";
type ModRow = {
  id: number;
  text: string;
  group: "quality" | "filter" | "trap";
  expected_verdict: Verdict;
  category: string;
  quality_tier: "greeting" | "vague" | "general" | "specific" | null;
};
type EvalRow = { text: string; category: string };
type InfRow = { text: string; expected_verdict: Verdict; category: string };
type DemoRow = InfRow & { disabledFilters: string[] };
type Room = { messages: { id: number; nickname: string; text: string }[] };

const mode = Deno.args.find((a) => !a.startsWith("--"));
const dataUrl = (() => {
  const arg = Deno.args.find((a) => a.startsWith("--data="))?.slice("--data=".length);
  // 상대 경로는 현재 작업 디렉터리 기준이다(절대 경로도 그대로 풀린다).
  return arg ? new URL(arg.replace(/\/?$/, "/"), `file://${Deno.cwd()}/`) : new URL("./data/", import.meta.url);
})();
const validate = Deno.args.includes("--validate");
const signal = new AbortController().signal;
const NO_KEY_LOG = JSON.stringify({ event: "ai_fallback", reason: "no_key" });
const INFLUENCER_DISABLED = ["profanity", "belittling", "appearance"];

const mdLines: string[] = [];
const out = (line = "") => {
  console.log(line);
  mdLines.push(line);
};

async function loadJson<T>(name: string): Promise<T> {
  return JSON.parse(await Deno.readTextFile(new URL(name, dataUrl)));
}

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const fmt = (n: number) => (Number.isNaN(n) ? "-" : String(Math.round(n * 10) / 10));
const cut = (s: string, n = 40) => ([...s].length > n ? [...s].slice(0, n).join("") + "…" : s);

// 키워드 문장·시험 행의 기대 판정. 선택 항목은 suggest, 항상 차단 항목은 block이다.
const verdictOfCategory = (category: string): Verdict =>
  category === "none" ? "pass" : CATEGORIES[category as FilterCategory].scope === "optional" ? "suggest" : "block";
const evalExpected = (category: string): Verdict =>
  category === "none" ? "pass" : ["profanity", "belittling", "appearance"].includes(category) ? "suggest" : "block";

async function pool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

function requireKeyedDeps(logs: string[]): AiDeps {
  const deps = { ...envDeps(), log: (line: string) => logs.push(line) };
  if (!deps.jevKey || !deps.claudeKey) {
    console.log("키가 없다: --env-file과 --allow-env로 실행해야 한다");
    Deno.exit(1);
  }
  return deps;
}

// moderateAndScore 구간마다 호출한다. ai_fallback이 한 줄이라도 있으면 그 실행은 무효이므로 즉시 종료한다.
function assertNoFallback(section: string, lines: string[]) {
  for (const line of lines) {
    if (!line.includes("ai_fallback")) continue;
    let reason = "unknown";
    try {
      reason = String(JSON.parse(line).reason);
    } catch { /* 형식이 다르면 unknown */ }
    console.log(`ai_fallback 발생(실행 무효): 구간=${section}, reason=${reason}`);
    Deno.exit(1);
  }
}

async function writeResults(name: string, data: unknown) {
  const dir = new URL("./results/", import.meta.url);
  await Deno.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await Deno.writeTextFile(new URL(`${name}-${stamp}.json`, dir), JSON.stringify(data, null, 2));
  await Deno.writeTextFile(new URL(`${name}-${stamp}.md`, dir), mdLines.join("\n") + "\n");
  console.log(`결과 파일: results/${name}-${stamp}.{json,md}`);
}

// ---------------------------------------------------------------- fallback
async function runFallback() {
  const logs: string[] = [];
  // 키를 읽지 않는다. envDeps()를 부르지 않고 키 없는 deps를 직접 만든다.
  const deps: AiDeps = {
    jevKey: undefined,
    claudeKey: undefined,
    callJev,
    claudeCreate: createClaudeCreate,
    now: Date.now,
    log: (line) => logs.push(line),
  };
  const rows = await loadJson<ModRow[]>("moderation-test-set.json");
  const quality = rows.filter((r) => r.group === "quality");
  const trapPass = rows.filter((r) => r.group === "trap" && r.expected_verdict === "pass");
  const keywordCases = Object.entries(KEYWORDS).flatMap(([category, words]) =>
    (words ?? []).map((word) => ({ id: word, text: `이거 ${word} 맞죠`, category }))
  );

  let calls = 0;
  let allFixed = true;
  const run = async (text: string) => {
    calls++;
    const r = await moderateAndScore({ body: text, disabledFilters: [], signal }, deps);
    if (r.passesAllFilters !== false || r.quality !== 50 || r.rewrite !== null) allFixed = false;
    return r;
  };

  out(`# 폴백 모드 결과 (${new Date().toISOString()})`);
  const fp: Record<string, unknown[]> = {};
  for (const [name, set] of [["quality", quality], ["trap(pass 기대)", trapPass]] as const) {
    const bad = [];
    for (const row of set) {
      const r = await run(row.text);
      if (r.verdict !== "pass") bad.push({ id: row.id, text: row.text, verdict: r.verdict, category: r.category });
    }
    fp[name] = bad;
    out(`\n## ${name}: ${set.length}문장, 오탐 ${bad.length}건`);
    for (const b of bad) out(`- #${b.id} ${b.verdict}/${b.category}: ${cut(b.text, 70)}`);
  }

  const keywordResults = [];
  let keywordMismatch = 0;
  for (const c of keywordCases) {
    const r = await run(c.text);
    const expected = verdictOfCategory(c.category);
    const ok = r.verdict === expected && r.category === c.category;
    if (!ok) keywordMismatch++;
    keywordResults.push({ word: c.id, expectedCategory: c.category, verdict: r.verdict, category: r.category, ok });
  }
  out(`\n## 금칙어 문장 ${keywordCases.length}개 (기대 불일치 ${keywordMismatch}건)`);
  for (const k of keywordResults) out(`- ${k.word}: ${k.verdict}/${k.category} ${k.ok ? "OK" : "불일치"}`);

  const badLogs = logs.filter((l) => l !== NO_KEY_LOG);
  out(`\n## 고정값 검증`);
  out(`- 모든 결과 passesAllFilters=false, quality=50, rewrite=null: ${allFixed}`);
  out(`- 로그 ${logs.length}줄 / 호출 ${calls}회, no_key 외 로그 ${badLogs.length}줄`);

  await writeResults("fallback", { fp, keywordResults, allFixed, logLines: logs.length, calls, badLogs: badLogs.length });
  if (!allFixed || badLogs.length > 0 || logs.length !== calls || fp["quality"].length > 0 || keywordMismatch > 0) Deno.exit(1);
}

// ---------------------------------------------------------------- rooms
async function runRooms() {
  const logs: string[] = [];
  const deps = requireKeyedDeps(logs);
  const rooms = await loadJson<Room[]>("rooms.json");
  const picked: Room["messages"] = [];
  let chars = 0;
  for (const m of [...rooms[0].messages].sort((a, b) => b.id - a.id)) {
    const len = [...m.text].length;
    if (picked.length >= 100 || chars + len > 20000) break;
    picked.push(m);
    chars += len;
  }
  picked.sort((a, b) => a.id - b.id);
  const messages = picked.map((m) => ({ id: String(m.id), body: m.text, sender: m.nickname }));
  out(`# rooms 모드 (${new Date().toISOString()})`);
  out(`입력 ${messages.length}건, ${chars}자`);

  const result: Record<string, unknown> = {};
  const started = performance.now();
  try {
    const clusters = await clusterQuestions({ messages, signal }, deps);
    const ms = Math.round(performance.now() - started);
    out(`\n## 묶기: ${clusters.length}묶음, ${ms}ms`);
    for (const c of clusters) out(`- ${c.messageIds.length}명, 대표 질문 ${[...c.representative].length}자`);
    // 대표 질문과 요약 원문은 품질 점검용으로 결과 .json에만 남긴다(stdout·.md에는 쓰지 않는다).
    result.cluster = {
      ms,
      groups: clusters.map((c) => ({ size: c.messageIds.length, len: [...c.representative].length, representative: c.representative, messageIds: c.messageIds })),
    };
  } catch (e) {
    out(`\n## 묶기 실패: ${safeMessage(e, "cluster_failed")}`);
    result.cluster = { error: safeMessage(e, "cluster_failed") };
  }

  const off: { ms: number; len: number; text: string }[] = [];
  const on: { ms: number; len: number; text: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    try {
      const text = await summarize({ messages, signal }, deps);
      off.push({ ms: Math.round(performance.now() - t), len: [...text].length, text });
    } catch (e) {
      out(`- 사고 끔 ${i + 1}회 실패: ${safeMessage(e, "summarize_failed")}`);
    }
  }
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    try {
      const req = buildSummaryRequest(messages);
      const response = await deps.claudeCreate(deps.claudeKey!)(
        {
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          thinking: { type: "adaptive" },
          output_config: { effort: "low" },
          system: req.system,
          messages: [{ role: "user", content: req.user }],
        },
        { timeout: 20000 },
      );
      const text = response.content.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
      on.push({ ms: Math.round(performance.now() - t), len: [...text].length, text });
    } catch {
      out(`- 사고 켬 ${i + 1}회 실패: provider_error`);
    }
  }
  for (const [name, runs] of [["사고 끔", off], ["사고 켬", on]] as const) {
    out(`\n## 요약 ${name}: 성공 ${runs.length}/3`);
    runs.forEach((r, i) => out(`- ${i + 1}회: ${r.ms}ms, ${r.len}자`));
    out(`- 중앙값: ${fmt(median(runs.map((r) => r.ms)))}ms, ${fmt(median(runs.map((r) => r.len)))}자`);
  }
  result.summaryOff = off;
  result.summaryOn = on;
  await writeResults("rooms", result);
}

// 우리 모듈이 만든 오류만 메시지를 보인다. SDK 오류 메시지는 출력하지 않는다.
function safeMessage(e: unknown, prefix: string): string {
  return e instanceof Error && e.message.startsWith(prefix) ? e.message : "provider_error";
}

// ---------------------------------------------------------------- full
type Judged = { verdict: Verdict; category: FilterCategory | null; scores: Record<FilterCategory, number>; quality: number; ms: number };

async function judge(text: string, deps: AiDeps): Promise<Judged> {
  const t = performance.now();
  try {
    const r = await callJev({ apiKey: deps.jevKey!, message: text, context: JEV_CONTEXT.user, timeoutMs: 4000, signal });
    const d = decide(r.scores, []);
    return { verdict: d.verdict, category: d.category, scores: r.scores, quality: toQuality(r.qualityScore), ms: performance.now() - t };
  } catch (e) {
    // 판정 호출이 하나라도 실패하면 그 실행은 무효다. 키와 SDK 메시지는 출력하지 않는다.
    console.log(`판정 호출 실패(실행 무효): ${e instanceof JevError ? e.reason : "provider_error"}`);
    Deno.exit(1);
  }
}

const violations = (s: Record<FilterCategory, number>) =>
  Object.entries(s).filter(([, v]) => v >= FLAG_THRESHOLD).map(([k, v]) => `${k}:${v.toFixed(2)}`).join(",") || "-";

async function runFull() {
  const logs: string[] = [];
  const deps = requireKeyedDeps(logs);
  const rows = await loadJson<ModRow[]>("moderation-test-set.json");
  out(`# full 모드 (${new Date().toISOString()})`);

  // 첫 호출은 지연 측정에서 빼려고 먼저 혼자 실행한다.
  const first = await judge(rows[0].text, deps);
  const rest = await pool(rows.slice(1), 3, (r) => judge(r.text, deps));
  const judged = [first, ...rest];

  const groupStat: Record<string, { n: number; ok: number }> = {};
  const matrix: Record<string, number> = {};
  const mismatches: string[] = [];
  let blockToPass = 0;
  // 선택 필터를 모두 끈 설정(인플루언서·방 주인 설정)에서의 실효 block→pass. 같은 점수에서 계산하므로 추가 호출이 없다.
  const effectiveBlockToPass: Record<string, number> = {};
  rows.forEach((row, i) => {
    const j = judged[i];
    const g = (groupStat[row.group] ??= { n: 0, ok: 0 });
    g.n++;
    matrix[`${row.expected_verdict}→${j.verdict}`] = (matrix[`${row.expected_verdict}→${j.verdict}`] ?? 0) + 1;
    if (row.expected_verdict === j.verdict) g.ok++;
    else {
      mismatches.push(`- #${row.id} [${row.group}] 기대 ${row.expected_verdict}/${row.category} 실제 ${j.verdict}/${j.category ?? "none"} (${violations(j.scores)}) ${cut(row.text)}`);
    }
    if (row.expected_verdict === "block" && j.verdict === "pass") blockToPass++;
    if (row.expected_verdict === "block" && decide(j.scores, INFLUENCER_DISABLED).verdict === "pass") {
      effectiveBlockToPass[row.category] = (effectiveBlockToPass[row.category] ?? 0) + 1;
    }
  });
  const effectiveTotal = Object.values(effectiveBlockToPass).reduce((a, b) => a + b, 0);
  const total = Object.values(groupStat).reduce((a, g) => a + g.ok, 0);
  out(`\n## 판정 일치율: ${total}/${rows.length} (${fmt((total / rows.length) * 100)}%)`);
  for (const [g, s] of Object.entries(groupStat)) out(`- ${g}: ${s.ok}/${s.n}`);
  out(`\n기대→실제 집계`);
  for (const [k, v] of Object.entries(matrix).sort()) out(`- ${k}: ${v}`);
  out(`\n항상 차단 항목 block→pass: ${blockToPass}건`);
  out(`선택 필터 3개를 끈 설정 기준 실효 block→pass: ${effectiveTotal}건 / block 기대 ${rows.filter((r) => r.expected_verdict === "block").length}건`);
  for (const [c, n] of Object.entries(effectiveBlockToPass).sort()) out(`- ${c}: ${n}`);
  out(`\n불일치 ${mismatches.length}건`);
  mismatches.forEach(out);

  out(`\n## 품질 (quality_tier별 평균/최소/최대)`);
  const tier = (t: string) => rows.flatMap((r, i) => (r.quality_tier === t ? [judged[i].quality] : []));
  for (const t of ["greeting", "vague", "general", "specific"]) {
    const q = tier(t);
    out(`- ${t}: n=${q.length} 평균 ${fmt(mean(q))} 최소 ${Math.min(...q)} 최대 ${Math.max(...q)}`);
  }
  const specific = tier("specific");
  const greetingMean = mean(tier("greeting"));
  out(`- A-03: specific 평균 > greeting 평균 ${mean(specific) > greetingMean}, specific 최솟값 > greeting 평균 ${Math.min(...specific) > greetingMean}`);

  // 응답 시간: 첫 호출 제외, suggest 제외.
  const fast = rows.flatMap((_, i) => (i > 0 && judged[i].verdict !== "suggest" ? [judged[i].ms] : []));
  out(`\n## 응답 시간 (pass·block 판정, 첫 호출 제외): 중앙값 ${fmt(median(fast))}ms, 최대 ${fmt(Math.max(...fast))}ms (기준 2000ms)`);

  // 수정 문장 30건: suggest 기대 행을 id 순으로 정렬해 i·n/30번째(내림)를 고른다.
  const suggestRows = rows.filter((r) => r.expected_verdict === "suggest").sort((a, b) => a.id - b.id);
  const sample = Array.from({ length: 30 }, (_, i) => suggestRows[Math.floor((i * suggestRows.length) / 30)]);
  const rewriteLogs: string[] = [];
  const rewriteDeps = { ...deps, log: (line: string) => rewriteLogs.push(line) };
  // 표본마다 deps를 감싸 수정 문장 실패 이유를 코드로만 남긴다. 본문·수정 문장은 코드에 넣지 않는다.
  const trace = { claudeCalled: false, claudeError: false, stop: null as string | null, text: "", jevCalls: 0, recheckError: false, recheckScores: null as Record<FilterCategory, number> | null };
  const resetTrace = () => Object.assign(trace, { claudeCalled: false, claudeError: false, stop: null, text: "", jevCalls: 0, recheckError: false, recheckScores: null });
  const tracedDeps: AiDeps = {
    ...rewriteDeps,
    callJev: async (opts) => {
      const nth = ++trace.jevCalls;
      try {
        const r = await rewriteDeps.callJev(opts);
        if (nth === 2) trace.recheckScores = r.scores;
        return r;
      } catch (e) {
        if (nth === 2) trace.recheckError = true;
        throw e;
      }
    },
    claudeCreate: (key) => {
      const inner = rewriteDeps.claudeCreate(key);
      return async (body, options) => {
        trace.claudeCalled = true;
        try {
          const r = await inner(body, options);
          trace.stop = r.stop_reason;
          trace.text = r.content.map((b) => b.text ?? "").join("");
          return r;
        } catch (e) {
          trace.claudeError = true;
          throw e;
        }
      };
    },
  };
  // moderate.ts의 rewriteAndRecheck 분기를 같은 순서로 따라가 이유 코드를 낸다.
  const rewriteReason = (verdict: Verdict, rewrite: string | null): string => {
    if (verdict !== "suggest") return "not_suggest";
    if (rewrite !== null) return "ok";
    if (!trace.claudeCalled) return "skipped_no_time";
    if (trace.claudeError) return "claude_error";
    if (trace.stop !== "end_turn") return "claude_no_result";
    let parsed: { rewritten?: unknown } | null = null;
    try {
      parsed = JSON.parse(trace.text);
    } catch { /* 파싱 실패는 결과 없음 */ }
    if (parsed === null) return "claude_no_result";
    const text = typeof parsed.rewritten === "string" ? parsed.rewritten.trim() : "";
    if (text === "") return "empty";
    if ([...text].length > 2000) return "too_long";
    if (trace.jevCalls < 2) return "skipped_no_time";
    if (trace.recheckError) return "recheck_failed";
    if (trace.recheckScores) {
      const hit = Object.entries(trace.recheckScores).filter(([, v]) => v >= FLAG_THRESHOLD).map(([k]) => k);
      if (hit.length > 0) return `recheck_violation:${hit.join(",")}`;
    }
    return "recheck_failed";
  };
  let suggestMax = 0;
  let actualSuggest = 0;
  let rewritten = 0;
  // 표본별 결과(id·판정·rewrite 유무·ms)는 진단용으로 결과 .json에만 남긴다. 문장은 넣지 않는다.
  const rewriteSamples: { id: number; verdict: Verdict; rewrite: boolean; reason: string; ms: number }[] = [];
  for (const row of sample) {
    resetTrace();
    const t = performance.now();
    const r = await moderateAndScore({ body: row.text, disabledFilters: [], signal }, tracedDeps);
    const ms = performance.now() - t;
    rewriteSamples.push({ id: row.id, verdict: r.verdict, rewrite: r.rewrite !== null, reason: rewriteReason(r.verdict, r.rewrite), ms: Math.round(ms) });
    if (r.verdict === "suggest") {
      actualSuggest++;
      suggestMax = Math.max(suggestMax, ms);
      if (r.rewrite !== null) rewritten++;
    }
  }
  assertNoFallback("수정 문장 표본", rewriteLogs);
  out(`\n## 수정 문장 표본 ${sample.length}건`);
  out(`- 실제 suggest ${actualSuggest}건 중 rewrite 있음 ${rewritten}건 (${fmt(actualSuggest ? (rewritten / actualSuggest) * 100 : 0)}%, 기준 80%)`);
  const reasonCounts: Record<string, number> = {};
  for (const s of rewriteSamples) reasonCounts[s.reason] = (reasonCounts[s.reason] ?? 0) + 1;
  out(`- 이유 코드: ${Object.entries(reasonCounts).sort().map(([k, v]) => `${k}=${v}`).join(", ")}`);
  for (const s of rewriteSamples) if (s.reason !== "ok" && s.reason !== "not_suggest") out(`  - #${s.id}: ${s.reason}`);
  out(`- suggest 전체 경로 최대 ${fmt(suggestMax)}ms (기준 8000ms)`);
  out(`- ai_fallback 로그 0줄`);

  const influencer = await loadJson<InfRow[]>("influencer-message-set.json");
  out(`\n## 인플루언서 세트 (${influencer.length}문장, disabledFilters=${INFLUENCER_DISABLED.join(",")})`);
  let normalFp = 0;
  const infResults = [];
  for (const row of influencer) {
    const r = await moderateAndScore({ body: row.text, disabledFilters: INFLUENCER_DISABLED, senderType: "influencer", signal }, deps);
    if (row.expected_verdict === "pass" && r.verdict !== "pass") normalFp++;
    infResults.push({ expected: row.expected_verdict, verdict: r.verdict, category: r.category, text: row.text });
    if (row.expected_verdict !== "pass" || r.verdict !== "pass") {
      out(`- 기대 ${row.expected_verdict}/${row.category} 실제 ${r.verdict}/${r.category ?? "none"} ${cut(row.text)}`);
    }
  }
  assertNoFallback("인플루언서 세트", logs);
  out(`- 정상 문장 오탐 ${normalFp}건`);

  const demo = await loadJson<DemoRow[]>("demo-messages.json");
  out(`\n## 시연 세트 (${demo.length}문장)`);
  const demoResults = [];
  for (const row of demo) {
    const r = await moderateAndScore({ body: row.text, disabledFilters: row.disabledFilters, signal }, deps);
    const verdictOk = r.verdict === row.expected_verdict && (r.category ?? "none") === row.category;
    const passesOk = row.disabledFilters.length === 0 || r.passesAllFilters === false;
    demoResults.push({ text: row.text, verdict: r.verdict, category: r.category, passesAllFilters: r.passesAllFilters, ok: verdictOk && passesOk });
    out(`- ${verdictOk && passesOk ? "OK" : "불일치"}: 기대 ${row.expected_verdict}/${row.category} 실제 ${r.verdict}/${r.category ?? "none"} passesAllFilters=${r.passesAllFilters} ${cut(row.text)}`);
  }

  assertNoFallback("시연 세트", logs);
  const validateResults: { text: string; expected: Verdict; expectedCategory: string; verdict: Verdict; category: FilterCategory | null; scores: Record<FilterCategory, number> }[] = [];
  if (validate) {
    const evalRows = await loadJson<EvalRow[]>("filter-eval-set.json");
    const ev = await pool(evalRows, 3, (r) => judge(r.text, deps));
    let ok = 0;
    out(`\n## 검증 세트 filter-eval-set (${evalRows.length}문장)`);
    evalRows.forEach((r, i) => {
      const expected = evalExpected(r.category);
      if (ev[i].verdict === expected) {
        ok++;
        // 판정이 맞아도 다른 항목으로 막혔으면 그 항목 설명이 대신 잡은 것이라 따로 보인다.
        if (expected === "block" && ev[i].category !== r.category) out(`- 판정 일치·항목 다름: 기대 ${r.category} 실제 ${ev[i].category ?? "none"} (${violations(ev[i].scores)}) ${cut(r.text)}`);
      } else out(`- 기대 ${expected}/${r.category} 실제 ${ev[i].verdict}/${ev[i].category ?? "none"} (${violations(ev[i].scores)}) ${cut(r.text)}`);
      validateResults.push({ text: r.text, expected, expectedCategory: r.category, verdict: ev[i].verdict, category: ev[i].category, scores: ev[i].scores });
    });
    out(`- 일치 ${ok}/${evalRows.length}`);
  }

  await writeResults("full", { matrix, groupStat, blockToPass, effectiveBlockToPass, effectiveTotal, mismatches: mismatches.length, rewriteSamples, infResults, demoResults, validateResults });
}

if (mode === "fallback") await runFallback();
else if (mode === "rooms") await runRooms();
else if (mode === "full") await runFull();
else {
  console.log("사용법: regress.ts <fallback|rooms|full> [--data=<dir>] [--validate]");
  Deno.exit(1);
}
