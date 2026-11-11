# BirdieBuddy — 문환P 작업 계획

**역할:** AI 활용 — 의사결정 모델(jev)·AI API로 메시지 필터링 등, 카드 확률 계산과 발급

**최종 갱신:** 2026-11-11 (`main` f14c5dc, `홍주P_plan.md` 계약 1.6 기준. 동료 계획 대조 결과와 구현 명세 추가)

**공통 기준:** 제품 규칙은 [prd.md](./prd.md), 구조는 [architecture.md](./architecture.md), 백엔드 계약은 [홍주P_plan.md](./홍주P_plan.md), 용어는 [GLOSSARY.md](../GLOSSARY.md)를 따른다.

> **우선순위:** 제품 규칙이 어긋나면 `prd.md`를 우선한다. `AiAdapter` 타입 정의는 `홍주P_plan.md` §8.1을 기준으로 하고, 판정·재검사·폴백·시한 같은 동작 규칙과 발급 함수 계약은 이 문서의 3절을, 구현 방법은 6절을 기준으로 한다. 이전 구조 기준의 AI 설계 문서와 구현 계획(2026-11-09)에서 아직 유효한 항목 설명, 품질 질문, 시험 결과는 6절에 옮겨 적었다.
>
> **표기:** `[결정]`은 문환P 담당 범위 안에서 정한 구현 방법, `[요청]`은 다른 담당자의 확인이 필요한 것(답이 오기 전에는 적힌 기본값으로 진행), `[측정]`은 실호출 결과로 확정할 값이다.

## 0. 실행 지시와 착수 상태

### 0.1 에이전트 실행 지시

사용자가 **"문환P 계획 기반으로 개발 시작해"** 또는 특정 티켓(예: "A-09 진행해")을 요청하면 다음 순서로 진행한다.

1. `git status`와 실제 파일을 확인한다. 기존 수정사항을 보존하고, 체크 표시만 보고 완료를 가정하지 않는다.
2. 0.3의 준비물을 확인한다(`deno --version`, `docker info`, `nvm ls 24`). 없는 도구는 설치하지 않고 사용자에게 알린 뒤, 그 도구 없이 할 수 있는 작업만 진행한다.
3. `main`에 `supabase/`가 있는지 확인한다. 없으면 0.4의 레포 밖 샌드박스에서 개발한다. 루트 파일과 `supabase/`를 직접 만들지 않는다(`architecture.md` §2 규칙 5, 홍주P B-01 소유).
4. 요청된 티켓을 4절의 완료 기준과 6절의 명세대로 구현한다. 담당 경로(2절) 밖의 파일은 고치지 않고, 필요한 변경은 1절의 요청 표에 적는다.
5. 7절의 검증을 실행하고 결과를 7.2에 기록한다. 실행하지 못한 검증은 이유를 남긴다.
6. 보고할 때 단위 시험 통과, 실호출 검증, 홍주P Edge Function 통합을 구분한다. 폴백 결과를 실제 AI 판정 성공으로 적지 않는다.

커밋, push, 원격 Secrets 변경, 원격 배포는 사용자 요청이 있을 때만 한다. 커밋 메시지는 `CONTRIBUTING.md` 형식을 따르고, 다른 담당자가 알아야 할 변경은 담당자와 티켓별로 본문에 적는다.

### 0.2 현재 상태 (`main` f14c5dc)

- 저장소에는 문서, `GLOSSARY.md`, `CONTRIBUTING.md`, `lib/ai` 스텁과 시험 도구만 있다. 루트 `package.json`, `supabase/`, `lib/api`, `app/`은 아직 없다. 홍주P B-01 root bootstrap은 `main`에 올라오지 않았다.
- A-01~A-05, A-07, A-08, A-09는 샌드박스에서 확인했고, B-01 뒤 레포로 옮기는 일을 기다린다. A-08은 수정 문장 통과율(79.3%)과 시연 문장(5/7)이 기준에 못 미치고, 고정 안내문 사람 검수와 시연 문장 확정이 대기(사용자 검수)다. A-06은 현호P로 옮겼다.
- 원격 Supabase에는 Edge Function Secrets 두 개의 이름만 저장돼 있다(`홍주P_plan.md` §14.2). 값의 유효성과 실제 호출은 확인되지 않았다.
- `lib/ai/tests/.env`에 두 키 이름이 있다. 값이 유효한지는 A-01의 실호출로 확인한다.

### 0.3 착수 전 준비물

2026-11-11에 이 개발 머신에서 설치하고 확인한 결과다.

| 도구 | 필요한 티켓 | 확인 결과 | 조치 |
| --- | --- | --- | --- |
| Deno 2 | A-01~A-08 전부 | 2.9.8 (Homebrew) | 준비됨 |
| Docker 호환 런타임 | A-09, 홍주P 로컬 stack 통합 | Docker Desktop 27.5.1 | 준비됨. 작업 전에 Docker Desktop이 실행 중인지 확인한다 |
| Node.js 24 | `npx supabase`, 홍주P scripts | v24.22.2 (nvm). nvm 기본값은 22.23.4 | 해당 명령을 실행하는 터미널에서만 `nvm use 24`를 쓴다. 기본값을 바꾸면 v22에 전역 설치된 `trail`·`graft`가 잡히지 않는다. 기존 시험 서버(`lib/ai/tests`)는 22.18 이상이면 된다 |
| Supabase CLI 3.0.0 | A-09 | 전역 설치 없음 | 설치하지 않고 `npx --yes supabase@3.0.0`으로 실행한다 |

### 0.4 B-01 전 작업 위치

홍주P B-01 root bootstrap이 `main`에 올라오기 전에는 레포의 형제 폴더 `../BirdieBuddy-ai/`에서 개발한다(`자성P_develop_document.md` 15절과 같은 방식). git 저장소로 만들지 않는다.

- 폴더 구조는 6.1의 레포 경로를 그대로 쓴다. 샌드박스 안에서 `npx --yes supabase@3.0.0 init`으로 로컬 구성을 만든다.
- A-09용 임시 스키마는 샌드박스의 `supabase/migrations/00000000000000_sandbox_schema.sql` 한 파일에 둔다. `홍주P_plan.md` §4.2·§5.1의 enum(`card_grade`, `card_style`, `influencer_type`)과 `influencers`, `card_templates`, `user_cards`, `rounds`, `draws`, `game_config` 테이블, `private` 스키마만 적힌 컬럼과 제약대로 만든다. 이 파일은 레포로 옮기지 않는다.
- `lib/ai/tests/`의 스크립트(`smoke.ts`, `regress.ts`)는 adapter를 상대 경로로 import하므로 샌드박스의 같은 경로(`../BirdieBuddy-ai/lib/ai/tests/`)에 만들고 adapter와 함께 옮긴다. 시험 데이터는 복사하지 않고 레포의 `lib/ai/tests/data/`를 읽는다.
- 키는 샌드박스로 복사하지 않는다. 실호출 명령의 `--env-file`은 레포의 `lib/ai/tests/.env`를 가리킨다.
- **레포로 옮기는 절차:** 샌드박스의 로컬 stack을 내린다(레포의 stack과 기본 포트가 같다) → `main`을 pull해 bootstrap을 확인한다 → `supabase/functions/_shared/ai.ts`, `supabase/functions/_shared/ai/`, `issue_card` migration, `supabase/tests/issue_card.test.sql`, `lib/ai/tests/`의 스크립트를 복사한다 → migration 타임스탬프는 홍주P의 private/Auth/RLS migration 뒤, `complete_round` migration 앞이 되게 다시 매긴다 → 7.1의 검증을 레포에서 다시 실행한다.

## 1. 동료와 동료 에이전트 전달 사항

아래는 각자의 plan에 반영이 필요한 내용이다. 구현 방법은 각 담당자가 정하고, 제품 동작은 `prd.md`를 따른다.

### 홍주P

**AI 계약 (`홍주P_plan.md` §8)**

2026-11-10에 요청한 8건(`senderType`, 폴백의 `passesAllFilters`와 판정, `message_clusters` SELECT, "오늘 N건" 집계, `issue_card` migration 순서, 묶기·요약 시한, 폴백 위반 미집계)은 계약 1.5(`main` 460e805)에 모두 반영돼 표에서 지웠다. 아래는 구현을 시작하면서 새로 필요해진 확인이다.

| # | 위치 | 확인이 필요한 것 `[요청]` | 답이 오기 전 기본값 |
| --- | --- | --- | --- |
| R1 | §1.1·§3·§8.1 `_shared/ai.ts` | 이 파일을 누가 만들고 무엇을 내보내는지, 키를 어떻게 주입하는지, fixture adapter를 어디에 두는지 | 문환P가 `ai.ts`에 `AiAdapter` 타입(§8.1 그대로)과 `createAiAdapter(): AiAdapter`를 둔다. 키는 adapter가 `Deno.env.get`으로 읽는다(§2.7). 홍주P fixture는 같은 타입을 구현해 시험에서 주입한다 |
| R2 | §8.1·§8.3 `summarize`의 `sender` | 값의 의미(닉네임인지, `user`·`influencer`인지, 표시명인지) | adapter는 화자 표시 문자열로만 쓰므로 어떤 값이 와도 동작한다. 다만 요약에서 인플루언서 발언을 구분하려면 방 소유자의 메시지에는 일정한 값이 와야 한다 |
| R3 | §2.3 Edge용 `deno.json`·`deno.lock` | 파일 위치와 `@anthropic-ai/sdk` 의존성 추가 방법 | 코드에 버전을 고정한 `npm:` 지정자를 직접 쓴다. lock 파일 갱신이 필요하면 커밋 메시지로 알린다 |
| R4 | §1.1·§11 migration·시험 파일 | `supabase/migrations/<timestamp>_issue_card.sql`과 `supabase/tests/issue_card.test.sql`을 문환P가 추가 | 이 이름으로 추가한다. 타임스탬프는 B-01의 migration이 병합된 뒤 private/Auth/RLS migration 뒤이고 `complete_round` migration 앞이 되는 값으로 직접 매긴다(0.4) |
| R5 | §5.2 `complete_round` | `private.issue_card`의 EXECUTE를 `PUBLIC`·`anon`·`authenticated`에서 회수해도 `complete_round`가 호출할 수 있는지(migration 소유 역할의 `SECURITY DEFINER`인지), `gen_random_bytes`가 설치된 스키마 | `SECURITY DEFINER`와 `extensions` 스키마로 가정한다. 확인함(A-09, 샌드박스 로컬 DB): `gen_random_bytes`는 `extensions` 스키마에 있다(`pg_proc`·`pg_namespace` 조회). `SECURITY DEFINER` 여부는 `complete_round`가 홍주P 쪽 구현이라 미확인 |
| R6 | §8.2 고정 안내문 | 2절 표의 문구를 어디에 복사해 두는지(A-08 검수로 문구가 바뀌면 함께 고칠 위치) | 2절 표가 기준이고, 문구가 바뀌면 커밋 메시지로 알린다 |
| R7 | §3·§9.2·B-02 카드 이미지 | A-06의 최종 이미지 30장을 받아 `card-assets`에 올리는 단계가 티켓에 명시돼 있지 않다(`현호P_plan.md`는 홍주P B-02가 한다고 적음) | 문환P 작업에는 영향이 없다 |
| R8 | §4.2 `draws`의 round 소유자 일치 강제 | `draws`의 round 소유자 일치("round 소유자와 일치 강제")를 어떤 방식으로 강제하는지. `private.issue_card`는 §3대로 권한을 다루지 않고 이 제약에 기댄다 | `draws (round_id, user_id) → rounds (id, user_id)` 복합 FK와 `rounds`의 `UNIQUE (id, user_id)`로 가정한다. 홍주P 답이 올 때까지 이 가정을 쓴다. A-09 pgTAP은 SQLSTATE 23503을 확인한다. B-01이 트리거로 구현하면 이관할 때 이 확인을 바꾼다 |

**계약 1.6 §15.2 문환P 행 확인 (2026-11-11):** 대표 질문 전 항목 재검사와 위반 묶음 제외, 재검사 실패 시 예외, source 밖·중복 ID 제거(6.6), 시한(3절·6.4·6.6·6.7)이 유지돼 있다. 시한 초과 단위 시험이 묶기·요약에 빠져 있어 6.6·6.7에 추가했다. adapter는 대표 질문과 메시지 ID만 돌려주며 DB `clusterId`·version·권한·점수 정렬은 홍주P DB 책임으로 남는다. 계약과 충돌하는 항목은 없어 해결 요청은 없다.

**제품 규칙 (`prd.md` 우선)**

`main` f14c5dc의 `홍주P_plan.md`(계약 1.6)와 한 줄씩 대조했고, 카드 이미지를 받아 올리는 단계(R7)를 빼면 모두 반영돼 있다. 계약 1.6에서 방식이 바뀐 항목은 바뀐 방식으로 고쳐 적었다. 아래는 합의 기록으로 남긴다.

