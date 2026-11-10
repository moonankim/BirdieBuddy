진행 상태: 표준 · 고위험(공개 계약: `moderateAndScore`) · plan 미승인, 구현 보류(사용자 지시로 플랜만 갱신) · 구현 전(0/5) · 브랜치 `feature/munhwan-ai`

# `lib/ai` 메시지 필터 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시험 코드의 필터 로직을 `lib/ai/`의 서버 모듈로 옮겨 `moderateAndScore`, `suggestRewrite`, 품질 점수, 금칙어 폴백을 제공하고, 시험 화면이 그 함수를 호출하게 한다.

**Architecture:** Jev는 항목별 확률과 품질 점수만 내고, 판정은 순수 함수 `decideFromScores`가 정한다. Jev가 실패하면 금칙어가 같은 함수로 판정한다. 수정 문장은 판정과 분리된 `suggestRewrite`가 Haiku로 만들고 Jev로 재검사한다.

**Tech Stack:** TypeScript(Node 22.18+ 직접 실행), `node:test`, `@anthropic-ai/sdk` 1.6.0, TypeSafe Jev(`fetch`).

**Spec:** `docs/superpowers/specs/2026-11-09-birdiebuddy-ai-design.md` (3-1절, 4절)

## 가정

- 이 작업의 커밋은 사용자가 plan 승인 때 허용한 경우에만 실행한다.
- `import ... with { type: "json" }`과 `.ts` 확장자 import가 Next.js 번들에서 동작하는지는 F-01이 없어 확인할 수 없다. 통합 때 확인한다.
- `lib/ai/tests/.env`는 사용자가 다시 복사한다. Task 5 이전에 필요하다.

## 범위 밖

요약·묶기의 `lib/ai` 이전(스텁만), 카드 이미지(A-06), Next.js 골격, 실제 API Route와 채팅 화면(B-06, F-06), `architecture.md`와 다른 담당자의 plan 파일 수정, 시연 문장 확정(A-08의 시연 부분).

## UI 상태 (시험 화면 `lib/ai/tests/index.html`)

- 로딩: 기존 "처리 중…" 유지. 수정 문장은 "작성 중…".
- 빈 입력: 기존 동작 유지.
- 에러: 기존 `.error` 표시 유지. 수정 문장 `null`이나 실패는 "수정 문장을 만들지 못했어요."
- 권한 없음: 로컬 전용 시험 화면이라 해당 없음.

## Global Constraints

- 차단 여부는 코드 규칙이 정한다. 항상 차단 항목은 `disabledFilters`에 있어도 무시하지 않는다.
- 기준값은 전 항목 `0.5` 이상을 위반으로 본다.
- Jev: `POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`, 모델 `jev-latest`, `state: {context, message}`.
- `context` 값: `스크린골프 인플루언서 팬 채팅방에서 유저가 인플루언서에게 보내려는 메시지`
- 항목 질문 형식: `이 메시지에 다음 내용이 포함되어 있는가: {설명}`. 항목 표시명, 구분, 설명은 Spec 4절 표의 문구를 그대로 쓴다.
- 품질 질문의 `instructions`, `criteria`는 Spec 4절 문구를 그대로 쓰고, `quality = score × 25`다.
- API 키는 서버 쪽에서만 읽고, 시험 서버는 `127.0.0.1`에만 바인딩한다.
- 최상위 `package.json`을 만들지 않는다. `.env`를 커밋하지 않는다.
- 최종 전체 브랜치 리뷰에는 CLAUDE.md의 위험 체크리스트를 전역 제약으로 넘긴다.

## Review Focus

- Jev가 200으로 응답했지만 `answers`에 항목이 없거나 값이 숫자가 아니면 금칙어 폴백으로 판정한다. (Task 2 테스트)
- Jev가 제한 시간을 넘기면 멈추지 않고 금칙어 폴백으로 응답한다. (Task 2 테스트)
- `disabledFilters`에 항상 차단 항목이나 없는 key가 들어와도 차단이 유지되고 오류가 없다. (Task 1 테스트)
- 공백뿐인 메시지는 외부 호출 없이 `pass`, `quality: 0`이다. (Task 2 테스트)
- Claude가 거절하거나 재검사가 실패하면 수정 문장 대신 `null`이다. (Task 3 테스트)

## 파일 구조

