# BirdieBuddy — 문환P 작업 계획

**역할:** AI 활용 — 의사결정 모델(jev)·AI API로 메시지 필터링 등

**최종 갱신:** 2026-11-10 (`main` 4e04410의 Supabase Edge 구조 기준)

**공통 기준:** 제품 규칙은 [prd.md](./prd.md), 구조는 [architecture.md](./architecture.md), 백엔드 계약은 [홍주P_plan.md](./홍주P_plan.md), 용어는 [GLOSSARY.md](../GLOSSARY.md)를 따른다.

> **우선순위:** 제품 규칙이 어긋나면 `prd.md`를 우선한다. AI 인터페이스는 이 문서의 3절을 우선한다. `docs/superpowers/`의 AI 설계 문서와 구현 계획은 이전 구조 기준이므로, 이 문서와 어긋나면 이 문서를 따른다.

## 1. 동료와 동료 에이전트 전달 사항

아래는 각자의 plan에 반영이 필요한 내용이다. 구현 방법은 각 담당자가 정하고, 제품 동작은 `prd.md`를 따른다.

### 홍주P

**AI 계약 (`홍주P_plan.md` §8)**

| 위치 | 현재 | 변경 요청 |
| --- | --- | --- |
| §8.1 `suggest` | `rewrite` 1~2000자 필수 | `rewrite: null` 허용. 값이 있으면 1~2000자. 혐오 표현과 재검사 실패 시 수정 문장 없이 안내만 표시 |
| §8.1·§6.2 장애 | timeout·5xx·JSON 오류는 `FILTER_UNAVAILABLE` | Jev 장애와 AI 키 누락은 adapter가 금칙어 폴백으로 판정해 돌려준다. 금칙어에 없으면 `pass`가 되며, 이는 `prd.md`와 AI 설계에서 받아들인 의도된 동작이다. `FILTER_UNAVAILABLE`은 adapter 예외, 응답 형식 불량, Edge 전체 시한 초과에만 쓴다 |
| §8.1 시한 | LLM timeout 8초 | Jev와 수정 문장의 시한은 adapter가 관리한다. Edge의 `signal`은 전체 처리 목표 12초에만 건다 |
| §10.2 환경변수 | `AI_MODE`, `LLM_API_KEY`, `LLM_MODEL`, live 누락 검증 | `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`로 교체. live에서 AI 키 누락을 오류로 막지 않는다 |
| §8.3 `member_count` | 참조 수 | 질문한 고유 발신자 수. 같은 사람의 질문 2건은 1명이다 |
| §8.2 필수 항목 | threat, sexual_harassment, personal_data, illegal_request | threat, stalking, sexual_harassment, privacy, illegal_ad, spam |
| §8.2 선택 항목 | profanity, belittling, spam | profanity, belittling, hate, appearance |
| §8.2 고정 안내문 | 7개 | 아래 2절의 10개 문구로 교체 |

**제품 규칙 (`prd.md` 우선)**