- **등급표:** `grade_rates`는 일반 70, 레어 20, 에픽 7.5, 스페셜 2.5(%)다.
- **입장 자격:** 현재 보유가 아니라 라운드 보상으로 받은 해당 인플루언서 카드의 누적 5장이다. 강화로 줄지 않으며 draws로 셀 수 있다. 자격을 얻어도 자동 입장하지 않는다.
- **게이지:** 시작 50, 0이면 퇴장, 최대 100이다. 월말에 3회 기준으로 초과·부족 1회당 ±12.5를 정산한다. 입장한 달과 재입장한 달은 정산하지 않아 게이지가 오르지도 내리지도 않는다. API와 화면의 게이지는 0~100을 유지하고, 12.5 단위를 표현할 수 있게 저장 형식과 설정 검증(`gauge int`, 정수 decay)을 바꾼다. 게이지 50은 여유 라운드 4회다.
- **재입장:** 카드 장수를 다시 검사하지 않는다. 퇴장한 뒤에는 한 달에 라운드 3회를 완료하면 그 달에 재입장할 수 있고 게이지 50에서 시작한다. 퇴장한 방이 여러 곳이면 그 달에 모두 재입장할 수 있다. 유저가 스스로 방을 나가는 기능은 없다.
- **버블형 채팅:** 팬은 자기 메시지와 인플루언서가 보낸 메시지(답변, 전체 메시지, 인사말)만 볼 수 있도록 `messages` SELECT RLS를 좁힌다. `message_clusters`의 SELECT도 방 소유자로 제한한다. 방 소유자는 전체를 본다. Realtime은 이 RLS를 그대로 따르므로 유지한다. 메시지 3초 폴링은 연결 장애와 답변 보강 실패 복구에만 쓰고, 퇴장·재입장 자격·사진 같은 상태는 이와 별개로 3초마다 다시 조회한다(`홍주P_plan.md` §9.1).
- **열람 범위:** 팬이 읽는 인플루언서 메시지는 자신의 입장 기간에 올라온 것으로 좁힌다. 입장 전과 퇴장 기간의 메시지는 읽을 수 없고, 퇴장 기간에 달린 내 질문의 답변만 예외로 재입장 뒤 읽을 수 있다. 퇴장 중에는 방의 메시지를 읽을 수 없다. 재입장하면 예전 입장 기간의 메시지를 다시 읽을 수 있어야 하므로 입장·퇴장 구간을 기록해야 한다.
- **답변의 원래 질문:** 다른 팬은 원래 질문 행을 읽을 수 없고 Realtime은 INSERT된 행의 컬럼만 전달하므로, 답변 행에 질문 문구의 스냅샷 컬럼을 두고 `reply_to_message`가 채운 뒤 `Message` 타입에 추가한다. 묶음에 대한 답변이면 대표 질문을 넣는다. 아니면 원래 질문을 넣되, 그 질문의 `passesAllFilters`가 참일 때만 넣고 거짓이면 비운다(선택 필터를 끈 방에서 통과한 욕설 등이 다른 팬에게 인용되지 않게 한다). 이를 위해 질문 행에 `passesAllFilters`를 저장한다. 비어 있어도 질문한 본인은 자기 질문 행을 읽을 수 있으므로 화면이 그것으로 인용을 보여 준다. 질문자의 닉네임, ID, 점수는 넣지 않는다.
- **묶음 답변:** 답변 1회로 묶음의 질문 전체를 답변 처리한다. 답변 시점의 대상 질문 전체를 비공개 링크(`answer_question_links`)로 고정하고, 팬 화면은 SDK가 보강한 `Message.isReplyToMe`로 내 질문에 대한 답변임을 표시한다. 묶음은 다시 묶일 수 있으므로 현재 `cluster_id` 비교로 판단하지 않는다(`홍주P_plan.md` §7.1).
- **보유 점수:** 배지 없음 0, 버디 30, 이글 60, 알바트로스 90에 보유 스타일이 1종 늘 때마다 +5(최대 +10)다. 묶음 순서는 묶음 안 최고 우선순위 점수로 정하고 인원수 가점은 없다.
- **보유 배지:** 인박스와 본인 메시지 응답에 배지 단계 필드를 추가한다. 다른 팬에게는 노출하지 않는다.
- **"오늘 N건 걸러냈어요":** 방 소유자가 자기 방의 `moderation_events` 중 `verdict='block'` 건수를 실제 KST 오늘 기준으로 조회하는 집계를 추가한다(P1). `suggest`는 세지 않고, 폴백 차단은 구분할 수 없어 함께 센다. 원문과 category별 내역은 노출하지 않는다.
- **인증:** 인플루언서 10명은 유형 5/3/2(투어 선수, 유튜버, 미디어 프로)의 인증됨으로 시드하고, 카드와 방이 없는 11번째 신청자를 심사 대기로 둔다. 승인하면 채팅방을 연다.
- **데모 시드:** userA에게 한 인플루언서의 같은 카드 일반 10장과 지난달 이전의 라운드·발급 기록 10건을 넣고, 미입장 상태로 시작해 입장을 시연한다. 통합 시험용 userB는 같은 인물의 카드 5장과 기록 5건으로 입장 상태에서 시작한다(`홍주P_plan.md` §10.1). 모든 데모 유저의 카드에는 draws 기록을 함께 넣는다.
- **`demoForceGrade`:** `private` 설정 행과 기존 `can_force_grade` 계정 권한을 `complete_round`가 둘 다 검사한다. Postgres RPC는 배포 환경변수를 직접 읽지 못하므로 설정 행으로 켜고 끈다. 기본값과 행 없음은 모두 꺼짐이고, 켜기는 시연 배포의 관리 SQL로만 한다(시드로 켜지 않음). 꺼져 있을 때 강제 등급 요청은 `FORBIDDEN`이고, 강제 등급이 없는 정상 라운드에는 영향이 없다. B-03 시험에 "설정 꺼짐 + `can_force_grade=true` → `FORBIDDEN`, draw 없음"을 추가한다.
- **카드 이미지:** A-06이 현호P로 옮겨졌다. 현호P에게 인플루언서 UUID를 제공하고, 인물·스타일·WebP 파일 URL 30행 목록을 받는 즉시 내려받아(임시 URL일 수 있음) `card-assets`의 `<influencer_uuid>/<style>.webp`에 올린 뒤 `image_path`를 저장한다. URL은 전달 수단이며 DB에 넣지 않는다. (받아서 올리는 단계는 위 R7 참고)
- **차단 원문:** 시연 범위에서는 현재 계획대로 `messages`에 pass만 저장하고 차단 원문을 저장하지 않는다. 제재와 재검토의 원문 보관은 실서비스 범위다.
- **전체 메시지 (P2):** 방 소유자가 답변 대상 없이 보내는 메시지 종류를 추가한다. 보낸 시점에 입장 중인 팬에게 보이며 위 열람 범위를 그대로 따른다. 팬의 메시지는 전체 메시지에 연결하지 않는다.
- **인사말 (P2):** 인플루언서마다 문구 1개를 둔다(200자 이내, 빈 값으로 저장하면 기본 문구). 팬이 처음 입장할 때 그 시점의 문구를 그 팬에게만 보이는 인플루언서 메시지로 남기고, 재입장 때는 만들지 않는다. 문구를 바꿔도 이미 남긴 인사말은 바뀌지 않는다. 시드 10명과 승인된 신청자에게 `prd.md` 4절의 기본 문구를 넣고, 본인 문구를 바꾸는 RPC·SDK를 제공한다.
- **인플루언서 메시지 삭제 (P2):** 방 소유자가 본인의 답변과 전체 메시지를 지울 수 있다. 행은 지우지 않고 삭제 표시를 남기며, 삭제된 메시지의 본문은 내려 주지 않는다. 답변을 지우면 그 질문(묶음에 대한 답변이면 묶음 전체)을 미답변으로 되돌린다. 인사말과 팬 메시지는 대상이 아니다. 삭제는 Realtime UPDATE로 전달하고 재연결 때 조회 완료 checkpoint부터 복구한다(`홍주P_plan.md` §9.1).
- **인박스 정렬과 숨김:** 우선순위 점수가 같으면 최신순이다. 퇴장 중인 팬의 미답변 질문은 인박스에서 빼고, 재입장하면 저장된 점수 그대로 다시 넣는다. 묶음의 `member_count`에서도 퇴장 중인 팬을 뺀다. 묶기 입력은 미답변 질문만이고, 답변한 묶음에는 새 질문을 넣지 않는다.
- **수정 제안 그대로 전송:** `suggest` 응답에 제안 확인값을 함께 내려 주고, `submitMessage`가 본문과 함께 그 값을 받으면 본문이 제안 문장과 같고 발급 후 10분 이내이며 처음 쓰는 경우에만 필터 판정 없이 `pass`로 저장한다. 품질 점수는 `rewriteQuality`, `passesAllFilters`는 참이다. 인증, 입장 상태, 도배 제한은 그대로 검사한다. 조건에 맞지 않으면 오류로 막지 않고 일반 판정으로 처리한다. 화면이 보낸 "제안 문장이다"라는 주장을 그대로 믿지 않도록 서버가 발급한 일회성 token으로 확인한다. 계약 1.6에서 token 검증·소비와 저장을 최종 저장 RPC 한 트랜잭션으로 묶었고, 무효 token이면 adapter를 한 번 호출하는 일반 판정으로 넘어간다(`홍주P_plan.md` §§7.2·7.3). adapter 쪽 변경은 없다. 제안 문장은 저장하지 않는다.
- **방 목록:** 카드 템플릿이 없는 방을 구분할 수 있는 값을 준다. 11번째 신청자의 방에 "카드 준비 중"을 표시하는 데 쓴다.
- **P2 순서:** 인증, 유사 질문 묶기, 대화 요약, 필터 해제, 인사말, 전체 메시지, 인플루언서 메시지 삭제, 프로필 사진 순이다.

**카드 발급 분담 (B-03 변경)**

추첨과 카드 지급은 문환P가 맡고, 홍주P는 카드 템플릿과 스키마, 현호P는 디자인과 뽑기 연출을 맡는다. 실행은 지금처럼 한 트랜잭션이다. `홍주P_plan.md` §5.2·§7.1·§11·§12에 반영돼 있다.

| 순서 | 할 일 | 담당 |
| --- | --- | --- |
| 1 | 멱등 처리, 사용자 잠금, 데모 시계, `rounds` 저장, 강제 등급 권한 검사 | 홍주P `complete_round` |
| 2 | 등급·템플릿 추첨, `draws`·`user_cards` 기록, `isNew`·`entryUnlocked` 계산 | 문환P `private.issue_card` (3절) |
| 3 | 결과 반환, 이미지 경로의 공개 URL 변환 | 홍주P `complete_round`·SDK |

- **B-03:** 5.2절의 추첨·지급 부분을 `private.issue_card` 호출로 바꾼다. 원자 지급, 강제 등급 권한, `isNew` 경합 시험은 B-03에 남고, 추첨 경계값과 확률 분포 시험은 A-09로 옮긴다. 강화(`upgrade_card`)는 B-04에 그대로 둔다.
- **migration 순서:** `issue_card` migration은 private/Auth 다음, cards/views의 `complete_round` 앞에 온다. B-01 전에 만든 파일은 B-01 머지 후 타임스탬프를 다시 매긴다.
- **`draws.forced`:** `boolean NOT NULL DEFAULT false`를 추가한다. 강제 발급 표시이며 확률 검증에서 제외하는 근거다. 데모 시드 계정의 발급 기록도 확률 검증에서 뺀다.
- **`completeRound` 응답:** `entryUnlocked: boolean`을 추가한다.
- **카드 식별:** 장별 고유 ID는 두지 않는다. 수량은 `user_cards.count`, 발급 1건의 식별은 `draws.id`다.

**문환P에게 제공할 데이터 정보**

`홍주P_plan.md` §4.2(테이블·컬럼·제약)와 §5.1(`game_config` 값 형식)로 받았다. 남은 것은 위 R5(`gen_random_bytes` 스키마)와 B-01의 실제 migration이다.

| 용도 | 데이터 |
| --- | --- |
| 발급 확률과 입장 기준 | `game_config`의 `grade_rates`, 입장 기준 key와 값 형식. 소수 확률(7.5, 2.5)을 허용해야 한다 |
| 발급 대상과 응답 정보 | `card_templates`의 id·influencer_id·style·image_path, `influencers`의 name·type·verified_at. 시연은 30종 전체가 대상이다 |
| 신규 여부 계산 | `user_cards` |
| 누적 획득 장수 계산 | `draws`와 `card_templates.influencer_id` 조인 |
| 저장 위치 | `draws`, `user_cards`의 컬럼과 제약, `user_cards` 행 생성 규칙 |

**프로필 사진 (P2 마지막 순서)**

`홍주P_plan.md` §8.5·§9.3과 B-14에 반영돼 있다. 저장 경로의 파일명은 홍주P가 요청 ID(`<influencer_uuid>/<requestId>.webp`)로 정했다.

- 새 공개 버킷을 두고 `<influencer_uuid>/<uuid>.webp` 경로에 매번 새로 저장한다(덮어쓰기는 CDN에 옛 사진이 남을 수 있다). 제한은 5MiB, `allowed_mime_types=["image/webp"]`다. JPG·PNG는 브라우저 입력 조건일 뿐 버킷 허용 형식이 아니다.
- 계정 매핑이 비공개이므로 경로에 `auth.uid`를 쓰지 않는다. Storage INSERT는 `(storage.foldername(name))[1]`이 `private.influencer_accounts`로 찾은 호출자의 `influencer_id`와 같고 그 인플루언서가 인증됨일 때만 허용한다. UPDATE·DELETE는 허용하지 않는다.
- `influencers`에 사진 경로 컬럼(nullable)을 추가하고, 본인 사진 경로를 바꾸는 RPC·SDK를 제공한다. RPC는 인플루언서 ID를 인자로 받지 않고 `auth.uid()`로 구하며 `p_request_id`가 필수다. 입력 경로는 `^<본인 uuid>/<uuid>\.webp$` 형식이고 버킷에 실제 객체가 있어야 한다.
- 시연의 인증 조건은 `verified_at IS NOT NULL`이다. 재인증 필요 잠금과 인증 취소 숨김은 상태 컬럼이 필요하므로 실서비스 범위다.
- **완료 기준:** 팬·다른 인플루언서 업로드 거부, 다른 인플루언서 폴더 거부, 다른 사람 경로나 없는 객체로 RPC 호출 거부, 미인증 거부, WebP 외 형식 거부, 덮어쓰기 거부.
- `RoomCatalogItem`에 표시용 사진 URL 1개를 추가한다. 프로필 사진이 없으면 일러스트 스타일 카드 이미지 URL을, 둘 다 없거나 인증 취소된 인물이면 `null`을 준다(인증 취소는 실서비스 범위).
- 방과 인플루언서가 1:1이므로 메시지 행이나 Realtime 이벤트에는 사진 컬럼을 넣지 않는다.

### 자성P

`main` 460e805의 `자성P_plan.md`와 `자성P_develop_document.md`에 아래 항목이 모두 반영돼 있고, 남은 요청은 없다. 프로필 사진의 WebP 변환은 홍주P SDK 안에서 하기로 바뀌어(`홍주P_plan.md` §6.5) 해당 줄을 고쳤다.