| 파일 | 책임 |
| --- | --- |
| `lib/ai/package.json`, `package-lock.json`, `.gitignore` | `lib/ai/tests/`에서 이동 |
| `lib/ai/tsconfig.json` | `lib/ai` 타입 검사 |
| `lib/ai/index.ts` | 공개 진입점, 요약·묶기 스텁 |
| `lib/ai/moderation/categories.ts` | 항목 정의, 타입 |
| `lib/ai/moderation/decide.ts` | 점수 → 판정 순수 함수 |
| `lib/ai/moderation/filter-templates.json` | 안내 문구 (`tests/data/`에서 이동) |
| `lib/ai/moderation/jev.ts` | Jev 호출 |
| `lib/ai/moderation/fallback.ts` | 금칙어 판정 |
| `lib/ai/moderation/moderate.ts` | `moderateAndScore` |
| `lib/ai/moderation/rewrite.ts` | `suggestRewrite` |
| `lib/ai/tests/unit/*.test.ts` | 단위 테스트 |
| `lib/ai/tests/run-moderation-set.ts` | 실제 API 시험 러너 |

---

### Task 1: 패키지 이동과 판정 규칙

**Files:**
- Move: `lib/ai/tests/package.json` → `lib/ai/package.json`, `lib/ai/tests/package-lock.json` → `lib/ai/package-lock.json`, `lib/ai/tests/.gitignore` → `lib/ai/.gitignore`, `lib/ai/tests/data/filter-templates.json` → `lib/ai/moderation/filter-templates.json`
- Modify: `lib/ai/tests/generate-templates.ts:65`
- Create: `lib/ai/tsconfig.json`, `lib/ai/moderation/categories.ts`, `lib/ai/moderation/decide.ts`
- Test: `lib/ai/tests/unit/decide.test.ts`

**Interfaces:**
- Produces:
  - `categories.ts`: `CATEGORIES`, `CATEGORY_KEYS`, `type CategoryKey`, `type Scope = "선택" | "항상 차단"`, `type Scores = Record<CategoryKey, number>`, `type Verdict = "pass" | "suggest" | "block"`, `type FlaggedItem = { key: string; label: string; scope: Scope; score: number }`
  - `decide.ts`: `decideFromScores(scores: Scores, disabledFilters: string[]): { verdict: Verdict; flagged: FlaggedItem[]; reason?: string; guide?: string | null }`

- [ ] **Step 1: 패키지를 옮기고 설정한다**

`git mv`로 위 파일을 옮긴 뒤 `lib/ai/package.json`의 scripts를 다음으로 바꾼다. `generate-templates.ts:65`의 저장 경로는 `../moderation/filter-templates.json`으로 바꾼다.

```json
{
  "start": "node --env-file-if-exists=tests/.env tests/server.ts",
  "test": "node --test \"tests/unit/*.test.ts\"",
  "typecheck": "tsc --noEmit",
  "eval": "node --env-file=tests/.env tests/run-moderation-set.ts"
}
```