- **등급표:** `grade_rates`는 일반 70, 레어 20, 에픽 7.5, 스페셜 2.5(%)다.
- **입장 자격:** 현재 보유가 아니라 라운드 보상으로 받은 해당 인플루언서 카드의 누적 5장이다. 강화로 줄지 않으며 draws로 셀 수 있다. 자격을 얻어도 자동 입장하지 않는다.
- **게이지:** 시작 50, 0이면 퇴장, 최대 100이다. 월말에 3회 기준으로 초과·부족 1회당 ±12.5를 정산한다. 입장한 달과 재입장한 달은 부족분을 깎지 않는다. API와 화면의 게이지는 0~100을 유지하고, 12.5 단위를 표현할 수 있게 저장 형식과 설정 검증(`gauge int`, 정수 decay)을 바꾼다. 게이지 50은 여유 라운드 4회다.
- **재입장:** 카드 장수를 다시 검사하지 않는다. 퇴장 후 라운드를 1회 완료하면 재입장할 수 있고 게이지 50에서 시작한다.
- **버블형 채팅:** 팬은 자기 메시지와 인플루언서 답변만 볼 수 있도록 `messages` SELECT RLS를 좁힌다. `message_clusters`의 SELECT도 방 소유자로 제한한다. 방 소유자는 전체를 본다. Realtime은 이 RLS를 그대로 따르므로 유지하고, 3초 폴링은 연결 장애 시에만 쓴다.
- **답변의 원래 질문:** 다른 팬은 원래 질문 행을 읽을 수 없고 Realtime은 INSERT된 행의 컬럼만 전달하므로, 답변 행에 질문 문구의 스냅샷 컬럼을 두고 `reply_to_message`가 채운 뒤 `Message` 타입에 추가한다. 묶음에 대한 답변이면 대표 질문을, 아니면 원래 질문을 넣는다. 질문자의 닉네임, ID, 점수는 넣지 않는다.
- **묶음 답변:** 답변 1회로 묶음의 질문 전체를 답변 처리한다. 답변 행에 `cluster_id`를 남기면 팬 화면이 자기 질문의 `cluster_id`와 비교해 내 질문에 대한 답변임을 표시할 수 있다.
- **보유 점수:** 배지 없음 0, 버디 30, 이글 60, 알바트로스 90에 보유 스타일이 1종 늘 때마다 +5(최대 +10)다. 묶음 순서는 묶음 안 최고 우선순위 점수로 정하고 인원수 가점은 없다.
- **보유 배지:** 인박스와 본인 메시지 응답에 배지 단계 필드를 추가한다. 다른 팬에게는 노출하지 않는다.
- **"오늘 N건 걸러냈어요":** 방 소유자가 자기 방의 차단 건수만 조회할 수 있는 집계를 추가한다. 원문과 category별 내역은 노출하지 않는다.
- **인증:** 인플루언서 10명은 유형 5/3/2(투어 선수, 유튜버, 미디어 프로)의 인증됨으로 시드하고, 카드와 방이 없는 11번째 신청자를 심사 대기로 둔다. 승인하면 채팅방을 연다.
- **데모 시드:** 데모 유저에게 한 인플루언서의 같은 카드 일반 10장과 지난달 이전의 라운드·발급 기록 10건을 넣는다. 모든 데모 유저의 카드에는 draws 기록을 함께 넣고, 미입장 상태로 시작해 입장을 시연한다.
- **`demoForceGrade`:** 시연 배포의 서버 환경변수가 켜져 있을 때만 동작한다. 계정별 권한 검사는 함께 유지해도 된다.
- **카드 이미지:** A-06이 현호P로 옮겨졌다. 현호P에게 인플루언서 UUID를 제공하고, 받은 파일을 `<influencer_uuid>/<style>.webp` 경로로 업로드한다(Storage 쓰기가 admin 전용이므로).
- **차단 원문:** 시연 범위에서는 현재 계획대로 `messages`에 pass만 저장하고 차단 원문을 저장하지 않는다. 제재와 재검토의 원문 보관은 실서비스 범위다.

### 자성P

- **F-05:** 버블형으로 표시한다. 답변 위에 원래 질문이나 대표 질문을 닉네임 없이 보여 주고, 질문한 본인의 화면에만 내 질문에 대한 답변임을 표시한다. 보유 배지는 본인 메시지에만 표시한다.
- **F-06:** 수정 문장은 판정 응답에 포함되므로 별도 호출이 없다. `rewrite`가 `null`이면 안내 문구만 표시한다.
- **F-07:** 게이지와 여유 라운드를 함께 표시한다.
- **F-08:** 인박스에 보유 배지를 표시한다. "오늘 N건 걸러냄"은 홍주P의 집계를 쓴다.
- **F-11:** 팬에게 주는 "필터가 꺼져 있어요" 안내는 삭제한다. 인플루언서의 해제 동의 문구는 유지한다.
- **F-10:** 11번째 신청자의 승인 흐름을 시연한다.

### 현호P

- **A-06 신규 담당 (P0):** AI 툴로 가상 인물 10명(투어 선수 5, 유튜버 3, 미디어 프로 2) × 일러스트·레트로·홀로그램 30장을 생성한다. 홍주P에게 받은 인플루언서 UUID와 스타일로 구분해 파일을 전달하면 업로드는 홍주P가 한다.
- **D-02:** 스타일 가이드를 문환P에게 전달할 필요가 없다.
- **결과 화면:** 입장 자격을 얻게 한 카드의 결과 화면에 입장 가능 안내를 추가한다.
- **보유 배지:** 버디, 이글, 알바트로스 3종 디자인을 추가한다.

## 2. 문환P 담당 범위

메시지 안전 필터, 품질 점수, 수정 문장, 유사 질문 묶기, 대화 요약의 LLM 로직과 프롬프트, 금칙어 폴백을 맡는다. 인증, 입출력 검증, 호출 제한, 멱등성, 저장, 실패 응답은 홍주P가 맡는다. 우선순위 점수는 DB에서 계산하며 AI 모듈의 범위가 아니다.