- **F-05:** 버블형으로 표시한다. 답변 위에 원래 질문이나 대표 질문을 닉네임 없이 보여 주고, 질문한 본인의 화면에만 내 질문에 대한 답변임을 표시한다. 답변의 인용이 비어 있으면 답변만 보여 주되, 질문한 본인의 화면에서는 자기 질문을 인용으로 보여 준다. 전체 메시지와 인사말은 인플루언서 말풍선으로 표시하고, 삭제된 메시지는 "삭제된 메시지"로 표시한다. 인사말이 있으므로 처음 입장한 방의 빈 상태 안내는 따로 두지 않는다. 입장 안내에 "내 질문은 답변과 함께 닉네임 없이 다른 팬에게 보일 수 있습니다"를 추가한다. 보유 배지는 본인 메시지에만 표시한다.
- **F-06:** 수정 문장은 판정 응답에 포함되므로 별도 호출이 없다. `rewrite`가 `null`이면 안내 문구만 표시한다. 수정 문장을 그대로 보내는 버튼은 응답의 제안 확인값을 함께 보내고, 팬이 문장을 고치면 확인값 없이 보낸다.
- **F-07:** 게이지와 여유 라운드를 함께 표시한다.
- **F-08:** 인박스에 보유 배지를 표시한다. "오늘 N건 걸러냄"은 홍주P의 집계를 쓴다.
- **인박스 추가 기능 (P2):** 전체 메시지 작성 칸, 본인 답변·전체 메시지 삭제(되돌릴 수 없다는 확인 문구 포함), 인사말 설정(200자 이내, 현재 문구 표시)을 추가한다. 순서는 인사말, 전체 메시지, 삭제다.
- **인박스 추가 기능의 화면 상태:** 전송·저장·삭제 중에는 중복 클릭을 막는다. 실패하면 입력을 유지하고 재시도를 제공하며, 인사말 저장에 실패하면 이전 문구를 유지한다. 인사말이 200자를 넘으면 안내한다. 본인 방이 아니면 권한 없음을 안내한다.
- **방 목록:** 카드 템플릿이 없는 방에는 인증 배지와 함께 "카드 준비 중"을 표시하고 입장 버튼을 두지 않는다.
- **F-11:** 팬에게 주는 "필터가 꺼져 있어요" 안내는 삭제한다. 인플루언서의 해제 동의 문구는 유지한다.
- **F-10:** 11번째 신청자의 승인 흐름을 시연한다.
- **프로필 사진 (P2 마지막 순서):** 인박스 설정에 사진 변경 화면을 추가한다. JPG·PNG·WebP 5MiB 이하만 받는다. 512×512 WebP 재인코딩과 메타데이터 제거는 홍주P SDK(`uploadInfluencerProfilePhoto`)가 하고, 화면은 형식과 크기를 미리 검사한다. 업로드 중 상태, 형식·크기 오류, 실패 시 이전 사진 유지, 권한 없음 안내를 처리한다. 재인증 필요 잠금은 실서비스 범위다.
- **프로필 사진 표시:** 채팅방 목록, 채팅방 상단, 인플루언서 말풍선(답변, 전체 메시지, 인사말)에 표시한다. 홍주P가 `RoomCatalogItem`에 추가할 표시용 사진 URL을 쓰고, 인플루언서 말풍선에도 방의 그 사진을 쓴다. 값이 `null`이면 이름 첫 글자를 표시한다. 시안은 현호P가 제공한다.

### 현호P

> **현호P와 현호P 에이전트 확인용:** 화면 디자인과 UI 구성은 현호P가 맡는다. 화면 작업 전에 이 절과 `prd.md` 3절을 확인한다.

**`현호P_plan.md`에 남은 차이** (`main` 460e805 기준, 현호P가 고칠 것)

| 위치 | 현재 | 기준 |
| --- | --- | --- |
| §2.3 F-07 행 | 퇴장 후 라운드 1회로 재입장 | `prd.md` 4절: 퇴장한 뒤 한 달에 라운드 3회를 완료하면 재입장 |
| §3.2 `entryUnlocked` 행 | `min_cards` | 설정 key는 `room_entry.min_earned_draws`다(`홍주P_plan.md` §5.1). 화면이 이 key를 읽지는 않는다 |
| §2.3 프로필 사진 행 | 512×512 WebP 재인코딩은 자성P | 홍주P SDK 내부에서 한다(`홍주P_plan.md` §6.5) |
| §1·§3.1 보유 카드 | 별도 API 없이 `getCollection` 재사용 | 홍주P는 `getOwnedCards`도 제공한다(§6.3). 어느 쪽을 쓸지 현호P가 정한다 |

**화면 디자인·UI 구성**

| 화면 | 경로 | 우선순위 | 구현 | 디자인에 담을 내용 | 쓰는 데이터 |
| --- | --- | --- | --- | --- | --- |
| 뽑기 연출·결과 | `app/(user)/draw/` | P0 (특수 연출·건너뛰기 P1) | 현호P | 카드팩 개봉, 등급 → 유형 → 이름·이미지 단계 공개, 신규·중복 표시, 입장 가능 안내 | `completeRound` |
| 컬렉션 | `app/(user)/collection/` | P0 | 현호P | 카드 템플릿 30종, 없는 카드 실루엣, 등급별 장수, 강화 가능 표시 | `getCollection` |
| 강화 화면·연출 | `app/(user)/collection/upgrade/` | 화면·기본 연출 P0, 등급별 연출·건너뛰기 P1 | 현호P | 소모 10장, 받을 다음 등급 카드, 강화 후 남는 장수, 확정 안내, 합쳐지는 연출, 결과 화면 | `getCollection`, `upgradeCard` |
| 보유 카드·카드 상세 | `app/(user)/collection/owned/` | P1 | 현호P | 1장 이상인 카드 목록, 인물·유형·등급 필터, 등급순·장수순 정렬, 카드 상세, 인증 배지, 강화 이동 | `getOwnedCards` |
| 프로필 사진 변경 | 인박스 설정 | P2 마지막 | 시안 현호P, 구현 자성P | 현재 사진, 파일 선택, 미리보기, 업로드 중, 오류, 권한 없음 안내 | `getMyInfluencerProfile`, `uploadInfluencerProfilePhoto` |
| 프로필 사진 표시 | 채팅방 목록·상단·인플루언서 말풍선 | P2 마지막 | 시안 현호P, 구현 자성P | 원형 사진, 사진이 없을 때의 대체 표시(일러스트 카드 이미지, 이름 첫 글자) | `RoomCatalogItem.profileImageUrl` |
| 보유 배지·인증 배지 | `components/card/`, D-09 산출물 | 보유 배지 P1, 인증 배지 P2 | 시안 현호P | 버디·이글·알바트로스 3종, 유튜버·미디어 프로·투어 선수 3종 | - |

**화면별 필수 상태**

- **공통:** 로딩, 불러오기 실패와 재시도, 모바일 폭, 동작 줄이기 설정을 넣는다. 등급은 색만으로 구분하지 않는다. 계정을 전환하면 이전 유저의 카드 상태를 비운다.
- **재시도:** 결과를 알 수 없는 요청의 재시도에는 같은 `requestId`를 쓴다. 새 `requestId`는 새 라운드나 새 강화가 되므로, 성공을 확인한 뒤의 다음 동작에만 쓴다. 화면을 벗어났다가 돌아오면 새 요청 전에 `getCollection`으로 수량을 다시 확인한다.
- **뽑기:** 서버가 확정한 결과를 공개하는 화면이다. 요청 중 중복 클릭을 막고, 결과를 알 수 없으면 오류와 재시도로 안내한다. 건너뛰거나 도중에 나가도 카드는 이미 컬렉션에 있고, 시연에 미개봉 카드팩은 없다. `completeRound`의 `entryUnlocked`가 `true`면 결과 화면에 입장 가능을 안내한다.
- **강화:** 100% 성공이므로 실패처럼 보이는 연출을 넣지 않는다. 연출은 서버 확정 뒤 시작하고, 건너뛰어도 강화를 다시 요청하지 않는다. 결과를 알 수 없으면 연출 없이 오류를 안내하고 수량을 다시 조회해 표시한다(응답만 끊긴 경우 이미 소모되었을 수 있다). `INSUFFICIENT_CARDS`는 "N장 더 필요", `MAX_GRADE`는 최고 등급 안내로 표시한다. 직접 URL로 열어도 같은 안내를 보여 준다. 확정 안내에 되돌릴 수 없음과 입장 자격·보유 배지 유지를 적는다. 일괄 강화는 없다.
- **보유 카드:** 빈 목록은 라운드 완료를 안내하고, 필터 결과 없음은 조건 변경을 안내한다. 강화로 0장이 된 카드는 목록에서 빠진다. 응답에 획득 시각이 없어 최근 획득순 정렬은 넣지 않는다.

**기존 계획과 달라진 점 (`현호P_plan.md`에 반영됨)**

- **A-06 (P0):** 담당이 문환P에서 현호P로 바뀌었다. AI 툴로 가상 인물 10명(투어 선수 5, 유튜버 3, 미디어 프로 2) × 일러스트·레트로·홀로그램 30장을 생성한다. 홍주P에게 받은 인플루언서 UUID로 인물·스타일·URL 30행 목록을 만들어 전달하면 저장은 홍주P가 한다. 저장 경로가 `.webp`이므로 URL은 WebP 파일을 가리켜야 한다.
- **D-01:** 시안 범위에 강화 화면, 보유 카드, 카드 상세, 프로필 사진 변경·표시를 추가한다. 채팅 쪽으로는 전체 메시지 작성 칸, 인사말 설정, 삭제된 메시지 표시, 방 목록의 "카드 준비 중" 표시를 추가한다(구현은 자성P).
- **D-02:** 스타일 가이드를 문환P에게 전달할 필요가 없다.
- **D-08:** 컬렉션 안의 동작이 아니라 위 표의 별도 강화 화면으로 만든다. 등급별 연출과 건너뛰기는 D-05와 함께 P1로 한다.
- **신규 작업:** 보유 카드·카드 상세(P1), 보유 배지 3종, 프로필 사진 시안. 티켓 번호는 현호P가 정했다(D-08b, D-10, D-11). 시연의 프로필 사진 업로드 샘플은 A-06의 가상 인물 이미지를 쓴다.
- **API 표기:** `POST /api/rounds/complete` 등은 이전 구조다. `completeRound`, `getCollection`, `getOwnedCards`, `upgradeCard` SDK를 쓰며, 위 화면에 필요한 계약은 `홍주P_plan.md` §§6~7에 반영돼 있다.

### U-01 시연·발표 담당 (미정)

`anonymous-plan.md` §4.2의 사전 상태가 시드 기준과 다르다. 같은 절의 "기존 첫 방 열기" 진행도 userA가 미입장으로 시작하는 시드와 맞지 않는다. 담당자가 정해지면 고친다.

| 위치 | 현재 | 기준 (`홍주P_plan.md` §10.1) |
| --- | --- | --- |
| §4.2 첫 줄 | userA 12장, 두 계정 모두 첫 방에 입장 중 | userA는 일반 10장에 미입장, userB는 5장에 입장 중(게이지 50) |

A-08이 U-01에 넘기는 것은 6.8의 `demo-messages.json`과 그 실제 판정 결과, 검증 날짜다(`anonymous-plan.md` §3).

## 2. 문환P 담당 범위

메시지 안전 필터(팬 메시지와 인플루언서의 답변·전체 메시지·인사말), 품질 점수, 수정 문장, 유사 질문 묶기, 대화 요약의 LLM 로직과 프롬프트, 금칙어 폴백을 맡는다. 인증, 입출력 검증, 호출 제한, 멱등성, 저장, 실패 응답은 홍주P가 맡는다. 우선순위 점수는 DB에서 계산하며 AI 모듈의 범위가 아니다. 카드 발급에서는 확률 계산과 지급 함수 `private.issue_card`를 맡는다.

**작업 경로:** `supabase/migrations/`의 `issue_card` migration과 그 시험, `supabase/functions/_shared/ai.ts`와 `supabase/functions/_shared/ai/`의 `AiAdapter` 구현과 프롬프트, `lib/ai/tests/`의 필터 테스트 세트와 스크립트. 파일별 책임은 6.1에 있다. Deno에서 동작해야 하며, 외부 SDK의 Deno 동작은 A-01에서 확인한다. `lib/ai/index.ts` 스텁은 이전 구조의 산출물이다. `lib/ai/tests/`의 시험 데이터는 유지하고, 실제 adapter를 돌리는 Deno 회귀 스크립트를 A-08에서 여기에 추가한다. `lib/ai/tests/server.ts`는 adapter와 별개 구현인 모델 비교 도구다.

**환경변수:** `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`를 Edge Function Secrets로 설정한다. 클라이언트에 두지 않는다. 로컬 실호출 시험은 `lib/ai/tests/.env`(커밋하지 않음)를 쓴다.

**받는 것 (의존)**

- 홍주P: root bootstrap과 스키마 (B-01), `complete_round` (B-03), `submit-message` 전송 계층과 저장 (B-06), `summarize-room`·`cluster-questions` 전송 계층 (B-12)

**주는 것**

- `private.issue_card` (A-09) → 홍주P B-03
- `AiAdapter.moderateAndScore` (A-02, A-03, A-07) → 홍주P B-06, B-08, B-15, B-16
- `AiAdapter.clusterQuestions`, `AiAdapter.summarize` (A-04, A-05) → 홍주P B-12
- 항목별 고정 안내문 → 홍주P
- 시연 문장과 판정 결과 (A-08) → U-01

| category | 구분 | 고정 안내문 (2026-11-11 문환P 검수 확정) |
| --- | --- | --- |
| profanity | 선택 | 욕설이나 비속어가 포함되어 메시지가 전송되지 않았어요. 거친 표현은 빼고 부드러운 말로 바꿔 주시면 감사하겠어요. |
| belittling | 선택 | 상대를 깎아내리는 표현이 포함되어 메시지가 전송되지 않았어요. 상대의 의견을 존중하는 말투로 다시 작성해 주세요. |
| appearance | 선택 | 외모나 몸매를 평가하는 표현이 포함되어 메시지가 전송되지 않았어요. 외모 대신 스크린골프 플레이나 대화 주제에 집중해 주세요. |
| threat | 항상 차단 | 상대에게 해를 끼치겠다는 내용은 전송할 수 없어요. |
| stalking | 항상 차단 | 상대의 위치나 일상을 살피는 내용은 전송할 수 없어요. |
| sexual_harassment | 항상 차단 | 성적인 언급이나 요구가 포함되어 전송할 수 없어요. |
| privacy | 항상 차단 | 주소, 연락처 등 개인 정보를 묻거나 공개하는 내용은 전송할 수 없어요. |
| hate | 항상 차단 | 특정 집단에 대한 혐오 표현은 전송할 수 없어요. |
| illegal_ad | 항상 차단 | 불법 광고나 도박 홍보 내용은 전송할 수 없어요. |
| spam | 항상 차단 | 같은 내용의 반복이나 무의미한 글은 전송할 수 없어요. |