`lib/ai/tsconfig.json`: `strict`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`, `resolveJsonModule`, `module: "nodenext"`, `target: "es2023"`, `types: ["node"]`, `include: ["*.ts", "moderation/**/*.ts", "tests/unit/**/*.ts", "tests/run-moderation-set.ts"]`. `tests/server.ts`는 SDK 내부 경로를 쓰므로 제외한다.

Run: `cd lib/ai && rm -rf tests/node_modules && npm install -D typescript@5 @types/node@22`
Expected: 설치 완료, `lib/ai/node_modules`가 git에 잡히지 않음 (`git check-ignore lib/ai/node_modules/x`)

- [ ] **Step 2: 실패하는 테스트를 쓴다**

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_KEYS, type Scores } from "../../moderation/categories.ts";
import { decideFromScores } from "../../moderation/decide.ts";

const scores = (overrides: Partial<Scores> = {}) =>
  ({ ...Object.fromEntries(CATEGORY_KEYS.map((key) => [key, 0])), ...overrides }) as Scores;

test("위반이 없으면 pass", () => {
  assert.deepEqual(decideFromScores(scores(), []), { verdict: "pass", flagged: [] });
});
test("선택 항목만 있으면 suggest, 사유와 안내 포함", () => {
  const result = decideFromScores(scores({ profanity: 0.9 }), []);
  assert.equal(result.verdict, "suggest");
  assert.ok(result.reason);
  assert.ok(result.guide);
});
test("항상 차단 항목이 있으면 block이고 먼저 온다", () => {
  const result = decideFromScores(scores({ profanity: 0.99, threat: 0.6 }), []);
  assert.equal(result.verdict, "block");
  assert.equal(result.flagged[0].key, "threat");
});
test("같은 구분 안에서는 확률이 높은 항목이 먼저 온다", () => {
  const result = decideFromScores(scores({ profanity: 0.6, hate: 0.9 }), []);
  assert.deepEqual(result.flagged.map((item) => item.key), ["hate", "profanity"]);
});
test("기준값 0.5는 포함, 0.49는 제외", () => {
  assert.equal(decideFromScores(scores({ profanity: 0.5 }), []).verdict, "suggest");
  assert.equal(decideFromScores(scores({ profanity: 0.49 }), []).verdict, "pass");
});
test("해제된 선택 항목은 무시한다", () => {
  assert.equal(decideFromScores(scores({ profanity: 0.9 }), ["profanity"]).verdict, "pass");
});
test("해제 목록에 항상 차단 항목이나 없는 key가 있어도 차단을 유지한다", () => {
  assert.equal(decideFromScores(scores({ threat: 0.9 }), ["threat", "unknown"]).verdict, "block");
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `cd lib/ai && npm test`
Expected: FAIL, 모듈을 찾을 수 없음

- [ ] **Step 4: `categories.ts`, `decide.ts`를 구현한다**

`CATEGORIES`는 Spec 4절 표를 옮긴다. 템플릿은 `import templates from "./filter-templates.json" with { type: "json" }`로 읽는다. 정렬은 항상 차단 우선, 그다음 확률 내림차순이다. 다른 곳의 `import`는 `.ts` 확장자를 붙인다.

- [ ] **Step 5: 통과를 확인한다**

Run: `cd lib/ai && npm test && npm run typecheck`
Expected: PASS, 타입 오류 없음

- [ ] **Step 6: 커밋한다**

```bash
git add lib/ai
git commit -m "feat(ai): 필터 판정 규칙과 lib/ai 패키지 구성 추가"
```

### Task 2: Jev 호출, 금칙어 폴백, `moderateAndScore`

**Files:**
- Create: `lib/ai/moderation/jev.ts`, `lib/ai/moderation/fallback.ts`, `lib/ai/moderation/moderate.ts`
- Test: `lib/ai/tests/unit/jev.test.ts`, `lib/ai/tests/unit/moderate.test.ts`

**Interfaces:**
- Consumes: Task 1의 `decideFromScores`, `CATEGORY_KEYS`, `Scores`, `Verdict`, `FlaggedItem`
- Produces:
  - `jev.ts`: `type Judgment = { scores: Scores; quality: number }`, `JEV_TIMEOUT_MS = 1500`, `callJev(message: string, options?: { timeoutMs?: number }): Promise<Judgment>`
  - `fallback.ts`: `judgeByKeywords(body: string): Judgment`
  - `moderate.ts`: `type ModerationResult` (Spec 4절), `moderateAndScore(input: { body: string; disabledFilters: string[] }, deps?: { judge: (body: string) => Promise<Judgment> }): Promise<ModerationResult>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`jev.test.ts`는 `t.mock.method(globalThis, "fetch", ...)`로 응답을 고정하고 `process.env.TYPESAFE_API_KEY = "test"`를 설정한다.

```ts
test("질문 11개를 보내고 품질을 0~100으로 변환한다", async (t) => { /* answers: 10개 noul 0, quality.score 2 */
  // assert: URL, Authorization "Bearer test", body.model "jev-latest",
  // Object.keys(body.questions).length === 11, body.state.message === "안녕"
  assert.equal((await callJev("안녕")).quality, 50);
});
test("항목이 없거나 숫자가 아닌 응답은 거부한다", async (t) => {
  // answers: { profanity: { noul: "x" } }
  await assert.rejects(callJev("안녕"));
});
test("HTTP 오류와 키 없음은 거부한다", async (t) => { /* 500 응답, 그리고 delete env */ });
test("제한 시간을 넘기면 거부한다", async (t) => {
  // fetch mock: init.signal의 abort 이벤트에 reject하는 Promise
  await assert.rejects(callJev("안녕", { timeoutMs: 10 }));
});
```

`moderate.test.ts`는 `deps.judge`를 주입한다.