**작업 경로:** `supabase/functions/_shared/ai.ts`의 `AiAdapter` 구현과 프롬프트, 필터 테스트 세트. Deno에서 동작해야 하며, 외부 SDK의 Deno 동작은 A-01에서 확인한다. `lib/ai/index.ts` 스텁은 이전 구조의 산출물이고, `lib/ai/tests/`는 회귀 시험용으로 유지한다.

**환경변수:** `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`를 Edge Function Secrets로 설정한다. 클라이언트에 두지 않는다.

**받는 것 (의존)**

- 홍주P: `submit-message` 전송 계층과 저장 (B-06), `summarize-room`·`cluster-questions` 전송 계층 (B-12)

**주는 것**

- `AiAdapter.moderateAndScore` (A-02, A-03, A-07) → 홍주P B-06
- `AiAdapter.clusterQuestions`, `AiAdapter.summarize` (A-04, A-05) → 홍주P B-12
- 항목별 고정 안내문 → 홍주P

| category | 구분 | 고정 안내문 (사람 검수 전, A-08에서 확정) |
| --- | --- | --- |
| profanity | 선택 | 욕설이나 비속어가 포함되어 메시지가 전송되지 않았어요. 거친 표현은 빼고 부드러운 말로 바꿔 주시면 감사하겠어요. |
| belittling | 선택 | 상대를 깎아내리는 표현이 포함되어 메시지가 전송되지 않았어요. 상대의 의견을 존중하는 말투로 다시 작성해 주세요. |
| hate | 선택 | 특정 집단에 대한 혐오 표현이 포함되어 메시지가 전송되지 않았어요. 누구에게도 상처가 되지 않도록 표현을 바꿔 주세요. |
| appearance | 선택 | 외모나 몸매를 평가하는 표현이 포함되어 메시지가 전송되지 않았어요. 외모 대신 스크린골프 플레이나 대화 주제에 집중해 주세요. |
| threat | 항상 차단 | 상대에게 해를 끼치겠다는 내용은 전송할 수 없어요. |
| stalking | 항상 차단 | 상대의 위치나 일상을 살피는 내용은 전송할 수 없어요. |
| sexual_harassment | 항상 차단 | 성적인 언급이나 요구가 포함되어 전송할 수 없어요. |
| privacy | 항상 차단 | 주소, 연락처 등 개인 정보를 묻거나 공개하는 내용은 전송할 수 없어요. |
| illegal_ad | 항상 차단 | 불법 광고나 도박 홍보 내용은 전송할 수 없어요. |
| spam | 항상 차단 | 같은 내용의 반복이나 무의미한 글은 전송할 수 없어요. |

## 3. AI 인터페이스

`홍주P_plan.md` §8.1의 `AiAdapter`를 기준으로, 1절의 변경 요청을 반영한 형태다. 아직 구현 전이다.

```ts
type Verdict = 'pass' | 'suggest' | 'block';
type FilterCategory =
  | 'profanity' | 'belittling' | 'hate' | 'appearance'
  | 'threat' | 'stalking' | 'sexual_harassment' | 'privacy' | 'illegal_ad' | 'spam';

interface AiAdapter {
  moderateAndScore(input: {
    body: string;
    disabledFilters: FilterCategory[];
    signal: AbortSignal;
  }): Promise<{
    verdict: Verdict;
    category: FilterCategory | null;
    reason: null;              // 최종 안내문은 category별 고정 문구로 홍주P가 만든다
    rewrite: string | null;
    quality: number;           // 0~100
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
```

- **판정:** 차단 여부는 모델이 아니라 코드 규칙이 정한다. 항상 차단 항목이 하나라도 있으면 `block`, 선택 항목만 있으면 `suggest`, 없으면 `pass`다.
- **`category`:** 항상 차단 항목을 우선하고, 그 안에서 확률이 높은 항목을 고른다. `pass`면 `null`이다.
- **`disabledFilters`:** 선택 항목만 무시한다. 항상 차단 항목은 목록에 있어도 무시하지 않는다.
- **`rewrite`:** `suggest`일 때만 값이 있을 수 있으며 1~2000자다. 다음 경우에는 `null`이고 판정은 `suggest`로 유지한다: `disabledFilters` 적용 후 위반 항목에 `hate`가 하나라도 있을 때, 재검사에서 위반이 나오거나 재검사 호출이 실패할 때, 생성에 실패하거나 시한을 넘길 때, 2000자를 넘을 때, 폴백 판정일 때. 재검사에도 같은 `disabledFilters`를 적용한다.
- **시한:** `moderateAndScore`는 수정 문장과 재검사를 포함해 8초 안에 끝낸다. Jev 시한은 첫 연결 지연을 측정해 A-01에서 정한다(기본 4초). 재시도는 하지 않는다.
- **`signal`:** Edge가 전체 시한으로 건다. 판정 전에 취소되면 폴백 판정을 돌려주고, 판정 후에 취소되면 `suggest`와 `rewrite: null`을 돌려준다.
- **장애:** Jev가 실패하거나 시한을 넘기거나 키가 없으면 adapter 안에서 금칙어 폴백으로 판정을 돌려준다. 폴백에도 같은 코드 규칙과 `disabledFilters`를 적용하고 `quality`는 50이다. 폴백 여부는 응답에 표시하지 않는다.
- **입력 처리:** 유저 메시지는 검사나 요약의 대상일 뿐이며, 메시지 안의 지시를 따르지 않게 한다. 메시지 본문, 수정 문장, 키를 로그에 남기지 않는다.