이 표가 고정 안내문의 유일한 기준이다. `lib/ai/tests/data/filter-templates.json`은 이 표에 맞춘다. 사람 검수는 문환P가 A-08에서 한다.

## 3. AI 인터페이스와 발급 함수

### AI 인터페이스

`홍주P_plan.md` §8.1(계약 1.6, 1.5에서 변경 없음)의 `AiAdapter`와 같은 타입이다. 골격은 끝났고(A-01) 세 함수는 샌드박스에서 구현했으며 레포 이관을 기다린다(A-02~A-05).

```ts
type Verdict = 'pass' | 'suggest' | 'block';
type FilterCategory =
  | 'profanity' | 'belittling' | 'appearance'
  | 'threat' | 'stalking' | 'sexual_harassment' | 'privacy' | 'hate' | 'illegal_ad' | 'spam';

interface AiAdapter {
  moderateAndScore(input: {
    body: string;
    disabledFilters: string[];  // FilterCategory 값만 온다
    senderType?: 'user' | 'influencer'; // 없으면 user
    signal: AbortSignal;
  }): Promise<{
    verdict: Verdict;
    category: string | null;   // FilterCategory 값만 돌려준다
    reason: string | null;     // adapter는 항상 null. 최종 안내문은 category별 고정 문구로 홍주P가 만든다
    rewrite: string | null;
    quality: number;           // 0~100
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
```

- **모델:** 판정·재검사·품질 점수는 Jev, 수정 문장·묶기·요약은 Claude Haiku 5.5다. Claude 호출은 모두 사고 단계를 끈다.
- **판정:** Jev 항목별 확률이 기준값 0.5 이상이면 위반으로 본다. 차단 여부는 모델이 아니라 코드 규칙이 정한다. 항상 차단 항목이 하나라도 있으면 `block`, 선택 항목만 있으면 `suggest`, 없으면 `pass`다.
- **`quality`:** Jev의 품질 질문 응답(0~4)에 25를 곱해 0~100으로 맞춘다.
- **`senderType`:** 값에 따라 Jev 문맥과 spam 질문 설명(6.2 `[결정]`)만 바뀌고 코드 규칙은 같다. 답변·전체 메시지·인사말은 홍주P가 선택 항목을 모두 `disabledFilters`로 넘겨 필수 7개만 검사한다.
- **`category`:** 항상 차단 항목을 우선하고, 그 안에서 확률이 높은 항목을 고른다. `pass`면 `null`이다.
- **`category` 불변식:** `block`이면 항상 차단 항목, `suggest`면 `disabledFilters`에 없는 선택 항목, `pass`면 `null`이다. `disabledFilters`에 있는 항목을 `category`로 돌려주면 홍주P가 계약 오류로 거부한다(`홍주P_plan.md` §8.2).
- **`disabledFilters`:** 선택 항목만 무시한다. 항상 차단 항목은 목록에 있어도 무시하지 않는다.
- **`rewrite`:** `suggest`일 때만 값이 있을 수 있으며 1~2000자다. 다음 경우에는 `null`이고 판정은 `suggest`로 유지한다: 재검사에서 위반이 나오거나 재검사 호출이 실패할 때, 생성에 실패하거나 시한을 넘길 때, 2000자를 넘을 때, 폴백 판정일 때. 재검사에는 `disabledFilters`를 적용하지 않는다. 수정 문장은 그대로 보내면 다시 검사하지 않고 전송되고 다른 팬에게 인용될 수 있으므로, 전 항목을 통과한 것만 돌려준다.
- **`rewriteQuality`:** 재검사 호출에서 받은 수정 문장의 품질 점수다. 추가 호출은 없다. `rewrite`가 `null`이면 `null`이다.
- **`passesAllFilters`:** 같은 판정 호출의 항목별 결과에서 `disabledFilters`를 적용하지 않고 계산하므로 추가 호출이 없다. `suggest`와 `block`이면 `false`다. `pass`인데 꺼 둔 선택 항목에 걸린 메시지도 `false`다. 폴백 판정이면 항상 `false`다.
- **시한:** `moderateAndScore` 전체에 8초 마감 하나를 둔다. 각 호출은 자기 상한과 남은 시간 중 짧은 쪽을 쓴다. 상한은 Jev 판정 4초(A-01 측정: 새 프로세스 5회 첫 호출이 253~562ms라 4초로 확정), 재검사 1.5초, 수정 문장은 재검사 몫 1.5초를 뺀 남은 시간이다. 재시도는 하지 않는다.
- **`signal`:** Edge가 전체 시한으로 건다. 판정 전에 취소되면 폴백 판정을 돌려주고, 수정 문장 생성이나 재검사 중에 취소되면 `suggest`와 `rewrite: null`을 돌려준다.
- **장애:** Jev가 실패하거나 시한을 넘기거나 키가 없거나, Jev 응답 형식이 불량하면(10개 항목이 모두 0~1 유한수이고 품질이 0~4 유한수가 아니면) adapter 안에서 금칙어 폴백으로 판정을 돌려준다. adapter 최종 반환값의 불량은 폴백이 아니라 홍주P의 `FILTER_UNAVAILABLE`이다. 폴백에도 같은 코드 규칙과 `disabledFilters`를 적용하므로 선택 항목에 걸리면 `suggest`(`rewrite: null`), 항상 차단 항목에 걸리면 `block`이다. `quality`는 50, `rewriteQuality`는 `null`이다. 폴백 여부는 응답에 표시하지 않고, adapter가 서버 로그에 `ai_fallback`과 사유 코드(`no_key`, 시한 초과와 취소는 `timeout`, 5xx와 형식 불량을 포함한 그 밖의 실패는 `provider_error`)만 남긴다. 위반 집계에서 폴백을 빼기 위한 내부 필드는 실서비스 과제다.
- **금칙어:** `supabase/functions/_shared/`의 코드 상수로 두고 `profanity`, `threat`, `sexual_harassment`, `hate`, `illegal_ad`만 다룬다. 공백·특수문자를 지운 뒤 부분 일치로 검사하며, 위협 표현은 단어가 아니라 구문(예: `죽여버`)으로 등록한다. 문맥이 필요한 항목은 장애 중 잡지 못하며 `prd.md`가 받아들인 한계다.
- **`clusterQuestions`·`summarize`:** 일반 응답(비스트리밍)으로 사고 단계를 끄고 호출하며, 인플루언서가 실행할 때만 동작한다. 각각 20초 시한이고 재시도와 폴백은 없다(Edge는 25초 `signal`과 29초 lease를 쓴다). 실패하면 예외를 던지고 홍주P가 `FILTER_UNAVAILABLE`로 돌려준다. 요약이 2,000자를 넘으면 마지막 문장 경계에서 자르고, 경계가 없으면 2,000자에서 자른다. 묶기 재검사는 Jev 동시 5개로 제한한다.
- **입력 처리:** 유저 메시지는 검사나 요약의 대상일 뿐이며, 메시지 안의 지시를 따르지 않게 한다. 메시지 본문, 수정 문장, 키를 로그에 남기지 않는다.

### 카드 발급 함수

샌드박스에서 구현하고 확인했다(A-09). 레포 이관을 기다린다.

```sql
private.issue_card(
  p_user_id uuid,
  p_round_id uuid,
  p_force_grade card_grade default null
) returns jsonb
-- {drawId, grade, template: {id, influencerId, influencerName, influencerType, verifiedAt, style, imagePath},
--  isNew, ownedCount, entryUnlocked}
```

- **호출 조건:** `complete_round`가 같은 트랜잭션 안에서 사용자 잠금과 강제 등급 권한 검사를 마친 뒤에만 호출한다. 이 함수는 잠금, 멱등, 권한을 처리하지 않는다. 임의의 `p_user_id`를 받으므로 `SECURITY INVOKER`로 만들고 `search_path=''`를 적용하며, `REVOKE ALL ... FROM PUBLIC, anon, authenticated`로 실행 권한을 회수한다.
- **추첨:** `grade_rates`로 등급을 뽑고 발급 대상 카드 템플릿 중 하나를 균등하게 뽑는다. 선택 로직은 난수를 인자로 받는 함수로 분리해 경계값을 결정적으로 시험하고, 실제 난수는 스키마까지 적은 `extensions.gen_random_bytes`로 만든다(설치 스키마는 B-01에서 확인).
- **강제 발급:** `p_force_grade`가 있으면 그 등급으로 발급하고 `draws.forced`를 `true`로 저장한다. 템플릿은 강제하지 않는다.
- **`isNew`:** 추첨 후 지급 직전에 해당 템플릿의 전체 등급 수량 합계가 0이면 `true`다. 같은 값을 `draws.is_new`에 저장한다.
- **`ownedCount`:** `홍주P_plan.md` §7.1의 기존 의미를 따른다(해당 템플릿·등급의 지급 직후 수량).
- **`entryUnlocked`:** 해당 인플루언서의 `draws` 건수로 `발급 전 < min_earned_draws AND 발급 후 >= min_earned_draws`이면 `true`다(`game_config`의 `room_entry.min_earned_draws`). 강제 발급도 포함한다. 이 값을 나중에 바꿔도 소급 안내는 없고 이 식만 따른다.
- **실패:** 설정 오염은 `CONFIG_INVALID` 예외로 전체를 롤백한다.

## 4. 문환P 티켓

| ID | 티켓 | 티어 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- |
| A-01 | Jev·Claude 호출의 Deno 동작 확인, `AiAdapter` 구현 골격 제공 | P0 | - | `deno check` 통과, 홍주P의 fixture adapter와 교체 가능(`createAiAdapter()`가 §8.1 타입을 만족하고, 세 함수는 구현 전까지 예외를 던진다). Deno에서 Jev·Claude 실호출 각 1회 성공, Jev 첫 호출 지연 5회 측정 후 시한 확정, 품질 질문(`type: "score"`)의 요청·응답 형식 확인 |
| A-02 | 메시지 안전 필터 — jev로 10개 항목 판정, 코드 규칙으로 처리 결정. `suggest`일 때 Claude로 수정 문장 생성과 재검사. 인플루언서 메시지는 `senderType`으로 판정 | P1 | A-01 | verdict·category·rewrite·`passesAllFilters`·`rewriteQuality` 반환. 수정 문장 재검사는 전 항목 기준(`disabledFilters` 미적용). `category` 불변식 단위 시험 통과. 첫 호출을 제외하고 `suggest`를 제외한 판정 응답 2초 이내, `suggest`도 8초 안에 응답 |
| A-03 | 메시지 품질 점수 — 구체성·답변 가치를 0~100으로 (A-02와 같은 jev 호출). 중복은 A-04에서 처리 | P1 | A-02 | quality 필드 반환. 시험 세트의 `specific` 문장 평균이 `greeting`보다 높고, `specific` 전 문장이 `greeting` 평균보다 높음 |
| A-04 | 유사 질문 묶기 `clusterQuestions` — 방 전체 일괄 처리 | P2 | A-02 | 최대 100건·20,000자 입력. 2건 이상인 묶음만 반환, 대표 질문 200자 이내, 없는 ID·중복 ID 제외. 대표 질문은 다른 팬에게 공개되므로 개인 식별 내용을 빼고 전 항목(`disabledFilters` 미적용) 필터로 재검사하며, 재검사에서 위반이 나온 묶음만 반환에서 제외. 재검사 호출 실패나 시한 초과가 하나라도 있으면 `[]`가 아니라 예외. 20초 시한 |
| A-05 | 대화 요약 `summarize` | P2 | A-01 | 최대 100건·20,000자 입력을 20초 안에 2,000자 이내 문자열로 요약하고, 넘으면 문장 경계에서 자름. 100건 소요 시간과 사고 단계를 끈 효과 측정. 실패 시 예외 |
| A-07 | LLM 실패·지연 시 금칙어 폴백 (adapter 내부) | P1 | A-02 | API 키를 빼도 필터가 금칙어로 동작하고 예외를 던지지 않음. 금칙어 5개 항목의 적중 문장이 기대 판정(선택 항목 `suggest`·`rewrite: null`, 항상 차단 `block`)과 `quality` 50을 돌려주고, 꺼 둔 선택 항목은 `pass`. Jev 지연·5xx 모의에서 사유 코드 확인. 키 제거 시험은 로컬에서만 하고 Supabase Secrets는 지우지 않음. `moderation-test-set.json`의 `quality` 그룹 100문장 오탐 0건, `trap` 그룹 `pass` 기대 25문장은 결과 기록. `passesAllFilters`는 항상 `false`, 서버 로그에는 사유 코드만 남음 |
| A-08 | 필터 검증용 테스트 문장 세트 + Deno 회귀 스크립트 + 시연 메시지 판정 사전 확인 + 고정 안내문 사람 검수 | P1 | A-02 | 혐오 기대값을 `block`으로 고치고(`moderation-test-set.json`의 17문장) `server.ts`의 혐오 구분은 `prd.md`, `filter-templates.json`은 2절 표에 맞춤. Deno 스크립트로 `moderation-test-set.json` 판정 300문장 전량과 `expected_verdict=suggest`에서 뽑은 수정 문장 30건 표본을 실행(`ai_fallback`이 1건이라도 나오면 그 실행은 무효). 기대 판정 일치율 90% 이상(불일치는 읽어 보고 필터 오류와 기대값 오류를 구분, 항상 차단 항목의 `block→pass` 건수는 따로 기록), 실제 판정이 `suggest`인 표본 중 수정 문장 재검사 통과 80% 이상, 시연용 문장(`demo-messages.json`)은 전부 기대대로, 안내문 10개 확정. `influencer-message-set.json`(정상 홍보·공지 20문장, 필수 항목 위반 10문장)의 정상 문장 오탐 0건, 위반 문장은 결과 기록. 선택 필터를 끈 상태에서 `pass`가 되는 욕설 문장의 `passesAllFilters`가 `false`인지 확인 |
| A-09 | 카드 확률 계산과 발급 `private.issue_card` | P0 | B-01 (전에는 로컬 테이블로 진행) | 등급·템플릿 선택 경계값 시험 통과, 1,000회 분포 기록과 등급별 3σ 범위 확인(벗어나면 다시 돌리기 전에 원인 확인), 강제 발급 시 `forced` 저장, 누적 4→5장 `entryUnlocked` true·5→6장 false, `min_earned_draws` 변경 시 경계 이동, `user_cards`만 있고 `draws`가 없으면 누적 0, 설정 누락·음수·합계 오류는 `CONFIG_INVALID`이고 소수 확률은 허용, 저장 실패 시 `draws`·`user_cards` 변경 없음, `has_function_privilege`로 `anon`·`authenticated`의 EXECUTE가 false임을 확인 |