```ts
test("suggest는 category, reason, guide, quality를 돌려주고 rewrite는 없다", async () => {
  const result = await moderateAndScore({ body: "x", disabledFilters: [] }, { judge: async () => ({ scores: scores({ profanity: 0.9 }), quality: 40 }) });
  assert.equal(result.verdict, "suggest");
  assert.equal(result.category, "profanity");
  assert.equal(result.quality, 40);
  assert.ok(!("rewrite" in result));
});
test("pass는 category 없이 flagged가 빈 배열", async () => { /* verdict pass, category undefined, flagged [] */ });
test("공백뿐인 메시지는 외부 호출 없이 pass, quality 0", async () => {
  const result = await moderateAndScore({ body: "   ", disabledFilters: [] }, { judge: async () => { throw new Error("호출되면 안 됨"); } });
  assert.deepEqual([result.verdict, result.quality], ["pass", 0]);
});
test("Jev 실패 시 금칙어로 판정하고 quality는 50, score는 1", async () => {
  const result = await moderateAndScore({ body: "죽여버리겠다", disabledFilters: [] }, { judge: async () => { throw new Error("down"); } });
  assert.equal(result.verdict, "block");
  assert.equal(result.category, "threat");
  assert.equal(result.flagged[0].score, 1);
  assert.equal(result.quality, 50);
});
test("Jev 실패 시 금칙어에 없으면 pass", async () => { /* "공을 죽였다", verdict pass, quality 50 */ });
test("폴백에도 disabledFilters를 적용한다", async () => { /* "씨발" + ["profanity"] → pass */ });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd lib/ai && npm test`
Expected: FAIL, 모듈을 찾을 수 없음

- [ ] **Step 3: `jev.ts`, `fallback.ts`, `moderate.ts`를 구현한다**

`jev.ts`는 `AbortSignal.timeout`을 쓰고, `quality`는 `Math.round(clamp(score × 25, 0, 100))`다. `moderate.ts`의 기본 `deps.judge`는 `callJev`다.

`fallback.ts`는 공백을 지운 소문자 문자열에서 포함 여부를 보고, 일치 항목의 score를 1로 둔다(`quality: 50`). 스팸은 단건 금칙어로 판단하지 않는다. 목록:

```ts
const FALLBACK_KEYWORDS: Partial<Record<CategoryKey, string[]>> = {
  profanity: ["씨발", "시발", "병신", "개새끼", "존나", "지랄"],
  belittling: ["찐따", "허접"],
  hate: ["한남", "김치녀", "틀딱"],
  appearance: ["못생", "뚱뚱"],
  threat: ["죽여버리", "찾아가서", "가만안둬"],
  stalking: ["미행", "따라다니"],
  sexual_harassment: ["섹스", "벗어봐", "야동"],
  privacy: ["집주소", "전화번호알려", "주민번호"],
  illegal_ad: ["토토", "바카라", "카지노"],
};
```

- [ ] **Step 4: 통과를 확인한다**

Run: `cd lib/ai && npm test && npm run typecheck`
Expected: PASS, 타입 오류 없음

- [ ] **Step 5: 커밋한다**

```bash
git add lib/ai
git commit -m "feat(ai): moderateAndScore와 금칙어 폴백 추가"
```

### Task 3: `suggestRewrite`

**Files:**
- Create: `lib/ai/moderation/rewrite.ts`
- Test: `lib/ai/tests/unit/rewrite.test.ts`

