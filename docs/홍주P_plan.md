# BirdieBuddy — 홍주P 백엔드 개발 실행 계획

**담당:** Supabase 백엔드·채팅 서비스·브라우저 호출 SDK

**계약 버전:** 1.0 / 2026-11-09

**상태:** 개발 실행 명세. 구현·프로젝트 연결·배포 완료를 뜻하지 않음.

> 홍주P 담당 범위의 독립 명세다. Claude 원문이나 다른 계획을 읽어 요구사항을 찾아내지 않아도 되도록 필요한 계약을 모았다. 착수 시 저장소의 AGENTS.md 등 작업 지침과 실제 기존 코드는 확인한다.
>
> 기존 계획의 **Supabase CSR·RLS·Auth 사용자 ID·migration·Edge Function** 결정을 유지한다. 다른 문서에 남은 Next.js 서버 API·RLS 비활성화·독립 users 테이블·schema.sql 직접 실행 설명은 이 백엔드에 적용하지 않는다. 다른 담당자 문서는 이번 보완에서 수정하지 않았다.
>
> 기획 원문: [Claude artifact](https://claude.ai/artifact/3T29sepfiGsRJtGRXF1XXH#202ef63e-f01c). 본문은 확인하지 못했다. 아래 **보완 기본값**은 이번 단독 개발을 위해 채택한 기준이며 원문에서 확인한 사실이 아니다. 명시적인 변경 요청이 없다면 이 값으로 진행한다.

## 0. 한 문장으로 시작하는 실행 지시

사용자가 **“md 파일 기반으로 개발 시작해”**라고 요청하면 이 파일을 실행 명세로 삼아 다음을 수행한다. 문서 보완 중인 현재 작업에서는 프로젝트 설정·코드·원격 데이터를 변경하지 않는다.

1. 저장소 상태와 작업 지침을 확인하고 기존 수정사항을 보존한다. 아래 체크리스트와 실제 파일을 비교해 미완료 지점부터 진행한다. 체크 표시만으로 구현 완료를 가정하지 않는다.
2. B-01~B-13을 구현한다. 미정이던 정책은 아래 기본값을 사용한다. 다른 담당자의 화면·AI 코드·최종 이미지가 없다는 이유로 독립 가능한 백엔드 구현을 중단하지 않는다.
3. migration → 권한/RPC → 시드·계정 → SDK → Edge Function → 통합 검증 순서로 진행한다. 화면 대신 SDK 테스트로 P0/P1을 먼저 완성한다.
4. 정상·거부·재시도·동시성 검증을 실행하고 실패를 수정한다. 티켓별 환경과 증거를 기록하며 구현 시 harness/verification-log.md도 갱신한다.
5. 자격증명·컨테이너 등 외부 조건이 없으면 가능한 구현과 정적 검사를 계속한다. 필요한 사용자 조치와 재개 방법만 구체적으로 보고한다. 없는 권한·키·검증 결과를 만들어내지 않는다.
6. 코드와 로컬 검증이 끝나면 **홍주P 백엔드 로컬 완료**로 보고한다. 실제 LLM·팀 화면 통합·원격 적용은 별도 상태다. 원격 변경에는 사용자 요청과 명시적인 대상 환경이 필요하다.

**완성 범위:** 홍주P 백엔드, 브라우저 SDK, 테스트, 실행·배포 절차. 현호P·자성P 화면, 문환P의 실제 AI 품질 개선·이미지 생성, 발표 자료를 대신 완성한다는 의미는 아니다.

### 0.1 이번에 보완한 공백

| 기존 공백 | 실행 기준 |
| --- | --- |
| 스키마를 다른 문서에 위임 | §4의 핵심 12개 테이블과 비공개 보조 모델 |
| 함수명만 있고 타입·오류 없음 | §§6~8의 SDK·RPC·Edge 계약 |
| F-01·T-02·A-02/A-03 대기 | §3의 독립 진행 대안 |
| 점수·재입장·월 경과·보관 미정 | §§5·8의 보완 기본값 |
| 재시도·동시성·AI 우회 경계 없음 | §§6~7의 잠금·멱등성·service-only 저장 |
| Supabase 연결·관리 방법 없음 | §2의 전달받은 값과 관리 인증 절차 |
| 완료 판단 증거 없음 | §§11~14의 검증·상태·완료표 |

## 1. 아키텍처와 담당 경계

Next.js는 CSR 화면과 정적 UI shell을 제공한다. 브라우저가 Supabase JS로 Auth, Data API, Postgres RPC, Edge Functions, Realtime, Storage를 직접 호출한다. 런타임 백엔드는 Supabase에 둔다.

| 기능 | 실행 위치 | 신뢰 기준 |
| --- | --- | --- |
| 로그인·세션 | Supabase Auth | 실제 계정 세션, 가입 시 기본 user |
| 컬렉션·방 목록·대화 | Data API + security_invoker view | JWT + 기초 테이블 RLS |
| 추첨·강화·입장·월 마감·답변·인증 | Postgres RPC | 트랜잭션, 역할·소유권 재검사 |
| 필터·질문 묶기·요약 | JWT 인증 Edge Functions | 비밀값·LLM 호출은 Edge 내부 |
| 채팅 이벤트 | Realtime Postgres Changes | messages SELECT RLS를 통과한 INSERT |
| 카드 이미지 | 공개 Storage card-assets | 공개 읽기, 관리자만 쓰기 |
| 배포 | Supabase CLI / 프론트는 Vercel | 환경 구분·변경 이력 |

Server Actions, API Routes, Route Handlers, 별도 백엔드를 추가하지 않는다. 브라우저의 역할·보유량·판정·점수는 신뢰하지 않는다.

### 1.1 홍주P 소유 산출물

아래 트리는 **개발 착수 시 생성할 산출물**이다. 준비 단계에서는 `supabase/`와 루트 `.env.example`을 두지 않는다. 파일이 없다는 이유로 이 계획의 실행 준비가 미완료라고 판단하지 않는다.

```text
lib/supabase/client.ts              브라우저 클라이언트
lib/supabase/database.types.ts      CLI 생성 DB 타입
lib/api/types.ts                    도메인 타입·Result·ApiError·Page
lib/api/cards.ts                    completeRound / getCollection / upgradeCard
lib/api/rooms.ts                    getRooms / joinRoom / getMyMembership / advanceDemoMonth
lib/api/chat.ts                     getMessages / submitMessage / subscribeRoomMessages
                                   getRoomInbox / replyToMessage / summarizeRoom / clusterQuestions
lib/api/verifications.ts            requestVerification / getMyVerifications
                                   getPendingVerifications / approveVerification
lib/api/game-config.ts              getGameConfig / updateGameConfig
lib/api/room-filters.ts             getRoomFilters / updateRoomFilters
supabase/config.toml                로컬 구성
supabase/migrations/*.sql           schema·RLS·grants·RPC·trigger·Storage·publication
supabase/seed.sql                   비기밀 고정 콘텐츠
supabase/functions/_shared/         인증·CORS·입력 검증·AI adapter·오류 변환
supabase/functions/submit-message/index.ts
supabase/functions/summarize-room/index.ts
supabase/functions/cluster-questions/index.ts
scripts/setup-demo-accounts.mjs     로컬 Auth 계정·시나리오
scripts/verify-backend.mjs          계약·역할별 통합 검증
supabase/tests/*.sql                DB·권한·RPC 테스트
tests/backend/                     Edge·SDK·동시 요청·Realtime 테스트
```

기존 파일이 있으면 그 구조를 존중해 갱신한다. app/(user)/draw·collection 및 components/card는 현호P, app/(user)/chat·app/inbox·app/admin 및 components/chat는 자성P 소유다. components/ui는 자성P 셋업·현호P 디자인 경계다. 채팅 use-room-messages.ts는 자성P가 SDK 구독 helper를 연결한다. 홍주P는 화면 대신 SDK·타입·호출 예제를 제공한다.

기존 lib/db는 lib/supabase·lib/api로, lib/ai는 Edge의 _shared로 대체한다. 점수 SQL은 migration에 둔다. SQL 원문은 이 문서에 중복하지 않는다.

## 2. Supabase 연결 설정 — 이 계획 파일에만 기록

### 2.1 전달받은 프로젝트와 공개 연결 값

| 항목 | 값·의미 |
| --- | --- |
| project ref | `kjfaqfpvfvgbrvdoosyi` |
| URL | `https://kjfaqfpvfvgbrvdoosyi.supabase.co` |
| 대시보드 | [프로젝트 관리](https://supabase.com/dashboard/project/kjfaqfpvfvgbrvdoosyi) |
| 용도 | 사용자가 제공한 해커톤 연결 대상. 개발/운영 구분·기존 데이터는 미확인 |

개발 착수 후 이 원격 프로젝트를 사용할 때 루트 `.env.local`에 작성할 값:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://kjfaqfpvfvgbrvdoosyi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_QuSwvsbS0CYx6aah9Y69XA_62e7ndwO
```

현재 연결 값은 **docs/홍주P_plan.md에만 보관**한다. 실제 `.env.local` 생성, CLI 연결, 원격 schema 생성 완료를 뜻하지 않는다. 루트 `.env.example`도 지금은 만들지 않고 개발 착수 시 자리표시자로 생성한다.

### 2.2 공개 연결과 관리 권한

- publishable key는 앱 식별용이며 RLS가 허용한 사용자 작업만 한다. 테이블 생성·migration·SQL 함수 정의·역할 승격 권한이 아니다.
- schema/RPC/RLS/trigger 변경은 Supabase CLI의 관리 계정 인증과 DB 접근 권한으로 수행한다. Edge 배포·Secrets 관리도 관리 권한이 필요하다.
- Edge의 service-only RPC·Auth Admin에는 서버용 Supabase secret key가 필요하다. 이 키도 임의 DDL을 수행하는 DB 암호의 대체품은 아니다.
- SUPABASE_ACCESS_TOKEN, DB 암호, Supabase secret key, LLM 키는 문서·브라우저·Git·로그에 넣지 않는다. CLI 로그인 저장소·실행 셸·암호 관리자·Functions Secrets를 사용한다.
- “자유롭게 제어”는 관리 인증을 갖추고 migration으로 변경을 재현한다는 뜻이다. RLS·EXECUTE 제한을 풀지 않는다.

### 2.3 개발 시 관리 연결 절차

2026-11-09 확인한 `supabase@3.0.0`을 devDependency와 lockfile에 고정한다. 기존 package manager를 사용하고 package.json이 없으면 B-01에서 최소 SDK·TypeScript·검증용 package를 만든다.

**빈 준비 상태에서의 B-01 초기화:** `supabase/`가 없으면 아래 명령으로 생성한다. 기존 config가 있으면 init을 재실행하거나 덮어쓰지 않고 이 계획과 비교한다.

```bash
# 개발 시작 요청을 받은 뒤에만 실행
npx --yes supabase@3.0.0 init
mkdir -p supabase/migrations supabase/functions/_shared supabase/tests lib/supabase
```

이후 `supabase/seed.sql`, 루트 `.env.example`, `supabase/functions/.env.example`을 만든다. seed는 §10.1의 비기밀 데이터만 담는다. 루트 예제의 URL/key는 `https://your-project-ref.supabase.co`와 `sb_publishable_replace_me`를 사용한다. 실제 연결 값은 §2.1에서 `.env.local`로 옮기고 Git에 포함하지 않는다. Functions 예제에는 §10.2의 변수명·자리표시자와 로컬 `AI_MODE=fixture`만 기록한다. 실제 `.env` 파일은 필요 시 복사해 비밀값을 주입한다. 기존 `.gitignore`를 보존하면서 `.env*` 제외·`.env.example` 예외·`supabase/.temp/` 제외 규칙을 확인한다.

CLI가 생성한 config는 다음 기준으로 보완한다. 이 설정을 위해 사전 생성된 파일을 필요로 하지 않는다.

| config 위치 | 개발 착수 시 설정 |
| --- | --- |
| 루트 | project_id="birdiebuddy". 원격 project ref와 별개의 로컬 식별자 |
| api | schemas=["public","graphql_public"], auto_expose_new_tables=false. private는 노출하지 않음 |
| db | CLI 생성 버전을 사용하되 원격 적용 전 DB major version과 호환성 확인 |
| db.seed | enabled=true, sql_paths=["./seed.sql"] |
| auth | site_url="http://localhost:3000", additional_redirect_urls에 localhost:3000과 127.0.0.1:3000 추가, enable_anonymous_sign_ins=false |
| auth.email | 로컬 enable_confirmations=false. 원격 Auth 설정은 별도 확인 |
| storage.buckets.card-assets | public=true, file_size_limit="10MiB", allowed_mime_types=["image/png","image/jpeg","image/webp"] |
| functions의 세 사용자 호출 함수 | verify_jwt=true 기본, §10.2의 handler 인증도 구현 |

로컬 설정이 원격 프로젝트에 자동 적용된다고 가정하지 않는다. 테이블·RLS·함수·Storage 정책·Realtime publication은 이후 티켓의 migration/배포로 구현한다.

```bash
# 저장소 루트에서, 개발 착수 후 수행할 절차
npx --yes supabase@3.0.0 login
npx --yes supabase@3.0.0 projects list
npx --yes supabase@3.0.0 link --project-ref kjfaqfpvfvgbrvdoosyi
```

사용자가 본인 계정으로 로그인한다. 비대화형 환경은 보안 저장소에서 주입한 SUPABASE_ACCESS_TOKEN을 사용한다. projects list에서 대상 ref 접근을 확인하고 link 결과도 확인한다. 접근이 없으면 소유자의 멤버 초대/권한 부여가 필요하다. 브라우저 로그인만으로 CLI 로그인 완료로 보지 않는다.

CLI 3.0.0의 DB 작업은 로컬이 기본이며 원격에는 `--remote`를 명시한다. 아래는 **원격 적용 요청과 환경 확인 후** 수행할 절차다.

```bash
# 기존 이력·schema를 먼저 확인한다. 원격 reset은 하지 않는다.
npx supabase migration list --remote
npx supabase db push --remote --dry-run
# 검토된 신규 migration만 적용
npx supabase db push --remote
npx supabase functions deploy submit-message
npx supabase functions deploy summarize-room
npx supabase functions deploy cluster-questions
```

DB 암호가 필요하면 보안 셸에서 SUPABASE_DB_PASSWORD로 주입한다. 계정 인증으로 임시 DB 로그인 역할을 쓰는 환경은 암호 입력이 필요 없을 수 있다. 기존 schema가 있으면 기준선을 보존·비교하고 충돌을 조정한다. 원격 reset·기존 테이블 삭제·무조건 migration repair로 맞추지 않는다.

**관리 연결 가능 판정:** ref 일치 + 계정 접근 확인 + DB 이력 읽기 + dry-run 성공. 공개 URL 응답 성공만으로 판정하지 않는다. 실제 쓰기 성공은 승인된 migration/Function 배포 결과로 별도 기록한다.

### 2.4 환경과 외부 조건

| 환경 | 연결·규칙 |
| --- | --- |
| 로컬 통합 테스트 | supabase start의 로컬 URL·publishable key. 원격 값을 기본 테스트 대상으로 쓰지 않음 |
| 해커톤 원격 | 위 ref, 환경·권한 확인 후 사용 |
| 프리뷰·운영 | 별도 프로젝트 또는 명시적으로 승인된 동일 프로젝트. 프론트 변수·Auth redirect 각각 설정 |

로컬 실행에는 Docker 호환 런타임, 관리 연결에는 CLI 로그인·프로젝트 권한, 실제 AI에는 문환P 모듈·공급자 키가 필요하다. 문서만으로 생성할 수 없는 외부 조건이다. 없으면 구현과 정적 검사를 계속하고 실행 불가 항목만 미검증으로 남긴다.

## 3. 팀 의존성 없이 진행하는 기본안

| 의존 | 독립 진행 방법 | 교체 지점 |
| --- | --- | --- |
| F-01 프론트 셋업 | 최소 SDK·TypeScript·검증환경 구성 | Next.js가 같은 lib/api 사용 |
| T-02 인플루언서 | `버디 01`~`버디 10` 가상 인물, 안정적 UUID, 유형 4/3/3명 | seed 표시명·type·매핑 |
| A-06 이미지 | 자체 생성 비민감 placeholder 30개 | 같은 Storage object path |
| A-02/A-03 필터·점수 | §8 타입의 local fixture adapter | _shared/ai.ts의 adapter |
| A-04/A-05 묶기·요약 | fixture로 권한·저장·응답 계약 검증 | 실제 AI adapter |
| 실제 화면 | SDK 통합 테스트로 P0/P1 완성 | 팀 화면 SDK 호출 |

**보완 기본값:** 스타일 `illust/retro/holo`, 등급 `common→rare→epic→special`, 유형 `youtuber/media_pro/tour`. 실제 골프존 회원·결제·라운드 연동은 없다. 인증 사용자의 “라운드 완료” 버튼을 데모 라운드로 처리한다. 새 requestId를 가진 별도 동작은 새 라운드다.

fixture는 로컬·테스트 전용이며 실제 AI 성공으로 보고하지 않는다. 원격 fixture 활성화나 AI 장애의 무조건 pass 전환은 금지한다. 공급자·모델·키는 문환P 모듈 설정을 수용한다. 홍주P는 인터페이스와 장애 처리를 완성하며 모델 선정·품질 개선을 대신 맡지 않는다.

## 4. 데이터 모델·제약·권한

### 4.1 타입·기본 원칙

- 별도 표기 외 ID는 UUID. 시각은 timestamptz/UTC 저장, 월 경계는 Asia/Seoul.
- nullable 표기 외 필수 컬럼은 NOT NULL이다. UUID PK는 gen_random_uuid(), created_at/updated_at은 now()를 기본값으로 한다. enum 이름은 user_role, influencer_type, card_style, card_grade이며 값은 §§3~4의 순서·목록을 따른다. 나머지 status/clock_kind/verdict는 명시적 CHECK로 제한한다.
- role=`user/influencer/admin`, member status=`active/left`, verification status=`pending/approved/rejected`.
- profiles.id는 auth.users.id FK. 가입 trigger는 metadata의 role/demo를 무시하고 role=user, nickname 1~30자(미입력 `버디`)로 만든다.
- 모든 public 테이블에 RLS. anon/authenticated 기본 쓰기 권한을 회수하고 필요한 SELECT/RPC만 명시적으로 허용한다.
- 서버 생성 시각을 클라이언트 입력으로 받지 않는다. 남의 리소스 존재를 상세 오류로 노출하지 않는다.
- auth.users 삭제는 profiles에 cascade하되 메시지·신청·운영 이력 등 참조가 있으면 RESTRICT로 거부한다. 탈퇴·익명화 기능은 이번 범위가 아니다. 데모 전체 초기화는 로컬 reset으로만 한다.

### 4.2 public 핵심 12개 테이블

아래는 논리 명세다. 실제 SQL은 migration에 구현한다. PK·FK·UQ·CHECK는 DB 제약이며 UI 검증으로 대체하지 않는다.

| 테이블 | 필수 컬럼·제약 | SELECT / 변경 경로 |
| --- | --- | --- |
| profiles | id PK→auth.users, nickname text, role default user, created_at, updated_at | 본인만 / bootstrap·관리 프로비저닝 |
| influencers | id PK, name 1~50자, type, verified_at nullable, created_at | 인증 사용자 / seed·승인RPC. 계정 매핑은 private |
| card_templates | id PK, influencer_id FK, style, image_path text, UQ(influencer_id,style) | 인증 사용자 / seed·관리 작업 |
| user_cards | user_id FK, template_id FK, grade, count int CHECK≥0, updated_at, PK(user_id,template_id,grade) | 본인 / 추첨·강화RPC |
| rounds | id PK, user_id FK, played_at, period_month date, clock_kind(real/demo) | 본인 / complete_round |
| draws | id PK, user_id FK, round_id FK UQ, template_id FK, grade, is_new bool, created_at | 본인 / complete_round. round 소유자와 일치 강제 |
| chat_rooms | id PK, influencer_id FK UQ, created_at | 인증 사용자 / seed. 비공개 필터 포함 안 함 |
| room_members | room_id FK, user_id FK, gauge int 0~100, status, joined_at, joined_month, left_at nullable, left_month nullable, updated_at, PK(room_id,user_id) | 본인·방 소유자 / 입장·월마감RPC |
| messages | id bigint identity PK, id_text text UQ, room_id FK, sender_id FK, sender_type(user/influencer), sender_name, reply_to bigint nullable, reply_to_text text nullable, body 1~2000자, filter_verdict=pass, own_score/quality_score/priority numeric(5,2) nullable, cluster_id nullable, created_at | 활성 멤버·방 소유자 / 검증 저장·답변RPC |
| message_clusters | id PK, room_id FK, representative 1~200자, member_count int≥1, created_at, updated_at | 활성 멤버·방 소유자 / 묶기 저장RPC |
| verifications | id PK, influencer_id FK, type, evidence_url, status, rejection_reason nullable, reviewed_by FK nullable, reviewed_at nullable, created_at | 본인 influencer·admin / 신청·검토RPC |
| game_config | key text PK, value jsonb, updated_at, version int≥1 | 인증 사용자 / update_game_config |

messages에는 pass 사용자 질문과 influencer 답변만 저장한다. block/suggest 행·원문·수정안은 넣지 않는다. 질문은 reply_to=null·점수 필수, 답변은 reply_to 필수·점수 null. sender_name은 서버 표시명 snapshot이므로 다른 사람의 profiles를 읽지 않아도 된다.

bigint 정밀도를 전송 전에 보존한다. id_text/reply_to_text는 일반 text 컬럼이며 BEFORE INSERT/UPDATE trigger가 id::text/reply_to::text로만 채운다. CHECK로 원본과 일치를 강제한다. 논리 복제의 generated column 전달에 의존하지 않는다. Data API는 문자열 컬럼을 선택하고 Realtime도 이 값만 SDK의 id/replyTo로 매핑한다. raw 숫자 id/reply_to는 사용하지 않는다. SQL JSONB도 명시적으로 ::text 변환한다. JSON.parse 이후 문자열 변환으로 정밀도를 복구할 수 있다고 가정하지 않는다.

추가 제약:

- reply_to/cluster_id는 같은 room_id만 참조한다. 복합 FK 또는 동등 DB trigger로 강제한다. 답변을 답변 대상으로 지정하지 못한다.
- 질문당 답변 1개: reply_to 부분 UNIQUE. 메시지 수정·삭제·스레드 답글은 범위 밖.
- influencer별 pending 신청 1개 부분 UNIQUE. 심사 완료는 reviewed_by/reviewed_at 필수, pending은 null. 반려 사유 1~500자 필수.
- active는 gauge>0, left는 gauge=0 및 left_at/left_month 필수.
- 점수는 0~100 유한 숫자. 월 date는 첫날, grade/style/status는 enum 또는 CHECK.
- 카탈로그·카드·메시지·심사 참조의 삭제는 RESTRICT가 기본. 서비스 실행 중 seed 콘텐츠를 삭제하지 않는다.
- 인덱스: rounds(user_id,clock_kind,period_month), messages(room_id,id), messages(room_id,priority DESC,id ASC) WHERE sender_type='user', room_members(room_id,status), verifications(status,created_at,id). PK/UQ 인덱스를 중복 생성하지 않는다.

### 4.3 private 보조 모델 — Data API 비노출

12개 테이블 수를 맞추려고 비밀 데이터·멱등성을 생략하지 않는다. private schema는 API 노출 목록에서 제외하고 anon/authenticated의 직접 접근을 금지한다.

| 모델 | 최소 내용·제약 |
| --- | --- |
| influencer_accounts | influencer_id PK/FK, user_id UQ/FK. 소유권 계정 매핑 |
| demo_accounts | user_id PK/FK, can_force_grade bool, can_advance_month bool |
| demo_clock | 단일 id=hackathon, current_month date, version. 로컬 seed는 KST 현재 월 첫날 |
| demo_month_runs | closed_month PK, target_month UQ, actor_id, request_id, 결과JSON, created_at |
| room_settings | room_id PK/FK, disabled_filters text[], version int default1 |
| operations | PK(actor_id,operation,request_id), payload_hash, state(processing/succeeded/failed), result jsonb nullable, lease_token UUID nullable, lease_until, created_at, updated_at |
| moderation_events | id PK, actor_id, room_id, request_id, verdict, category nullable, created_at. 원문·수정안 미보관, 7일 보관 |
| verification_reviews | id PK, verification_id UQ/FK, reviewer_id, decision, reason nullable, reviewed_at. 변경 불가 |
| rate_windows | PK(actor_id,operation,scope_id,window_start), count. DB 분당 제한 |
| demo_fixture_runs | fixture_version text PK, completed_at. 로컬 demo setup의 최초 주입 완료 표시 |

private 모델도 최소 GRANT만 부여한다. 브라우저에 필요한 작업은 권한 검증 public RPC로 노출한다. block/suggest 작업 기록에도 원문·rewrite를 넣지 않는다(§7.3).

### 4.4 RLS·열·함수 권한

- anon은 DB 카탈로그·사용자 데이터·RPC에 접근하지 못한다. 공개 Storage 읽기만 허용.
- admin은 인증 심사·데모 관리만 추가 허용. 다른 사람의 카드·대화·인박스나 influencer 명의 답변 권한은 없다.
- 방 소유자는 본인 방 멤버십·대화·인박스·필터·AI 기능에 접근한다. 회원 카드 대신 저장된 own_score를 읽는다.
- view는 security_invoker=true. 본인 카드 수만 집계하고 기초 테이블 RLS를 유지한다.
- RLS는 행 경계다. 민감 열 숨김으로 오해하지 않는다. 계정 매핑·demo capability·필터·moderation은 private에 분리한다.
- 필요한 SECURITY DEFINER 함수는 이유·권한 명시, search_path='', 완전한 schema qualification, PUBLIC EXECUTE 회수, 함수별 최소 grant를 적용한다.
- 일반 RPC actor는 auth.uid(). **Edge service-only 내부 RPC만** 검증 JWT에서 얻은 actor_id를 받는 예외다. authenticated에 이 함수 실행 권한을 주지 않는다.
- role은 profiles의 서버 관리 값으로 검사한다. user_metadata는 권한 근거가 아니다. 소유권/멤버십 RLS helper는 private helper로 구성해 재귀 정책을 피한다.

## 5. 게임·월·점수 기본값

### 5.1 game_config JSON

| key | 초기 value |
| --- | --- |
| grade_rates | `{"common":70,"rare":22,"epic":7,"special":1}` |
| upgrade_cost | `10` |
| room_entry | `{"min_cards":5,"any_grade":true}` |
| priority_weights | `{"own":0.6,"quality":0.4}` |
| own_score | `{"count_cap":30,"count_weight":0.5,"grade_weight":0.3,"style_weight":0.2,"grade_points":{"common":25,"rare":50,"epic":75,"special":100}}` |
| gauge | `{"start":100,"monthly_min_rounds":3,"decay_per_month":50}` |

mutation은 필요한 설정을 트랜잭션 내 한 번 읽는다. 필수/추가 key·enum·숫자를 DB 검증한다. 확률≥0·합계100, weight≥0·그룹 합계1, count_cap/upgrade_cost/min_cards는 양의 정수. gauge.start=1~100, monthly_min_rounds≥0, decay=1~100. 스타일 수3·등급 순서·any_grade=true는 v1 고정이며 변경 설정은 거부한다. 설정 누락·오염은 CONFIG_INVALID로 전체 롤백한다.

### 5.2 추첨·강화

- 등급을 먼저 grade_rates로 추첨하고 30 template 중 균등 추첨. round1·draw1·카드+1을 한 트랜잭션으로 처리한다.
- isNew는 추첨 직전 해당 template의 모든 등급 count 합계=0인지다. 과거 수집 이력이 아닌 현재 보유 기준.
- demoForceGrade는 private.demo_accounts.can_force_grade=true인 user만. 일반 user는 FORBIDDEN. template 고정 옵션은 공개 API에 없다.
- 같은 template/grade10장→다음 grade1장. special 강화는 MAX_GRADE. 0행은 유지하되 보유 스타일·최고 등급 계산에서 제외한다.
- 추첨·강화는 동일 사용자 transaction lock을 공유한다. 최초 isNew·차감·적립·작업 성공 기록까지 원자적이다.
- complete_round는 사용자 잠금 다음에 데모 clock을 잠그고 period_month를 읽는다. 라운드 저장과 커밋까지 유지해 월 마감 뒤 지난 월 라운드가 뒤늦게 추가되지 않도록 한다.
- 난수 경계는 결정적으로 테스트한다. 실제 1,000회 분포는 수치를 기록하고 좁은 확률 허용 범위를 합격 조건으로 삼지 않는다.

### 5.3 입장·재입장 — 보완 기본값

- 해당 influencer의 모든 template/grade count 합계≥5. 카드는 소모하지 않는다.
- 부족 응답에 requiredCards/ownedCards/missingCards. 이미 active면 강화로5장 미만이 되어도 유지한다.
- 최초 gauge100. active의 join 재호출은 gauge·joined_at을 보존한다.
- left는 **left_month보다 뒤 월**이고 현재 5장 이상일 때 재입장 가능하다. left_month는 퇴장의 효력이 발생한 월이다. 예를 들어 11월 마감으로 12월 시작 시 퇴장하면 left_month=12월이고 재입장은 1월부터다. 퇴장한 월에는 REJOIN_NOT_AVAILABLE. 재입장 시 gauge=100, joined 갱신, left 정보=null.
- 잠금은 사용자 카드 → demo clock(데모만) → membership 순서. 월 마감은 clock → membership만 사용한다.
- 자발적 나가기·추방·게이지 충전·카드 선물은 v1 범위 밖.

### 5.4 월 경과 — 보완 기본값

- 데모 rounds.period_month·입장 월은 demo_clock.current_month. 일반 계정은 실제 KST 월. played_at은 모두 실제 서버 시각.
- advance_demo_month는 role=admin 및 can_advance_month=true만. demo_accounts에 등록된 active 사용자 멤버십만 변경한다.
- targetMonth는 월 첫날이며 바로 다음 월만 새 처리. 예: 2026-11-01→2026-12-01은11월 마감.
- clock을 잠그고 마감 월의 사용자 전체 데모 라운드 수를 집계한다. 방과 무관하게3회 미만이면 각 active방 gauge-50,3회 이상이면 유지(회복 없음).
- 입장한 부분 월도 평가하며 면제는 없다. 0 이하는 0으로 고정하고 status=left, left_month=targetMonth, left_at=now()로 기록한다. closedMonth는 활동 평가 월, left_month는 퇴장 효력 월로 구분한다.
- 결과·demo_month_runs·clock 이동은 한 트랜잭션. 같은 targetMonth 재요청은 기존 결과+applied=false, 추가 감소 없음. 처리 이력 없는 과거 월·미래 건너뛰기는 INVALID_MONTH_TRANSITION.
- 다른 requestId 동시 요청도 한 마감만 적용. 동일 requestId 재시도는 최초 응답 그대로.
- 일반 계정 자동 월마감 스케줄러는 해커톤 범위 밖. 데모 기능을 운영 자동화로 보고하지 않는다.

### 5.5 ownScore·priority — 보완 기본값

해당 방 influencer의 현재 카드로 계산한다.

```text
countScore = 100 × min(totalCards,30) / 30
gradeScore = 최고 등급 점수(common25/rare50/epic75/special100), 없으면0
styleScore = 100 × 보유 스타일 수 / 3
ownScore   = round(0.5×countScore + 0.3×gradeScore + 0.2×styleScore,2)
priority   = round(0.6×ownScore + 0.4×qualityScore,2)
```

계수는 §5.1 설정에서 읽는다. 최종 저장 시 DB 계산 snapshot이며 이후 카드·설정 변경으로 재채점하지 않는다. qualityScore는 검증한 AI 값만 받는다.

예: common 한 스타일5장은 ownScore22.50, quality80이면 priority45.50. special 포함3스타일30장은 ownScore100, 같은 quality면 priority92.00.

인박스 기본은 미답변 user pass 질문. 정렬은 **priority DESC, id ASC**(같은 점수는 먼저 저장된 질문). answered 포함 옵션도 같은 정렬이다.

## 6. API·조회·오류 공통 계약

### 6.1 공개 타입

```ts
type UUID = string;
type MessageId = string; // bigint를 Number로 변환하지 않음
type Grade = 'common' | 'rare' | 'epic' | 'special';
type Style = 'illust' | 'retro' | 'holo';
type InfluencerType = 'youtuber' | 'media_pro' | 'tour';
type ApiError = {
  code: string; message: string; retryable: boolean;
  details?: Record<string, unknown>;
};
type Result<T> = { ok: true; data: T } | { ok: false; error: ApiError };
type Page<T> = { items: T[]; nextCursor: string | null };
type CardTemplate = {
  id: UUID; influencerId: UUID; influencerName: string;
  influencerType: InfluencerType; verifiedAt: string | null;
  style: Style; imageUrl: string;
};
type Membership = {
  roomId: UUID; status: 'active' | 'left'; gauge: number;
  joinedAt: string; joinedMonth: string;
  leftAt: string | null; leftMonth: string | null;
};
type Message = {
  id: MessageId; roomId: UUID; senderId: UUID;
  senderType: 'user' | 'influencer'; senderName: string;
  body: string; replyTo: MessageId | null; createdAt: string;
  clusterId: UUID | null;
  ownScore: number | null; qualityScore: number | null; priority: number | null;
};
```

모든 SDK 메서드는 Promise<Result<T>>다. SDK만 snake_case→camelCase, numeric, 문자열 ID를 정규화한다. database.types.ts는 CLI로 생성하고 수동 수정하지 않는다. SQL RPC는 표의 camelCase 도메인 payload를 JSONB로 만들되 template은 imageUrl 대신 imagePath를 전달한다. SDK가 Storage 공개 URL을 만들어 최종 CardTemplate.imageUrl로 바꾼다. DB에 환경별 절대 URL을 하드코딩하지 않는다.

SDK는 세션을 Supabase client에서 얻으며 공개 인자에 userId/actor/role을 받지 않는다. RLS 때문에 비어 있는 결과를 확인하려고 관리자 권한으로 재조회하지 않는다.

### 6.2 오류 코드

| code | 의미·details | retryable |
| --- | --- | --- |
| UNAUTHENTICATED | JWT 없음·만료·위조, 재로그인 | false |
| FORBIDDEN / NOT_FOUND | 역할·소유권 부족 / 접근 가능한 대상 없음 | false |
| VALIDATION_ERROR / CONFIG_INVALID | 입력/설정 불량 | false |
| INSUFFICIENT_CARDS | requiredCards, ownedCards, missingCards | false |
| MAX_GRADE | 최고 등급 강화 | false |
| ROOM_INACTIVE | 활성 멤버가 아님·월마감 퇴장 | false |
| REJOIN_NOT_AVAILABLE | eligibleMonth | false |
| INVALID_MONTH_TRANSITION | currentMonth, requestedMonth | false |
| IDEMPOTENCY_CONFLICT | 같은 requestId에 다른 payload | false |
| REQUEST_IN_PROGRESS | 동일 작업 처리중, retryAfterMs | true |
| FILTERS_CHANGED | 판정중 필터 변경, 재판정 필요 | true |
| RATE_LIMITED | retryAfterSeconds | true |
| FILTER_UNAVAILABLE | AI 미설정·timeout·JSON/점수 오류 | true |
| ALREADY_REVIEWED / PENDING_EXISTS | 심사 완료/신청중 중복 | false |
| ALREADY_REPLIED | 질문 답변 완료 | false |
| NETWORK_ERROR / INTERNAL_ERROR | 통신/예상 밖 장애 | true |

SQL 업무 오류는 SQLSTATE P0001, MESSAGE=고정code, DETAIL=비기밀JSON. Edge error body는 `{ok:false,error:ApiError}`, HTTP401/403/404/400/409/429/503/500을 의미에 맞춘다. SDK는 SQL/HTTP 오류를 Result로 바꾸고 raw SQL·stack·JWT·키를 반환하지 않는다. 자동 무한 재시도는 하지 않는다.

### 6.3 조회 계약

| SDK | 입력·조회원 | 반환data |
| --- | --- | --- |
| getCollection() | security_invoker collection_view, 본인 | `{items:CollectionItem[]}` |
| getRooms() | security_invoker room_catalog, 본인 장수·멤버십 | `{items:RoomCatalogItem[]}` |
| getMyMembership(roomId) | room_members의 본인/방 1행 | Membership 또는 null |
| getMessages({roomId,beforeId?,afterId?,limit?}) | messages room_id + id keyset | Page<Message> |
| getMyVerifications({cursor?,limit?}) | 본인 influencer 신청 | Page<Verification> |
| getPendingVerifications({cursor?,limit?}) | admin, pending | Page<Verification> |
| getGameConfig() | game_config 공개값만 | §5.1 key/value/version 목록 |

```ts
type CollectionItem = {
  template: CardTemplate; counts: Record<Grade, number>;
  totalCards: number; highestGrade: Grade | null;
};
type RoomCatalogItem = {
  roomId: UUID; influencerId: UUID; influencerName: string;
  influencerType: InfluencerType; verifiedAt: string | null;
  requiredCards: number; ownedCards: number; missingCards: number;
  canJoin: boolean; eligibleMonth: string | null; membership: Membership | null;
};
type Verification = {
  id: UUID; influencerId: UUID; type: InfluencerType; evidenceUrl: string;
  status: 'pending' | 'approved' | 'rejected'; createdAt: string;
  reviewedAt: string | null; rejectionReason: string | null;
};
```

collection_view는 미보유 포함30행·grade별0을 채운다. room_catalog는10방이며 active면 canJoin=true, 재입장 제한이면 false. 실제 입장은 RPC 재검증. imageUrl은 image_path의 공개 Storage URL로 SDK가 만든다.

메시지 기본50·최대100, beforeId/afterId 동시 금지. 최초/before는 id DESC 조회 후 SDK ASC 정렬, nextCursor=최소id(과거방향). after는 id ASC, nextCursor=최대id(복구방향). limit+1로 후속 유무를 판단하고 id를 인과 순서로 사용한다.

본인 신청과 pending 신청은 (created_at,id) ASC keyset, 기본 50·최대 100이다. cursor는 base64url(JSON 튜플)이며 SDK에서 검증·직렬화한다.

### 6.4 일반 mutation 멱등성

모든 mutation은 UUID requestId 필수. 최초 동작에서 생성하고 네트워크 재전송은 같은 값을 쓴다. SQL 인자는 p_request_id.

- 키=(auth.uid(),operation,requestId). 정규화 payload의 SHA-256 저장. 문자열 trim·배열 정렬 규칙은 함수마다 일관되게 적용.
- 같은 키/같은 성공 payload는 최초 결과 반환, 다른 payload는 IDEMPOTENCY_CONFLICT.
- 성공 캐시를 반환하기 전에도 현재 role·리소스 소유권·접근권한을 검사한다. 퇴장 후 메시지 결과나 소유권 상실 후 summary를 requestId만으로 조회하지 못한다. 멱등 join의 캐시는 현재 상태를 바꾸지 않으며 UI는 getMyMembership으로 최신 상태를 읽는다.
- 일반 RPC 데이터 변경과 성공 operations 기록은 한 트랜잭션. 실패는 전부 롤백. 성공 뒤 바뀐 설정으로 재실행하지 않음.
- operations 예약/잠금 뒤 도메인 잠금. 같은 키 경합은 대기 후 결과 반환, 다른 키는 도메인 잠금으로 제어.
- 성공 operations는7일 유지. 7일 이후 미확정 요청을 SDK가 자동 재전송하지 않음. AI 비저장 결과 예외는 §7.3.

## 7. RPC·메시지 전송 계약

### 7.1 브라우저 직접 호출 RPC

아래 mutation은 모두 p_request_id uuid 필수. 표 외 actor/role/점수 입력은 받지 않는다. SDK 입력은 p_ 제거 camelCase다. 예: upgradeCard({requestId,templateId,grade}).

| SDK → RPC | 나머지 SQL 입력 | 반환data / 권한 |
| --- | --- | --- |
| completeRound → complete_round | p_demo_force_grade card_grade default null | `{roundId,drawId,grade,template:CardTemplate,isNew,ownedCount}` / user, 고정등급은 capability 추가 |
| upgradeCard → upgrade_card | p_template_id uuid, p_grade card_grade | `{templateId,fromGrade,toGrade,consumed,remainingCount,upgradedCount}` / user |
| joinRoom → join_room | p_room_id uuid | `{membership:Membership,alreadyActive:boolean}` / user |
| advanceDemoMonth → advance_demo_month | p_target_month date | `{closedMonth,currentMonth,applied:boolean,members:[{roomId,userId,roundCount,previousGauge,gauge,status}]}` / demo admin |
| replyToMessage → reply_to_message | p_room_id uuid, p_reply_to bigint, p_body text | `{message:Message}` / 방 소유 influencer |
| requestVerification → request_verification | p_type influencer_type, p_evidence_url text | `{verification:Verification}` / 본인 influencer |
| approveVerification → approve_verification | p_verification_id uuid, p_decision text(approved/rejected), p_reason text default null | `{verification:Verification,verifiedAt:string 또는 null}` / admin |
| updateRoomFilters → update_room_filters | p_room_id uuid, p_disabled_filters text[], p_expected_version int | `{roomId,disabledFilters,version}` / 방 소유 influencer |
| updateGameConfig → update_game_config | p_key text, p_value jsonb, p_expected_version int | `{key,value,version}` / admin |

ownedCount/upgradedCount는 해당 template/grade의 갱신 직후 count. optional 값은 명시적 null 전달. reply 본문도 trim1~2000자.

| 읽기 SDK → RPC | 입력 | 반환data / 권한 |
| --- | --- | --- |
| getRoomInbox → get_room_inbox | p_room_id uuid, p_include_answered bool default false, p_cursor jsonb default null, p_limit int default50 | Page<InboxItem> / 방 소유 influencer |
| getRoomFilters → get_room_filters | p_room_id uuid | `{roomId,disabledFilters,mandatoryFilters,version}` / 방 소유 influencer |

InboxItem=Message + answered:boolean + replyId:MessageId/null. inbox cursor={priority:number,id:MessageId}, 다음 행은 낮은 priority 또는 같은 priority의 큰 id. limit≤100. SQL이 id를 문자열로 반환한다. expectedVersion 충돌은 필터=FILTERS_CHANGED, 설정=IDEMPOTENCY_CONFLICT(details.currentVersion)이며 덮어쓰지 않는다.

### 7.2 submit-message Edge

SDK submitMessage({requestId,roomId,body}) → functions.invoke('submit-message',{body:{requestId,roomId,body}}).

```ts
type SubmitMessageData =
  | { verdict:'pass'; message:Message; category:null; reason:null; rewrite:null }
  | { verdict:'suggest'; message:null; category:string; reason:string; rewrite:string|null }
  | { verdict:'block'; message:null; category:string; reason:string; rewrite:null };
```

body는 trim 후1~2000 Unicode code point, 요청≤16KiB, 추가 key 거부. user만 질문 전송, influencer는 reply RPC.

1. POST/JSON/CORS·JWT 서명/만료/프로젝트 검증. JWT decode나 publishable key만으로 인증하지 않는다.
2. 검증 JWT에서 actor를 얻고 user 역할·active·필터 version 확인. actor/verdict/quality/priority 입력 금지.
3. service-only begin_message_submission으로 requestId/payloadHash 예약·분당 제한 적용. 사용자10회/분, 실패/block/suggest 포함, 같은 requestId 재시도는 추가 차감 없음.
4. 유효 lease 한 요청만 AI 호출, JSON schema 검증.
5. service-only submit_moderated_message가 membership·role·필터version·lease 재검증. pass는 DB 점수 계산+messages+operations 성공을 원자 저장.
6. suggest/block은 messages 없이 moderation metadata만 기록. 수정안은 사용자가 확인 후 **새 requestId**로 재전송.
7. 판정중 퇴장은 ROOM_INACTIVE, 필터 변경은 FILTERS_CHANGED로 미저장. 같은 requestId로 최신 필터 재판정 가능.

### 7.3 Edge 내부 RPC·lease

아래 RPC는 service_role 역할에만 EXECUTE. 서버 secret key의 DB 역할 경계를 사용하며 legacy service_role key를 신규 설정에 쓰지 않는다. PUBLIC/anon/authenticated는 실행 불가. private 함수가 필요하면 서비스 전용 public wrapper에서만 호출한다.

| 내부 RPC | 필수 입력 | 결과·책임 |
| --- | --- | --- |
| begin_message_submission | p_actor_id, p_room_id, p_request_id, p_payload_hash | 예약·제한·lease. `{state,leaseToken,filterVersion,disabledFilters,cachedResult?}` |
| submit_moderated_message | 위 식별자, p_lease_token, p_filter_version, p_body, p_verdict, p_category nullable, p_quality nullable | 최종 재검증·pass 저장/점수 또는 metadata·성공기록. reason은 category별 고정 안내문에서 생성 |
| fail_message_submission | p_actor_id, p_request_id, p_lease_token, p_error_code | token 일치 시 failed, 원문·stack 미저장 |
| begin_room_ai_operation | p_actor_id, p_room_id, p_operation(summary/cluster), p_request_id, p_payload_hash | 소유권·방/actor rate limit·lease·cache |
| finish_room_ai_operation | 위 식별자, p_lease_token, p_source_message_ids, p_result jsonb | source·방·lease 재검증, cluster/summary·성공기록 |
| fail_room_ai_operation | 작업 식별자, p_lease_token, p_error_code | 유효 lease만 failed |

ID=uuid, source IDs=bigint[], hash=text, lease token=uuid, version=int, body/category/code=text, verdict enum, quality=numeric. begin 반환은 state(processing/succeeded/failed)와 nullable lease/cachedResult를 갖는 JSONB. finish는 외부 SDK에 반환할 payload JSONB, fail은 `{updated:boolean}`. 일반 내부 함수 입력도 추가·길이·형식을 검증한다.

lease는 30초이며 UUID token을 발급한다. 처리 중 재시도는 REQUEST_IN_PROGRESS/retryAfterMs. finish/fail은 잠근 operation의 state=processing, 현재 token 일치, lease_until>now()를 모두 검사한다. 만료됐지만 아직 재예약되지 않은 token도 완료할 수 없다. 만료·실패 후 재시도는 새 token을 발급한다. lease당 AI 호출은 한 번이며 adapter의 숨은 자동 재시도는 없다. 외부 timeout 직전 처리 등으로 **공급자 과금 exactly-once는 보장하지 않는다**. DB 저장 중복은 반드시 막는다.

pass 성공은 저장된 응답 복구. block/suggest operations에는 verdict/category/reason만 저장하고 원문·rewrite 없음. 최초 suggest에만 rewrite, 동일 requestId 재조회는 rewrite=null 가능. SDK는 최초 수정안을 메모리에 유지하고 새로고침 뒤 재입력을 안내한다. 이 예외 외 성공 응답은 동일하다.

payloadHash에는 정리한 body/roomId, 판정/filterVersion은 제외. FILTERS_CHANGED 실패 후 같은 요청은 최신 필터로 재판정하되 기존 성공 pass는 다시 처리하지 않는다. 내부 RPC는 Edge 사전 검사만 믿지 않고 현재 actor 권한을 재검사한다.

### 7.4 도메인 잠금

사용자 메시지 최종 저장은 사용자 카드 → demo clock(해당 시) → membership → 방 단위 메시지 쓰기 잠금 순서다. 입장은 앞의 세 단계, 월 마감은 clock → membership을 사용한다. 답변은 방 단위 메시지 쓰기 잠금 → 대상 질문 잠금 순서다. cluster 최종 반영도 방 잠금을 먼저 획득한다.

질문·답변의 방 잠금은 **messages INSERT의 identity ID 할당 전** 획득하고 커밋까지 유지한다. 같은 방에서 작은 ID가 늦게 커밋되어 lastId 복구에서 빠지지 않도록 모든 메시지 생성 경로를 직렬화한다. 다른 방은 독립 실행한다. LLM 호출 동안 DB transaction lock을 유지하지 않는다.

update_room_filters도 같은 방 잠금을 획득한다. 최종 메시지 저장은 방 잠금을 잡은 뒤 필터 version을 재확인하고 커밋까지 유지한다. 확인 직후 필터가 변경되는 경합을 막는다. 테스트 fixture의 messages INSERT도 같은 순서를 따르거나 동시 사용자가 없는 초기화 단계에서만 수행한다.

## 8. AI·필터·인증 정책

### 8.1 문환P와 교환할 adapter

```ts
type Verdict = 'pass' | 'suggest' | 'block';
interface AiAdapter {
  moderateAndScore(input: {
    body:string; disabledFilters:string[]; signal:AbortSignal;
  }): Promise<{
    verdict:Verdict; category:string|null; reason:string|null;
    rewrite:string|null; quality:number;
  }>;
  clusterQuestions(input: {
    messages:{id:MessageId;body:string}[]; signal:AbortSignal;
  }): Promise<{representative:string;messageIds:MessageId[]}[]>;
  summarize(input: {
    messages:{id:MessageId;body:string;sender:string}[]; signal:AbortSignal;
  }): Promise<string>;
}
```

홍주P는 adapter·형식검사·전송 계층, 문환P는 LLM·프롬프트·금칙어 fallback·품질을 소유한다. fixture는 테스트에서 정한 입력별 결과이며 브라우저가 판정을 주입하는 API는 없다.

- LLM timeout8초, 전체 처리 목표12초. timeout/5xx/JSON오류/quality비유한·범위밖은 FILTER_UNAVAILABLE, 저장 없음.
- 사용자 입력을 비신뢰 데이터로 전달한다. 키·계정정보·차단 원문을 추가 문맥으로 넘기지 않는다.
- pass는 category/reason/rewrite=null. suggest는 허용된 category와 rewrite 1~2000자 필수(최초 응답), block은 category 필수·rewrite=null이다. AI의 자유문장 reason은 저장·로그·사용자 응답에 사용하지 않는다. 원문을 인용할 수 있기 때문이다. 최종 reason은 아래 고정 안내문으로 만든다. 불량 category/결과를 pass로 보정하지 않는다.
- metadata7일 보관. 본문/JWT/rewrite 서버로그 금지. 만료 moderation_events·operations·과거 rate_windows는 서버 전용 cleanup 및 일별 pg_cron으로 정리하고 실행 여부 검증.
- 실제 adapter/키 없으면 actual AI 미검증. fixture를 실제 판정 성공으로 보고하지 않는다.

### 8.2 필터 — 보완 기본값

| 종류 | category | 설정 |
| --- | --- | --- |
| 필수 | threat, sexual_harassment, personal_data, illegal_request | 해제 요청 자체 VALIDATION_ERROR |
| 선택 | profanity, belittling, spam | 방 소유자만 disabledFilters로 해제 |

초기 disabledFilters=[]. 선택 enum만, 중복 제거·정렬 저장, version 증가. 해제는 해당 선택필터 적용을 끄는 것이며 필수정책을 덮어쓰지 않는다. moderation metadata도 influencer/admin 화면에 노출하지 않는 기본안. 인박스에는 pass만 있다.

고정 reason 매핑: threat=`위협적인 표현은 전송할 수 없습니다.`, sexual_harassment=`성희롱 표현은 전송할 수 없습니다.`, personal_data=`개인정보를 포함한 내용은 전송할 수 없습니다.`, illegal_request=`불법 행위를 요청하는 내용은 전송할 수 없습니다.`, profanity=`욕설 표현을 수정해 주세요.`, belittling=`비하 표현을 수정해 주세요.`, spam=`반복·홍보성 내용을 수정해 주세요.`. 필수 category는 block만, 선택 category는 suggest 또는 block만 허용한다. disabledFilters의 category를 사유로 차단한 AI 결과는 계약 오류로 거부한다.

### 8.3 summarize-room·cluster-questions

JWT 인증 **방 소유 influencer만**, admin 타방 호출도 불가. 브라우저의 임의 원문 배열을 받지 않고 DB에서 source를 읽는다. 두 작업 합쳐 방1회/분·actor3회/분, 같은 requestId 재시도 추가 차감 없음.

| SDK 요청 | source·한계 | 반환data |
| --- | --- | --- |
| summarizeRoom({requestId,roomId}) | 최신pass/답변100개·총20,000자, 최신 우선 포함 후id정렬 | `{roomId,summary,sourceMessageIds,generatedAt}` |
| clusterQuestions({requestId,roomId}) | 미답변user pass 최신100개·총20,000자 | `{roomId,clusters:[{id,representative,memberCount,messageIds}]}` |

summary≤2000자, 빈 source는 summary=""/IDs=[]·LLM0회. cluster는2개 이상 묶음만, 대표문장≤200자, 메시지는 한 묶음에만. source 밖·다른방·중복ID 결과는 전체 거부. singleton cluster_id=null.

묶기 완료는 source ID의 기존 cluster_id 정리와 새 묶음을 한 트랜잭션에 반영한다. source 밖 메시지의 묶음은 유지하되 참조 수를 재계산한다. 1개만 남은 묶음도 해당 메시지의 cluster_id를 null로 만들고 삭제한다. 같은 방 작업은 직렬화한다. summary는 공개 테이블 없이 operation 결과로 캐시한다. 실패 시 기존 결과·묶음을 보존하며 자동 무한 재실행은 없다.

### 8.4 인증

- 본인 influencer만 신청. evidenceUrl은 HTTPS≤2048자 문자열, 임의 URL fetch 금지.
- influencer별 pending1개. 반려 후 새 requestId로 재신청. 이미 verified이면 추가 신청 거부(재인증·취소 범위 밖).
- pending만 승인/반려. 동시 검토는1개 성공.
- 승인 시 influencers.type=신청type, verified_at=서버시각. 반려는 verified_at 변경 없음. 신청상태·reviewer·reviewed_at·private이력 원자 갱신.
- 배지=verifiedAt 유무+influencerType. 임의 badge flag 없음.

## 9. Realtime·Storage·Auth

### 9.1 메시지 구독

- publication에는 public.messages만. moderation·operations·비공개설정 포함 금지.
- subscribeRoomMessages({roomId,onMessage,onStatus})는 room_id 필터·INSERT만 구독, unsubscribe 함수 반환. 필터가 아닌 SELECT RLS가 권한 경계.
- SUBSCRIBED→초기조회→버퍼병합→id중복제거→id ASC. 재연결은 마지막id 이후 페이지 재조회로 복구.
- 계정/방 전환·로그아웃은 이전채널·캐시 정리. 데모전환은 실제 signOut/signInWithPassword, 임의userId 교체 아님.
- 월마감 뒤 membership 갱신, left면 구독해제. 클라이언트가 해제하지 않아도 RLS로 신규 이벤트가 막혀야 함.
- 연결장애만3초 폴링 fallback, 복구시중단. 권한거부/left/로그아웃은 폴링도 중단.

### 9.2 Storage

- card-assets public read, 최대10MiB, MIME image/png·image/jpeg·image/webp.
- object path=`<influencer_uuid>/<style>.webp`, 총30개. placeholder와 최종이미지 경로 동일.
- INSERT/UPDATE/DELETE는 profiles.role=admin만. user/influencer/anon 쓰기·덮어쓰기·삭제 거부.
- 공개 이미지에 signed URL 사용 안 함. 없는 이미지의 UI placeholder 연결 예제 제공.
- 버킷·정책은 migration으로 재현. 로컬 config 선언을 원격 적용 완료로 보지 않음.

### 9.3 Auth 계정 프로비저닝

로컬 script가 Auth Admin으로 userA/userB/influencer/admin 최소4계정을 만든다. user-a@example.test 같은 비실계정 이메일 사용, 암호는 안전하게 생성하거나 환경변수로 받는다. 가입 trigger 이후 관리 연결로 role·private 매핑·demo capability 부여. seed/프론트에 암호·Admin키 금지.

거부 테스트에는 다른 방 influencerB와 demo_accounts에 없는 일반 user를 별도 fixture로 추가한다. Auth 계정은 같은 이메일이면 재사용한다. 도메인 시연 데이터는 demo_fixture_runs의 버전 marker와 같은 트랜잭션으로 최초 1회만 주입한다. 재실행으로 카드·게이지·clock·질문·답변·신청을 덮어쓰거나 중복 생성하지 않는다. Auth API 생성과 DB 트랜잭션은 별개이므로 중간 실패 후에도 같은 계정을 재사용해 재개한다.

일반 가입은 influencer/admin을 만들지 못한다. setup은 로컬 URL만 기본 허용·반복 실행 안전. 원격 계정 생성은 대상확인·요청이 있을 때만. 암호는 검증로그 대신 로컬 비밀 저장소에 전달한다.

## 10. 시드·환경·실행 명령

### 10.1 시드와 시연 시나리오

1. seed.sql은 설정 6개·가상 인물 10명·template 30개·room 10개·room_settings 10개·demo_clock 1개를 안정적 UUID로 구성한다. 콘텐츠 upsert는 가능하지만 기존 사용자 카드·멤버십·필터·clock·변경된 game_config는 덮어쓰지 않는다. 상태·설정 초깃값은 ON CONFLICT DO NOTHING으로 넣는다.
2. setup: userA 첫 인물 illust common10+retro common1+holo special1=12장. userB illust common5장. 둘 다 첫방 active/gauge100·can_force_grade=true. admin만 can_advance_month=true.
3. 같은 quality의 두 user 질문으로 정렬 차이, 답변완료1개·pending인증1개. 테스트는 RPC 또는 명시적 로컬 fixture setup 사용.
4. userA 강화 후 rare1+다른스타일2=3장이어도 active 유지. 4/5장 입장 경계는 독립fixture.
5. 전체 재현 기준은 **로컬 db reset+demo setup**. seed upsert만으로 사용자상태 전체 초기화를 약속하지 않음.

### 10.2 환경변수

| 위치 | 변수 | 규칙 |
| --- | --- | --- |
| 프론트 .env.local | NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | §2.1 원격 또는 로컬 한 환경만 |
| CLI 저장소·셸 | SUPABASE_ACCESS_TOKEN / 필요시 SUPABASE_DB_PASSWORD | 비밀값 문서/Git 금지 |
| Edge runtime | SUPABASE_URL / SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS | 서버만, 실제 제공 여부 확인 |
| 로컬 Edge .env | SUPABASE_PUBLISHABLE_KEY / SUPABASE_SECRET_KEY | 단일키 fallback 필요한 경우만, Git제외 |
| Edge .env/Secrets | AI_MODE=fixture 또는 live, LLM_API_KEY/LLM_MODEL/adapter필수값 | fixture 로컬전용, live 누락검증 |
| Edge .env/Secrets | ALLOWED_ORIGINS | localhost:3000·승인된 프리뷰 origin allowlist |

publishable key는 apikey, 사용자 access token은 Authorization Bearer. 공개키를 JWT로 보지 않는다. legacy anon/service_role key를 신규 기준으로 쓰지 않는다. 런타임 key JSON의 키 이름을 명시하고 서버 비밀모듈의 브라우저 import를 막는다.

사용자 Edge는 verify_jwt=true 기본이며 handler도 user JWT를 검증한다. gateway가 선택 서명키/런타임 JWT를 처리하지 못하면 원인 기록 후에만 verify_jwt=false+getUser/getClaims 또는 공식 auth:user wrapper로 전환. 어느 설정이든 key만 가진 호출은 거부. OPTIONS는 인증 전 CORS 응답만, DB/LLM 호출 없음.

### 10.3 개발 시 실행 명령

B-01에서 아래 scripts를 먼저 구현한다. 현재 존재한다고 가정하지 않는다. 기존 package manager가 npm이 아니면 같은 의미로 맞춘다.

실행 전 준비 순서는 package/고정 CLI → config가 없을 때만 §2.3의 init → migration·seed·Function·SDK·scripts 작성 → 실제 로컬 env 준비 → start → reset이다. 타입 출력 디렉터리 lib/supabase와 Functions env-file도 첫 사용 전에 생성한다. 아래 명령은 이 준비가 끝난 뒤 실행한다.

```bash
npm ci
npx supabase start
npx supabase db reset
npm run demo:setup
npx supabase gen types typescript --local > lib/supabase/database.types.ts
npx supabase db lint
npx supabase test db
npx supabase functions serve --env-file supabase/functions/.env
# 별도 터미널
npm run typecheck
npm run test:backend
npm run verify:backend
```

신규 package는 npm install로 lockfile 생성 후 npm ci. 고정 CLI --help로 flag 확인. demo:setup=계정/시나리오, typecheck=SDK/테스트 타입, test:backend=DB·Edge·SDK 계약, verify:backend=P0/P1/P2 스모크·Realtime·역할별 거부. Edge 타입/테스트는 고정 Deno 설정·명령으로 연결한다.

Docker가 없으면 코드·테스트 작성과 정적검사를 계속하고 런타임 미검증으로 기록한다. 원격 DB를 테스트 대용으로 reset하지 않는다.

## 11. 티켓·수행 순서

P0/P1/P2는 순서이며 전체완료 요청에서 P2를 임의 제외하는 기준이 아니다. B-12는 기존 서비스 목록에만 있던 AI 전송계층, B-13은 완료검증을 명시한 보완 티켓이다.

| ID | 산출물 | 티어·선행 | 완료 기준 |
| --- | --- | --- | --- |
| B-01 | toolchain·CLI고정·schema/Auth/RLS/grants | P0/없음 | 가입user·metadata무시·reset·역할검증 |
| B-02 | seed·placeholder·계정script | P0/B-01 | 10인/30template/10방·4계정·반복안전·비밀없음 |
| B-03 | complete_round·config·멱등·cards SDK | P0/B-01,02 | 원자지급·강제등급권한·isNew경합·확률검증 |
| B-04 | collection_view·upgrade_card·SDK | P0/B-03 | 9/10장·special·동시차감정합 |
| B-05 | room_catalog·join_room·SDK | P1/B-04 | 4/5장·active보존·재입장월 |
| B-06 | 내부저장RPC·submit-message·SDK·Realtime | P1/B-05 | JWT·3판정·직접우회거부·멱등·전송중권한변경 |
| B-07 | demo_clock·월마감·SDK | P1/B-05 | 2/3회·중복1마감·퇴장·재입장 |
| B-08 | 점수·inbox·reply·SDK | P1/B-06 | 공식·snapshot·동점페이지·답변권한 |
| B-09 | 신청·심사·이력·SDK | P2/B-01,02 | pending UQ·동시검토·배지일관 |
| B-10 | filters/config·version·cleanup | P2/B-06 | 필수해제불가·소유권·version·7일정리 |
| B-11 | 연결·환경·배포·복구runbook | P0/B-01 | 키구분·대상·dry-run·외부조건 |
| B-12 | summary/cluster·작업RPC·adapter | P2/B-06,08 | source검증·제한·재처리·실패보존 |
| B-13 | 테스트·SDK통합·증거·인계예제 | 전구간/각티켓 | §12 통과·모의/실제·로컬/원격 구분 |

순서:

1. B-01→B-02, B-11 연결/환경 안내 병행.
2. B-03→B-04→P0 SDK 통합(Auth→draw→collection→upgrade).
3. B-05→B-06→B-08→P1 SDK 통합(join→판정→Realtime→inbox→reply).
4. B-07 연결→퇴장·신규이벤트거부·다음월재입장.
5. B-09→B-10→B-12, 실제AI 없어도 fixture 계약 구현 완료.
6. B-13→fresh reset 재검증→SDK 인계. 원격조건·요청 충족 시 B-11 적용, 팀화면 리허설2회.

일정 참고: 1일차 오전 기반·추첨, 오후 강화·입장·전송, 저녁P0, 밤게이지·인박스. 2일차 오전인증·필터·AI계층, 점심P1, 오후수정·동결·리허설. 생략한 티켓은 완료로 표시하지 않는다.

migration 순서: core/config→private/Auth→RLS/helpers→cards/views→rooms/month→messages/score/inbox→verification/filters/config→AI/cleanup→Storage/Realtime. CLI로 기존 파일과 충돌 없는 이름 생성. 적용된 migration을 고치지 않고 새 migration으로 수정한다.

## 12. 필수 검증

| 묶음 | 사례·합격 조건 |
| --- | --- |
| 재현 | 빈 로컬 DB에서 migration+seed+setup 및 재실행 성공. 타입 검사·DB lint 통과 |
| 역할 | anon/userA/userB/방 소유자/다른 influencer/admin 각각 허용·거부 확인. 가입 metadata의 admin/demo 값 무시 |
| 지급 | 같은 requestId 20회 병렬 호출 시 round/draw 각 1개·카드 +1. 다른 payload 재사용 거부. 같은 template 최초 동시 지급의 isNew=true는 정확히 1개 |
| 강화 | 9장 거부·10장 성공·special 거부. 10장에 서로 다른 요청 2개 병렬 호출 시 1개 성공·1개 부족. 음수·부분 지급 없음 |
| 확률·설정 | 설정 누락·음수·합계 오류 거부. 난수 경계 검사와 1,000회 분포 기록. 일반 계정 강제 등급 거부 |
| 입장 | 4/5장 경계·카드 미소모·active gauge 보존·강화 후 유지. 퇴장 효력 월 재입장 거부·다음 월 허용 |
| 월 | 2회면 -50·3회면 유지. 두 무활동 월 뒤 퇴장. 같은 월 병렬 요청에도 마감 1회. 월 마감과 라운드 저장 경합·비데모 데이터 보존 확인 |
| 메시지 | pass만 저장. suggest/block 원문·rewrite가 DB/Realtime/inbox/log에 없음. 동일 요청 1행·만료 lease 거부 |
| 신뢰 | JWT 없음·만료·위조·key만 가진 요청 거부. 내부 RPC 직접 호출·직접 INSERT·actor/verdict/quality 위조 거부 |
| AI 장애 | timeout·5xx·불량 JSON·NaN·점수 범위 오류 때 저장 없음. 판정 중 퇴장·필터 변경 거부 |
| 인박스 | 점수 예시·과거 snapshot 불변. 동점 페이지 중복·누락 없음. 타방·답변 대상·중복 답변 거부 |
| Realtime | 두 세션 송수신, 타방·left 이벤트 차단, 초기 버퍼 중복 제거, 재연결 복구, 계정 전환 정리, 폴링 중단. 큰 bigint 문자열과 동일 방 동시 전송도 확인 |
| 인증 | 본인 신청만 허용·pending 중복 거부. 승인/반려 경합 1회 성공. type·배지·이력 일관, 증빙 URL fetch 없음 |
| 필터·보관 | 필수 필터 해제·타방 변경 거부. version 충돌·저장 경합 검사. 만료 metadata/operations/rate window 정리 |
| 묶기·요약 | 소유자만 허용, source 밖·중복 ID 거부, 길이·호출 제한. 빈 source는 AI 0회. singleton 제외·실패 시 기존 결과 보존 |
| Storage | 공개 읽기 성공, 비관리자 쓰기·덮어쓰기·삭제 거부, 관리자 업로드 성공, 없는 이미지 예제 |
| 노출 | 번들·Git·fixture·로그에 secret/JWT/암호 없음. private 비노출·민감 RPC의 PUBLIC 실행 금지·권한 상실 후 캐시 조회 거부 |

실제 역할/JWT/RPC 경계로 검증한다. 관리자 직접 쓰기만으로 대체하지 않는다. 보안 거부 사례가 실패하면 시연이 되어도 미완료다. 명령·결과·환경·실패 원인을 기록한다.

## 13. 원격 적용·인계·복구

1. 원격 적용 요청과 대상 환경을 확인한다. 현재 문서 작성 중에는 원격 schema를 변경하지 않는다.
2. 관리 인증·ref·기존 schema/이력·DB 버전을 확인하고 로컬 major_version과 호환성을 맞춘다.
3. 필수 로컬 검증을 통과한 뒤 migration 목록·데이터 영향·백업·복구 가능성을 확인한다.
4. dry-run → migration → Functions → Secrets/Storage/Auth redirect 확인 → 원격 역할별 스모크 순서로 수행한다. JWT 정책도 배포 결과로 확인한다.
5. Vercel에는 URL/publishable key만 설정한다. 화면 코드가 없으면 안내·SDK 인계까지 수행하고 프론트 배포 완료로 표시하지 않는다.

인계 예제는 실제 export 이름·타입으로 제공한다.

```ts
const drawn = await completeRound({ requestId: crypto.randomUUID() });
const collection = await getCollection();
const joined = await joinRoom({ requestId: crypto.randomUUID(), roomId });
const sent = await submitMessage({ requestId: crypto.randomUUID(), roomId, body });
// sent.ok이면 verdict별 pass 표시 / suggest 수정 확인 / block 안내.
// 네트워크 재전송은 최초 동작의 기존 requestId 재사용.
```

cards는 현호P, rooms/chat/filters/verifications는 자성P가 사용한다. 코드·타입·예제를 저장소에 제공한다. 외부 메시지는 별도 지시 없이 전송하지 않는다.

적용 전 migration/Function 버전·대상·백업 위치를 기록하되 비밀값은 제외한다. 실패는 새 보정 migration으로 수정하고 원격 reset·이력 삭제는 하지 않는다. Function은 직전 정상 소스로 재배포한다. AI 장애 때는 실패 응답을 반환하고 필터 없이 저장하지 않는다. schema는 추가 변경을 우선하며 삭제·데이터 변환은 구체적인 영향과 복구안을 검토한다.

## 14. 진행·완료 보고

### 14.1 티켓

- [ ] B-01 toolchain·schema·Auth·RLS/grants
- [ ] B-02 seed·placeholder·로컬 계정/시나리오
- [ ] B-03 complete_round·멱등·확률/설정
- [ ] B-04 collection·upgrade_card
- [ ] B-05 room_catalog·join_room·재입장
- [ ] B-06 moderation·저장·조회·Realtime
- [ ] B-07 게이지·데모월마감
- [ ] B-08 점수·인박스·답변
- [ ] B-09 인증신청·심사
- [ ] B-10 필터·설정·보관정리
- [ ] B-11 연결·환경·배포·복구절차
- [ ] B-12 summary/cluster·AI adapter
- [ ] B-13 계약·권한·동시성·SDK통합검증

### 14.2 상태 구분

| 상태 | 조건 | 현재 |
| --- | --- | --- |
| 계획 단독 실행 준비 | 범위·기본값·타입·권한·순서·검증·외부조건 | 문서 보완·정적 교차 검토 완료 |
| 백엔드 로컬 완료 | B-01~13 코드·필수로컬검증 | 미착수/미검증 |
| 실제AI 검증 | live 호출·3판정·장애 | 미검증 |
| 팀화면 통합 | 담당화면 P0/P1/P2·오류·구독 | 미검증 |
| Supabase 관리 연결 | CLI/ref/DB접근 | 문서상 절차만 준비 |
| 원격 적용 | 승인환경migration/Functions/Secrets·스모크 | 미실행 |
| 데모 완료 | 동결 후 전체리허설2회 | 미실행 |

보고 순서는 변경 파일 → 명령/증거 → 완료 티켓 → 외부 조건/미검증 → 재개 방법이다. 외부 권한·AI 모듈이 없어도 독립 가능한 구현은 끝까지 진행한다.

### 14.3 이번 문서 검토 범위

2026-11-10 준비 상태 정리: 사용자 요청에 따라 로컬 `supabase/` 폴더 전체와 루트 `.env.example`을 삭제한다. 위 연결 값과 생성 기준은 이 문서에 보존하며 다음 개발 착수 시 B-01에서 생성한다. 원격 Supabase는 변경하지 않는다.

준비 단계의 전체 계획 검사기는 아직 이 파일들이 존재한다고 가정한다. 따라서 삭제 후 required file 누락도 보고할 수 있다. 이는 의도된 개발 전 상태이며, 검사를 통과시키려고 사용자 요청 전에 파일을 다시 생성하지 않는다. 개발 착수 시 초기화한 뒤 전체 검사를 실행한다.

기존 문서의 독립성·계약·권한을 검토하고 위 공백을 보완했다. Supabase 값은 사용자가 전달한 그대로 §2.1에 기록했다. 프로젝트 설정파일 생성·CLI 로그인/link·schema/RPC 생성·원격배포는 이번 작업의 범위가 아니다.

문서 자체 검증: 주요 절 15개, 티켓·체크리스트 13개 일치, TypeScript 예시 5개 구문 분석, 설정 JSON 6개 파싱, 전달받은 URL/key 일치, 코드 블록 짝·공백 검사를 통과했다. git diff --check도 통과했다. 이는 문서 검증이며 DB·Edge·브라우저 실행 증거가 아니다.

기존 전체계획 검사(check-plan.mjs)는 다른 담당자/architecture 문서의 과거 서버API·권한 설명 때문에 보완 전부터 실패했다. 이 파일만 수정하라는 범위를 지켜 다른 문서·검사기를 바꾸지 않는다. 개발 시 이 문서의 CSR 계약을 SDK로 제공하고 공통문서 정리는 별도 범위로 남긴다. 이 검사 실패는 런타임 검증 결과가 아니다.

### 14.4 기술 근거

2026-11-09 확인한 공식 자료다. 제품 요구사항을 찾기 위해 추가로 읽어야 하는 기획 문서는 아니다.

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys): 공개/서버키·사용자JWT 구분.
- [Personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens): CLI관리인증·DB암호 차이.
- [CLI local/hosted targets](https://supabase.com/docs/guides/local-development/local-and-hosted-projects): 로컬·원격대상. 실제flag는 고정CLI --help 확인.
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database views](https://supabase.com/docs/guides/database/views): RLS·security_invoker 경계.
- [Edge authentication](https://supabase.com/docs/guides/functions/auth), [JWT verification](https://supabase.com/docs/guides/auth/jwts): 사용자인증을 키존재로 대체하지 않는 검증.

---

**착수 문장:** `md 파일 기반으로 개발 시작해`

이 문장으로 홍주P 구현·로컬검증을 시작하고 완료한 작업은 보존하며 이어간다. 외부계정권한·실제AI자격증명·실행환경은 문서가 대신 만들 수 없다. 원격적용은 명시적 요청과 대상 확인 후 수행한다.