> **이관:** A-06(카드 이미지 30장 생성, P0)은 현호P가 AI 툴로 생성하는 것으로 옮겼다. 내용은 1절의 현호P 항목을 따른다.

### 체크리스트

완료 표시에는 7.2의 검증 기록이 필요하다. 단위 시험만 통과한 상태와 실호출까지 확인한 상태를 구분해 적는다.

- [ ] **A-01** Jev·Claude 호출의 Deno 동작 확인, `AiAdapter` 구현 골격 제공 (P0) — 단위 시험·샌드박스 실호출 확인, 레포 이관·홍주P 통합 대기, 명세 6.1~6.3
- [ ] **A-02** 메시지 안전 필터 — 판정, 코드 규칙, 수정 문장과 재검사 (P1) — 단위 시험·샌드박스 실호출·Edge 경로 확인. 후속 조정 2회차에서 수정 문장 재검사 통과율 96.6%로 기준 충족(7.2 단서 참고). 레포 이관·홍주P 통합 대기, 명세 6.2~6.4
- [ ] **A-03** 메시지 품질 점수 (P1) — 완료 기준 충족(7.2), 레포 이관·홍주P 통합 대기, 명세 6.2
- [ ] **A-04** 유사 질문 묶기 `clusterQuestions` (P2) — 단위 시험·샌드박스 실호출 확인. 묶음 품질 관찰 사항은 7.2, 홍주P 통합 대기, 명세 6.6
- [ ] **A-05** 대화 요약 `summarize` (P2) — 단위 시험·샌드박스 실호출 확인. 요약 품질 관찰 사항은 7.2, 홍주P 통합 대기, 명세 6.7
- [ ] **A-07** 금칙어 폴백 (P1) — 완료 기준 충족(폴백 모드 실행 결과 7.2), 레포 이관 후 재실행 대기, 명세 6.5
- [ ] **A-08** 테스트 세트, 시연 메시지 확인, 고정 안내문 검수 (P1) — 회귀 2회와 후속 조정 회귀 2회 실행(7.2). 후속 2회차에서 일치율 94.7%, 수정 문장 96.6%, 시연 7/7, 검증 65/65로 기준 충족(7.2 단서 참고). 고정 안내문은 2026-11-11 사용자 검수로 확정. 레포 이관 대기, 명세 6.8
- [ ] **A-09** 카드 확률 계산과 발급 `private.issue_card` (P0) — 단위 시험(pgTAP)·1,000회 분포 확인, 레포 이관·홍주P 통합 대기, 명세 6.9

## 5. 문환P 타임라인

| 구간 | 할 일 | 넘겨야 하는 것 |
| --- | --- | --- |
| 사전 준비 | 0.3 준비물 설치, A-01 (샌드박스) | - |
| 1일차 오전 | T-01·T-02 킥오프(1절 R1~R6 확인), A-09 | 오전이 끝나기 전에 `issue_card` migration과 시험 → 홍주P B-03. adapter 골격(`ai.ts`) → 홍주P B-06 착수 전 |
| 1일차 오후 | A-02, A-03 | `moderateAndScore` 실제 구현 → 홍주P B-06 |
| 1일차 저녁 | T-03 P0 통합 (전원) | `completeRound`가 `issue_card`를 거쳐 응답하는지 확인 |
| 1일차 밤 | A-07, A-08, 프롬프트 튜닝 | 시연 문장과 판정 결과 → U-01, 확정 안내문 → 홍주P |
| 2일차 오전 | A-04, A-05 | `clusterQuestions`·`summarize` → 홍주P B-12 |
| 2일차 점심 | T-04 P1 통합 (전원) | 실제 키로 pass·suggest·block 3판정 확인 |
| 2일차 오후 | 프롬프트 튜닝 → 기능 동결 → T-05 리허설 | - |

## 6. 구현 명세

### 6.1 파일 구조

```text
supabase/functions/_shared/ai.ts             경계 파일. AiAdapter 타입(홍주P §8.1 그대로)과 createAiAdapter() (1절 R1)
supabase/functions/_shared/ai/categories.ts  10개 항목의 key·구분·Jev 설명, 기준값 0.5, 품질 질문
supabase/functions/_shared/ai/decide.ts      점수 → verdict·category·passesAllFilters (순수 함수)
supabase/functions/_shared/ai/jev.ts         Jev 호출과 응답 형식 검증
supabase/functions/_shared/ai/claude.ts      Anthropic SDK 클라이언트 생성과 공통 호출 옵션
supabase/functions/_shared/ai/keywords.ts    금칙어 상수
supabase/functions/_shared/ai/fallback.ts    금칙어 판정
supabase/functions/_shared/ai/moderate.ts    moderateAndScore: 마감, 수정 문장, 재검사, 폴백, 로그
supabase/functions/_shared/ai/cluster.ts     clusterQuestions
supabase/functions/_shared/ai/summarize.ts   summarize
supabase/functions/_shared/ai/*_test.ts      deno test. 네트워크 없이 호출 함수를 주입해 시험
supabase/migrations/<timestamp>_issue_card.sql   private.issue_card와 보조 함수 (1절 R4)
supabase/tests/issue_card.test.sql               pgTAP 시험
lib/ai/tests/smoke.ts                        A-01 실호출 확인과 지연 측정
lib/ai/tests/regress.ts                      A-08 회귀 스크립트
lib/ai/tests/sql/issue_card_distribution.sql A-09 1,000회 분포 (supabase test db의 대상이 아님)
lib/ai/tests/data/                           기존 4개 + influencer-message-set.json, demo-messages.json
```

상대 import에는 `.ts` 확장자를 붙이고 Node 전용 API를 쓰지 않는다. adapter는 `lib/ai/tests/`를 import하지 않는다.

### 6.2 Jev 호출과 항목 정의

`POST https://api.typesafe.ai/v1/systemone`, `Authorization: Bearer $TYPESAFE_API_KEY`, `Content-Type: application/json`. SDK 없이 `fetch`로 호출한다. 재시도는 없다.

```json
{
  "model": "jev-latest",
  "state": { "context": "<문맥>", "message": "<검사할 본문>" },
  "questions": {
    "<항목 key>": { "type": "noul", "instructions": "이 메시지에 다음 내용이 포함되어 있는가: <설명>" },
    "quality": { "type": "score", "instructions": "<품질 지시>", "criteria": ["<레벨 0>", "…", "<레벨 4>"] }
  }
}
```

- 한 요청에 항목 10개와 `quality`를 함께 보낸다. 응답은 `answers.<key>.noul`(0~1)과 `answers.quality.score`(0~4)다.
- `[측정]` 확인함(A-01, 2026-11-11, 실호출 5회): `type: "score"` 질문에 `criteria` 배열을 보내면 요청이 받아들여지고, 응답은 `answers.quality.score`(실측 3.2~3.26)이다. 같은 객체에 `confidence`, `legend`, `probabilities`도 오지만 쓰지 않는다. 형식이 달라진 곳은 없다.
- 형식 검증: 10개 항목이 모두 0~1 유한수이고 `quality.score`가 0~4 유한수여야 한다. 하나라도 어긋나면 호출 실패로 본다.
- `quality = round(clamp(score × 25, 0, 100))`.

**문맥**

| `senderType` | `context` 값 | 상태 |
| --- | --- | --- |
| `user` | 스크린골프 인플루언서 팬 채팅방에서 유저가 인플루언서에게 보내려는 메시지 | 기존 시험에서 쓴 값 |
| `influencer` | 스크린골프 인플루언서 팬 채팅방에서 인플루언서가 팬에게 보내려는 메시지(답변, 전체 공지, 인사말) | `[결정]` 초안. A-08의 `influencer-message-set.json`으로 검증한다. 정상 홍보·공지가 `spam`·`illegal_ad`로 걸리는지를 본다 |

수정 문장과 대표 질문의 재검사에는 `user` 문맥을 쓴다.

**항목** (설명은 2026-11-09 확장 시험에서 조정한 문구다. `hate`는 `prd.md` 6절에 따라 항상 차단으로 옮겼다)

| key | 표시명 | 구분 | Jev 질문에 넣는 설명 |
| --- | --- | --- | --- |
| profanity | 욕설 | 선택 | 욕설이나 비속어. 사람을 향하지 않고 골프 샷을 설명하는 거친 은어는 포함하지 않는다 |
| belittling | 가벼운 비하 | 선택 | 상대를 깎아내리거나 조롱하는 표현 |
| appearance | 외모 평가 | 선택 | 상대의 외모나 몸매를 평가하는 표현 |
| threat | 협박 | 항상 차단 | 해를 끼치겠다는 위협. 직접 말하지 않고 사고, 안전, 신변을 들먹이며 불안하게 만드는 암시나 돌려 말하는 경고도 포함한다 |
| stalking | 스토킹성 | 항상 차단 | 집요하게 따라다니거나 위치와 일상을 감시하는 내용. 공개되지 않은 동선, 차량, 옷차림, 집 주변을 직접 보았다거나 안다고 드러내는 내용, 사적인 공간에 몰래 접근했다는 내용도 포함한다. 방송 밖에서 상대를 직접 보았거나 엿들었다고 말하는 내용은 칭찬처럼 말해도 포함한다 |
| sexual_harassment | 성희롱 | 항상 차단 | 성적인 언급이나 요구. 운동이나 골프 표현에 빗댄 성적 암시도 포함한다 |
| privacy | 사생활 침해 | 항상 차단 | 주소, 연락처, 가족 등 사적인 정보를 캐거나 공개하는 내용. 사는 곳을 안다고 드러내거나 수입, 연애사를 캐묻는 내용도 포함한다 |
| hate | 혐오 표현 | 항상 차단 | 성별, 지역, 출신, 장애, 나이 등 집단에 대한 혐오. 노인이나 특정 세대를 싸잡아 깎아내리는 표현, 지역이나 출신을 빗댄 은어로 집단을 비하하는 표현도 포함한다 |
| illegal_ad | 불법 광고·도박 | 항상 차단 | 불법 광고나 도박 홍보. 은어로 표현한 불법 약물 판매나 비밀 거래 유도도 포함한다 |
| spam | 스팸·도배 | 항상 차단 | 광고성 권유, 무의미한 내용을 복사해 붙인 도배, 같은 글자나 문구를 기계적으로 길게 반복하는 도배. 경기를 응원하는 짧은 구호나 감탄사를 몇 번 반복하는 것은 포함하지 않는다 |