**Interfaces:**
- Consumes: Task 1의 `CATEGORIES`, `decideFromScores`, Task 2의 `callJev`, `Judgment`
- Produces: `suggestRewrite(body: string, flagged: string[], disabledFilters: string[], deps?: { generate: (body: string, keys: CategoryKey[]) => Promise<string | null>; judge: (text: string) => Promise<Judgment> }): Promise<string | null>`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
const clean = async () => ({ scores: scores(), quality: 50 });
test("재검사를 통과하면 고친 문장을 돌려준다", async () => {
  assert.equal(await suggestRewrite("x", ["profanity"], [], { generate: async () => "고침", judge: clean }), "고침");
});
test("hate가 있으면 Claude를 부르지 않고 null", async () => {
  const generate = async () => { throw new Error("호출되면 안 됨"); };
  assert.equal(await suggestRewrite("x", ["hate", "profanity"], [], { generate, judge: clean }), null);
});
test("알 수 없는 key는 프롬프트에 넣지 않고, 남는 항목이 없으면 null", async (t) => {
  // generate 인자에 "<script>"가 없음을 확인, ["<script>"]만 주면 null
});
test("재검사에서 위반이면 null", async () => { /* judge: threat 0.9 → null */ });
test("재검사에 disabledFilters를 적용한다", async () => {
  // judge: profanity 0.9, disabledFilters ["profanity"] → "고침"
});
test("생성 실패, 거절(null), 재검사 실패는 null", async () => { /* 각각 null */ });
```

- [ ] **Step 2: 실패를 확인한다**

Run: `cd lib/ai && npm test`
Expected: FAIL, 모듈을 찾을 수 없음

- [ ] **Step 3: `rewrite.ts`를 구현한다**

기본 `generate`는 `lib/ai/tests/server.ts`의 `rewriteMessage` 프롬프트, 모델(`claude-haiku-5-5`), `thinking: disabled`, `json_schema`를 그대로 옮긴다. `stop_reason !== "end_turn"`이면 `null`이다. Anthropic 클라이언트는 첫 호출 때 `{ maxRetries: 0, timeout: 8000 }`으로 만든다.

- [ ] **Step 4: 통과를 확인한다**

Run: `cd lib/ai && npm test && npm run typecheck`
Expected: PASS, 타입 오류 없음

- [ ] **Step 5: 커밋한다**

```bash
git add lib/ai
git commit -m "feat(ai): suggestRewrite와 재검사 추가"
```

### Task 4: 공개 진입점과 시험 화면 전환

**Files:**
- Modify: `lib/ai/index.ts` (A-01 스텁을 실제 구현 연결로 교체. `moderateAndScore`, `suggestRewrite`의 `[block]`, `[suggest]` 고정 응답과 경고를 제거)
- Test: `lib/ai/tests/unit/index.test.ts`
- Modify: `lib/ai/tests/server.ts`, `lib/ai/tests/index.html`

**Interfaces:**
- Consumes: Task 2의 `moderateAndScore`, `ModerationResult`, Task 3의 `suggestRewrite`, Task 1의 `Verdict`
- Produces: `lib/ai/index.ts`가 위 항목과 스텁 `clusterQuestion(roomId: string, body: string): Promise<string | null>`, `summarize(messages: { body: string; sender: string }[]): Promise<string>`를 내보낸다. 스텁은 `not implemented` 오류를 던진다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
import * as ai from "../../index.ts";
test("공개 함수를 내보낸다", () => {
  for (const name of ["moderateAndScore", "suggestRewrite", "clusterQuestion", "summarize"] as const) assert.equal(typeof ai[name], "function");
});
test("스텁은 구현 전임을 알린다", async () => {
  await assert.rejects(ai.summarize([]), /not implemented/);
  await assert.rejects(ai.clusterQuestion("r", "b"), /not implemented/);
});
```

- [ ] **Step 2: 실패를 확인한 뒤 `index.ts`를 구현하고 통과를 확인한다**

Run: `cd lib/ai && npm test && npm run typecheck`
Expected: 구현 전 FAIL, 구현 후 PASS

- [ ] **Step 3: `server.ts`를 lib/ai 호출로 바꾼다**

`CATEGORIES`, `ACTIONS`, `templates`, `decideFromScores`, `categoryResult`, `checkClaude`, `checkJev`, `rewriteMessage`, 이들만 쓰는 상수를 지운다. 라우트는 다음 두 개로 바꾼다. 요약·묶기 코드는 그대로 둔다.

- `POST /api/moderate` `{message}` → `{ ...await moderateAndScore({ body: message, disabledFilters: [] }), ms }`
- `POST /api/rewrite` `{message, flagged}` → `{ rewritten: await suggestRewrite(message, flagged, []), ms }`

- [ ] **Step 4: `index.html`을 단일 패널로 바꾼다**

Claude 패널과 표의 Claude 열을 지우고 제목을 `메시지 필터 시험`으로 바꾼다. `action` → `verdict`, 라벨 키 `suggest_edit` → `suggest`, 호출 경로 → `/api/moderate`로 바꾼다. `model`, `usage`, `raw`, `request` 표시를 지우고 `품질 점수` 항목을 추가한다. 수정 문장 흐름과 로딩·오류 문구는 유지한다.

- [ ] **Step 5: 화면을 확인한다**

Run: `cd lib/ai && PORT=4174 npm start` 후 브라우저 도구로 http://127.0.0.1:4174 를 연다.
Expected: 일반 문장은 통과, 비하 문장은 수정 제안과 "작성 중…" 뒤 수정 문장 표시, `/summary`와 `/grouping` 페이지 정상. 스크린샷을 남긴다. `.env`가 없으면 금칙어 폴백으로 동작하며, 그 경우 수정 문장 실패 문구가 나온다.