## 4. 문환P 티켓

| ID | 티켓 | 티어 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- |
| A-01 | Jev·Claude 호출의 Deno 동작 확인, `AiAdapter` 구현 골격 제공 | P0 | - | `deno check` 통과, 홍주P의 fixture adapter와 교체 가능 |
| A-02 | 메시지 안전 필터 — jev로 10개 항목 판정, 코드 규칙으로 처리 결정. `suggest`일 때 Claude로 수정 문장 생성과 재검사 | P1 | A-01 | verdict·category·rewrite 반환. `suggest`를 제외한 판정 응답 2초 이내, `suggest`도 제한 시간 안에 응답 |
| A-03 | 메시지 품질 점수 — 구체성·답변 가치를 0~100으로 (A-02와 같은 jev 호출). 중복은 A-04에서 처리 | P1 | A-02 | quality 필드 반환, 구체적인 질문이 인사말보다 높게 |
| A-04 | 유사 질문 묶기 `clusterQuestions` — 방 전체 일괄 처리 | P2 | A-02 | 2건 이상인 묶음만 반환, 대표 질문 200자 이내, 없는 ID·중복 ID 제외. 대표 질문은 다른 팬에게 공개되므로 개인 식별 내용을 빼고 전 항목(`disabledFilters` 미적용) 필터로 재검사하며, 위반이거나 재검사가 실패한 묶음은 반환에서 제외 |
| A-05 | 대화 요약 `summarize` | P2 | A-01 | 최대 100건·20,000자 입력을 2,000자 이내 문자열로 요약 |
| A-07 | LLM 실패·지연 시 금칙어 폴백 (adapter 내부) | P1 | A-02 | API 키를 빼도 필터가 금칙어로 동작하고 예외를 던지지 않음 |
| A-08 | 필터 검증용 테스트 문장 세트 + 시연 메시지 판정 사전 확인 + 고정 안내문 사람 검수 | P1 | A-02 | 테스트 세트(`lib/ai/tests/data/moderation-test-set.json`) 기대 판정 일치율 확인, 시연용 문장은 전부 기대대로, 안내문 10개 확정 |

> **이관:** A-06(카드 이미지 30장 생성, P0)은 현호P가 AI 툴로 생성하는 것으로 옮겼다. 내용은 1절의 현호P 항목을 따른다.

### 체크리스트

- [ ] **A-01** Jev·Claude 호출의 Deno 동작 확인, `AiAdapter` 구현 골격 제공 (P0)
- [ ] **A-02** 메시지 안전 필터 — 판정, 코드 규칙, 수정 문장과 재검사 (P1)
- [ ] **A-03** 메시지 품질 점수 (P1)
- [ ] **A-04** 유사 질문 묶기 `clusterQuestions` (P2)
- [ ] **A-05** 대화 요약 `summarize` (P2)
- [ ] **A-07** 금칙어 폴백 (P1)
- [ ] **A-08** 테스트 세트, 시연 메시지 확인, 고정 안내문 검수 (P1)

## 5. 문환P 타임라인

| 구간 | 할 일 |
| --- | --- |
| 사전 준비 | A-01 |
| 1일차 오전 | T-01·T-02 킥오프, A-02 |
| 1일차 오후 | A-03, A-07 |
| 1일차 저녁 | T-03 P0 통합 (전원) |
| 1일차 밤 | A-08, 프롬프트 튜닝 |
| 2일차 오전 | A-04, A-05 |
| 2일차 점심 | T-04 P1 통합 (전원) |
| 2일차 오후 | 프롬프트 튜닝 → 기능 동결 → T-05 리허설 |