`[결정]` (2026-11-11 후속 조정) spam 설명 끝에 붙이는 문장 "채팅방의 인플루언서가 자기 레슨, 굿즈, 이벤트, 방송 일정을 알리는 공지는 포함하지 않는다"는 `senderType: "influencer"`일 때만 붙인다(코드 상수 `SPAM_INFLUENCER_NOTE`). 팬의 자기 홍보는 그대로 spam이다. hate·stalking 설명의 마지막 문장은 선택 필터를 끈 설정에서 항상 차단 대상이 비하·외모로만 잡혀 통과한 문장(#132·#139·#140·#142, #183·#186)의 유형을 일반화해 더했다. threat에도 #170 유형 문장을 더했으나 후속 1회차에서 검증 세트의 직접 협박 2건과 인플루언서 세트 1건이 새로 통과해 되돌렸다. 조정 근거 문장의 개선은 독립 검증이 아니다. stalking 보강 문구의 "방송 밖에서"는 승인한 계획의 "공개되지 않은 시간·장소에서"보다 넓어 대회장·팬미팅·사인회 같은 공개 장소에서 직접 봤다는 정상 문장도 걸릴 수 있다. 이 유형의 정상 문장은 시험 세트에 없어 오탐률은 미확인이다(문구 확정은 사용자 확인 대기).

**품질 질문**

- `instructions`: `이 메시지가 인플루언서가 답할 가치가 얼마나 있는지 구체성과 답변 가치를 기준으로 평가한다.`
- `criteria` (레벨 0부터):
  0. 인사, 응원, 감탄처럼 답을 기대하지 않는 메시지
  1. 주제가 없거나 막연해서 답하기 어려운 질문
  2. 주제는 있지만 누구에게나 해당하는 일반적인 질문
  3. 자신의 상황이 일부 드러나 있어 구체적으로 답할 수 있는 질문
  4. 구체적인 상황, 수치, 시도한 내용이 담겨 있어 답변이 다른 팬에게도 도움이 되는 질문

**이전 시험 결과 (참고, 2026-11-09, Node 시험 서버)**: 60문장 판정 60/60, 응답 중앙값 약 0.17초, 첫 호출에서 3.8초가 1회 측정됨. 검증 140문장은 기대 판정 일치 129, 차단 대상 놓침 9, 정상 문장 오탐 1이었다. 당시에는 `hate`가 선택 항목이었으므로 A-08에서 다시 측정한다.

### 6.3 Claude 호출 공통

- `[결정]` 공식 SDK `@anthropic-ai/sdk`를 쓴다(시험 서버에서 1.6.0으로 요청 형식을 확인했다). Deno에서는 `npm:` 지정자로 가져온다. `[측정]` Deno와 Edge에서의 동작은 A-01에서 확인하고, 동작하지 않으면 멈추고 사용자에게 보고한다.
- 클라이언트는 `maxRetries: 0`으로 만든다. SDK 기본값은 2회 재시도라 "재시도 없음"과 8초 마감을 깨뜨린다.
- 호출마다 `timeout`(밀리초)과 `signal`을 넘긴다.
- 모델은 `claude-haiku-5-5`, `thinking: { type: "disabled" }`, `output_config.effort: "low"`다. Haiku 5.5에서 사고 단계 끄기는 effort가 `high` 이하일 때만 허용된다.
- `stop_reason`이 `end_turn`이 아니면(거절, 길이 초과 포함) 결과 없음으로 처리한다.
- 유저 메시지는 `<message>`나 `<chat>` 태그 안에 넣고, system 프롬프트에 그 안의 지시를 따르지 않는다고 적는다.
- `[결정]` A-02·A-04·A-05가 이어받는 요구사항: `callClaudeJson`은 SDK 오류를 그대로 통과시키고(메시지에 API 오류 본문이 들어 있을 수 있다) JSON 모양을 검증하지 않는다. 그래서 호출하는 쪽이 오류를 이유 코드로 감싸고, 오류 메시지를 로그에 남기지 않고, 결과의 모양을 검증한다.
- 프롬프트의 출발점은 `lib/ai/tests/server.ts`의 `rewriteMessage`, `groupQuestions`, `summarize`다. 달라지는 부분은 6.4, 6.6, 6.7에 적었다.

### 6.4 `moderateAndScore` 처리 순서

1. 마감 시각을 지금부터 8초로 잡는다. 이후 모든 호출의 시한은 자기 상한과 남은 시간 중 짧은 쪽이고, 입력 `signal`과 함께 건다.
2. `TYPESAFE_API_KEY`가 없으면 폴백(`no_key`)으로 간다.
3. Jev 판정을 호출한다(상한 4초, 문맥과 spam 질문 설명은 `senderType`에 따름). 실패하거나 형식이 불량하면 폴백으로 간다.
4. `decide`가 점수와 `disabledFilters`로 `verdict`, `category`, `passesAllFilters`를 정한다.
   - 전 항목 기준 위반 = 점수 0.5 이상인 항목. 적용 위반 = 그중 항상 차단 항목과 `disabledFilters`에 없는 선택 항목.
   - 적용 위반에 항상 차단 항목이 있으면 `block`, 선택 항목만 있으면 `suggest`, 없으면 `pass`.
   - `category`는 적용 위반 중 항상 차단 항목을 우선하고 그 안에서 점수가 높은 항목이다.
   - `passesAllFilters`는 전 항목 기준 위반이 없을 때만 `true`다.
5. `pass`와 `block`은 여기서 반환한다(`rewrite`와 `rewriteQuality`는 `null`).
6. `suggest`면 수정 문장을 만든다. `ANTHROPIC_API_KEY`가 없거나 남은 시간이 1.5초 이하면 건너뛴다. Claude 호출의 시한은 남은 시간에서 1.5초를 뺀 값이다.
   - 프롬프트에 넣는 "문제가 된 내용"은 전 항목 기준 위반 항목의 설명이다(재검사가 전 항목 기준이므로). 호출자가 넘긴 문자열은 프롬프트에 넣지 않는다.
   - `max_tokens` 1000, 구조화 출력 `{ rewritten: string }`.
   - `[결정]` (2026-11-11 후속 조정) 고친 문장에 상대의 외모·얼굴·체형·머리숱·옷차림·실력·인기·장비를 평가하거나 비교하는 말을 넣지 않고, 원래 메시지에 남길 내용이 없으면 방송이나 플레이에 대한 짧고 중립적인 응원 한 문장으로 쓴다. "내용을 새로 지어내지 않는다"의 예외다. 이 문장은 팬이 보고 그대로 보낼지 고르며, 수락하면 재검사 없이 `passesAllFilters=true`로 저장돼 인용될 수 있다(`홍주P_plan.md` §8.1). 중립 응원으로 바뀐 건수와 원래 뜻 유지 여부는 원문을 저장하지 않아 미확인이다.
   - 결과 없음, 빈 문자열, 2,000자(Unicode code point) 초과는 `rewrite: null`이다.
7. 수정 문장을 Jev로 재검사한다(상한 1.5초, `user` 문맥). 10개 항목 중 하나라도 0.5 이상이거나 호출이 실패하면 `rewrite: null`이다. 통과하면 `rewrite`에 문장을, `rewriteQuality`에 재검사의 품질 점수를 넣는다.
8. `reason`은 항상 `null`로 반환한다.

**단위 시험 (호출 함수 주입, 네트워크 없음)**

- `decide`: 항목별 `pass`·`suggest`·`block`, 항상 차단과 선택이 함께 걸리면 `block`이고 `category`는 항상 차단 항목, 꺼 둔 선택 항목만 걸리면 `pass`·`category: null`·`passesAllFilters: false`, `disabledFilters`에 항상 차단 항목이나 없는 key가 있어도 차단 유지.
- `category` 불변식: 어떤 입력에서도 `disabledFilters`에 있는 항목이 `category`로 나오지 않는다.
- Jev 응답: 항목 누락, 숫자가 아닌 값, 범위 밖 값, 5xx, 시한 초과는 각각 폴백과 사유 코드.
- 수정 문장: 재검사 통과, 재검사 위반, 재검사 실패, 생성 거절, 2,000자 초과, 꺼 둔 선택 항목에 재검사가 걸려도 `null`.
- `signal`: 판정 전 취소는 폴백, 수정 문장 중 취소는 `suggest`·`rewrite: null`.
- 로그: 폴백 로그에 본문이 들어가지 않는다.

### 6.5 금칙어 폴백

- 정규화: 공백과 특수문자를 지우고 영문은 소문자로 바꾼 뒤 부분 일치로 검사한다.
- 걸린 항목 집합에 6.4의 4번과 같은 규칙과 `disabledFilters`를 적용한다. 확률이 없으므로 항상 차단 항목이 여러 개면 `categories.ts`의 정의 순서가 앞선 것을 `category`로 한다 `[결정]`.
- 반환값은 `quality: 50`, `rewrite: null`, `rewriteQuality: null`, `passesAllFilters: false`다.
- 로그는 `console.log(JSON.stringify({ event: "ai_fallback", reason }))` 한 줄이고 `reason`은 `no_key`·`timeout`·`provider_error` 중 하나다.
- 초기 금칙어 `[결정]` (A-07에서 `quality` 그룹 100문장 오탐이 0건이 되도록 조정한다). 공백을 지우고 비교하므로 "출시 발표"처럼 단어 경계를 넘어 금칙어가 만들어지는 문장이 걸릴 수 있다. A-07에서 이런 문장을 시험에 넣어 확인한다:

| category | 금칙어 |
| --- | --- |
| profanity | 씨발, 시발, 병신, 개새끼, 존나, 지랄 |
| hate | 한남, 김치녀, 틀딱 |
| threat | 죽여버, 가만안둬 |
| sexual_harassment | 섹스, 벗어봐, 야동 |
| illegal_ad | 토토, 바카라, 카지노 |

- 예외 복합어 `[결정]` (A-07): `출시발`, `시발점`, `시발역`, `유니섹스`. 공백을 지우고 부분 일치로 비교하면 "출시 발표"(`시발`)처럼 단어 경계를 넘어 금칙어가 생기거나 "시발점"·"시발역"(`시발`)·"유니섹스"(`섹스`)처럼 정상 단어가 금칙어를 품은 문장이 걸리기 때문이다. 정규화한 문장에서 예외 복합어를 먼저 `_`로 바꾼 뒤 금칙어를 검사한다. 지우지 않고 바꾸는 이유는 지우면 앞뒤 글자가 이어져 새 금칙어가 생기거나(이어 붙임) 같은 문장의 실제 금칙어가 가려질 수 있어서다. `_`는 글자·숫자가 아니라 이어 붙지 않는다. 예외 복합어와 실제 금칙어가 한 문장에 있어도("시발점 병신") 금칙어는 적중한다. A-07 결과 `quality` 그룹 100문장 오탐이 0건이라 목록은 초기값에서 늘리지 않았다.
- 수용한 잔여 위험 `[결정]`: 같은 우회가 마스킹하는 모든 예외 복합어에 적용된다. 공백을 지우면 `시발` 뒤에 `점…`·`역…`으로 시작하는 단어가 오는 "시발 점심", "시발 역시", "시발 점수"가 모두 예외 `시발점`·`시발역`에 가려지고, "유니 섹스"도 `유니섹스`에 가려져 적중하지 않는다. 앞에서 이어 붙는 경우도 같다. `출시발`이 "제출 시발"·"외출 시발"의 `시발`까지 가린다. 폴백은 LLM이 없을 때의 최소 안전망이라 이 정도의 미탐은 받아들이고, 빈도는 측정하지 않았다. 퇴보가 아니다. 예외를 지우던 이전 방식에도 같은 구멍이 있었고, 마스킹은 거기에 더해 이어 붙임으로 새 금칙어가 생기는 문제만 없앴다.

### 6.6 `clusterQuestions` 처리 순서

1. 메시지가 1건 이하면 Claude를 부르지 않고 `[]`를 반환한다.
2. 메시지에 1부터 번호를 붙여 `#번호 본문` 줄로 만든다. `MessageId`는 bigint 문자열이므로 모델에 넘기지 않고, 번호와 ID의 대응은 코드가 가진다.
3. Claude를 1회 호출한다. `max_tokens` 8000, 구조화 출력 `{ groups: [{ representative_question: string, message_ids: integer[] }] }`. `server.ts`의 `groupQuestions` 프롬프트에 다음을 더한다: 대표 질문은 200자 이내, 특정 개인을 알아볼 수 있는 내용(이름, 닉네임, 연락처, 장소 등)을 넣지 않는다. 입력에 방 이름과 유형이 없으므로 "스크린골프 인플루언서의 팬 채팅방"으로 쓴다.
4. 후처리는 이 순서로 한다: 없는 번호와 이미 쓴 번호를 뺀다 → 2건 미만이 된 묶음을 뺀다 → 대표 질문을 trim하고, 비었거나 200자(code point)를 넘으면 그 묶음을 뺀다(자르지 않는다. 잘린 문장은 뜻이 달라질 수 있다) `[결정]`.
5. 남은 묶음의 대표 질문을 Jev로 재검사한다(동시 5개, 호출당 상한 1.5초, 전 항목 기준). 위반이 나온 묶음은 뺀다. 재검사 호출이 하나라도 실패하거나 시한을 넘기면 전체를 예외로 끝낸다.
6. 전체 마감은 20초다. 키 없음, Claude 실패, 결과 없음, 마감 초과는 모두 예외다.

홍주P는 source 밖 ID나 중복 ID가 하나라도 있으면 결과 전체를 거부하므로(`홍주P_plan.md` §8.3) 4번의 걸러내기는 반환 전에 반드시 끝낸다. 개인 식별 내용 제거는 프롬프트 지시와 `privacy` 재검사에 의존하며, 그 밖의 식별 정보는 걸러지지 않을 수 있다(자동 제거는 `prd.md` 4절의 실서비스 과제다).

**단위 시험:** 1건 이하 입력, 없는 번호, 중복 번호, 걸러낸 뒤 1건 남는 묶음, 200자 초과 대표 질문, 재검사 위반 묶음만 제외, 재검사 실패 시 예외, 재검사 1.5초 초과 시 예외, 전체 20초 마감 초과와 `signal` 취소 시 예외, 반환 ID가 모두 입력에 있고 서로 겹치지 않음.

### 6.7 `summarize` 처리 순서

1. 메시지가 0건이면 Claude를 부르지 않고 `""`를 반환한다.
2. 메시지를 `[sender] 본문` 줄로 만든다. `id`는 모델에 넘기지 않는다. `sender`의 의미는 1절 R2를 따른다.
3. Claude를 1회 호출한다. 비스트리밍, `max_tokens` 4096, 구조화 출력 없이 평문으로 받는다 `[결정]`. 프롬프트 요구: 마크다운 기호 없는 한국어 평문 1,500자 이내, 전체 흐름 2~3문장, 주요 화제 최대 5개(한 줄씩), 답하면 좋은 질문 최대 5개(한 줄씩), 대화에 없는 사실을 지어내지 않는다, 인원수나 건수 같은 숫자를 쓰지 않는다(묶기 결과의 인원수와 어긋나지 않게).
4. 2,000자(code point)를 넘으면 2,000자 안의 마지막 문장 경계(`.`, `!`, `?`, 줄바꿈)에서 자르고, 경계가 없으면 2,000자에서 자른다.
5. 전체 마감은 20초다. 키 없음, 실패, 결과 없음, 마감 초과는 모두 예외다.

**단위 시험:** 0건 입력, 2,000자 초과 시 문장 경계 자르기, 경계 없는 긴 문자열, 결과 없음 시 예외, 20초 마감 초과와 `signal` 취소 시 예외.

**`[측정]` (A-05):** `rooms.json`의 한 방에서 100건·20,000자 이내로 만든 입력으로 소요 시간을 3회 재고, 사고 단계를 끈 경우와 켠 경우를 비교한다. 결과(2026-11-11, 실호출 1회, 입력 100건·2,834자): 사고 단계를 끈 경우 중앙값 4,230ms(3,842·4,422·4,230ms, 길이 666·881·782자), 켠 경우 중앙값 4,888ms(4,888·5,861·4,418ms, 길이 713·783·833자). 켠 경우가 중앙값 기준 658ms 느리고 길이 중앙값은 782자와 783자로 거의 같다. 두 경우 모두 20초 안이다. 입력이 상한 20,000자의 약 14%라 상한 길이에서의 소요 시간은 미확인이다. 표본이 3회라 두 경우 차이의 유의성은 미확인이다.

### 6.8 테스트 세트와 회귀 스크립트 (A-08)

**데이터 정리**

- `moderation-test-set.json`(300문장 = `quality` 100 + `filter` 150 + `trap` 50): `category`가 `hate`인 17문장(`filter` 15, `trap` 2)의 `expected_verdict`를 `suggest`에서 `block`으로 고친다.
- `filter-templates.json`: `reason`과 `guide`를 2절 표의 문구와 맞추고 `hate`의 `guide`를 없앤다.
- `server.ts`: `hate`의 구분을 항상 차단으로 고친다.
- `influencer-message-set.json` 신규: 정상 홍보·공지 20문장, 필수 항목 위반 10문장. 필드는 `text`, `expected_verdict`, `category`, `note`.
- `demo-messages.json` 신규: 시연에서 직접 입력할 무해한 문장. `pass` 2개, `suggest` 2개, `block` 2개와 선택 필터를 끈 방에서 `pass`가 되는 문장 1개. 필드는 `text`, `expected_verdict`, `category`, `disabledFilters`.

**회귀 스크립트 `lib/ai/tests/regress.ts`**

- 300문장 판정은 `jev.ts`의 호출 함수와 `decide`를 직접 써서 폴백에 가려지지 않게 한다. 호출이 하나라도 실패하면 종료 코드 1로 끝내고 그 실행은 무효다.
- 수정 문장은 `expected_verdict=suggest`인 문장에서 30건을 뽑아 `moderateAndScore` 전체 경로로 실행한다.
- 출력: 그룹별 일치 수, 기대→실제 집계, 불일치 목록, 항상 차단 항목의 `block→pass` 건수, `quality_tier`별 품질 평균·최소·최대, 수정 문장 재검사 통과율, 응답 시간 중앙값·최대.
- `influencer-message-set.json`은 `senderType: 'influencer'`와 선택 항목 3개를 `disabledFilters`로 넘겨 실행한다.
- `demo-messages.json`은 행마다 자기 `disabledFilters`로 `moderateAndScore`를 실행해 판정이 기대와 같은지 확인하고, 선택 필터를 끈 행은 `passesAllFilters`가 `false`인지도 확인한다. 이 결과와 실행 날짜를 U-01에 넘긴다.
- 폴백 모드(A-07): 키를 읽지 않고 `moderateAndScore`로 `quality` 그룹 100문장, `trap` 그룹의 `pass` 기대 25문장, 금칙어 적중 문장을 실행해 오탐 건수와 판정을 출력한다.
- 결과 파일은 `lib/ai/tests/results/`에 쓰고 커밋하지 않는다(`lib/ai/tests/.gitignore`에 추가). 수치는 7.2에 옮겨 적는다.
- 항목 설명을 고칠 때는 조정에 쓴 문장과 검증에 쓴 문장을 나눠 기록한다. 기대 판정은 AI가 붙인 값이므로 불일치는 읽어 보고 필터 오류와 기대값 오류를 구분한다.

### 6.9 `private.issue_card` 처리 순서

**보조 함수** (모두 `private`, `IMMUTABLE`, 같은 권한 회수 적용)

- `private.pick_grade(p_rates jsonb, p_roll numeric) returns card_grade`: `p_roll`은 0 이상 100 미만이다. `common → rare → epic → special` 순서로 확률을 누적해 `p_roll`이 처음으로 누적값보다 작아지는 등급을 고른다. 기본 설정에서 구간은 일반 [0, 70), 레어 [70, 90), 에픽 [90, 97.5), 스페셜 [97.5, 100)이다. 확률이 0인 등급은 뽑히지 않는다.
- `private.pick_index(p_count int, p_roll numeric) returns int`: `p_roll`은 0 이상 1 미만이고 `floor(p_roll × p_count)`를 돌려준다(0부터 `p_count - 1`).

**본 함수**

1. `game_config`에서 `grade_rates`와 `room_entry`를 읽어 검증한다. `grade_rates`는 네 등급 key가 모두 있고 값이 0 이상의 수이며 합이 100이어야 한다(소수 허용). `room_entry.min_earned_draws`는 양의 정수여야 한다. 발급 대상 카드 템플릿이 0건이어도 실패다. 실패는 `RAISE EXCEPTION 'CONFIG_INVALID' USING ERRCODE = 'P0001', DETAIL = '<비기밀 JSON>'`이다(`홍주P_plan.md` §6.2).
2. 난수 두 개를 `extensions.gen_random_bytes(4)`로 따로 만든다. 4바이트를 0 이상 2³² 미만의 정수로 읽어 2³²으로 나누면 0 이상 1 미만의 값이 된다.
3. 등급은 `p_force_grade`가 있으면 그 값이고, 없으면 `pick_grade(rates, 난수 × 100)`이다.
4. 템플릿은 `card_templates`를 `id` 순으로 정렬해 `pick_index(건수, 난수)` 번째를 고른다. 시연은 30종 전체가 대상이다.
5. `isNew`는 `user_cards`에서 이 유저와 이 템플릿의 전 등급 `count` 합계가 0(행 없음 포함)인지다.
6. 발급 전 누적은 이 유저의 `draws` 중 뽑힌 템플릿과 같은 `influencer_id`인 건수다.
7. `draws`에 `user_id`, `round_id`, `template_id`, `grade`, `is_new`, `forced`(`p_force_grade IS NOT NULL`)를 넣고 `id`를 받는다.
8. `user_cards`에 `(user_id, template_id, grade)`로 upsert해 `count`를 1 올리고, 올린 뒤의 값을 `ownedCount`로 쓴다.
9. `entryUnlocked`는 `발급 전 누적 < min_earned_draws AND 발급 전 누적 + 1 >= min_earned_draws`다.
10. 3절의 형태로 `jsonb`를 반환한다. 템플릿 정보는 `card_templates`와 `influencers`에서 읽고 `imagePath`는 `image_path` 그대로다.

같은 `round_id`로 두 번 호출하면 `draws.round_id`의 UNIQUE 제약으로 실패해 전체가 롤백된다. 멱등 처리는 `complete_round`가 한다.

**pgTAP 시험 `supabase/tests/issue_card.test.sql`**

| 묶음 | 사례 |
| --- | --- |
| 등급 경계 | `pick_grade`에 0, 69.999, 70, 89.999, 90, 97.499, 97.5, 99.999를 넣어 일반·일반·레어·레어·에픽·에픽·스페셜·스페셜. 스페셜 확률을 0으로 둔 설정에서 99.999는 스페셜이 아님 |
| 템플릿 경계 | `pick_index(30, 0)`은 0, `pick_index(30, 0.0333)`은 0, `pick_index(30, 0.0334)`는 1, `pick_index(30, 0.5)`는 15, `pick_index(30, 0.999999)`는 29 |
| 강제 발급 | `p_force_grade`가 있으면 그 등급이고 `forced=true`, 없으면 `forced=false` |
| `isNew` | 같은 템플릿의 다른 등급을 이미 가지고 있으면 `false`, 수량 0인 행만 있으면 `true` |
| `entryUnlocked` | 누적 4→5는 `true`, 5→6은 `false`. `min_earned_draws`를 3으로 바꾸면 2→3이 `true`. `user_cards`만 있고 `draws`가 없으면 누적 0으로 계산 |
| 설정 오류 | `grade_rates` 행 없음, 등급 key 누락, 음수, 합계 99는 `CONFIG_INVALID`. 70/20/7.5/2.5는 통과. 템플릿 0건은 `CONFIG_INVALID` |
| 원자성 | `user_cards` 쓰기에서 예외를 내는 시험용 트리거를 건 상태로 호출하면 예외가 그대로 올라오고 `draws`와 `user_cards`에 변경이 없음(`draws` INSERT 뒤의 실패가 삼켜지지 않는지 본다). 같은 `round_id`로 두 번째 호출도 실패하고 첫 호출 직후와 같음 |
| 권한 | `has_function_privilege`로 `anon`과 `authenticated`의 `issue_card`, `pick_grade`, `pick_index` EXECUTE가 모두 `false` |

**1,000회 분포 `lib/ai/tests/sql/issue_card_distribution.sql`**

트랜잭션 안에서 시험용 유저와 라운드 1,000건을 만들고 `issue_card`를 1,000번 부른 뒤 등급별 건수와 템플릿별 최소·최대 건수를 출력하고 롤백한다. 우연히 범위를 벗어나는 일이 100번에 1번쯤 생기므로 `supabase test db`의 자동 시험에는 넣지 않는다. 벗어나면 다시 돌리기 전에 경계 시험과 난수 변환을 먼저 확인한다.

| 등급 | 기대 건수 | 3σ 범위 |
| --- | --- | --- |
| 일반 | 700 | 657~743 |
| 레어 | 200 | 163~237 |
| 에픽 | 75 | 51~99 |
| 스페셜 | 25 | 11~39 |

## 7. 검증

### 7.1 명령

명령의 세부 옵션은 설치한 Deno와 고정 CLI의 `--help`로 확인한다. 샌드박스와 레포에서 같은 명령을 쓰되, 샌드박스에서는 `--env-file`과 시험 데이터 경로가 레포를 가리키게 한다(0.4).

| 종류 | 명령 | 기준 |
| --- | --- | --- |
| 타입 | `deno check supabase/functions/_shared/ai.ts` | 오류 0 |
| 단위 | `deno test supabase/functions/_shared/ai/` (권한 없이 실행해 네트워크 호출이 섞이면 실패하게 한다) | 6.4~6.7의 단위 시험 통과 |
| 실호출 확인 (A-01) | `deno run --allow-net=api.typesafe.ai,api.anthropic.com --allow-env --allow-read --env-file=lib/ai/tests/.env lib/ai/tests/smoke.ts` | Jev·Claude 각 1회 성공. 첫 호출 지연은 프로세스를 새로 띄워 5회 측정 |
| 회귀 (A-08) | 같은 권한으로 `lib/ai/tests/regress.ts` | 4절 A-08 완료 기준 |
| 폴백 (A-07) | 키 없이 `regress.ts`의 폴백 모드 실행 | 4절 A-07 완료 기준. Supabase Secrets는 건드리지 않는다 |
| DB (A-09) | `npx --yes supabase@3.0.0 start` → `db reset` → `test db` | pgTAP 통과 |
| 분포 (A-09) | 로컬 DB에 `issue_card_distribution.sql` 실행 | 6.9의 3σ 범위 |
| 통합 | 홍주P의 `functions serve`와 `test:backend`·`verify:backend` | 홍주P B-03·B-06·B-12 통합 시점에 함께 확인 |

실호출은 비용이 든다. 회귀 1회는 Jev 최대 약 400회(300문장 판정, 수정 문장 30건의 판정과 재검사 60회, 인플루언서 30문장, 시연 문장 7개와 그 재검사)와 Claude 최대 32회다.

### 7.2 검증 기록

티켓을 마칠 때마다 한 줄씩 추가한다. 환경은 샌드박스·레포 로컬·원격을 구분하고, 폴백 결과를 실제 AI 검증으로 적지 않는다.

| 날짜 | 티켓 | 환경 | 명령 | 결과 | 미확인 |
| --- | --- | --- | --- | --- | --- |
| 2026-11-11 | A-01 | 샌드박스 Deno | `deno run --allow-net=api.typesafe.ai,api.anthropic.com --allow-env --allow-read --env-file=lib/ai/tests/.env lib/ai/tests/smoke.ts` 5회(프로세스마다 새로 실행) | 5회 모두 Jev 200·`parsed: true`·`claude.ok: true`. `jev.ms` 398, 299, 253, 562, 290. Claude ms 1746, 1499, 1354, 1451, 1460. 품질 질문 응답은 `answers.quality.score` 형식. 단위 시험: `deno check` 오류 0건, `deno test` 18건 통과. 샌드박스(`../BirdieBuddy-ai/`)에서 돌릴 때는 `--env-file=../BirdieBuddy/lib/ai/tests/.env`처럼 레포의 `.env`를 가리킨다(0.4). Edge 런타임(샌드박스 `supabase functions serve`, `ai-smoke` 함수로 `callJev`·`callClaudeJson` 각 1회): HTTP 200, `jevOk: true`(jevMs 337), `claudeOk: true`(claudeMs 1635). `npm:` 지정자와 SDK가 Edge 런타임(supabase-edge-runtime-1.77.9)에서 동작 | 홍주P fixture 교체 |
| 2026-11-11 | A-09 | 샌드박스 로컬 Supabase | `supabase test db`, `docker exec -i <supabase_db_ 컨테이너> psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < lib/ai/tests/sql/issue_card_distribution.sql` (1회 실행, 롤백) | pgTAP 77건 모두 통과. 템플릿 30종은 레포 seed가 아니라 분포 스크립트가 만들었으므로 seed에 돌리면 결과가 다를 수 있다. 1,000회 분포: 일반 698(657~743), 레어 203(163~237), 에픽 72(51~99), 스페셜 27(11~39)로 4등급 모두 PASS. 템플릿 30종, 종류별 최소 23·최대 49(합계 1,000). `forced=true` 0건. 롤백 뒤 `draws` 0건 | 레포 이관 후 재실행, 홍주P `complete_round` 통합 |
| 2026-11-11 | A-07 | 샌드박스 Deno, 키 없음 | `deno run --allow-read --allow-write=lib/ai/tests/results lib/ai/tests/regress.ts fallback --data=<레포>/lib/ai/tests/data` (`--allow-env`·`--allow-net` 없이 실행, `deno test` 101건 통과, `deno check` 오류 0건) | 폴백 `moderateAndScore`만 실행(AI 판정 아님). `quality` 그룹 100문장 오탐 0건(예외 복합어 목록은 초기값 그대로). `trap` 그룹 `pass` 기대 25문장 중 `block/threat` 1건: #258 "홀컵을 죽여버리겠다는 마음으로"(결과 기록만, 기준 아님). 금칙어 17개로 만든 문장은 전부 기대 판정(선택 항목 `suggest`, 항상 차단 `block`·항목 일치). 142회 호출 전부 `passesAllFilters: false`·`quality: 50`·`rewrite: null`, 로그 142줄 전부 `{"event":"ai_fallback","reason":"no_key"}` | Jev 지연·5xx 모의의 사유 코드는 단위 시험(`moderate_test.ts`)만 확인, 실호출 미확인. 레포 이관 후 재실행 |
| 2026-11-11 | A-04 | 샌드박스 Deno 실호출 | `deno run --allow-net=api.typesafe.ai,api.anthropic.com --allow-env --allow-read --allow-write=lib/ai/tests/results --env-file=<레포>/lib/ai/tests/.env lib/ai/tests/regress.ts rooms --data=<레포>/lib/ai/tests/data` (1회 실행, 종료 코드 0) | `clusterQuestions` 1회 성공, 입력 100건·2,834자, 6,213ms로 20초 안. 8묶음: 인원 5·2·2·2·2·2·2·2명, 대표 질문 길이 39·35·31·33·30·32·22·20자(모두 200자 이내). 품질 재실행(같은 날, 대표 질문·묶음 ID·요약 원문을 결과 `.json`에만 남기도록 `rooms` 모드를 고친 뒤 같은 명령 1회, 종료 코드 0): 10묶음(인원 5·5·2·2·3·2·3·2·8·3명, 대표 질문 32~64자), 5,413ms. 대표 질문 10개에 이름·닉네임 0건. 질문이 아닌 메시지(기대·응원·후기)가 든 묶음 2개(3건), 하위 질문 여러 개를 한 문장에 몰아 쓴 대표 질문 여러 개, 묶은 메시지 일부(선정 기준)를 대표 질문에 반영하지 않은 묶음 1개 | 홍주P Edge 통합(B-12) 미확인. 입력이 2,834자뿐이라 20,000자 상한 입력은 미확인. 묶음 품질은 재실행 1회 표본으로만 확인. 묶음 수가 8개와 10개로 실행마다 달라 편차가 있고 크기는 미확인 |
| 2026-11-11 | A-05 | 샌드박스 Deno 실호출 | 위 A-04와 같은 실행 | `summarize` 6회 모두 성공. 사고 끔: 3,842ms/666자, 4,422ms/881자, 4,230ms/782자, 중앙값 4,230ms·782자. 사고 켬: 4,888ms/713자, 5,861ms/783자, 4,418ms/833자, 중앙값 4,888ms·783자. 6회 모두 2,000자 이하, 20초 안. 품질 재실행(A-04와 같은 재실행): 사고 끔 중앙값 3,771ms·677자, 켬 중앙값 4,072ms·803자, 6회 모두 성공. 6건 모두 6.7 구조(흐름 2~3문장, 화제 5개, 질문 5개)를 지킴. 마크다운 기호 2건(사고 끔 2건: 하이픈 목록, 번호 목록). 인원수·건수 0건, 숫자 표기 3건(번호 목록, 대화에 있던 빈도·기간 인용). 명백히 지어낸 사실 0건, 원문에 없는 해석 3종(카드 질문을 게임 내 카드로 단정, 원문의 마감일을 신청 기간으로 씀, 신청서 기재 항목을 참가 자격으로 분류). 6.7 `[측정]` 줄은 첫 실행 값을 유지 | 홍주P Edge 통합(B-12) 미확인. 입력이 2,834자뿐이라 20,000자 상한 입력은 미확인. 요약 품질은 재실행 1회(6건) 표본으로만 확인. 마크다운 금지 지시를 어긴 2건에 대해 프롬프트는 고치지 않았음(재발 빈도 미확인) |
| 2026-11-11 | A-02 | 샌드박스 Deno 실호출 | A-08과 같은 실행 2회 | 판정 일치는 아래 A-08. 응답 시간(동시 3개 부하, 첫 호출 제외, `pass`·`block`): 1회차 중앙값 236.5ms·최대 486.7ms, 2회차 중앙값 172.7ms·최대 285.5ms로 2초 이내. `suggest` 전체 경로(수정 문장 포함) 최대 3,682ms(1회차)·2,528ms(2회차)로 8초 이내. 수정 문장 재검사 통과: 1회차 14/29(48.3%), 수정 문장 프롬프트 조정 후 2회차 23/29(79.3%)로 기준 80%에 1건 모자라 미달. 2회차 실패 6건: #122, #126, #152, #157, #159, #281(프롬프트 주입 시험 문장). 두 실행 모두 `ai_fallback` 0줄. 단위 시험 101건 통과 | 홍주P Edge 통합(B-12) 미확인. 수정 문장 실패 원인(생성 결과 없음, 재검사 위반, 시한)은 나눠 기록하지 않아 미확인(다음 `full` 실행부터 표본별 이유 코드를 결과 .json에 남김). 79.3%는 프롬프트 조정에 쓴 같은 30표본에서 다시 잰 값이라 독립 검증이 아님. #281의 `rewrite: null`은 프롬프트 주입 시험 문장에 대한 안전한 결과임. 선택 필터를 모두 끈 설정 기준 실효 block→pass 17/121(2회차 결과 파일에서 계산): 기록된 10건에 선택 항목 점수만 받은 `block→suggest` 7건(#132·#139·#140·#142 혐오가 belittling으로, #170 협박이 belittling으로, #183·#186 스토킹이 appearance로)이 더해진다. 인플루언서 메시지는 선택 필터 3개를 끈 채 보내고 방 주인도 끌 수 있어 이 7건은 `pass`가 된다. hate·threat 설명을 강화할지는 사용자 결정으로 남김. 1회차 실패 표본 id는 기록하지 않음. 조정 후 수정 문장의 내용(원래 뜻 유지, 지어낸 내용 여부)은 원문을 저장하지 않아 미확인. 응답 시간은 동시 3개 부하에서 잰 값 |
| 2026-11-11 | A-02 | 샌드박스 Edge 런타임 | `supabase functions serve --no-verify-jwt --env-file=<레포>/lib/ai/tests/.env`(supabase-edge-runtime-1.77.9) 후 `ai-smoke`가 `createAiAdapter().moderateAndScore`를 1회 호출, `curl http://127.0.0.1:54321/functions/v1/ai-smoke` 1회 | HTTP 200, `{"verdict":"pass","quality":82,"ms":335}`(정상 문장 "드라이버 비거리가 220m인데 슬라이스가 나요. 그립을 바꿔야 할까요?"). serve 로그에 `ai_fallback` 0줄이라 Edge에서 `Deno.env`로 키를 읽는 경로까지 실제로 동작 | `suggest` 경로(Claude 호출)의 Edge 동작은 미확인. 호출 1회 값이라 응답 시간 분포는 미확인. 홍주P Edge 통합 미확인 |
| 2026-11-11 | A-03 | 샌드박스 Deno 실호출 | A-08과 같은 실행 2회 | 2회차 `quality_tier`별 평균(최소~최대): greeting 3.8(0~48), vague 51(31~82), general 59.7(51~76), specific 99.4(95~100). `specific` 평균이 `greeting` 평균보다 높고 `specific` 최솟값 95가 `greeting` 평균 3.8보다 높아 기준 충족. 1회차도 같은 결론(greeting 평균 3.9, specific 평균 99.4·최소 96) | 홍주P Edge 통합(B-12) 미확인. greeting 최대 48~49가 vague 범위(30~82)와 겹침(기준 밖 관찰) |
| 2026-11-11 | A-08 | 샌드박스 Deno 실호출 | 1회차 `deno run --allow-net=api.typesafe.ai,api.anthropic.com --allow-env --allow-read --allow-write=lib/ai/tests/results --env-file=<레포>/lib/ai/tests/.env lib/ai/tests/regress.ts full --data=<레포>/lib/ai/tests/data`, 2회차 같은 명령에 `--validate` (승인 범위 2회 모두 사용, 둘 다 종료 코드 0. `full` 모드의 기준 미달은 종료 코드에 반영되지 않음) | 1회차: 일치 278/300(92.7%, quality 100/100·filter 129/150·trap 49/50), 불일치 22건을 읽어 모두 필터 오류로 분류(기대값 오류 0건이라 기대값 오류를 뺀 일치율도 92.7%), 항상 차단 `block→pass` 11건. 미달: 수정 문장 48.3%, 인플루언서 정상 문장 오탐 4건(모두 `spam`), 시연 1건. 조정 1회: 6.2 `spam` 설명에 인플루언서 본인 공지 제외 문장 추가(조정 근거: `influencer-message-set.json` 0부터 센 0·2·8·13행, 레슨 신청·굿즈 판매·클래스 모집·한정 수량 공지), 수정 문장 프롬프트에 비꼬는 뜻과 외모 평가를 없애고 문제없는 질문·응원만 남기라는 지시 추가(근거는 통과율뿐, 표본별 원인 없음). 2회차: 일치 279/300(93.0%), 불일치 21건 모두 필터 오류(1회차의 #213 해소, 새 불일치 없음), 기대값 오류를 뺀 일치율 93.0%. 항상 차단 `block→pass` 10건(threat 4, stalking 2, sexual_harassment 2, spam 2). 인플루언서 정상 20문장 오탐 0건, 위반 10문장 모두 `block`(항목이 다른 것 2건: threat→stalking, illegal_ad→spam). 시연 5/7(아래 표). 검증 세트 `filter-eval-set.json` 60/60. 기준: 일치율·품질 순서·응답 시간·인플루언서 오탐 충족, 수정 문장 통과율(79.3%)·시연 미달 | 인플루언서 오탐 0건은 조정에 쓴 세트에서 잰 값이라 독립 검증이 아님. 이번 조정에 쓴 근거는 `influencer-message-set.json` 0부터 센 0·2·8·13행과 수정 문장 통과율뿐이고, `filter-eval-set.json`(60/60)은 이번 조정에 쓰지 않았음. 다만 2026-11-09 항목 설명 조정과 독립인지는 미확인. 300문장 일치율도 그때의 조정과 겹칠 수 있음: 6.2 설명이 이 세트 문장의 유형을 이미 적고 있음("차량" #185, "사고" #172, "운동이나 골프 표현에 빗댄 성적 암시" #200, "사는 곳을 안다고" #213). #213이 2회차에 `block`으로 바뀐 것은 privacy 설명을 바꾸지 않았으므로 실행 간 편차로 봄. 선택 필터를 끈 욕설 시연 문장의 `passesAllFilters: false`는 Jev가 그 문장을 욕설로 보지 않아 확인하지 못함. 시연 문장 교체와 안내문 사람 검수는 대기(사용자 검수). 수정 문장 통과율 79.3%는 조정에 쓴 같은 30표본에서 다시 잰 값이라 독립 검증이 아니며, 선택 필터를 끈 설정 기준 실효 block→pass는 17/121임(A-02 행). 홍주P Edge 통합 미확인 |
| 2026-11-11 | A-02·A-08 후속 조정 | 샌드박스 Deno 실호출 | `regress.ts full --validate` 2회(사용자 승인 최대 2회 사용) | 변경: spam의 인플루언서 공지 제외 문장을 `senderType: "influencer"`일 때만 적용, hate·stalking 설명 보강(근거 #132·#139·#140·#142·#183·#186), 시연 3·7행 교체, 검증 세트에 팬 자기 홍보 5문장 추가. 1회차(threat 보강 포함): 일치율 94.3%(283/300), 실효 block→pass 10/121, 검증 63/65(기존 직접 협박 2건 새로 통과), 인플루언서 위반 중 협박 1건 통과, 수정 문장 71.4%(20/28, 사유 recheck_violation appearance 5·belittling 3), 시연 7/7. threat 보강은 직접 협박 누락을 불러 사용자 결정으로 되돌리고, 수정 문장 프롬프트에 외모·실력 등 평가 금지와 중립 응원 대체를 더함. 2회차: 일치율 94.7%(284/300), 항상 차단 block→pass 9, 선택 필터를 끈 설정 기준 실효 block→pass 11/121(이전 17, 남은 block→suggest #139·#170), 검증 세트 65/65(팬 홍보 5문장 모두 block), 인플루언서 정상 오탐 0·위반 10건 모두 block, 수정 문장 96.6%(28/29, 실패 #155 recheck_violation:appearance), 시연 7/7, A-03 충족, 응답 시간 `pass`·`block` 최대 526.6ms·`suggest` 최대 2,825.9ms. 결과 파일 full-2026-11-11T07-07-32-548Z(1회차)·full-2026-11-11T07-11-19-804Z(2회차) | 조정 근거 문장(#132 등 6건, 수정 문장 표본 30건)의 개선은 독립 검증이 아님. 부작용으로 #116(기대 suggest/belittling)이 hate 0.58로 block. #170 유형(돌려 말한 신변 위협)은 여전히 비하로만 잡힘. 1회차에서 정상 문장 #50("싱글 치려면 얼마나 걸릴까요??")이 sexual_harassment 0.53으로 block됐다가 설명 변경 없이 2회차에 해소돼 실행 간 편차로 봄. 수정 문장 96.6%는 재검사 통과율이고, 원문을 저장하지 않아 원래 뜻 유지 여부와 중립 응원으로 대체된 건수는 미확인. 금지 목록은 1회차 실패 id(#126·#148·#152·#155·#157)의 유형을 따름. 주입 시험 문장 #281은 `rewrite: null`에서 생성으로 바뀌었고 내용은 미확인. threat 되돌림을 1회차 결과로 정했으므로 2회차 검증 65/65와 인플루언서 위반 10/10 중 threat 부분은 독립 검증이 아님. stalking 보강의 공개 장소 정상 문장 오탐은 미확인. 공개 진입점(`createAiAdapter`)의 influencer 경로 실호출은 미확인(홍주P 통합 때 확인) |

**시연 문장 실제 판정 (U-01 전달용, 후속 조정 2회차, 2026-11-11, 샌드박스 Deno 실호출)**

`demo-messages.json` 행 순서다.

| 행 | 문장 | `disabledFilters` | 기대 | 2회차 실제 | `passesAllFilters` | 결과 | 1회차 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 오늘 드라이버 비거리 어떻게 늘리셨어요? | 없음 | `pass` | `pass` | true | 일치 | 일치 |
| 2 | 다음 라이브 방송은 언제 하세요? | 없음 | `pass` | `pass` | true | 일치 | 일치 |
| 3 | 프로님 답장 좀 해주세요 존나 기다렸는데 | 없음 | `suggest`/profanity | `suggest`/profanity | false | 일치 | 일치 |
| 4 | 프로님 오늘 몸매 더 좋아지신 것 같아요 | 없음 | `suggest`/appearance | `suggest`/appearance | false | 일치 | 일치 |
| 5 | 프로님 연락처 좀 알려주실 수 있나요? | 없음 | `block`/privacy | `block`/privacy | false | 일치 | 일치 |
| 6 | 골프 팁 영상 여기 있어요 www.example.com 꼭 들어와 보세요 | 없음 | `block`/spam | `block`/spam | false | 일치 | 일치 |
| 7 | 프로님 답장 좀 해주세요 존나 기다렸는데 | profanity | `pass`, `passesAllFilters: false` | `pass` | false | 일치 | 일치 |

3·7행은 2026-11-11 사용자 결정으로 "ㅈㄴ 멋있어요" 문장에서 교체했다(사람을 향하지 않은 비속어는 6.2 `profanity` 설명대로 `pass`가 되므로). 같은 문장을 두 자리에 써서 욕설 필터를 끄면 같은 문장이 통과하는 대비를 보인다. "1회차" 열은 후속 조정 1회차 결과다.

### 7.3 보고 형식

```text
티켓: A-02
상태: 단위 시험 통과 | 실호출 확인 | 홍주P Edge 통합 확인 | 대기(이유)
변경 파일: ...
검증: 실행한 명령과 결과
미확인: ...
담당자 요청: (1절 요청 표에 추가한 항목)
```