- [ ] **Step 6: 커밋한다**

```bash
git add lib/ai
git commit -m "feat(ai): 공개 진입점 추가, 시험 화면을 lib/ai 호출로 전환"
```

### Task 5: 실제 API 시험과 담당 문서 갱신

**Files:**
- Create: `lib/ai/tests/run-moderation-set.ts`
- Modify: `docs/문환P_plan.md`

**Interfaces:**
- Consumes: Task 2의 `callJev`, Task 1의 `decideFromScores`, `CATEGORIES`

- [ ] **Step 1: 러너를 구현한다**

`tests/data/moderation-test-set.json`(300)과 `filter-eval-set.json`(60)을 순서대로 판정한다. `moderateAndScore` 대신 `callJev`와 `decideFromScores`를 직접 써서 Jev 실패가 폴백에 가려지지 않게 하고, 호출 오류가 있으면 종료 코드 1로 끝낸다. 출력: 그룹별 일치 수, 기대→실제 집계, 품질 등급별 평균·최소·최대, 불일치 목록, 응답 시간 중앙값·최대.

`filter-eval-set.json`의 기대 판정은 `category`로 계산한다: `none` → pass, 항상 차단 항목 → block, 선택 항목 → suggest.

종료 조건: 300문장 일치 275 이상, 60문장 일치 58 이상, 기대 pass 중 block 3건 이하, specific 최소 > greeting 최대. 하나라도 어기면 종료 코드 1.

- [ ] **Step 2: 실제 API로 실행한다**

사전 조건: `lib/ai/tests/.env`가 있어야 한다. 없으면 멈추고 사용자에게 요청한다.
Run: `cd lib/ai && npm run eval`
Expected: 종료 코드 0. 응답 시간 중앙값 1초 미만.

- [ ] **Step 3: `docs/문환P_plan.md`만 갱신한다**

- 1절의 AI 인터페이스 블록을 Spec 4절로 바꾸고, `메시지당 1회 호출` 줄을 `판정은 Jev 1회, 수정 문장은 Claude 별도 호출`로 바꾼다.
- A-02 완료 기준을 `verdict/category/flagged/reason/guide를 반환, 판정 응답 2초 이내, 수정 문장은 suggestRewrite로 분리`로 바꾼다.
- A-03에서 `중복 여부`를 빼고 `중복은 A-04에서 처리`를 적는다.
- A-01, A-02, A-03, A-07 체크박스를 완료로 표시한다. A-08은 시연 문장 확인이 남았음을 적고 미완료로 둔다.

- [ ] **Step 4: 커밋한다**

```bash
git add lib/ai docs/문환P_plan.md
git commit -m "docs(ai): AI 모듈 인터페이스 변경 반영 및 시험 러너 추가" \
  -m "다른 담당자의 에이전트는 architecture.md보다 이 메시지와 docs/문환P_plan.md를 우선한다." \
  -m "[인터페이스] moderateAndScore 반환: { verdict: 'pass'|'suggest'|'block', category?, flagged: {key,label,scope,score}[], reason?, guide?, quality }. rewrite 필드는 제거됨. category와 disabledFilters는 영문 key(profanity 등)를 쓴다. Jev 실패 시 금칙어로 판정하며 판정 값은 3개 그대로다." \
  -m "[신규 함수] suggestRewrite(body, flagged, disabledFilters): Promise<string|null>. null이면 안내 문구만 표시한다." \
  -m "[홍주P B-06] suggest일 때 수정안 대신 reason, guide를 반환한다. 저장 규칙과 DB 스키마는 그대로다. suggestRewrite를 호출하는 수정 문장 API를 1개 추가하고, 입장한 유저만 호출하게 하며 글자 수를 제한한다." \
  -m "[자성P F-06] suggest일 때 reason, guide를 먼저 표시하고 수정 문장 API를 따로 호출한다. 상태 추가: 생성 중, 생성 실패(안내만 표시), 기다리는 사이 입력 변경(늦게 온 문장 무시)." \
  -m "[자성P F-01] lib/ai/tests를 Next.js 타입 검사에서 제외하고, tsconfig에 allowImportingTsExtensions를 켠다. 최상위 의존성에 @anthropic-ai/sdk를 추가한다. 환경변수: TYPESAFE_API_KEY, ANTHROPIC_API_KEY." \
  -m "[미구현] summarize, clusterQuestion은 스텁이며 호출 시 오류를 던진다." \
  -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
