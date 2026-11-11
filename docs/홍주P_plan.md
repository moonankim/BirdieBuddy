# BirdieBuddy — 홍주P 백엔드 개발 실행 계획

**담당:** Supabase 백엔드·채팅 서비스·브라우저 호출 SDK

**계약 버전:** 1.6 / 2026-11-11

**상태:** 개발 실행 명세. 구현·프로젝트 연결·배포 완료를 뜻하지 않음.

> 제품 규칙은 [prd.md](./prd.md)를 기준으로 한다. 이 문서는 홍주P 담당 백엔드의 실행 계약이며, 공통 구조는 [architecture.md](./architecture.md)를 따른다. 구현 방식은 제품 규칙을 바꾸지 않는 범위에서 구체화한다.
>
> **Supabase CSR·RLS·Auth 사용자 ID·migration·Edge Function** 결정을 유지한다. 제품 정책이 이 계약과 다르면 PRD를 우선하고, 구현 계약을 함께 고친다. PRD에서 정하지 않은 세부사항만 이 문서의 명시된 기본값으로 다룬다.

## 0. 한 문장으로 시작하는 실행 지시

사용자가 이 계획을 바탕으로 개발을 요청하면 이 파일을 실행 명세로 삼는다. 현재는 로컬 구현·검증을 보완 중이다. 이번 main 병합 후속 작업은 로컬 migration/test만 반영하며 원격 데이터·schema·배포는 변경하지 않는다.

1. 저장소 상태와 작업 지침을 확인하고 기존 수정사항을 보존한다. 아래 체크리스트와 실제 파일을 비교해 미완료 지점부터 진행한다. 체크 표시만으로 구현 완료를 가정하지 않는다.
2. B-01~B-17을 구현한다. 제품 규칙은 PRD를 적용하고, 미정인 기술 세부사항은 아래 계약을 사용한다. 다른 담당자의 화면·AI 코드·최종 이미지가 없다는 이유로 독립 가능한 백엔드 구현을 중단하지 않는다.
3. migration → 권한/RPC → 시드·계정 → SDK → Edge Function → 통합 검증 순서로 진행한다. 화면 대신 SDK 테스트로 P0/P1을 먼저 완성한다.
4. 정상·거부·재시도·동시성 검증을 실행하고 실패를 수정한다. 티켓별 환경과 증거를 기록하며 구현 시 harness/verification-log.md도 갱신한다.
5. 자격증명·컨테이너 등 외부 조건이 없으면 가능한 구현과 정적 검사를 계속한다. 필요한 사용자 조치와 재개 방법만 구체적으로 보고한다. 없는 권한·키·검증 결과를 만들어내지 않는다.
6. 코드와 로컬 검증이 끝나면 **홍주P 백엔드 로컬 완료**로 보고한다. 실제 LLM·팀 화면 통합·원격 적용은 별도 상태다. 원격 변경에는 사용자 요청과 명시적인 대상 환경이 필요하다.

**완성 범위:** 홍주P 백엔드, 브라우저 SDK, 테스트, 실행·배포 절차. 카드 확률/발급 알고리즘과 private.issue_card는 문환P A-09 소유이며, 홍주P는 complete_round에서 같은 트랜잭션으로 이를 호출하고 권한·멱등성·반환 계약을 통합한다. 현호P·자성P 화면과 현호P의 카드 이미지 생성, 문환P의 실제 AI 품질 개선, 발표 자료를 대신 완성한다는 의미는 아니다.

### 0.1 이번에 보완한 공백

| 기존 공백 | 실행 기준 |
| --- | --- |
| 스키마를 다른 문서에 위임 | §4의 핵심 12개 테이블과 비공개 보조 모델 |
| 함수명만 있고 타입·오류 없음 | §§6~8의 SDK·RPC·Edge 계약 |
| F-01·T-02·A-02/A-03 대기 | §3의 독립 진행 대안 |
| 최신 PRD의 입장 기간·인사말·전체 메시지·삭제 미반영 | §§4·6~9의 메시지 종류, 입장 기간 RLS, 인사말 snapshot, 수정 제안 재사용, soft delete |
| 구 PRD 기준 재입장·월 정산·안전 필터 | §§5·8의 월 3회 재입장, 입장/재입장 월 전체 정산 제외, 필수 혐오 필터·AI 폴백 |
| 재시도·동시성·AI 우회 경계 없음 | §§6~7의 잠금·멱등성·service-only 저장 |
| Supabase 연결·관리 방법 없음 | §2의 전달받은 값과 관리 인증 절차 |
| PRD와 어긋난 게임 규칙·빠진 프로필/보유 카드 계약 | §§3~12의 PRD 대조 결과와 B-14 |
| 완료 판단 증거 없음 | §§11~14의 검증·상태·완료표 |
| 전체 검수에서 확인한 저장·복구·묶음 조회 공백 | §§4~9의 원자적 제안 소비·입장 시각·조회 완료 checkpoint·묶음 인박스·상태 재조회와 §12의 경합/중간 실패 검증 |
| 다른 담당자의 연동 후속 작업 불명확 | §15의 담당별 에이전트 검토 입력·수정 범위·완료 조건. 시연 계획은 이번 검수 범위에서 제외 |

### 0.2 최종 검토 판정과 실행 전제

**최신 PRD의 제품 규칙을 백엔드 계약에 반영한 B-01~B-17 실행 기준이다.** 구현 중의 라이브러리 설치·타입 생성·공식 도구 사용법 확인은 일반 개발 작업이며, PRD에 없는 기술 세부사항을 정하기 위해 별도 제품 결정을 다시 받을 이유가 없다.

- 로컬 필수 환경은 Node.js 24, 기존 package manager(신규 저장소는 npm), Deno 2, 실행 중인 Docker 호환 런타임이다. 존재 여부·버전을 먼저 확인하고 의존성은 lockfile에 고정한다. 없는 환경은 구체적으로 보고하고 가능한 코드·정적 검증을 계속한다.
- 로컬 Supabase는 자체 Auth/DB 관리 연결 값을 사용한다. **사용자가 제공한 원격 키나 CLI 로그인은 로컬 구현·통합 검증의 선행 조건이 아니다.** 로컬 값을 얻는 순서는 §10.3에 고정한다.
- AI 공급자 키 관리 결정: `TYPESAFE_API_KEY`와 `ANTHROPIC_API_KEY`를 §2.1의 Supabase 프로젝트 Edge Function Secrets에 저장하고 Edge Function에서만 사용한다. 실제 Jev/Claude 검증과 시연에는 각각의 키와 문환P 모듈이 필요하며, 이 상태를 로컬 백엔드 완료와 구분한다.
- 로컬 코드·DB 개발은 provider key 없이 진행한다. 문환P가 소유한 `AiAdapter` 구현 전에는 `BB_USE_LOCAL_AI_FIXTURE=true`와 local Supabase API/DB host가 모두 확인될 때만 로컬 샘플 adapter를 사용한다. 지정 marker에 따라 suggest/block/cluster 응답과 고정 요약문을 만들며 일반 문장은 quality 50으로 통과한다. 이는 안전 필터가 아니고 `passesAllFilters=false`라 질문 인용 권한을 부여하지 않는다. hosted·운영·host 불일치 환경은 `FILTER_UNAVAILABLE`로 fail-closed 한다. 실제 owner adapter가 도착하면 교체한다. 원격 Secret 설정은 대상 환경 및 Owner/Administrator 권한 확인 뒤 별도 기록한다.
- 원격 CLI 로그인/link·schema 변경·Function 배포는 별도 요청과 대상 확인 전까지 실행하지 않는다. 독립 가능한 로컬 backend 구현과 검증은 진행한다.

## 1. 아키텍처와 담당 경계

Next.js는 CSR 화면과 정적 UI shell을 제공한다. 브라우저가 Supabase JS로 Auth, Data API, Postgres RPC, Edge Functions, Realtime, Storage를 직접 호출한다. 런타임 백엔드는 Supabase에 둔다.

| 기능 | 실행 위치 | 신뢰 기준 |
| --- | --- | --- |
| 로그인·세션 | Supabase Auth | 실제 계정 세션, 가입 시 기본 user |
| 컬렉션·방 목록·대화 | Data API + security_invoker view | JWT + 기초 테이블 RLS |
| 추첨·강화·입장·월 마감·삭제·인증 | Postgres RPC | 트랜잭션, 역할·소유권 재검사 |
| 팬 질문·인플루언서 답변/전체 메시지·인사말 설정·필터·질문 묶기·요약 | JWT 인증 Edge Functions | 비밀값·LLM 호출과 최종 메시지 저장은 Edge 내부 |
| 채팅 이벤트 | Realtime Postgres Changes | messages SELECT RLS를 통과한 INSERT·삭제 UPDATE |
| 카드 이미지 | 공개 Storage card-assets | 공개 읽기, 관리자만 쓰기 |
| 배포 | Supabase CLI / 프론트는 Vercel | 환경 구분·변경 이력 |

Server Actions, API Routes, Route Handlers, 별도 백엔드를 추가하지 않는다. 브라우저의 역할·보유량·판정·점수는 신뢰하지 않는다.

### 1.1 홍주P 소유 산출물

아래 트리는 로컬 backend의 실제 구현 위치를 나타낸다. 이번 개발 착수에서 `supabase/`와 루트 `.env.example`을 생성했으며, `.env.local`·`.env.backend.local`은 loopback 전용 gitignored 설정으로 관리한다.

```text
lib/supabase/client.ts              브라우저 클라이언트
lib/supabase/database.types.ts      CLI 생성 DB 타입
lib/api/index.ts                    클라이언트 주입형 API factory·브라우저 export
lib/api/types.ts                    도메인 타입·Result·ApiError·Page
lib/api/cursor.ts                   opaque inbox cursor encode/decode
supabase/config.toml                로컬 구성
supabase/migrations/README.md        migration safety and local workflow
supabase/migrations/*.sql            schema·RLS·grants·RPC·trigger·Storage·publication
supabase/seed.sql                   비기밀 고정 콘텐츠
supabase/functions/_shared/http.ts  인증·CORS·입력 검증·service client·오류 변환
supabase/functions/_shared/ai_adapter.ts  Jev/Claude provider adapter + explicit local-only fixture selector
supabase/fixtures/local_issue_card.sql  A-09 migration 적용 전 로컬 전용 결정적 카드 발급 sample
supabase/functions/submit-message/index.ts
supabase/functions/send-influencer-message/index.ts
supabase/functions/update-room-greeting/index.ts
supabase/functions/summarize-room/index.ts
supabase/functions/cluster-questions/index.ts
scripts/prepare-local-env.mjs       로컬 stack 시작·연결 값 수집·env 생성, 비밀값 비출력
scripts/setup-demo-accounts.mjs     로컬 Auth 계정·시나리오
scripts/verify-backend.mjs          계약·역할별 통합 검증
supabase/tests/*.sql                DB·권한·RPC 테스트
tests/backend/                     cursor tests; Deno Edge adapter contract tests
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
| 용도 | 사용자가 제공한 해커톤 연결 대상. Dashboard에서 `main` 브랜치가 `PRODUCTION`으로 표시됨. 이를 해커톤 시연용으로 써도 되는지와 실제 데이터 상태는 별도 확인 필요 |

개발 착수 후 이 원격 프로젝트를 사용할 때 루트 `.env.local`에 작성할 값:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://kjfaqfpvfvgbrvdoosyi.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_QuSwvsbS0CYx6aah9Y69XA_62e7ndwO
```

현재 연결 값은 **docs/홍주P_plan.md에만 보관**한다. 이 계획의 원격 값은 실제 `.env.local`·CLI 연결·schema 생성에 사용하지 않았다. 루트 `.env.example`은 loopback 전용 placeholder를 제공하며, 실제 local env는 Supabase stack에서 얻어 gitignored 파일로 관리한다.

### 2.2 공개 연결과 관리 권한

- publishable key는 앱 식별용이며 RLS가 허용한 사용자 작업만 한다. 테이블 생성·migration·SQL 함수 정의·역할 승격 권한이 아니다.
- 원격 변경에는 아래 세 권한 층을 각각 갖춰야 한다. 한 층의 로그인 성공은 나머지 권한을 뜻하지 않는다.

| 권한 층 | 필요한 권한 | 확인 기준 |
| --- | --- | --- |
| Supabase 관리 API | 대상 프로젝트에 접근 가능한 Supabase 계정과 필요한 CLI/PAT 작업 범위 | 계정 멤버십·프로젝트 ref·수행할 관리 작업 확인 |
| Postgres DB | 대상 DB에 접속할 수 있는 DB 자격증명 또는 허용된 임시 로그인 방식 | 네트워크 접근·DB 버전·migration history 읽기 확인. PAT만으로 DB SQL 권한을 얻지 않음 |
| 앱 런타임 | publishable key와 로그인 사용자의 JWT, RLS/RPC 정책 | 실제 사용자 JWT로 허용·거부 동작 확인. 서버 secret은 브라우저에 사용하지 않음 |

- migration·SQL/RLS·DB RPC는 관리 API 인증만으로 충분하다고 가정하지 않는다. 대상 DB 권한도 별도로 확인한다. Edge Function 배포는 대상 프로젝트의 함수 배포 권한이, hosted Secrets 추가·변경·삭제는 현재 Supabase 문서상 Owner 또는 Administrator 권한이 필요하다.
- Edge의 service-only RPC·Auth Admin에는 서버용 Supabase secret key가 필요하다. 이 키도 임의 DDL을 수행하는 DB 암호의 대체품은 아니다.
- Codex의 Full Access는 로컬 파일·네트워크 실행 범위일 뿐 Supabase 계정 로그인, 프로젝트 멤버십, PAT, DB 권한을 부여하지 않는다. Supabase MCP 연결의 로그인 상태도 CLI 로그인과 별개다.
- Supabase PAT는 그 토큰 소유 계정 권한을 넘지 못한다. 개인 전체 권한 Legacy PAT보다 대상 프로젝트와 필요한 작업만 허용하는 scoped PAT를 우선한다. projects list의 계정 전체 조회 권한은 known project ref에 접근할 때 필수로 가정하지 않는다.
- CLI 로그인/PAT, DB 암호, Supabase secret key, LLM 키는 서로 다른 자격증명이다. 문서·브라우저 번들·Git·일반 로그에 넣지 않는다. 관리형 비밀 저장소 또는 보호된 실행 환경을 사용하고, 실제 토큰 값을 채팅에 붙이지 않는다.
- “자유롭게 제어”는 관리 인증을 갖추고 migration으로 변경을 재현한다는 뜻이다. RLS·EXECUTE 제한을 풀지 않는다.

### 2.3 개발 초기화 및 로컬 설정 절차

**F-01 전 root bootstrap:** B-01 첫 deliverable에서 `package.json`·`package-lock.json`, backend toolchain·scripts와 `lib/`·`supabase/` 뼈대를 만들어 `main`에 올린다. 목표 시점은 1일차 오전 첫 1시간이다. 이 단계에는 backend 의존성·공통 검사 설정, `lib/supabase/`·`lib/api/` 경로, `supabase/config.toml` 및 빈 migrations/functions/tests 구조만 포함한다. schema·migration·Auth·RLS·기능 SDK·계정·비밀 env 값은 포함하지 않는다. F-01은 이 manifest와 lockfile에 Next.js·Tailwind 의존성 및 화면 scripts를 추가하고 `app/`·레이아웃·라우트를 만든다. 이어지는 B-01 schema/Auth/RLS 작업은 F-01과 병행할 수 있고 F-01의 선행조건이 아니다. 루트 package 파일은 이 순서로 차례로 갱신한다.

2026-11-09 확인한 `supabase@3.0.0`을 devDependency와 lockfile에 고정한다. 런타임 의존성은 @supabase/supabase-js와 로컬 관리용 pg, 개발 의존성은 supabase·typescript·@types/node·@types/pg·tsx를 기본으로 한다. Node SDK용 tsconfig.backend.json과 Edge용 deno.json/deno.lock을 분리한다. SDK의 생성 타입이 준비되기 전에 setup script가 이를 import하지 않도록 한다.

**빈 준비 상태에서의 B-01 초기화:** `supabase/`가 없으면 아래 명령으로 생성한다. 기존 config가 있으면 init을 재실행하거나 덮어쓰지 않고 이 계획과 비교한다.

```bash
# 개발 시작 요청을 받은 뒤에만 실행
npx --yes supabase@3.0.0 init
mkdir -p supabase/migrations supabase/functions/_shared supabase/tests lib/supabase
```

이번 착수에서 `supabase/seed.sql`, 루트 `.env.example`, `supabase/functions/.env.example`을 생성했다. seed는 §10.1의 비기밀 데이터만 담는다. 루트 예제에는 loopback URL과 `sb_publishable_replace_me`만 사용하고 실제 key는 넣지 않는다. **개발의 실제 `.env.local`과 backend env는 §10.3에서 얻은 로컬 값으로 생성한다.** §2.1의 원격 값은 원격 연결 단계에서만 사용하며 로컬 작업에 섞지 않는다. Functions 예제에는 `ANTHROPIC_API_KEY`, `TYPESAFE_API_KEY`, `ALLOWED_ORIGINS` 이름과 비밀 아닌 자리표시자만 적는다. 두 provider key는 §2.7 계약대로 hosted Edge Function Secrets를 사용하며, local live-AI test가 필요할 때만 보호된 gitignored 파일에 별도로 둔다. local:env는 `BB_USE_LOCAL_AI_FIXTURE=true`를 설정하지만 adapter는 Supabase URL/DB URL이 local host일 때만 sample을 고른다. 가짜 판정·요약·묶음과 deterministic 카드 지급은 local-only이며 migration/production seed가 아니다. `.demo-passwords.json` 등 `.env*` 제외·`.env.example` 예외·`supabase/.temp/` 규칙을 유지한다. 실제 env 파일은 stack 시작 후 local:env가 생성한다.

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

로컬 설정은 원격 프로젝트에 자동 반영되지 않는다. 원격 로그인은 §2.5, 단계별 반영은 §13을 따른다. 개발 시작 요청만으로 원격 변경을 시작하지 않는다.

### 2.4 환경과 외부 조건

| 환경 | 연결·규칙 |
| --- | --- |
| 로컬 통합 테스트 | supabase start의 로컬 URL·publishable key. 원격 값을 기본 테스트 대상으로 쓰지 않음 |
| 해커톤 원격 | 위 ref, 환경·권한 확인 후 사용 |
| 프리뷰·운영 | 별도 프로젝트 또는 명시적으로 승인된 동일 프로젝트. 프론트 변수·Auth redirect 각각 설정 |

로컬 실행에는 §0.2의 Node/Deno/Docker 환경, 원격 관리 연결에는 CLI 로그인·프로젝트 권한, 실제 AI에는 문환P 모듈·공급자 키가 필요하다. 문서만으로 생성할 수 없는 외부 조건이다. 없으면 구현과 정적 검사를 계속하고 실행 불가 항목만 미검증으로 남긴다.

### 2.5 Supabase 로그인·프로젝트 권한 준비

아래는 향후 사용자가 원격 적용을 명시적으로 요청하고 대상 환경을 확정한 뒤 사용할 절차다. 현재 적힌 project ref는 사용자가 전달한 연결 대상일 뿐, 실제 로그인·프로젝트 멤버십·해커톤/운영 환경 구분·기존 데이터 상태는 확인하지 않았다.

1. 소유자가 Supabase Dashboard에서 대상 ref가 `kjfaqfpvfvgbrvdoosyi`인지, 프로젝트가 의도한 해커톤 환경인지, 기존 데이터와 현재 migration 이력을 확인한다.
2. 작업자는 해당 프로젝트에 초대된 Supabase 계정으로 로그인한다. 접근 권한이 없으면 프로젝트 소유자/관리자가 필요한 프로젝트 멤버 권한만 부여한다. 앱의 `profiles.role='admin'`은 Supabase Dashboard/CLI 권한을 부여하지 않는다.
3. Supabase 계정 [Access Tokens](https://supabase.com/dashboard/account/tokens)에서 scoped PAT 선택지가 제공되는 계정은 필요한 프로젝트·작업만 허용한 토큰을 발급해 보호된 실행환경에서 `SUPABASE_ACCESS_TOKEN`으로 주입한다. 발급 시 유효기간·대상 프로젝트·CLI에서 실제 사용할 작업 범위를 제한한다. 현재 scoped PAT는 순차 배포 중일 수 있다. 옵션이 없으면 계정/프로젝트 소유자에게 필요한 작업을 요청하거나, 불가피하게 전체 권한 Legacy PAT를 쓸 때에만 짧은 기간의 승인된 격리 환경에서 사용한 뒤 회수한다. Supabase PAT는 계정 역할을 높이지 않는다. CLI 대화형 `login`은 사용자 브라우저 로그인용 대안이며 계정 전체 Legacy PAT를 만들 수 있으므로 자동화와 최소권한이 필요한 경우 scoped PAT를 우선한다. 이미 scoped PAT 환경변수를 쓸 때 불필요한 전체권한 로그인을 추가하지 않는다. Codex Full Access 또는 Supabase MCP 연결을 CLI 인증으로 간주하지 않는다.
4. 저장소 루트에서 대상 ref를 명시해 연결한다. 토큰을 명령 인수·채팅·저장소에 넣지 않는다. 프로젝트 목록 전체 조회 권한을 받을 수 없다면 알려진 ref로 직접 연결을 확인한다.

```bash
# 미래 실행 예시. 현재 문서 작업에서는 실행하지 않음.
# SUPABASE_ACCESS_TOKEN은 승인된 비밀 저장소/실행환경에서 주입한다.
npx --yes supabase@3.0.0 link --project-ref kjfaqfpvfvgbrvdoosyi
```

| 작업 | 준비할 권한·자격증명 | 준비하지 못했을 때 |
| --- | --- | --- |
| 프로젝트 연결·관리 API 조회 | 대상 project ref에 접근 가능한 Supabase 계정과 해당 CLI 작업에 필요한 PAT 범위. link에는 Project Settings/API keys 읽기 권한이 요구될 수 있음 | 소유자에게 해당 프로젝트의 최소 읽기/작업 권한 부여를 요청. PAT를 더 넓게 발급하지 않고 현재 CLI 도움말과 권한 오류를 확인 |
| migration·DB/RPC 적용 | PAT를 쓰는 관리 API 요청은 `Migrations`의 필요한 읽기/쓰기 범위와 대상 DB 접속 권한. CLI 명령별로 실제 필요한 scope는 고정 버전 도움말 확인. 환경에 따라 `SUPABASE_DB_PASSWORD` 또는 지원되는 임시 DB 로그인 방식 | DB 비밀번호는 PAT나 secret key와 다르다. 필요한 경우에만 보호된 셸/비밀 저장소에서 공급하고 대상 ref·DB 계정을 다시 확인 |
| Edge Function 배포 | 대상 프로젝트의 `Edge Functions` 쓰기 범위와 해당 프로젝트 멤버 권한 | 필요한 함수 범위 권한을 프로젝트 소유자에게 요청. 전체 Owner 권한을 기본 요구하지 않음 |
| hosted Edge Secrets 변경 | 토큰 작업 범위에 `Edge Function Secrets` 쓰기가 있더라도 현재 프로젝트 권한 문서상 Owner 또는 Administrator 역할 필요 | 권한 있는 프로젝트 소유자가 직접 반영하거나 권한을 조정. Developer의 조회 가능성을 수정 권한으로 오인하지 않음 |
| Auth URL·Storage 설정 변경 | 해당 프로젝트의 관련 설정 변경 권한. CLI의 `config push`는 로컬 설정 전체에 영향을 줄 수 있음 | 정확한 변경 항목만 대시보드에서 비교·수정하거나 승인된 설정 변경 경로 사용 |

DB 암호는 Management API/PAT 범위가 제한되어도 별도의 DB 권한을 가진다. 프로젝트 linking/read permission, 실제 SQL 권한, Function 배포 권한, Secrets 변경 권한이 서로 같다고 추정하지 않는다. 최신 CLI `--help`와 Supabase 권한 문서를 확인하고 필요한 작업이 거부되면 그 작업에서 중단한다.

### 2.6 연결 준비 완료 판정과 미확인 항목

원격 계정, DB, Function, Secrets, Auth 설정 권한은 서로 분리해 기록한다. dry-run은 변경 목록을 검토하는 증거일 뿐 실제 쓰기 권한이나 배포 성공 증거가 아니다.

마지막 원격 확인 기록(2026-11-11, 이번 PR #14/#15 main 병합 전):

- MCP로 사용자가 지정한 `kjfaqfpvfvgbrvdoosyi` `main / PRODUCTION` 프로젝트의 기존 상태를 읽고, migration 및 Function 쓰기 권한을 사용해 적용했다. 이는 별도 CLI PAT 로그인이 확인됐다는 뜻은 아니다.
- 적용 전 PostgreSQL 17.11·ACTIVE_HEALTHY, migration·앱 테이블·Auth 사용자·Storage object·Edge Function이 비어 있음을 읽기 전용으로 확인했다. 기존 사용자 데이터가 없어 데이터 백업/복구 대상은 없었으며, 원격 `reset`은 실행하지 않았다.
- 당시 9 migrations와 5개 JWT 검증 Edge Function의 적용 후 상태를 MCP로 읽어 확인했다. Secret 값·Owner/Administrator Secret 수정 권한은 조회하거나 사용하지 않았다. PR #14/#15 병합 후에는 원격 상태를 재조회하지 않았다.
- 미확인: CLI용 `SUPABASE_ACCESS_TOKEN`, CLI linked-remote migration list/dry-run, Secret 쓰기 권한·실제 provider 호출, 공개 앱 origin에 따른 Auth redirect/CORS, 실제 사용자 JWT·Realtime·Storage smoke.

MCP 또는 CLI 접근 성공 하나로 다른 작업 권한을 추정하지 않는다. 현재 범위와 후속 순서는 §§13~14에 구분해 기록한다.

### 2.7 AI 공급자 키 저장과 호출 계약

홍주P·문환P 합의에 따라 `TYPESAFE_API_KEY`와 `ANTHROPIC_API_KEY`는 §2.1의 Supabase 프로젝트에서 Edge Function hosted Secrets로 관리한다. 저장 대상은 Supabase Dashboard의 Edge Functions > Secrets이며, 저장 후 Edge Function이 `Deno.env.get("TYPESAFE_API_KEY")`와 `Deno.env.get("ANTHROPIC_API_KEY")`로 읽는다. 실제 Secret 값은 이 문서·Git·브라우저 코드·SQL/seed·일반 로그에 기록하지 않는다. Edge Function Secrets 관리의 공식 절차는 [Supabase Environment Variables](https://supabase.com/docs/guides/functions/secrets)를 따른다.

| 변수 | 담당 공급자·호출 | 노출 경계 |
| --- | --- | --- |
| `TYPESAFE_API_KEY` | TypeSafe Jev의 메시지 안전 필터 판정 | Jev를 호출하는 Edge Function만 읽음 |
| `ANTHROPIC_API_KEY` | Claude의 suggest 수정 문장 및 대화 요약·묶기 | Claude를 호출하는 Edge Function만 읽음 |

원격 host 설정은 프로젝트 환경(해커톤/운영)과 대상 ref를 확인하고, Owner/Administrator Secret 변경 권한을 확인한 뒤 진행한다. 채팅·저장소·로그에 입력된 provider key는 재사용하지 않고 공급자 대시보드에서 회전/재발급한 값을 저장한다. 기존 키를 회수할 때는 새 키가 Edge runtime에서 동작하는 것을 확인한 뒤 순서를 정한다.

로컬 코드·DB·SDK 작업에는 provider key가 필요하지 않다. local-only fixture로 Edge 입출력·저장·제안 token·차단 집계·요약·묶음 연동을 개발할 수 있지만 실제 안전 필터나 모델 호출을 입증하지 않는다. owner adapter가 병합되면 Jev 키 누락/장애의 §8 fallback을 검증한다. live Jev 검증에는 `TYPESAFE_API_KEY`, Claude suggest/summary 검증에는 `ANTHROPIC_API_KEY`가 필요하다. 시연의 전체 AI 경로 검증에는 실제 담당 모듈과 두 hosted Secrets가 모두 준비되어야 한다. 일부 키 누락이나 fixture/fallback 결과를 live AI 성공으로 보고하지 않는다. Secret 저장 후 Supabase Edge Function 재배포는 필요하지 않지만, 실제 공급자 호출로 런타임 동작을 검증한다.

## 3. 팀 의존성 없이 진행하는 기본안

| 의존 | 독립 진행 방법 | 교체 지점 |
| --- | --- | --- |
| F-01 프론트 셋업 | 최소 SDK·TypeScript·검증환경 구성 | Next.js가 같은 lib/api 사용 |
| T-02 인플루언서 | 카드 라인업 가상 인물10명(투어5·유튜버3·미디어 프로2), 안정적 UUID. 별도로 카드·방 없는 11번째 심사 대기 계정 | seed 표시명·type·매핑·승인 후 방 생성 |
| A-06 이미지 | 자체 생성 비민감 placeholder 30개 | 같은 Storage object path |
| A-02/A-03 필터·점수 | §8 타입의 local fixture adapter | _shared/ai.ts의 adapter |
| A-04/A-05 묶기·요약 | fixture로 권한·저장·응답 계약 검증 | 실제 AI adapter |
| A-09 카드 추첨·발급 | complete_round에서 문환P private.issue_card 계약을 호출 | 동일 transaction과 API 응답으로 통합 |
| 실제 화면 | SDK 통합 테스트로 P0/P1 완성 | 팀 화면 SDK 호출 |

**PRD 시연 구성:** 스타일 `illust/retro/holo`, 등급 `common→rare→epic→special`, 유형 `youtuber/media_pro/tour`, 등급 확률 `70/20/7.5/2.5`. 10명의 fictional lineup만 30개 카드 템플릿에 포함한다. 실제 골프존 회원·결제·라운드 연동은 없다. 인증 사용자의 “라운드 완료” 버튼을 데모 라운드로 처리한다. 새 requestId를 가진 별도 동작은 새 라운드다.

fixture는 로컬·테스트 전용이며 실제 AI 성공으로 보고하지 않는다. 원격 fixture 활성화나 AI 장애의 무조건 pass 전환은 금지한다. 공급자·모델·키는 문환P 모듈 설정을 수용한다. 홍주P는 인터페이스와 장애 처리를 완성하며 모델 선정·품질 개선을 대신 맡지 않는다.

## 4. 데이터 모델·제약·권한

### 4.1 타입·기본 원칙

- 별도 표기 외 ID는 UUID. 시각은 timestamptz/UTC 저장, 월 경계는 Asia/Seoul.
- nullable 표기 외 필수 컬럼은 NOT NULL이다. UUID PK는 gen_random_uuid(), 일반 created_at/updated_at은 now()를 기본값으로 한다. 단, messages INSERT는 §7.4의 방 쓰기 잠금 후 한 번 얻은 clock_timestamp()를 created_at/updated_at에 함께 지정하고 identity ID도 그 뒤에 할당한다. UPDATE는 created_at을 보존하고 같은 잠금 후 updated_at을 지정한다. 입장 구간의 joined_at/left_at도 §7.4의 직렬화 시각을 사용하며 트랜잭션 시작 시각으로 대신하지 않는다. enum 이름은 user_role, influencer_type, card_style, card_grade이며 값은 §§3~4의 순서·목록을 따른다. 나머지 status/clock_kind/verdict는 명시적 CHECK로 제한한다.
- role=`user/influencer/admin`, member status=`active/left`, verification status=`pending/approved/rejected`, support badge=`none/buddy/eagle/albatross`.
- profiles.id는 auth.users.id FK. 가입 trigger는 metadata의 role/demo를 무시하고 role=user, nickname 1~30자(미입력 `버디`)로 만든다.
- 모든 public 테이블에 RLS. anon/authenticated 기본 쓰기 권한을 회수하고 필요한 SELECT/RPC만 명시적으로 허용한다.
- 서버 생성 시각을 클라이언트 입력으로 받지 않는다. 남의 리소스 존재를 상세 오류로 노출하지 않는다.
- auth.users 삭제는 profiles에 cascade하되 메시지·신청·운영 이력 등 참조가 있으면 RESTRICT로 거부한다. 탈퇴·익명화 기능은 이번 범위가 아니다. 데모 전체 초기화는 로컬 reset으로만 한다.

### 4.2 public 핵심 12개 테이블

아래는 논리 명세다. 실제 SQL은 migration에 구현한다. PK·FK·UQ·CHECK는 DB 제약이며 UI 검증으로 대체하지 않는다.

| 테이블 | 필수 컬럼·제약 | SELECT / 변경 경로 |
| --- | --- | --- |
| profiles | id PK→auth.users, nickname text, role default user, created_at, updated_at | 본인만 / bootstrap·관리 프로비저닝 |
| influencers | id PK, name 1~50자, type, verified_at nullable, profile_image_path nullable, created_at | 인증 사용자 / seed·승인RPC·본인 사진 변경 RPC. 계정 매핑은 private |
| card_templates | id PK, influencer_id FK, style, image_path text, UQ(influencer_id,style) | 인증 사용자 / seed·관리 작업 |
| user_cards | user_id FK, template_id FK, grade, count int CHECK≥0, updated_at, PK(user_id,template_id,grade) | 본인 / 추첨·강화RPC |
| rounds | id PK, user_id FK, played_at, period_month date, clock_kind(real/demo) | 본인 / complete_round |
| draws | id PK, user_id FK, round_id FK UQ, template_id FK, grade, is_new bool, forced bool default false, created_at | 본인 / complete_round. round 소유자와 일치 강제 |
| chat_rooms | id PK, influencer_id FK UQ, created_at | 인증 사용자 / seed. 비공개 필터 포함 안 함 |
| room_members | room_id FK, user_id FK, gauge numeric(5,1) 0~100, status, joined_at/latest joined_month, left_at nullable, left_month nullable, updated_at, PK(room_id,user_id) | 본인·방 소유자 / 입장·월마감RPC |
| messages | id bigint identity PK, id_text text UQ, room_id FK, sender_id FK, sender_type(user/influencer), message_kind(user_question/influencer_answer/influencer_broadcast/greeting), recipient_user_id nullable, sender_name, reply_to bigint nullable, reply_to_text text nullable, reply_context text nullable, body nullable(삭제 후 null; 일반 1~2000자), deleted_at nullable, passes_all_filters bool nullable, support_badge nullable, own_score/quality_score/priority numeric(5,2) nullable, cluster_id nullable, created_at, updated_at | 입장 기간·수신자·질문 관계를 적용한 fan RLS / 방 소유자는 전체. 검증 저장·답변·인사말·전체 메시지·삭제 RPC |
| message_clusters | id PK, room_id FK, representative 1~200자, version int≥1 default1, created_at, updated_at | 방 소유자만 / 묶기 저장RPC. 구성/대표문장 변경·답변/삭제 시 version 증가. 활성 참여자 수는 조회 시 계산 |
| verifications | id PK, influencer_id FK, type, evidence_url, status, rejection_reason nullable, reviewed_by FK nullable, reviewed_at nullable, created_at | 본인 influencer·admin / 신청·검토RPC |
| game_config | key text PK, value jsonb, updated_at, version int≥1 | 인증 사용자 / update_game_config |

messages에는 pass 사용자 질문과 influencer 답변·전체 메시지·첫 입장 인사말을 저장한다. block/suggest 원문·수정안은 messages에 넣지 않는다. 질문에는 `passes_all_filters`를 저장해 선택 필터 설정과 무관하게 모든 항목을 통과했는지 보존한다. 답변은 관계 ID와 함께 원 질문의 `passes_all_filters=true`일 때만 팬에게 공개할 닉네임 없는 `reply_context`를 snapshot한다. 묶음 답변은 모든 필터를 통과한 대표 문장을 snapshot한다. 팬은 본인 질문과 본인의 입장 기간에 도착한 influencer 메시지만 읽고, 다른 팬의 질문 행은 읽지 않는다. 퇴장 기간에 내 질문에 달린 답변은 재입장 후 예외적으로 읽을 수 있다. 전체 메시지는 생성 시각에 활성 입장 기간이 겹치는 팬에게만 공개하고, 인사말은 최초 입장 사용자에게만 수신자와 문구를 snapshot한다. 삭제된 답변·전체 메시지는 행을 유지하되 `body=null`, `deleted_at`을 기록해 본문 대신 삭제 표시를 제공한다. 방 소유 influencer만 방 전체와 인박스를 읽는다.

draws는 라운드 보상으로 누적 획득한 카드의 원장이다. 입장 자격과 보유 배지는 강화로 감소하는 user_cards가 아니라 이 원장에서 influencer별 누적 발급 수를 집계한다. 강제 등급 발급도 누적 수와 입장 자격에는 포함하며 `forced=true`로 표시해 확률 검증 표본에서는 제외한다. `draws.forced`는 문환P AI 계획의 공통 계약이다.

bigint 정밀도를 전송 전에 보존한다. id_text/reply_to_text는 일반 text 컬럼이며 BEFORE INSERT/UPDATE trigger가 id::text/reply_to::text로만 채운다. CHECK로 원본과 일치를 강제한다. 논리 복제의 generated column 전달에 의존하지 않는다. Data API는 문자열 컬럼을 선택하고 Realtime도 이 값만 SDK의 id/replyTo로 매핑한다. raw 숫자 id/reply_to는 사용하지 않는다. SQL JSONB도 명시적으로 ::text 변환한다. JSON.parse 이후 문자열 변환으로 정밀도를 복구할 수 있다고 가정하지 않는다.

추가 제약:

- reply_to/cluster_id는 같은 room_id만 참조한다. 복합 FK 또는 동등 DB trigger로 강제한다. 답변은 user 질문만 대상으로 삼는다. `message_kind`와 sender_type 조합, recipient_user_id 허용 조합, 삭제 가능 종류를 CHECK/RPC에서 제한한다. greeting은 `(room_id,recipient_user_id,message_kind)` 유일성을 보장해 재입장 중복 발송을 막는다. body가 null인 행은 soft-deleted answer/broadcast만 허용하며 해당 행의 deleted_at은 필수다.
- 활성 답변은 질문당 1개다. reply_to 부분 UNIQUE WHERE deleted_at IS NULL은 단일 anchor 중복을 막고, 묶음/개별 답변 간 전체 중복은 private.answer_question_links와 연결된 미삭제 답변을 같은 방 잠금 아래 검사해 막는다. 활성 묶음 답변도 cluster당 1개만 허용한다. 답변 삭제는 링크를 보존한 채 질문/묶음을 미답변으로 돌린다. cross-table 조건을 단순 부분 UNIQUE만으로 보장한다고 가정하지 않는다. reply_context는 모든 필터를 통과한 질문 또는 대표 문장만 닉네임 없이 snapshot한다. 팬 메시지는 수정·삭제할 수 없다.
- influencer별 pending 신청 1개 부분 UNIQUE. 심사 완료는 reviewed_by/reviewed_at 필수, pending은 null. 반려 사유 1~500자 필수.
- active는 gauge>0, left는 gauge=0 및 left_at/left_month 필수. 소수점 12.5 단위의 월 증감을 위해 gauge는 1자리 소수 numeric으로 둔다.
- 점수는 0~100 유한 숫자. 월 date는 첫날, grade/style/status는 enum 또는 CHECK.
- 카탈로그·카드·메시지·심사 참조의 삭제는 RESTRICT가 기본. 서비스 실행 중 seed 콘텐츠를 삭제하지 않는다.
- 인덱스: rounds(user_id,clock_kind,period_month), messages(room_id,id), messages(room_id,priority DESC,id DESC) WHERE sender_type='user', messages(room_id,updated_at,id), room_members(room_id,status), room_member_periods(room_id,user_id,joined_at,left_at), verifications(status,created_at,id). PK/UQ 인덱스를 중복 생성하지 않는다.

### 4.3 private 보조 모델 — Data API 비노출

12개 테이블 수를 맞추려고 비밀 데이터·멱등성을 생략하지 않는다. private schema는 API 노출 목록에서 제외하고 anon/authenticated의 직접 접근을 금지한다.

| 모델 | 최소 내용·제약 |
| --- | --- |
| influencer_accounts | influencer_id PK/FK, user_id UQ/FK. 소유권 계정 매핑 |
| demo_accounts | user_id PK/FK, can_force_grade bool, can_advance_month bool |
| demo_clock | 단일 id=hackathon, current_month date, version. 로컬 seed는 KST 현재 월 첫날 |
| demo_month_runs | closed_month PK, target_month UQ, actor_id, request_id, 결과JSON, created_at |
| room_settings | room_id PK/FK, disabled_filters text[], greeting_text text nullable, version int default1, last_write_at timestamptz default '-infinity'. null/빈 문자열은 PRD 기본 인사말 사용. last_write_at은 방별 단조 시각용 비공개 값이며 필터 version과 독립 |
| room_member_periods | id PK, room_id FK, user_id FK, joined_at, left_at nullable, CHECK left_at>joined_at. 입장 때 열고 게이지 퇴장 때 닫는 반개구간 [joined_at,left_at); 사용자/방당 열린 구간은 최대 1개; Data API 비노출 |
| moderation_suggestions | id PK, actor_id, room_id, request_id, token_hash UQ, body_hash, rewrite_quality, expires_at, used_at nullable. token 원문·제안 문구 원문은 보관하지 않으며 소비는 최종 메시지 저장 트랜잭션 안에서만 수행 |
| operations | PK(actor_id,operation,request_id), payload_hash, state(processing/succeeded/failed), result jsonb nullable, lease_token UUID nullable, lease_until nullable, created_at, updated_at |
| moderation_events | id PK, actor_id, room_id, request_id, verdict, category nullable, created_at. 원문·수정안 미보관, 7일 보관 |
| verification_reviews | id PK, verification_id UQ/FK, reviewer_id, decision, reason nullable, reviewed_at. 변경 불가 |
| answer_question_links | answer_id FK→messages, question_id FK→messages, room_id FK, PK(answer_id,question_id). 같은 방의 answer→user_question 관계를 검증한 불변 snapshot. 단일 답변 1개/묶음 답변의 전체 원 질문(퇴장 팬 포함)을 연결하고 soft delete·재묶기 후에도 보존. 직접 SELECT/변경 금지 |
| rate_windows | PK(actor_id,operation,scope_id,window_start), count, blocked_until nullable. DB 속도 제한·연속 도배 30초 차단 |
| demo_fixture_runs | fixture_version text PK, completed_at. 로컬 demo setup의 최초 주입 완료 표시 |

private 모델도 최소 GRANT만 부여한다. 브라우저에 필요한 작업은 권한 검증 public RPC로 노출한다. block/suggest 작업 기록에도 원문·rewrite를 넣지 않는다(§7.3). RLS helper는 `room_member_periods`를 통해 생성 시각이 포함되는 입장 구간인지 확인한다. `moderation_suggestions`에는 일회성 토큰과 정규화 본문의 hash 및 검증된 rewrite_quality만 저장한다. 제안 원문·token 원문을 DB·operations.result·로그에 복사하지 않으며 최초 응답에서만 token을 전달한다.

Edge의 processing 행은 lease_token/lease_until 필수다. 일반 RPC의 성공 행은 둘 다 null이며, Edge 완료/실패 후에는 두 값을 지운다. 일반 RPC는 한 트랜잭션 안에서 성공 행을 만들므로 외부에 processing 상태를 남기지 않는다.

### 4.4 RLS·열·함수 권한

- anon은 DB 카탈로그·사용자 데이터·RPC에 접근하지 못한다. 공개 Storage 읽기만 허용.
- admin은 인증 심사·데모 관리만 추가 허용. 다른 사람의 카드·대화·인박스나 influencer 명의 답변 권한은 없다.
- user는 활성 방에서 본인 질문, 본인의 입장 구간과 created_at이 겹치는 전체 메시지·인사말·답변, 그리고 퇴장 기간에 달린 본인 질문의 답변을 읽는다. 재입장 후에는 과거의 본인 입장 구간 대화가 다시 보인다. 퇴장 중에는 메시지 SELECT를 허용하지 않는다. greeting은 recipient_user_id=auth.uid()인 팬만 읽는다. 다른 팬 질문 행은 SELECT·Realtime에서 항상 제외한다. 질문 인용은 답변의 안전한 snapshot만 허용하며 질문의 passes_all_filters가 false면 reply_context를 저장하지 않는다. 팬에게는 본인 메시지의 cluster_id와 답변 reply_context만 제공한다.
- message_clusters는 방 소유자만 SELECT할 수 있다. 방 소유자는 대표 질문과 활성 참여자 수를 확인하고, 팬은 cluster 행을 직접 읽지 않는다.
- influencer broadcast는 생성 시각에 활성 room_member_periods가 있는 멤버만 읽는다. 첫 입장 greeting은 해당 사용자의 최초 membership 기간만 생성하며 재입장 때 재발송하지 않는다.
- 방 소유자는 본인 방 멤버십·전체 대화·인박스·필터·인사말 설정·AI 기능에 접근한다. 답변·전체 메시지만 본인 권한으로 soft delete할 수 있다. 인박스는 저장된 own_score와 support_badge snapshot을 읽는다.
- view는 security_invoker=true. 본인 카드 수만 집계하고 기초 테이블 RLS를 유지한다.
- room_catalog는 private.demo_accounts/demo_clock을 직접 JOIN하지 않는다. 인자 없이 auth.uid()의 real/demo 유효 현재 월만 date로 반환하는 좁은 SECURITY DEFINER helper를 사용한다. helper는 빈 search_path·완전한 schema qualification을 적용하고 authenticated에 해당 helper 실행만 허용한다. private 테이블 SELECT나 타인 userId 입력은 허용하지 않는다.
- RLS는 행 경계다. 민감 열 숨김으로 오해하지 않는다. 계정 매핑·demo capability·필터·moderation은 private에 분리한다.
- 필요한 SECURITY DEFINER 함수는 이유·권한 명시, search_path='', 완전한 schema qualification, PUBLIC EXECUTE 회수, 함수별 최소 grant를 적용한다.
- 일반 RPC actor는 auth.uid(). **Edge service-only 내부 RPC만** 검증 JWT에서 얻은 actor_id를 받는 예외다. authenticated에 이 함수 실행 권한을 주지 않는다.
- role은 profiles의 서버 관리 값으로 검사한다. user_metadata는 권한 근거가 아니다. 소유권/멤버십 RLS helper는 private helper로 구성해 재귀 정책을 피한다.

## 5. 게임·월·점수 기본값

### 5.1 game_config JSON

| key | 초기 value |
| --- | --- |
| grade_rates | `{"common":70,"rare":20,"epic":7.5,"special":2.5}` |
| upgrade_cost | `10` |
| room_entry | `{"min_earned_draws":5}` |
| priority_weights | `{"own":0.6,"quality":0.4}` |
| gauge | `{"start":50,"monthly_min_rounds":3,"per_round_delta":12.5,"max":100}` |

mutation은 필요한 설정을 트랜잭션 내 한 번 읽는다. 필수/추가 key·enum·숫자를 DB 검증한다. 확률≥0·합계100, weight≥0·그룹 합계1, upgrade_cost/min_earned_draws는 양의 정수. gauge.start/max는 정수이며 `0 < start <= max <= 100`, monthly_min_rounds는 비음수 정수다. per_round_delta는 유한 숫자로 `0 < per_round_delta <= 100`이고 gauge의 numeric(5,1)에 반올림 없이 저장 가능한 0.1 단위 값이어야 한다. 0·start>max·0.01 같은 정밀도 초과를 허용하거나 반올림으로 보정하지 않는다. 초기값은 PRD 기준이며 게임 수치 변경은 관리자 RPC로 version을 올려 적용한다. 확률 비율·입장 기준·강화 비용·게이지 수치가 PRD 규칙을 바꾸면 PRD도 함께 갱신한다. 스타일 수3과 등급 순서는 v1 고정이다. 설정 누락·오염은 CONFIG_INVALID로 전체 롤백하며 설정 값·version도 부분 갱신하지 않는다.

upgrade_cost=10·room_entry=누적 발급 5장·gauge 시작50·월 기준3회·회당12.5·최대100은 PRD 시연 기본값이다. grade_rates는 70/20/7.5/2.5다. 추첨·강화·입장·월 마감·room_catalog·오류 details는 현재 유효한 설정 snapshot을 사용한다. 배지 조건·배지 점수·보유 스타일 가산은 현재 제품 규칙이며 변경 시 PRD와 계획을 같이 갱신한다. 설정 변경은 기존 카드·gauge·과거 점수를 일괄 변경하지 않고 다음 작업부터 적용한다.

### 5.2 추첨·강화

- 홍주P complete_round는 사용자 잠금·demo clock·강제 등급 권한·round 저장을 담당하고, 카드 확률 추첨과 draws/user_cards 발급은 문환P A-09의 private.issue_card(p_user_id,p_round_id,p_force_grade)로 위임한다. wrapper와 발급 호출은 한 DB transaction이어야 하며 중복으로 확률·지급 로직을 만들지 않는다. 결과는 동일 transaction에서 API response로 반환한다.
- DB 지급 확정이 뽑기 애니메이션보다 먼저다. 애니메이션을 건너뛰거나 도중에 나가도 카드와 결과는 보유 기록에 남는다. 미개봉 팩 재조회/열기 큐와 골프존 라운드 ID 중복 방지는 앱 밖 라운드 연동이 필요한 실서비스 과제이며 프로토타입에서 구현하지 않는다. requestId는 네트워크 재전송만 막는다.
- isNew는 추첨 직전 해당 template의 모든 등급 count 합계=0인지다. 과거 수집 이력이 아닌 현재 보유 기준.
- demoForceGrade는 private.demo_accounts.can_force_grade=true 및 private 설정이 활성인 user만 complete_round에서 허용한다. 하나라도 빠지면 FORBIDDEN과 draw 없음. 일반 user도 FORBIDDEN. 공개 API에 template 고정 옵션은 없다. complete_round는 권한 확인 후 p_force_grade를 issue_card에 전달한다. 강제 발급도 draws.forced=true로 남고 누적 획득·입장·배지 집계에 포함한다. 확률 검증에서는 제외한다.
- 같은 template/grade10장→다음 grade1장. special 강화는 MAX_GRADE. 0행은 유지하되 보유 스타일·최고 등급 계산에서 제외한다.
- 추첨·강화는 동일 사용자 transaction lock을 공유한다. 최초 isNew·차감·적립·작업 성공 기록까지 원자적이다.
- complete_round는 사용자 잠금 다음에 데모 clock을 잠그고 period_month를 읽는다. 라운드 저장과 커밋까지 유지해 월 마감 뒤 지난 월 라운드가 뒤늦게 추가되지 않도록 한다.
- 확률 경계·난수 선택·1,000회 분포의 구현과 통계 증거는 문환P A-09 소유다. 홍주P는 complete_round의 강제 등급 전달·원자 transaction·멱등 결과·오류 rollback·entryUnlocked 응답을 통합 검증한다. 발급함수 권한 확인은 A-09 계약을 따른다.

### 5.3 입장·재입장

- 해당 influencer의 draws 누적 발급 수가 5 이상이면 입장 자격을 얻는다. 등급·스타일 무관이며 user_cards에서 강화로 카드가 줄거나 게이지 소진으로 퇴장해도 자격은 유지된다. 카드는 소모하지 않는다.
- 부족 응답에는 requiredCards=5, earnedCards, missingCards를 반환한다. active의 join 재호출은 gauge·joined_at을 보존한다.
- 최초 입장 gauge는 50이다. 게이지 소진으로 left가 된 사용자는 `currentMonth >= leftMonth`인 현재 달력 월에 라운드 3회를 완료하면 그 달에 재입장할 수 있다. `leftMonth`는 월 정산의 평가 월이 아닌 퇴장 효력 월이다. 자격이 생기면 left인 모든 방을 재입장할 수 있고, 각 방의 gauge는 50으로 재시작한다. `join_room`은 유효 현재 월, left_month, 현재 월 전체 라운드 수 3회를 서버에서 재검증하며 active 재호출은 기존 상태를 유지한다. 입장 자격 draws 5장은 유지되지만 RPC에서 다시 확인한다.
- 입장·재입장과 월 마감의 잠금 순서 및 입장 구간 시각은 §7.4를 따른다. 메시지 저장과 같은 방 잠금을 공유한다.
- 자발적 나가기·추방·게이지 충전·카드 선물은 v1 범위 밖.

### 5.4 월 게이지와 데모 월 경과

- 데모 rounds.period_month·입장 월은 demo_clock.current_month. 일반 계정은 실제 KST 월. played_at은 모두 실제 서버 시각.
- advance_demo_month는 role=admin 및 can_advance_month=true만. demo_accounts에 등록된 active 사용자 멤버십만 변경한다.
- targetMonth는 월 첫날이며 바로 다음 월만 새 처리. 예: 2026-11-01→2026-12-01은11월 마감.
- clock을 잠그고 마감 월의 사용자 전체 데모 라운드 수를 집계한다. 라운드는 모든 채팅방에 공통 적용한다. 기준3회에서 초과 1회당12.5를 더하고 부족 1회당12.5를 뺀다. 정산 대상 월은 `clamp(previousGauge + (roundCount - 3) × 12.5, 0, 100)`이다.
- 해당 월에 최초 입장하거나 재입장한 멤버십은 월 정산 전체를 건너뛴다. 게이지 증가·감소를 모두 적용하지 않는다. 다른 active 멤버십은 기준대로 정산한다. 0 이하는 0으로 고정하고 status=left, left_month=targetMonth, left_at=server time을 기록하며 열린 `room_member_periods` 구간을 같은 트랜잭션에서 닫는다. `joined_month`는 해당 멤버십의 최신 입장 월로 관리한다. closedMonth는 활동 평가 월, left_month는 퇴장 효력 월이다.
- 월 3회 재입장 기준은 현재 유효 월의 사용자 전체 라운드 수로 판정한다. 예를 들어 11월 마감으로 `targetMonth=12월`, `leftMonth=12월`에 퇴장하면 12월 안에 라운드 3회를 채운 즉시 재입장할 수 있다. 1월까지 기다리지 않는다. 12월이 지난 뒤에도 과거 3회를 이월하지 않고 재입장을 요청한 현재 월의 3회를 검사한다. 휴면·활동 랭킹은 후속 실서비스 범위라 프로토타입 월 마감에 넣지 않는다.
- 화면은 게이지 50을 여유 라운드4회, 100을8회로 보여 주고, 월 라운드 수를 기준3회와 비교해 이번 달 남은 회수를 계산한다.
- `getMyRoundGaugeSummary`는 유효 현재 월·모든 방에 공통인 월 라운드 수·목표 3회·남은 라운드를 반환한다. 게임 시작 화면과 방 입장 화면은 이를 이용해 이번 달 남은 라운드와 월 마감일을 안내한다. 게이지가12.5 이하이면 다음 기준 미달 월 마감에 퇴장할 수 있다는 인앱 경고를 보인다. 프로토타입은 푸시 대신 화면 내 안내를 사용한다.
- PRD의 “게이지 소진까지 남은 기간”은 계산 기준이 정해져 있지 않다. UI는 확정된 게이지 잔여량(50은4회, 100은8회)과 월 마감일을 표시하며, 플레이율을 가정한 퇴장 날짜 예측은 하지 않는다.
- 결과·demo_month_runs·clock 이동은 한 트랜잭션. 같은 targetMonth 재요청은 기존 결과+applied=false, 추가 감소 없음. 처리 이력 없는 과거 월·미래 건너뛰기는 INVALID_MONTH_TRANSITION.
- 다른 requestId 동시 요청도 한 마감만 적용. 동일 requestId 재시도는 최초 응답 그대로.
- 일반 계정 자동 월마감 스케줄러는 해커톤 범위 밖. 데모 기능을 운영 자동화로 보고하지 않는다.

### 5.5 보유 배지·ownScore·priority

해당 방 influencer별로 현재 보유 카드와 누적 draws를 계산한다. 누적 발급은 강화로 줄지 않고, 현재 최고 보유 등급도 강화로 낮아지지 않는다. 배지는 더 높은 조건을 우선 적용한다.

```text
Albatross = earnedDraws >= 15 AND highestOwnedGrade == special
Eagle     = earnedDraws >= 15 OR  highestOwnedGrade == special
Buddy     = earnedDraws >= 10 OR  highestOwnedGrade >= epic
baseScore = Albatross 90 / Eagle 60 / Buddy 30 / no badge 0
styleBonus = min(2, max(0, ownedStyleCount - 1)) × 5
ownScore   = baseScore + styleBonus
priority   = round(0.6×ownScore + 0.4×qualityScore,2)
```

배지는 influencer별로 Buddy(누적10장 또는 Epic 이상), Eagle(누적15장 또는 Special), Albatross(누적15장 그리고 Special)다. 보유 스타일 수는 해당 influencer의 카드 중 현재 1장 이상 보유한 illust/retro/holo 종류 수다. 스타일 보너스는 배지 유무와 관계없이 적용한다. 예를 들어 배지가 없어도 스타일 2종이면 ownScore=5, 3종이면 10이다. 보유 배지와 ownScore는 팬 본인 화면 및 influencer 인박스에 표시할 수 있게 질문에 snapshot으로 저장한다. 최종 저장 시 priority도 snapshot이며 이후 카드·설정 변경으로 재채점하지 않는다. qualityScore는 검증한 AI 값만 받는다.

예: 누적10장·현재 한 스타일이면 Buddy 30점, quality80이면 priority50.00. 배지가 없고 스타일2종이면 ownScore=5, quality80이면 priority=35.00이다. 15장 이상·Special 보유·스타일3종이면 Albatross 100점, quality80이면 priority92.00.

인박스 기본은 미답변 user pass 질문 중 현재 입장 중인 팬의 질문이다. 퇴장 중인 팬의 질문은 숨기고, 재입장하면 원래 점수 snapshot으로 복귀시킨다. 개별 질문은 priority DESC,id DESC이며 묶음은 활성 질문 최고 점수·최신 ID로 만든 항목을 같은 순서에 넣는다. answered 포함 옵션·페이지 revision의 상세 기준은 §7.1이다. 묶음은 미답변 질문끼리만 만들고 한 번 답변된 묶음은 닫는다. 답변 뒤 도착한 유사 질문은 닫힌 묶음에 넣지 않고 새 pending 질문으로 남긴다. `member_count`는 저장 시 고정 수가 아니라 현재 활성 멤버십인 고유 질문자 수를 조회 시 계산한다.

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
type RoundGaugeSummary = {
  currentMonth: string; monthlyRoundCount: number;
  targetRounds: number; remainingRounds: number;
};
type AdvanceDemoMonthData = {
  closedMonth: string; currentMonth: string; applied: boolean;
  members: { roomId: UUID; userId: UUID; roundCount: number;
    previousGauge: number; gauge: number; status: 'active' | 'left' }[];
};
type SupportBadge = 'none' | 'buddy' | 'eagle' | 'albatross';
type MessageKind = 'user_question' | 'influencer_answer' | 'influencer_broadcast' | 'greeting';
type Message = {
  id: MessageId; roomId: UUID; senderId: UUID;
  senderType: 'user' | 'influencer'; messageKind: MessageKind;
  recipientUserId: UUID | null; senderName: string;
  body: string | null; replyTo: MessageId | null; replyContext: string | null;
  deletedAt: string | null; passesAllFilters: boolean | null;
  isReplyToMe: boolean; // user 본인 질문과의 불변 답변 링크로 SDK가 보강
  createdAt: string; updatedAt: string;
  clusterId: UUID | null;
  supportBadge: SupportBadge | null;
  ownScore: number | null; qualityScore: number | null; priority: number | null;
};
type MessageChangeCursor = { updatedAt: string; id: MessageId };
type InboxItemBase = {
  inboxKey: string; priority: number; tieMessageId: MessageId;
  replyTo: MessageId; answered: boolean; replyId: MessageId | null;
};
type InboxItem =
  | (InboxItemBase & { kind: 'question'; expectedClusterId: null; expectedClusterVersion: null; question: Message })
  | (InboxItemBase & { kind: 'cluster'; expectedClusterId: UUID; expectedClusterVersion: number;
      clusterId: UUID; representative: string; memberCount: number;
      activeMessageIds: MessageId[] });
type InboxPage = Page<InboxItem> & { revision: string };
```

조회·mutation SDK 메서드는 Promise<Result<T>>이며 구독 helper는 §6.5의 해제 함수를 반환한다. SDK만 snake_case→camelCase, numeric, 문자열 ID를 정규화한다. database.types.ts는 CLI로 생성하고 수동 수정하지 않는다. SQL RPC는 표의 camelCase 도메인 payload를 JSONB로 만들되 template은 imageUrl 대신 imagePath를 전달한다. SDK가 Storage 공개 URL을 만들어 최종 CardTemplate.imageUrl로 바꾼다. DB에 환경별 절대 URL을 하드코딩하지 않는다.

SDK는 세션을 Supabase client에서 얻으며 공개 인자에 userId/actor/role을 받지 않는다. RLS 때문에 비어 있는 결과를 확인하려고 관리자 권한으로 재조회하지 않는다.

lib/api의 쿼리·호출 로직은 createBackendApi(client)로 주입한 SupabaseClient를 사용한다. 브라우저 export는 lib/supabase/client.ts의 인스턴스에 연결한다. Node 통합 테스트는 사용자별 client를 persistSession=false·autoRefreshToken=false로 만들어 같은 API factory를 검증한다. SDK import 시 window/localStorage에 접근하지 않으며 Node 테스트를 위해 Next.js 앱을 먼저 만들지 않는다. 브라우저 전용 초기화는 브라우저 factory 안에서만 수행한다.

### 6.2 오류 코드

| code | 의미·details | retryable |
| --- | --- | --- |
| UNAUTHENTICATED | JWT 없음·만료·위조, 재로그인 | false |
| FORBIDDEN / NOT_FOUND | 역할·소유권 부족 / 접근 가능한 대상 없음 | false |
| VALIDATION_ERROR / CONFIG_INVALID | 입력/설정 불량 | false |
| INSUFFICIENT_CARDS | requiredCards, earnedCards, missingCards | false |
| MAX_GRADE | 최고 등급 강화 | false |
| ROOM_INACTIVE | 활성 멤버가 아님·월마감 퇴장 | false |
| REJOIN_NOT_AVAILABLE | requiredRoundsThisMonth=3, monthlyRoundCount, currentMonth, leftMonth | false |
| INVALID_MONTH_TRANSITION | currentMonth, requestedMonth | false |
| IDEMPOTENCY_CONFLICT | 같은 requestId에 다른 payload | false |
| REQUEST_IN_PROGRESS | 동일 작업 처리중, retryAfterMs | true |
| FILTERS_CHANGED | 판정중 필터 변경, 재판정 필요 | true |
| SOURCE_CHANGED | AI source 자격·인박스 revision·답변 대상 묶음 ID/version 변경. 해당 목록/source 재조회 필요 | true |
| RATE_LIMITED | retryAfterSeconds | true |
| FILTER_UNAVAILABLE | 키워드 fallback 불가·adapter 예외·불량 최종 adapter 반환값·점수 오류 | true |
| MESSAGE_BLOCKED | influencer 답변·전체 메시지·인사말의 필수 필터 적중. details={category,reason}, reason은 고정 안내문 | false |
| ALREADY_REVIEWED / PENDING_EXISTS | 심사 완료/신청중 중복 | false |
| ALREADY_REPLIED | 질문 답변 완료 | false |
| NETWORK_ERROR / INTERNAL_ERROR | 통신/예상 밖 장애 | true |

SQL 업무 오류는 SQLSTATE P0001, MESSAGE=고정code, DETAIL=비기밀JSON. Edge error body는 `{ok:false,error:ApiError}`, HTTP401/403/404/400/409/429/503/500을 의미에 맞춘다. SDK는 SQL/HTTP 오류를 Result로 바꾸고 raw SQL·stack·JWT·키를 반환하지 않는다. 자동 무한 재시도는 하지 않는다.

`MESSAGE_BLOCKED`는 HTTP 400, `error.message=details.reason`으로 반환하며 원문·rewrite는 포함하지 않는다. 같은 requestId/본문의 차단 재시도는 동일한 안전한 오류를 반환하고, 본문을 고쳤으면 새 requestId를 사용한다. 차단은 저장 성공이 아니므로 messages·인사말 설정을 변경하지 않는다. 팬 질문의 block은 기존 `SubmitMessageData` 분기를 유지한다.

### 6.3 조회 계약

| SDK | 입력·조회원 | 반환data |
| --- | --- | --- |
| getCollection() | security_invoker collection_view, 본인·미보유 템플릿 포함 | `{items:CollectionItem[]}` |
| getOwnedCards() | security_invoker inventory_view, 본인·count>0 | `{items:OwnedCardItem[]}` |
| getRooms() | security_invoker room_catalog, 본인 누적발급·멤버십·월 재입장 자격·현재 표시 이미지·카드 준비 상태 | `{items:RoomCatalogItem[]}` |
| getMyInfluencerProfile() | get_my_influencer_profile, auth.uid()에 연결된 본인 정보 | `MyInfluencerProfile` |
| getMyMembership(roomId) | room_members의 본인/방 1행 | Membership 또는 null |
| getMyRoundGaugeSummary() | auth.uid()의 유효 현재 월·전체 라운드 집계 | `RoundGaugeSummary` |
| getMessages({roomId,beforeId?,afterId?,limit?}) | messages room_id + id keyset | Page<Message> |
| getRoomMessageCheckpoint({roomId}) | messages room_id, SELECT RLS 범위에서 updated_at DESC,id DESC LIMIT 1, updated_at/id_text만 전송 | MessageChangeCursor 또는 null |
| getMessageChanges({roomId,checkpoint?,through,cursor?,limit?}) | messages room_id + (updated_at,id) keyset, `(checkpoint,through]`의 변경. 최초 checkpoint 명시(null 허용), 후속은 cursor | Page<Message> |
| getRoomDailyBlockCount({roomId}) | private moderation_events를 직접 노출하지 않는 소유자 전용 집계 RPC | `{roomId,day,count}` / verified 방 소유 influencer |
| getMyVerifications({cursor?,limit?}) | 본인 influencer 신청 | Page<Verification> |
| getPendingVerifications({cursor?,limit?}) | admin, pending | Page<Verification> |
| getGameConfig() | game_config 공개값만 | §5.1 key/value/version 목록 |

```ts
type CollectionItem = {
  template: CardTemplate; counts: Record<Grade, number>;
  totalCards: number; highestGrade: Grade | null;
};
type OwnedCardItem = {
  template: CardTemplate; grade: Grade; count: number;
};
type RoomCatalogItem = {
  roomId: UUID; influencerId: UUID; influencerName: string;
  influencerType: InfluencerType; verifiedAt: string;
  profileImageUrl: string | null; requiredCards: number;
  earnedCards: number; missingCards: number; supportBadge: SupportBadge;
  cardStatus: 'ready' | 'preparing'; canJoin: boolean;
  joinReason: 'eligible' | 'need_cards' | 'already_active' | 'rejoin_rounds_needed' | 'card_preparing';
  currentMonthRoundCount: number; requiredRoundsToRejoin: number;
  membership: Membership | null;
};
type RoomGreeting = { roomId: UUID; text: string; isDefault: boolean; maxLength: 200; version: number };
type RoomDailyBlockCount = { roomId: UUID; day: string; count: number };
type MyInfluencerProfile = {
  influencerId: UUID; influencerName: string; verifiedAt: string;
  profileImageUrl: string | null; fallbackImageUrl: string | null;
};
type Verification = {
  id: UUID; influencerId: UUID; type: InfluencerType; evidenceUrl: string;
  status: 'pending' | 'approved' | 'rejected'; createdAt: string;
  reviewedAt: string | null; rejectionReason: string | null;
};
```

collection_view는 카드 템플릿30행·grade별0을 채운다. 별도 보유 카드 화면은 template-grade 조합별 수량을 반환하는 inventory_view를 사용하고 count=0인 행은 제외한다. room_catalog는 인증된 인플루언서 중 방이 열린 항목을 반환한다. 기본은10방이고 11번째 대기 신청자가 승인되면 새 방이 추가된다. 11번째 방은 템플릿이 없는 동안 `cardStatus='preparing'`, `canJoin=false`, `joinReason='card_preparing'`이다. 일반 입장 조건은 누적 draws 5장, 재입장은 퇴장 후 현재 달력 월 라운드 3회다. 재입장 자격은 모든 left 방에 공통 적용하며 실제 입장 시 RPC에서 재검증한다. 카드 이미지와 influencer profile image는 서로 다른 Storage 경로로 공개 URL을 만든다.

메시지 history 기본50·최대100, beforeId/afterId 동시 금지. 최초/before는 id DESC 조회 후 SDK ASC 정렬, nextCursor=최소id(과거방향). after는 id ASC, nextCursor=최대id(복구방향). limit+1로 후속 유무를 판단하고 id를 인과 순서로 사용한다. user 조회는 현재 active 멤버십을 요구하고 과거·현재 `room_member_periods` 구간을 적용한다. 답변의 불변 질문 링크로 본인 질문 소유 여부에 따른 퇴장 기간 예외 조회를 허용하며, 일반 답변·전체 메시지는 다른 팬 질문 행을 노출하지 않는다. Realtime UPDATE는 생성 뒤의 삭제 등 오래된 행 변경도 일으키므로 `getMessageChanges`는 updated_at,id keyset으로 증분 복구한다. messages의 생성·변경 시각과 방 잠금은 §7.4를 따른다. bigint cursor 비교·정렬은 DB에서 수행하고 SDK는 문자열을 유지한다.

본인 신청과 pending 신청은 (created_at,id) ASC keyset, 기본 50·최대 100이다. cursor는 base64url(JSON 튜플)이며 SDK에서 검증·직렬화한다.

### 6.4 일반 mutation 멱등성

모든 mutation은 UUID requestId 필수. 최초 동작에서 생성하고 네트워크 재전송은 같은 값을 쓴다. SQL 인자는 p_request_id.

- 키=(auth.uid(),operation,requestId). 정규화 payload의 SHA-256 저장. 문자열 trim·배열 정렬 규칙은 함수마다 일관되게 적용.
- 같은 키/같은 성공 payload는 최초 결과 반환, 다른 payload는 IDEMPOTENCY_CONFLICT.
- 성공 캐시를 반환하기 전에도 현재 role·리소스 소유권·접근권한을 검사한다. 퇴장 후 메시지 결과나 소유권 상실 후 summary를 requestId만으로 조회하지 못한다. 멱등 join의 캐시는 현재 상태를 바꾸지 않으며 UI는 getMyMembership으로 최신 상태를 읽는다.
- 일반 RPC 데이터 변경과 성공 operations 기록은 한 트랜잭션. 실패는 전부 롤백. 성공 뒤 바뀐 설정으로 재실행하지 않음.
- operations 예약/잠금 뒤 도메인 잠금. 같은 키 경합은 대기 후 결과 반환, 다른 키는 도메인 잠금으로 제어.
- 성공 operations는7일 유지. 7일 이후 미확정 요청을 SDK가 자동 재전송하지 않음. AI 비저장 결과 예외는 §7.3.

### 6.5 인플루언서 화면 SDK 입력

SDK 입력은 SQL의 `p_` 접두어를 제거한 camelCase다. 모든 mutation은 `requestId`를 받으며 화면은 다음 시그니처를 사용한다.

```ts
type SubscribeRoomMessagesStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED';
type SubscribeRoomMessagesInput = {
  roomId: UUID;
  onMessage: (message: Message) => void;
  onStatus: (status: SubscribeRoomMessagesStatus, error?: Error) => void;
};
type ReconcileRoomMessagesInput = {
  roomId: UUID; currentMessages: readonly Message[];
  checkpoint: MessageChangeCursor | null;
};
type ReconcileRoomMessagesData = {
  messages: Message[]; checkpoint: MessageChangeCursor | null;
};
type InfluencerScreenSdk = {
  updateRoomGreeting(input: { requestId: UUID; roomId: UUID; expectedVersion: number; text: string }): Promise<Result<RoomGreeting>>;
  uploadInfluencerProfilePhoto(input: { requestId: UUID; file: File }): Promise<Result<MyInfluencerProfile>>;
  sendBroadcast(input: { requestId: UUID; roomId: UUID; body: string }): Promise<Result<Message>>;
  deleteInfluencerMessage(input: { requestId: UUID; roomId: UUID; messageId: MessageId }): Promise<Result<{ message: Message }>>;
  replyToMessage(input: { requestId: UUID; roomId: UUID; replyTo: MessageId; expectedClusterId: UUID | null; expectedClusterVersion: number | null; body: string }): Promise<Result<Message>>;
  getRoomMessageCheckpoint(input: { roomId: UUID }): Promise<Result<MessageChangeCursor | null>>;
  getRoomDailyBlockCount(input: { roomId: UUID }): Promise<Result<RoomDailyBlockCount>>;
  subscribeRoomMessages(input: SubscribeRoomMessagesInput): () => void;
  reconcileRoomMessages(input: ReconcileRoomMessagesInput): Promise<Result<ReconcileRoomMessagesData>>;
};
```

`checkpoint`는 마지막으로 전체 변경 조회를 완료한 `(updatedAt,id)`이며 `reconcileRoomMessages` 입력에서 반드시 명시한다. 처음부터 복구할 때만 null을 사용하고, `currentMessages`의 마지막/최댓값이나 Realtime 이벤트로 추론·전진시키지 않는다. helper는 시작 시 `getRoomMessageCheckpoint`로 상한 `through`를 읽고 `(checkpoint,through]`만 조회한다. `through=null`이면 빈 범위다. `getMessageChanges` 최초 page는 checkpoint(null 허용), 후속 page는 직전 nextCursor를 사용하며 둘을 함께 보내지 않는다. 모든 page의 through는 고정하고 cursor는 roomId·하한·상한·마지막 튜플에 묶어 검증한다. 기본50·최대100이며 limit+1로 다음 page를 판정한다.

helper는 모든 page를 성공한 뒤에만 through를 새 checkpoint로 반환한다. 시작 시 상한 조회 또는 중간 page가 실패하면 오류를 반환하고 기존 checkpoint·화면 목록을 보존한다. through 이후로 변경된 행은 다음 복구에서 읽는다. 병합은 id별 최신 updatedAt을 우선하고 같은 행의 오래된 조회 결과로 최신 live 이벤트를 덮어쓰지 않는다. 최초 history용 checkpoint 획득 순서와 복구 중 live buffer 처리는 §9.1을 따른다.

`updateRoomGreeting`의 빈 `text`는 기본 문구 복원이며 200 Unicode code point까지 허용한다. `expectedVersion`은 `getRoomGreeting`의 `version`을 보낸다. `sendBroadcast`의 body는 trim 후 1~2000 Unicode code point다. 사진 SDK의 `file`은 브라우저 `File`이며 JPEG/PNG/WebP, 5 MiB 이하만 받고 내부에서 512×512 WebP로 변환한 뒤 업로드·RPC 갱신까지 수행한다. 변환 bytes의 SHA-256과 요청별 Blob을 보존하고 §8.5의 기존 객체 비교·중간 실패 복구를 수행한다. 업로드 경로·contentSha256은 SDK 내부 값이며 화면은 requestId와 File만 전달한다.

`replyToMessage`와 `sendBroadcast`는 `send-influencer-message` Edge의 discriminated input을 SDK 안에서 만든다. 각각 `{requestId,roomId,kind:'answer',replyTo,expectedClusterId,expectedClusterVersion,body}`와 `{requestId,roomId,kind:'broadcast',body}`로 호출한다. replyTo/expectedClusterId/expectedClusterVersion은 인박스 항목을 그대로 쓰며 묶음 경합 검증은 §7.1을 따른다. 세 influencer 쓰기 SDK는 block을 §6.2의 `MESSAGE_BLOCKED`로 반환한다. 삭제는 `deleteInfluencerMessage`가 내부에서 `delete_influencer_message` RPC의 `p_request_id`, `p_room_id`, `p_message_id`로 변환한다. 인사말 Edge는 `{requestId,roomId,expectedVersion,text}`를 받는다.

`getRoomDailyBlockCount({roomId})`는 `{roomId,day,count}`를 반환한다. `day`는 서버가 계산한 Asia/Seoul 달력 날짜다. `count`는 오늘 해당 방에서 팬이 보낸 질문 중 고유 `(actor_id,request_id)`의 `verdict='block'` 수(키워드 fallback block 포함)다. suggest는 제외한다. 차단 원문·suggest 결과는 저장하거나 반환하지 않는다. RPC는 비공개 `moderation_events`에서 count만 조회하고, `auth.uid()` 기준 verified 방 소유자만 실행할 수 있다. 노출된 `public.get_room_daily_block_count`는 `SECURITY INVOKER` wrapper만 두고, 비노출 `private` helper가 `SECURITY DEFINER`·빈 고정 `search_path`·schema-qualified 이름으로 count를 수행한다. private helper도 `auth.uid()`와 방 소유권을 검증한다. 양쪽 RPC 모두 `PUBLIC`/`anon` 실행 권한은 회수하고 필요한 schema usage와 `authenticated` 실행 권한만 준다. `authenticated`에 private 테이블 SELECT를 주지 않는다.

## 7. RPC·메시지 전송 계약

### 7.1 브라우저 직접 호출 RPC

아래 mutation은 모두 p_request_id uuid 필수. 표 외 actor/role/점수 입력은 받지 않는다. SDK 입력은 p_ 제거 camelCase다. 예: upgradeCard({requestId,templateId,grade}).

| SDK → RPC | 나머지 SQL 입력 | 반환data / 권한 |
| --- | --- | --- |
| completeRound → complete_round | p_force_grade card_grade default null | `{roundId,drawId,grade,template:CardTemplate,isNew,ownedCount,entryUnlocked}` / user, 고정등급은 capability 추가 |
| upgradeCard → upgrade_card | p_template_id uuid, p_grade card_grade | `{templateId,fromGrade,toGrade,consumed,remainingCount,upgradedCount}` / user |
| joinRoom → join_room | p_room_id uuid | `{membership:Membership,alreadyActive:boolean,welcomeMessage:Message|null}` / user. B-05는 입장 구간을 기록하고 greeting은 null; P2 B-15에서 첫 입장에만 snapshot 생성 |
| advanceDemoMonth → advance_demo_month | p_target_month date | `AdvanceDemoMonthData` (`members[].status` is `active` or `left`) / demo admin |
| deleteInfluencerMessage → delete_influencer_message | p_room_id uuid, p_message_id bigint | `{message:Message}` / 본인 답변·전체 메시지만 soft delete. greeting은 불가 |
| requestVerification → request_verification | p_type influencer_type, p_evidence_url text | `{verification:Verification}` / 본인 influencer |
| approveVerification → approve_verification | p_verification_id uuid, p_decision text(approved/rejected), p_reason text default null | `{verification:Verification,verifiedAt:string 또는 null}` / admin |
| setInfluencerProfilePhoto → set_influencer_profile_photo | p_profile_image_path text, p_content_sha256 text | `{influencerId,profileImagePath}` / 인증된 본인 influencer. digest는 소문자 64자리 hex로 검증하고 경로와 함께 멱등 payload에 포함 |
| updateRoomFilters → update_room_filters | p_room_id uuid, p_disabled_filters text[], p_expected_version int | `{roomId,disabledFilters,version}` / 방 소유 influencer |
| updateGameConfig → update_game_config | p_key text, p_value jsonb, p_expected_version int | `{key,value,version}` / admin |

ownedCount/upgradedCount는 해당 template/grade의 갱신 직후 count. `entryUnlocked`는 지급 직전 해당 influencer의 누적 `draws`가 입장 기준보다 적고 지급 직후 기준 이상일 때만 `true`다. 강제 발급도 누적 수에 포함하며 멱등 재시도는 최초 결과를 반환한다. `RoomCatalogItem.profileImageUrl`은 표시용으로 현재 프로필 사진, 없으면 illust 카드 URL을 반환한다. optional 값은 명시적 null 전달. reply 본문도 trim1~2000자.

| 읽기 SDK → RPC | 입력 | 반환data / 권한 |
| --- | --- | --- |
| getRoomInbox → get_room_inbox | p_room_id uuid, p_include_answered bool default false, p_cursor jsonb default null, p_limit int default50 | InboxPage / 방 소유 influencer |
| getRoomFilters → get_room_filters | p_room_id uuid | `{roomId,disabledFilters,mandatoryFilters,version}` / 방 소유 influencer |
| getRoomGreeting → get_room_greeting | p_room_id uuid | `RoomGreeting` / 방 소유 verified influencer |
| getRoomDailyBlockCount → get_room_daily_block_count | p_room_id uuid | `RoomDailyBlockCount` / verified 방 소유 influencer, 오늘 count만 |
| getMyInfluencerProfile → get_my_influencer_profile | 없음. `auth.uid()`만 사용 | `MyInfluencerProfile` / verified 본인 influencer |
| getMyRoundGaugeSummary → get_my_round_gauge_summary | 없음. `auth.uid()`만 사용 | `RoundGaugeSummary` / user |
| SDK 내부 답변 표시 보강 → get_my_answer_links | p_room_id uuid, p_answer_ids bigint[] 최대100. userId 입력 없음 | `{items:[{answerId:MessageId,isReplyToMe:boolean}]}` / active user의 RLS로 읽을 수 있는 답변만 |

`get_my_round_gauge_summary`는 `auth.uid()`에 연결된 사용자만 집계하고 사용자 ID 인자를 받지 않는다. 유효 월은 기존 비공개 current-month helper에서 받으며, private clock 원본이나 타인 라운드 수를 노출하지 않는다. `remainingRounds=max(0,targetRounds-monthlyRoundCount)`다.

`answer_question_links`는 답변 시점의 전체 대상 질문을 고정한다. 팬의 퇴장 기간 답변 예외 RLS와 `isReplyToMe`는 auth.uid()의 질문에 대한 이 링크를 좁은 private helper로 확인하며, 변경 가능한 cluster_id의 일치만으로 판단하지 않는다. `get_my_answer_links`는 public SECURITY INVOKER wrapper·권한 검증 private helper 경계를 사용하고 링크 테이블 SELECT를 브라우저에 주지 않는다. 본인이 읽을 수 없는 답변이나 다른 팬 질문의 ID/내용은 반환하지 않는다. SDK는 history/변경 page와 Realtime 답변을 이 RPC로 보강한 뒤 Message/onMessage를 제공한다. 보강 실패 시 조회/복구를 성공 처리하지 않고 checkpoint를 보존한다. owner 조회 및 답변 이외 종류의 isReplyToMe는 false다. 원시 Realtime 행에 사용자별 값을 넣거나 전체 대상 질문 ID를 공개하지 않는다.

`getRoomInbox`는 §6.1의 `InboxPage`를 반환한다. 묶이지 않은 질문은 `kind='question'`, 묶음은 `kind='cluster'` 한 행으로 조회하며 묶음 안 질문을 별도 항목으로 중복 반환하지 않는다. 대표문장·활성 고유 질문자 수·활성 질문 ID는 저장된 관계에서 매 조회 계산하므로 새로고침 후에도 동일 계약을 사용한다. 팬에게 이 조회를 허용하지 않는다.

- 개별 항목의 priority는 질문의 저장 snapshot이다. 묶음 priority는 현재 active 질문들의 priority 최댓값, `tieMessageId`는 해당 묶음의 활성 질문 중 가장 큰 ID다. 정렬은 priority DESC,tieMessageId DESC,inboxKey ASC다. `inboxKey`는 `question:<id>` 또는 `cluster:<uuid>`이며 방 안에서 유일하다.
- `memberCount`는 활성 질문자의 고유 수이고 `activeMessageIds`는 그들의 질문 ID다. 같은 팬의 질문을 임의로 하나만 남기지 않는다. 활성 팬이 1명이어도 묶음을 유지하고, 0명이면 인박스에서 숨기되 DB 구성은 보존한다. 재입장하면 원래 질문 점수로 다시 집계한다.
- `replyTo`는 개별 질문 ID 또는 묶음의 tieMessageId다. 개별은 expectedClusterId/expectedClusterVersion 모두 null, 묶음은 현재 ID/version을 함께 반환한다. 답변은 이 값을 그대로 보내며 최종 방 잠금 아래 대상 질문의 현재 active·미답변 상태·묶음 ID/version을 검사한다. 묶음 구성/대표문장 변경은 version을 올리며, 다르면 SOURCE_CHANGED로 미저장 후 인박스를 다시 읽는다. 같은 묶음의 팬 active/left 변화는 저장 version을 바꾸지 않고 조회 시 수·점수만 갱신한다.
- 기본50·최대100, limit+1로 다음 page를 판정한다. cursor는 `{revision,priority,tieMessageId,inboxKey}`를 담는다. revision은 같은 SQL snapshot에서 조회 후보 질문의 ID·cluster/version·답변 관계·active 여부·includeAnswered를 반영한 서버 fingerprint다. 다음 page에서 현재 revision이 다르면 SOURCE_CHANGED로 반환하고 첫 page부터 다시 읽는다. UI는 서로 다른 revision의 page를 합치지 않는다. 데이터가 고정된 경우에 중복·누락 없는 페이지를 보장한다.
- includeAnswered=true는 답변 완료 질문/묶음도 같은 형식으로 포함한다. 묶음의 모든 원 질문은 한 답변에 연결되고, 퇴장한 팬도 관계에서 제거하지 않는다. 미답변 여부는 private.answer_question_links의 연결 답변 중 deleted_at이 없는 행의 유무로 판정한다. 답변·삭제·재묶기 후에는 인박스를 다시 조회한다. SQL은 모든 메시지 ID를 문자열로 반환한다.

expectedVersion 충돌은 필터=FILTERS_CHANGED, 설정=IDEMPOTENCY_CONFLICT(details.currentVersion)이며 덮어쓰지 않는다.

### 7.2 submit-message Edge

SDK submitMessage({requestId,roomId,body}) → functions.invoke('submit-message',{body:{requestId,roomId,body}}).

```ts
type SubmitMessageData =
  | { verdict:'pass'; message:Message; category:null; reason:null; rewrite:null; passesAllFilters:boolean }
  | { verdict:'suggest'; message:null; category:string; reason:string; rewrite:string|null;
      rewriteQuality:number|null; suggestionToken:string|null; expiresAt:string|null; passesAllFilters:false }
  | { verdict:'block'; message:null; category:string; reason:string; rewrite:null;
      rewriteQuality:null; suggestionToken:null; expiresAt:null; passesAllFilters:false };

type InfluencerMessageInput =
  | { kind:'answer'; roomId:UUID; requestId:UUID; replyTo:MessageId;
      expectedClusterId:UUID|null; expectedClusterVersion:number|null; body:string }
  | { kind:'broadcast'; roomId:UUID; requestId:UUID; body:string };
```

user 질문 body는 trim 후1~2000 Unicode code point, 요청≤16KiB, 추가 key 거부. unchanged suggestion은 submitMessage({requestId,roomId,body,suggestionToken})로 한 번만 제출한다. influencer의 답변·전체 메시지는 send-influencer-message Edge를 통해 전송하고 greeting 설정은 update-room-greeting Edge에서 검사한다. 세 종류 모두 필수 차단 필터를 적용한다.

1. POST/JSON/CORS·JWT 서명/만료/프로젝트 검증. JWT decode나 publishable key만으로 인증하지 않는다.
2. 검증 JWT에서 actor를 얻고 user 역할·active·필터 version 확인. actor/verdict/quality/priority 입력 금지.
3. service-only begin_message_submission으로 requestId/payloadHash 예약·연속 도배 제한 적용. 임의의 10초 구간에 새 전송이 5건을 넘으면 30초 차단하며, 동일 requestId 재시도는 추가 횟수로 세지 않는다.
4. 유효 lease 한 요청만 처리한다. suggestionToken이 있으면 먼저 최종 저장 RPC의 token 경로를 호출하고, 유효 제안은 AI 호출 없이 저장한다. token이 없거나 내부 needsModeration 신호를 받은 경우에만 adapter를 한 번 호출해 JSON schema를 검증한다.
5. service-only submit_moderated_message가 membership·role·필터version·lease 재검증. pass는 DB 점수 계산+messages+operations 성공을 원자 저장.
6. suggest/block은 messages 없이 moderation metadata만 기록한다. 안전한 수정안이 있으면 별도 일회성 token과 만료시각을 최초 응답에 반환하고, 제안 원문·token 원문은 저장하지 않는다. 팬의 수정안 수락은 최초 suggest 요청과 다른 새 requestId를 사용하며, 그 수락 동작의 네트워크 재시도는 같은 ID를 사용한다. 10분 안에 수정 없이 token과 같은 문구를 보내면 최종 저장 RPC 한 트랜잭션 안에서 권한·lease·본문 hash·token 유효성을 확인한 뒤 token 소비, rewriteQuality를 사용한 pass 저장, operations 성공 기록을 함께 커밋한다. 성공 뒤 같은 requestId 재시도는 현재 접근권한을 재검사한 다음 소비 여부·만료 여부보다 먼저 최초 성공을 복구한다. 저장 실패·Edge 종료로 트랜잭션이 롤백되면 token도 미사용 상태로 남는다. token이 만료·사용됐거나 본문/actor/room이 다르면 소비하지 않고 §7.3의 내부 재판정 신호로 일반 필터 판정을 진행하며, 검사를 생략한 본문은 저장하지 않는다. 사용자가 직접 수정하거나 새로 전송할 때는 token 없이 새 requestId로 일반 판정한다.
7. 판정중 퇴장은 ROOM_INACTIVE, 필터 변경은 FILTERS_CHANGED로 미저장. 같은 requestId로 최신 필터 재판정 가능.

**인플루언서 메시지:** replyToMessage와 sendBroadcast는 send-influencer-message Edge를 호출한다. body는 1~2000자이며 JWT 기준 verified 방 소유자만 가능하다. adapter에 `senderType:'influencer'`와 선택 항목을 모두 disabled로 전달해 필수 차단 7개만 검사한다. block은 `MESSAGE_BLOCKED`와 고정 category/reason으로 반환하고 메시지는 저장하지 않는다. pass한 답변은 §7.1의 replyTo·예상 묶음 ID/version을 최종 재검사한 뒤 미답변 질문 또는 열린 묶음 전체에 원자적으로 연결한다. 묶음 답변은 질문별 중복 답변도 막으며 같은 묶음의 inactive 팬 질문 관계까지 보존해 재입장 후 본인 답변으로 확인할 수 있게 한다. 원 질문의 passesAllFilters=true일 때만 reply_context를 다른 팬에게 보여 주고, 묶음 답변은 검증된 대표문장을 쓴다. 답변 삭제 시 질문 또는 묶음의 미답변 상태를 복원한다. 전체 메시지는 §7.4의 방 잠금 후 생성 시각에 active인 사용자들에게 room_member_periods로 범위를 제한한다. 인플루언서 발송은 팬 질문 점수·인박스 행을 만들지 않는다.

**인사말 설정(P2 B-15):** updateRoomGreeting은 update-room-greeting Edge에서 선택 필터를 제외한 필수 차단 항목을 검사하고 verified owner·200자 이내를 검증한다. block이면 `MESSAGE_BLOCKED`와 고정 category/reason을 반환하고 기존 문구/version을 유지한다. 빈 값은 room_settings.greeting_text=null로 저장해 PRD 기본 문구를 복원한다. 기본 문구는 "○○ 채팅방에 오신 것을 환영합니다. 카드를 모아 찾아와 주셔서 감사합니다. 골프 이야기나 궁금한 점을 메시지로 보내 보세요."를 사용하고 ○○을 방 인플루언서 이름으로 치환한다. B-15를 구현한 뒤 첫 join transaction에서만 수신자·입장 시점 문구 snapshot을 저장한다. 기존 greeting 행은 설정 수정 후에도 변경하지 않는다.

**삭제:** deleteInfluencerMessage는 delete_influencer_message RPC로 본인 influencer_answer 또는 influencer_broadcast만 soft delete한다. body=null, deleted_at/updated_at은 §7.4의 방 잠금 후 동일 시각으로 정해 원문을 팬에게 더 이상 내보내지 않고 Realtime UPDATE를 보낸다. 팬 메시지·greeting·타인 메시지는 거부하고 되돌리기는 제공하지 않는다.

### 7.3 Edge 내부 RPC·lease

아래 RPC는 service_role 역할에만 EXECUTE. 서버 secret key의 DB 역할 경계를 사용하며 legacy service_role key를 신규 설정에 쓰지 않는다. PUBLIC/anon/authenticated는 실행 불가. private 함수가 필요하면 서비스 전용 public wrapper에서만 호출한다.

| 내부 RPC | 필수 입력 | 결과·책임 |
| --- | --- | --- |
| begin_message_submission | p_actor_id, p_room_id, p_request_id, p_payload_hash | 팬 질문 예약·제한·lease. `{state,leaseToken,filterVersion,disabledFilters,cachedResult?}` |
| submit_moderated_message | 위 식별자, p_lease_token, p_filter_version, p_body, p_verdict nullable, p_category nullable, p_quality nullable, p_passes_all_filters nullable, p_rewrite_quality nullable, p_suggestion_token text default null | 현재 접근권한·성공 cache·lease·필터를 재검사. 아래 제안/일반 판정 분기별 필수값 검증. 유효 제안은 token 검증·소비와 pass/점수/messages/operations 성공을 한 트랜잭션에 저장. 무효 제안은 미변경 상태로 `{needsModeration:true}` 반환. reason은 category별 고정 안내문에서 생성 |
| begin_influencer_message_submission | p_actor_id, p_room_id, p_request_id, p_kind(answer/broadcast/greeting), p_payload_hash | verified owner·필수 필터·중복/lease를 예약. 답변·전체 메시지는 방 제한 적용, greeting은 filter lease 반환 |
| submit_influencer_message | p_actor_id, p_room_id, p_request_id, p_kind(answer/broadcast), p_reply_to nullable, p_expected_cluster_id nullable, p_expected_cluster_version nullable, p_body, p_verdict(pass/block), p_category nullable, p_lease_token | verified owner·필수 필터 판정·활성 팬 범위·답변/묶음 상태 재검증. pass는 answer/broadcast와 해당 시 answer_question_links를 같은 트랜잭션에 저장, block은 category와 MESSAGE_BLOCKED 결과만 operations에 확정하고 미저장 |
| update_room_greeting | p_actor_id, p_room_id, p_expected_version, p_body nullable, p_verdict(pass/block), p_category nullable, p_filter_lease | verified owner·필수 필터·200자·version 검사. pass는 greeting_text 저장(빈 값 reset), block은 MESSAGE_BLOCKED 결과만 operations에 확정하고 기존 설정 보존 |
| fail_message_submission | p_actor_id, p_request_id, p_lease_token, p_error_code | token 일치 시 failed, 원문·stack 미저장 |
| begin_room_ai_operation | p_actor_id, p_room_id, p_operation(summary/cluster), p_request_id, p_payload_hash | 소유권·방/actor rate limit·29초 lease·cache |
| finish_room_ai_operation | 위 식별자, p_lease_token, p_source_message_ids, p_result jsonb | source·방·lease 재검증, cluster/summary·성공기록 |
| fail_room_ai_operation | 작업 식별자, p_lease_token, p_error_code | 유효 lease만 failed |

ID=uuid, source IDs=bigint[], hash=text, lease token=uuid, version=int, body/category/code=text, verdict enum, quality=numeric. begin 반환은 state(processing/succeeded/failed)와 nullable lease/cachedResult를 갖는 JSONB. finish는 외부 SDK에 반환할 payload JSONB, fail은 `{updated:boolean}`. 일반 내부 함수 입력도 추가·길이·형식을 검증한다. influencer block은 처리 완료된 판정으로 operations.state=succeeded에 안전한 `{ok:false,error}`만 캐시하고 도메인 데이터는 변경하지 않는다. API 성공을 뜻하는 상태와 구분하며 현재 권한 재검사 뒤 같은 오류를 복구한다. influencer 저장 RPC의 p_category는 필수 차단 enum만 허용하고 reason은 DB/Edge의 고정 매핑으로 만든다.

`submit_moderated_message`의 제안 경로는 p_suggestion_token이 nonnull이고 판정 입력(p_verdict/p_category/p_quality/p_passes_all_filters/p_rewrite_quality)은 모두 null이어야 한다. 저장할 pass/quality/passesAllFilters는 private helper의 검증 결과로만 결정한다. 일반 판정 경로는 p_suggestion_token=null이며 p_verdict와 p_passes_all_filters 및 verdict별 §8.1 필수값을 요구한다. 두 분기를 섞거나 판정 없이 일반 저장을 호출하면 VALIDATION_ERROR다.

`consume_moderation_suggestion`은 별도 RPC로 노출하지 않는다. `submit_moderated_message`만 호출하는 비노출 private helper로 두고 PUBLIC/anon/authenticated/service_role의 직접 EXECUTE를 회수한다. 저장 RPC는 이 helper 호출에 필요한 전용 소유자 권한으로 실행하는 최소 SECURITY DEFINER 경계로 두고, §4.4의 search_path·명시적 grant·현재 actor 검사를 적용한다. 최종 저장 RPC가 먼저 현재 role·active·접근권한 및 같은 payload의 성공 operations를 확인해 이미 성공한 수락 요청을 복구한다. 신규 처리는 유효 lease와 필터 version을 검사한 뒤 suggestion 행을 잠그고 token hash·DB에서 계산한 정규화 body hash·actor·room·미사용·실제 현재 시각 기준 만료를 확인한다. 유효하면 저장된 rewrite_quality와 passesAllFilters=true를 사용하며 token 소비·메시지 INSERT·점수·operations 성공이 함께 커밋되거나 함께 롤백된다. helper의 검증 결과·rewriteQuality만 따로 커밋해 Edge로 넘기는 경로는 만들지 않는다.

무효·만료·이미 사용된 token이나 변경된 본문은 token을 소비하지 않고 내부 `{needsModeration:true}`를 반환한다. Edge는 같은 requestId·payloadHash·lease로 일반 adapter를 한 번 호출하고, 검증된 판정과 `p_suggestion_token=null`로 최종 저장 RPC를 다시 호출한다. 이 신호는 SDK에 pass로 반환하거나 성공 operations로 기록하지 않는다. lease가 끝났다면 REQUEST_IN_PROGRESS/실패 후 기존 requestId 재예약 규칙을 따르며, AI 판정 전 취소·시한 초과에도 §8의 fallback/실패 규칙을 적용한다. token 원문은 검증 인수와 최초 응답에만 존재하며 오류·로그·성공 cache에 남기지 않는다.

메시지 처리 lease는 30초이며 UUID token을 발급한다. room AI 작업은 29초 lease를 사용한다. 팬 질문·인플루언서 답변/전체 메시지/인사말 설정 Edge는 각 operation 종류에 맞는 reservation을 만들고 verified owner·필수 필터·requestId를 검증한다. 처리 중 재시도는 REQUEST_IN_PROGRESS/retryAfterMs. finish/fail은 잠근 operation의 state=processing, 현재 token 일치, lease_until>clock_timestamp()를 모두 검사한다. 잠금 대기 전 트랜잭션 시작 시각으로 만료를 판단하지 않는다. 만료됐지만 아직 재예약되지 않은 token도 완료할 수 없다. 만료·실패 후 재시도는 새 token을 발급한다. lease당 AI 호출은 한 번이며 adapter의 숨은 자동 재시도는 없다. 외부 timeout 직전 처리 등으로 **공급자 과금 exactly-once는 보장하지 않는다**. DB 저장 중복은 반드시 막는다.

pass 성공은 저장된 응답 복구. block/suggest operations에는 verdict/category/reason만 저장하고 원문·rewrite·token 원문 없음. 제안이 있으면 10분 TTL의 token hash, 본문 hash, rewriteQuality만 `moderation_suggestions`에 저장하고 제안 원문은 서버에도 저장하지 않는다. token은 actor·room·본문 hash와 결합되고 최종 pass 저장과 함께 한 번만 소비된다. 변경된 본문이나 무효 token은 일반 판정으로 돌아간다. 만료되거나 사용된 suggestion metadata는 cleanup한다. 일반 suggest 재조회에 원문 rewrite/token을 복구할 수 없으므로 같은 requestId는 rewrite=null·suggestionToken=null일 수 있고, SDK는 최초 수정안과 token을 메모리에만 둔다.

팬 전송 payloadHash에는 정리한 body/roomId를 넣고 판정/filterVersion은 제외한다. influencer 전송은 kind·body·roomId·replyTo·expectedClusterId/Version(해당 시)을 모두 포함한다. FILTERS_CHANGED 실패 후 같은 팬 요청은 최신 필터로 재판정하되 기존 성공 pass는 다시 처리하지 않는다. 답변 대상이 바뀐 SOURCE_CHANGED는 목록을 다시 읽어 새 대상/본문을 확인한 새 사용자 동작으로 새 requestId를 발급한다. Jev 공급자 장애·키 누락·응답 형식 불량은 문환P adapter의 키워드 fallback으로 처리하며, 선택 항목 적중은 `suggest`/`rewrite:null`, 항상 차단 항목 적중은 `block`, 미적중은 `pass`다. fallback pass만 `quality=50`으로 저장하며 fallback block도 오늘 차단 집계에 포함한다. fallback을 구분하는 누적 위반 집계는 실서비스 과제다. 내부 RPC는 Edge 사전 검사만 믿지 않고 현재 actor 권한을 재검사한다.

### 7.4 도메인 잠금

모든 경로는 operations 예약/행 잠금 뒤 필요한 도메인 잠금만 아래 순서로 획득한다. 사용자 카드·라운드는 같은 사용자 transaction lock을 공유한다. 팬 질문 최종 저장과 입장·재입장은 **사용자 → demo clock(해당 시) → room_members → room_member_periods → 방 쓰기 잠금** 순서다. 신규 membership/period도 사용자 잠금과 유일 제약으로 직렬화한다. 입장 구간을 열거나 닫는 작업은 반드시 메시지 쓰기와 동일한 방 잠금을 획득하고 커밋까지 유지한다. 최초 greeting도 그 잠금 안에서 생성한다.

월 마감은 **demo clock → 대상 membership들 → 열린 period들 → 대상 방 쓰기 잠금들** 순서다. 여러 행/방은 각각 `(room_id,user_id)`·period ID·room UUID의 오름차순으로 잠그고, 필요한 방 잠금을 전부 얻은 뒤 상태와 입장 구간을 변경한다. 월 마감은 사용자 잠금을 역으로 얻지 않는다. 이미 방 잠금을 가진 경로가 membership/period 또는 clock 잠금을 나중에 얻는 역순은 금지한다.

답변·전체 메시지·삭제·cluster 최종 반영·필터/인사말 설정은 방 쓰기 잠금을 먼저 얻는다. 이 owner 경로의 활성 멤버십/입장 구간 확인은 **MVCC 읽기만** 사용하고 membership/period row lock을 추가로 얻지 않는다. READ COMMITTED에서 방 잠금 획득을 별도 SQL statement로 끝낸 뒤 후속 statement에서 현재 membership·기간·필터·대상 질문 상태를 다시 읽는다. 잠금 대기 전 snapshot으로 활성 팬을 판정하지 않는다. 모든 기간 변경도 같은 방 잠금을 사용하므로 이 확인부터 커밋까지 입장/퇴장 경계가 바뀌지 않는다.

방 잠금 후 필요한 상태를 재검사하고 실제 시각을 기준으로 `max(clock_timestamp(),room_settings.last_write_at + 1 microsecond)`를 그 작업의 직렬화 시각으로 확정한다. last_write_at 갱신도 같은 트랜잭션에서 수행해 시계 역보정·동일 정밀도 시각의 과거 ID UPDATE에서도 변경 cursor가 엄격히 전진하도록 한다. messages INSERT는 **identity ID 할당 전** 이 시각을 created_at/updated_at에 함께 지정한다. membership의 joined_at/left_at와 period 시작/종료도 이 방의 같은 작업 시각을 사용하고 최초 greeting은 입장 구간 시작과 같은 시각으로 생성한다. UPDATE는 created_at을 보존하고 updated_at 및 해당 시 deleted_at을 이 시각으로 정한다. 트랜잭션 시작 시각 now()를 이 경계에 사용하지 않는다. 반개구간 `[joined_at,left_at)`에 따라 입장 후 방송은 포함하고 퇴장 이후 방송은 제외한다. 같은 방의 ID 할당·변경 시각·commit 순서를 맞춰 작은 ID의 지연 commit이나 과거 시각 때문에 조회·복구에서 빠지지 않게 한다.

최종 메시지 저장과 필터 설정 변경은 같은 방 잠금 안에서 필터 version을 재검사하고 커밋까지 유지한다. 다른 방은 독립 실행한다. LLM 호출 동안 DB transaction lock을 유지하지 않는다. fixture의 messages INSERT·입장 기간 주입도 같은 순서를 따르거나 동시 사용자가 없는 초기화 단계에서만 수행한다.

## 8. AI·필터·인증 정책

### 8.1 문환P와 교환할 adapter

```ts
type Verdict = 'pass' | 'suggest' | 'block';
interface AiAdapter {
  moderateAndScore(input: {
    body:string; disabledFilters:string[]; senderType?:'user'|'influencer'; signal:AbortSignal;
  }): Promise<{
    verdict:Verdict; category:string|null; reason:string|null;
    rewrite:string|null; quality:number; rewriteQuality:number|null;
    passesAllFilters:boolean;
  }>;
  clusterQuestions(input: {
    messages:{id:MessageId;body:string}[]; signal:AbortSignal;
  }): Promise<{representative:string;messageIds:MessageId[]}[]>;
  summarize(input: {
    messages:{id:MessageId;body:string;sender:string}[]; signal:AbortSignal;
  }): Promise<string>;
}
```

홍주P는 adapter·형식검사·전송 계층, 문환P는 LLM·프롬프트·금칙어 fallback·품질을 소유한다. 팬 질문은 `senderType` 생략 시 `user`로 판정하며 답변·전체 메시지·인사말 판정에는 `influencer`를 전달한다. `passesAllFilters`는 disabledFilters와 무관하게 모든 10개 필터를 통과했는지를 나타내며 질문 인용에 사용한다. 금칙어 fallback은 전체 10개 필터 검사가 아니므로 항상 `false`다. `rewriteQuality`는 안전한 제안 문구의 품질이며 suggestion token으로 변경 없이 전송될 때 최종 question quality로 쓴다. fixture는 테스트에서 정한 입력별 결과이며 브라우저가 판정을 주입하는 API는 없다.

- Jev 키 누락·timeout·5xx·응답 형식 불량 또는 판정 전 취소는 문환P adapter의 키워드 fallback으로 처리한다. 필수 차단 항목 적중은 `block`, 선택 항목 적중은 `suggest`와 `rewrite:null`, 미적중은 `pass`다. fallback의 `quality`는 50, `rewriteQuality`는 `null`, `passesAllFilters`는 항상 `false`이며 pass만 저장한다. Claude 수정 문장 생성·재검사가 실패하거나 시한에 걸리면 `suggest`와 `rewrite:null`을 반환한다. fallback 결과는 응답에 표시하지 않고 서버 로그에는 `ai_fallback`과 `no_key`·`timeout`·`provider_error` 사유 코드만 남긴다. 메시지 본문·JWT·rewrite·키는 로그에 남기지 않는다. 유효하지 않은 최종 adapter 반환값·adapter 예외·fallback 불가 시 `FILTER_UNAVAILABLE`로 fail closed하고 저장하지 않는다. moderated 판정 adapter 시한은 8초이며 Edge 전체 처리 목표는 12초다.
- 사용자 입력을 비신뢰 데이터로 전달한다. 키·계정정보·차단 원문을 추가 문맥으로 넘기지 않는다.
- pass는 category/reason/rewrite=null, quality 0~100, passesAllFilters boolean이다. suggest는 선택 category와 rewrite null 또는 1~2000자, rewrite가 있으면 rewriteQuality 0~100을 요구한다. block은 category 필수·rewrite=null이다. adapter의 `reason`은 항상 null이며, 최종 사용자 안내는 아래 고정 문구로 만든다. 자유문장 reason은 저장·로그·사용자 응답에 사용하지 않는다. 원문을 인용할 수 있기 때문이다. 불량 category/최종 adapter 결과를 pass로 보정하지 않는다.
- metadata7일 보관. 본문/JWT/rewrite 서버로그 금지. 만료 moderation_events·operations·과거 rate_windows는 서버 전용 cleanup 및 일별 pg_cron으로 정리하고 실행 여부 검증.
- Jev/Claude adapter source는 main에 병합됐지만 실제 provider key로 호출하지 않았다. Provider unit tests는 모의 응답 기반이며 live AI 결과로 보고하지 않는다.

### 8.2 필터

| 종류 | category | 설정 |
| --- | --- | --- |
| 선택 | profanity, belittling, appearance | 방 소유자만 disabledFilters로 해제 |
| 항상 차단 | threat, stalking, sexual_harassment, privacy, hate, illegal_ad, spam | 해제 불가 |

초기 disabledFilters=[]. 선택 enum만, 중복 제거·정렬 저장, version 증가. 해제 가능한 항목은 욕설·가벼운 비하·외모 평가뿐이다. 혐오는 필수 차단이며 방 설정으로 해제할 수 없다. threat/stalking/sexual_harassment/privacy/hate/illegal_ad/spam은 항상 차단한다. 답변·전체 메시지·인사말은 선택 필터 설정을 적용하지 않고 필수 차단 7개만 검사한다. 수정 제안 문구는 선택 설정과 무관하게 10개 전부를 통과해야 한다. 질문 인용에 쓰이는 `passesAllFilters`도 선택 설정을 무시하고 10개 전부를 통과했는지 나타내며, keyword fallback 결과는 항상 false다. moderation metadata는 팬에게 공개하지 않는다. 인박스에는 pass 질문만 있다.

연속 도배는 별도 코드 제한으로 판정한다. 최근 10초 안에 5건을 초과하는 새 전송 요청이 오면 30초간 해당 사용자의 전송을 막고 RATE_LIMITED와 retryAfterSeconds를 반환한다. 동일 requestId 재시도는 새 요청으로 세지 않으며 위반 횟수에도 넣지 않는다. 프로토타입에는 위반 누적·제재 단계·재검토 절차를 구현하지 않는다.

고정 reason 매핑은 category별 문환P 계획의 문구를 사용한다. 계약 category는 선택 `profanity`, `belittling`, `appearance`; 필수 `threat`, `stalking`, `sexual_harassment`, `privacy`, `hate`, `illegal_ad`, `spam`으로 고정한다. 필수 category 판정은 block만, 선택 category 판정은 suggest 또는 block만 허용한다. disabledFilters category를 사유로 차단한 판정은 계약 오류로 거부한다. 이 10개 값은 PRD와 문환P 계획에 맞춰 일치시킨다.

`stalking` 의미는 문환P 계획 §6.2와 일치시킨다. 공개되지 않은 시간 또는 장소 중 하나만 해당해도 필수 `block`이며, 공개 장소에서 사적인 시간에 목격했다는 내용도 포함한다. 이 분류 설명은 provider 판정 문맥에 전달하고, 홍주P 계층에서는 기존 `category='stalking'`·`verdict='block'` 계약을 검증해 저장한다. SDK/RPC 입력·반환 구조는 바뀌지 않는다.

### 8.3 summarize-room·cluster-questions

JWT 인증 **방 소유 influencer만**, admin 타방 호출도 불가. 브라우저의 임의 원문 배열을 받지 않고 DB에서 source를 읽는다. 두 작업 합쳐 방1회/분·actor3회/분, 같은 requestId 재시도 추가 차감 없음.

| SDK 요청 | source·한계 | 반환data |
| --- | --- | --- |
| summarizeRoom({requestId,roomId}) | 최신pass/답변100개·총20,000자, 최신 우선 포함 후id정렬 | `{roomId,summary,sourceMessageIds,generatedAt}` |
| clusterQuestions({requestId,roomId}) | 미답변user pass 최신100개·총20,000자 | `{roomId,clusters:[{id,representative,memberCount,messageIds}]}` |

summary≤2000자, 빈 source는 summary=""/IDs=[]·LLM0회. cluster는2개 이상 묶음만, 대표문장≤200자, 메시지는 한 묶음에만. source 밖·다른방·중복ID 결과는 전체 거부. singleton cluster_id=null. Edge는 25초 `AbortSignal`을 전달하고 adapter는 20초 안에 완료한다. room AI 작업 lease는 29초이며 자동 재시도와 keyword fallback은 없다. 실패·시한 초과는 기존 결과를 보존하고 `FILTER_UNAVAILABLE`로 반환한다.

묶기 완료는 source ID의 기존 cluster_id 정리와 새 묶음을 한 트랜잭션에 반영한다. source 밖 메시지의 묶음은 유지하되 참조 수를 재계산한다. 영속 질문 구성이 1개만 남은 묶음은 해당 질문의 cluster_id를 null로 만든다. 과거 답변이 참조하는 cluster 행과 answer_question_links는 삭제하지 않고 이력을 보존하며, 참조 없는 묶음만 삭제한다. 팬의 일시 퇴장으로 활성 수가 줄어든 것은 구성을 줄이거나 해체하는 이유가 아니다. 기존 ID의 구성/대표문장이 바뀌면 version을 올리고, 답변·삭제로 열림 상태가 바뀔 때도 version을 올린다. 같은 방 작업은 직렬화한다. summary는 공개 테이블 없이 operation 결과로 캐시한다. 실패 시 기존 결과·묶음을 보존하며 자동 무한 재실행은 없다.

cluster 최종 반영 시 source 질문이 여전히 같은 방의 미답변 pass인지 다시 확인한다. AI 계산 중 답변이 생겼다면 SOURCE_CHANGED로 전체 미반영·실패 처리하고 같은 requestId의 재시도에서 source를 다시 읽는다. source가 0~1개면 묶음은 []로 반환하고 LLM을 호출하지 않는다. 새로운 질문이 추가됐다는 이유만으로 기존 source 작업을 무효화하지 않는다.

### 8.4 인증

- 본인 influencer만 신청. evidenceUrl은 HTTPS≤2048자 문자열, 임의 URL fetch 금지.
- influencer별 pending1개. 반려 후 새 requestId로 재신청. 이미 verified이면 추가 신청 거부(재인증·취소 범위 밖).
- pending만 승인/반려. 동시 검토는1개 성공.
- 승인 시 influencers.type=신청type, verified_at=서버시각. 기존 10개 라운업 인플루언서는 이미 방이 있으므로 그대로 둔다. 대기 중인 11번째 신청자는 승인과 같은 트랜잭션에서 chat_rooms를 생성해 방을 연다. 이 인물은 card_template을 만들지 않으며 기존 30개 템플릿과 추첨 풀은 유지한다. 반려는 verified_at·방 목록을 바꾸지 않는다. 신청상태·reviewer·reviewed_at·private이력 원자 갱신.
- 배지=verifiedAt 유무+influencerType. 임의 badge flag 없음.

### 8.5 인플루언서 프로필 사진

- 카드 이미지와 별도인 influencer당 사진 하나를 저장한다. 본인 계정이 인증됨 상태일 때만 인박스 설정에서 변경하며 별도 재인증은 요구하지 않는다.
- 브라우저 입력은 JPG/PNG/WebP, 5MiB 이하로 제한하고 512×512 WebP로 변환해 메타데이터를 제거한다. SDK는 **변환을 마친 실제 업로드 bytes**의 SHA-256을 계산하고, 재시도 동안 같은 bytes·digest·requestId를 유지한다. `influencer-profiles` bucket은 공개 읽기, 최대5MiB, `image/webp`만 허용한다. 변경 요청은 `<influencer_uuid>/<requestId>.webp`에 새 객체로 올려 덮어쓰지 않는다. Storage RLS의 INSERT와 `set_influencer_profile_photo` RPC 모두 private influencer_accounts 소유권 및 verified_at을 검사한다. RPC는 요청 ID와 경로의 UUID 일치, 실제 객체 존재를 확인하고 다른 influencer 경로를 거부한다. `p_content_sha256`은 소문자 64자리 hex로 형식 검증하며 경로와 함께 멱등 payload hash에 포함한다.
- 업로드 성공 뒤 응답 유실·포인터 RPC 실패가 나도 같은 requestId와 경로로 재개한다. 같은 경로의 객체가 이미 존재하거나 업로드 결과가 불확실하면 SDK는 그 **정확한 공개 객체**를 읽어 bytes의 SHA-256을 계산한다. 최초 업로드 bytes와 digest가 같을 때만 업로드 완료로 취급해 포인터 RPC를 호출/재시도한다. 다른 파일이거나 재변환 bytes가 달라진 같은 requestId는 IDEMPOTENCY_CONFLICT로 거부한다. 기존 객체 읽기·해시 비교가 실패하면 포인터를 변경하지 않고 재시도 가능한 오류를 반환하며 덮어쓰기·삭제로 해결하지 않는다. 권한/크기/MIME 오류를 객체 존재 성공으로 바꾸지 않는다. 포인터 저장 성공 뒤 응답 유실은 같은 requestId·경로·digest로 최초 RPC 결과를 복구한다.
- 이 digest 비교는 불변 객체를 사용하는 **SDK의 동일 bytes 재시도 계약**이다. DB RPC는 객체 bytes를 독립적으로 읽거나 digest가 실제 내용과 일치함을 증명하지 않는다. 서버는 소유자 전용 포인터 변경·객체 존재·경로·requestId 재사용을 검증한다. SDK를 우회해 주장한 digest도 기존 객체를 덮어쓸 권한을 주지 않는다. 별도 이미지 검증 Edge Function이나 서버 파일 내용 검증은 이번 범위에 추가하지 않는다.
- `profile_image_path`가 교체되면 room 목록·상단·인플루언서가 보낸 답변·전체 메시지·인사말 말풍선은 현재 공개 URL을 사용한다. 업로드 성공 응답으로 본인 화면의 사진 cache를 즉시 갱신하고, 다른 열린 화면은 §9.1의 3초 간격 상태 재조회가 성공하면 다음 갱신에 과거 말풍선까지 새 사진을 적용한다. `RoomCatalogItem.profileImageUrl`은 프로필 사진, 사진이 없으면 illust 카드 URL을 담고 둘 다 없으면 null이다. 화면은 null일 때 이름 첫 글자를 표시한다. 요청별 고유 경로로 교체 시 CDN이 이전 사진을 계속 반환하는 일을 막는다.
- 프로토타입은 가상 인물 사진만 허용한다. Storage 객체는 업로드 전용이며 이전 파일 정리, 운영자 삭제, 재인증 필요 상태의 잠금, 인증 취소 시 숨김과 서버 측 메타데이터 제거는 실서비스 과제다.

## 9. Realtime·Storage·Auth

### 9.1 메시지 구독

- publication에는 public.messages만. moderation·operations·비공개설정 포함 금지.
- `subscribeRoomMessages({roomId,onMessage,onStatus})`는 room_id 필터로 INSERT·UPDATE를 구독하고 `unsubscribe():void`를 반환한다. `onStatus(status,error?)`의 status는 Supabase Realtime 공식 `REALTIME_SUBSCRIBE_STATES` union인 `SUBSCRIBED | TIMED_OUT | CHANNEL_ERROR | CLOSED`다. 필터가 아닌 SELECT RLS가 권한 경계다. UPDATE는 삭제된 답변/전체 메시지를 `body=null`, `deletedAt`과 함께 전달한다.
- `SUBSCRIBED`에서는 메시지 장애 복구용 3초 폴링을 멈추고 복구를 수행한다. 현재 화면이 구독을 유지하는 동안 `TIMED_OUT`, `CHANNEL_ERROR`, `CLOSED`를 받으면 `reconcileRoomMessages`를 3초 간격으로 호출한다. 명시적 unsubscribe·화면 정리 뒤의 CLOSED callback은 무시한다. 아래 상태 재조회 timer는 이 메시지 폴링과 독립적이다.
- `reconcileRoomMessages({roomId,currentMessages,checkpoint})`는 §6.5의 SDK helper다. 고정 through까지 모든 변경 page를 읽어 id 기준 최신 updatedAt으로 upsert하고 id ASC로 정렬한 목록과 checkpoint를 반환한다. 화면은 복구 진행 중 live 이벤트를 별도 buffer에 모으고, 성공 결과와 buffer를 다시 같은 규칙으로 병합한 뒤 교체한다. 중간 실패에는 기존 목록/checkpoint를 유지하고 buffer 이벤트만 안전하게 반영한다. 복구를 중첩 실행하지 않으며 getMessageChanges 직접 호출로 화면 복구를 대체하지 않는다.
- Realtime 답변의 get_my_answer_links 보강이 실패하면 raw 이벤트를 pending buffer에 보관하고 직전 checkpoint에서 직렬 reconcile을 요청한다. SUBSCRIBED여도 pending/복구 실패가 남아 있는 동안 3초 간격으로 재시도하며, 보강·복구 성공 또는 terminal 권한/퇴장 정리 후에만 pending을 지운다. 이를 채널 장애로 위장하지 않는다. 정상 live 수신이 진행돼도 미완료 checkpoint를 건너뛰지 않는다.
- 첫 연결은 Realtime 구독·buffer를 시작하면서 `getRoomMessageCheckpoint`를 호출한다. **checkpoint 조회 완료 후** 최초 history를 시작하고 그 응답에 buffer를 병합한다. history 완료와 SUBSCRIBED를 모두 확인한 뒤 앞서 캡처한 checkpoint로 reconcile한다. history page·buffer·화면 마지막 메시지로 초기 checkpoint를 다시 계산하지 않는다. 재연결은 직전 전체 복구 완료 checkpoint를 사용한다. 명시적 null은 처음부터 조회하는 의미이며, history 더보기는 checkpoint를 전진시키지 않는다.
- 방 목록·팬 대화 화면이 보이는 동안 `getRooms()`를 3초 간격으로 재조회해 membership·재입장 자격·현재 사진 URL을 갱신한다. 게이지/월 라운드 패널은 `getMyRoundGaugeSummary()`도 같은 주기로 읽는다. 정상 SUBSCRIBED 중에도 이 상태 재조회를 유지한다. 인플루언서 인박스는 같은 주기로 getRoomInbox 첫 page를 읽어 활성 질문자 수·묶음 점수·revision을 갱신하며 revision이 바뀌면 기존 후속 page를 버린다. 인박스/설정 화면의 본인 사진은 getMyInfluencerProfile도 같은 주기로 읽어 다른 로그인 세션의 변경을 반영한다. SDK 읽기는 과거 응답을 영구 cache하지 않고 현재 RLS/집계값을 반환한다.
- focus·pageshow·화면 복귀 및 해당 화면의 라운드 완료·입장·월 경과·답변·묶기·삭제·사진 업로드 성공 직후에도 관련 상태를 재조회한다. 한 화면의 상태 재조회는 중첩하지 않고, 숨김 상태에서는 주기를 멈췄다가 복귀 시 즉시 읽는다. 다른 세션의 상태 변경은 정상 네트워크에서 다음 3초 주기 응답에 반영하며 요청 실패 시 stale 상태와 재시도 안내를 제공한다.
- 새 상태에서 membership=left이거나 메시지 호출이 ROOM_INACTIVE/FORBIDDEN/UNAUTHENTICATED이면 메시지 구독·복구 폴링·대화 cache·buffer/checkpoint를 정리하고 전송을 막는다. left의 방 목록/재입장 화면 상태 조회는 현재 세션이 유효하고 화면이 보이는 동안 유지할 수 있다. 재입장 시 새 checkpoint/history 절차로 과거 입장 구간을 다시 읽는다. UI가 정리를 늦춰도 RLS는 left의 조회와 신규 이벤트를 막아야 한다.
- 계정/방 전환·로그아웃·route 정리 시 해당 구독·timer·cache를 정리하고 세대 식별자 또는 AbortSignal로 이전 요청의 늦은 결과를 버린다. 데모 전환은 실제 signOut/signInWithPassword이며 임의 userId 교체가 아니다. 구독 정상화는 메시지 장애 폴링만 중단하고 상태 재조회는 유지한다.

### 9.2 Storage

- card-assets public read, 최대10MiB, MIME image/png·image/jpeg·image/webp.
- object path=`<influencer_uuid>/<style>.webp`, 총30개. placeholder와 최종이미지 경로 동일.
- INSERT/UPDATE/DELETE는 profiles.role=admin만. user/influencer/anon 쓰기·덮어쓰기·삭제 거부.
- 공개 이미지에 signed URL 사용 안 함. 없는 이미지의 UI placeholder 연결 예제 제공.
- 버킷·정책은 migration으로 재현. 로컬 config 선언을 원격 적용 완료로 보지 않음.

### 9.3 인플루언서 프로필 사진 Storage

- card-assets와 별도인 공개 읽기 `influencer-profiles` bucket을 만든다. 최대 크기5MiB, 허용 MIME은 image/webp다. 화면은 입력 JPG/PNG/WebP를 512×512 WebP로 변환하고 메타데이터를 제거한 뒤 업로드한다.
- 경로는 요청 ID를 파일명으로 쓰는 `<influencer_uuid>/<requestId>.webp`이며 verified 상태의 본인 influencer만 Storage RLS로 INSERT할 수 있다. UPDATE·DELETE는 허용하지 않는다. `set_influencer_profile_photo` RPC는 같은 소유권·verified 상태·요청ID/경로 일치·객체 존재·p_content_sha256 형식을 검증하고 경로와 digest를 멱등 payload에 포함한다. 재시도는 최초 요청의 같은 ID·경로·변환된 bytes·digest를 사용한다. 이미 있는 객체는 SDK가 정확한 공개 객체를 내려받아 SHA-256이 같을 때만 upload 완료로 보고 RPC부터 이어간다. 불일치에는 IDEMPOTENCY_CONFLICT, 객체 확인 실패에는 재시도 가능한 오류를 반환하며 기존 객체는 변경하지 않는다. DB가 파일 내용의 SHA-256을 독립 검증한다고 보고하지 않는다(§8.5).
- 인플루언서 계정 소유권 확인에는 private helper를 쓰고 private schema를 Data API에 노출하지 않는다. 프로필 사진은 signed URL이나 메시지별 이미지 snapshot을 쓰지 않는다.
- 데모 업로드는 가상 인물 이미지에 한정한다. 교체 후 이전 객체 정리, 서버 메타데이터 제거와 관리자 삭제는 실서비스 과제다.

### 9.4 Auth 계정 프로비저닝

로컬 script가 Auth Admin으로 userA/userB/influencer/pendingInfluencer/admin 최소5계정을 만든다. user-a@example.test 같은 비실계정 이메일 사용, 암호는 안전하게 생성하거나 환경변수로 받는다. 가입 trigger 이후 관리 연결로 role·private 매핑·demo capability 부여. seed/프론트에 암호·Admin키 금지.

**Auth 생성과 도메인 프로비저닝의 경로를 구분한다.** Auth 계정 생성/기존 계정 확인은 로컬 URL+secret key의 Auth Admin SDK로 수행한다. role·private 매핑·초기 보유량·fixture marker는 pg가 §10.3의 BB_LOCAL_DATABASE_URL로 직접 로컬 DB에 연결한 관리 SQL 트랜잭션으로 기록한다. private schema를 Data API에 노출하거나 authenticated GRANT를 늘려 해결하지 않는다. 이 관리 연결은 Node script에만 있으며 브라우저·Edge에 전달하지 않는다.

setup script는 @supabase/supabase-js와 pg만 사용하고 database.types.ts·브라우저 SDK·Next.js 코드를 import하지 않는다. URL과 DB host가 모두 loopback이며 프로젝트 로컬 포트인지 확인하고 원격 URL이면 쓰기 전에 거부한다. 같은 이메일 계정 재사용·DB marker 확인으로 중간 실패를 복구한다.

거부 테스트에는 다른 방 influencerB와 demo_accounts에 없는 일반 user를 별도 fixture로 추가한다. Auth 계정은 같은 이메일이면 재사용한다. 도메인 시연 데이터는 demo_fixture_runs의 버전 marker와 같은 트랜잭션으로 최초 1회만 주입한다. 재실행으로 카드·게이지·clock·질문·답변·신청을 덮어쓰거나 중복 생성하지 않는다. Auth API 생성과 DB 트랜잭션은 별개이므로 중간 실패 후에도 같은 계정을 재사용해 재개한다.

일반 가입은 influencer/admin을 만들지 못한다. setup은 로컬 URL만 기본 허용·반복 실행 안전. 원격 계정 생성은 대상확인·요청이 있을 때만. 암호는 검증로그 대신 로컬 비밀 저장소에 전달한다.

## 10. 시드·환경·실행 명령

### 10.1 시드와 시연 시나리오

1. seed.sql은 설정 5개·카드 라인업 가상 인물10명·30 template·10 room·room_settings 10개(인사말 설정 null이면 PRD 기본 문구 사용)·11번째 pending influencer와 verification(카드·room 없음)·demo_clock 1개를 안정적 UUID로 구성한다. 승인 전 room은10개, 승인 후 11개가 된다. 콘텐츠 upsert는 가능하지만 기존 사용자 카드·멤버십·필터·clock·변경된 game_config는 덮어쓰지 않는다. 상태·설정 초깃값은 ON CONFLICT DO NOTHING으로 넣는다.

**B-02 fictional lineup IDs (stable):**

| ID suffix | Display name | Type | Seed state |
| --- | --- | --- | --- |
| 001 | 한별 김 | tour | verified |
| 002 | 유나 박 | tour | verified |
| 003 | 서윤 최 | tour | verified |
| 004 | 지우 정 | tour | verified |
| 005 | 하린 이 | tour | verified |
| 006 | 라운드메이트 서아 | youtuber | verified |
| 007 | 스윙로그 도윤 | youtuber | verified |
| 008 | 버디샷 민준 | youtuber | verified |
| 009 | 골프리포트 은채 | media_pro | verified |
| 010 | 페어웨이 뉴스 태오 | media_pro | verified |
| 011 | 주말골퍼 선우 | tour | pending; no room/templates |

IDs use the prefix `20000000-0000-4000-8000-0000000000` and suffixes `001` through `011` (full range: `20000000-0000-4000-8000-000000000001`–`20000000-0000-4000-8000-000000000011`). Each verified influencer has `illust/retro/holo` template paths under `<influencer_uuid>/<style>.webp`. The 30 tracked WebP files under `supabase/fixtures/card-assets/` are fictional local placeholders for those exact object paths. They are not the final A-06 assets. The 11th ID is reserved for the pending account and does not enter the card lineup.
2. setup: userA는 첫 인물 illust common 10장과 이를 지급한 직전 월 rounds/draws 10건(`clock_kind='demo'`)을 갖고, 활성 membership은 없어 입장 가능·강화 가능·Buddy badge가 보인다. userB는 첫 인물 illust common 5장과 직전 월 rounds/draws 5건(`clock_kind='demo'`)으로 첫 방 active/gauge50 상태를 갖고 최초 입장 period를 갖는다. B-15 구현 뒤 별도 greeting fixture에서 최초 입장 snapshot을 준비한다. 미리 주입한 fixture 발급은 통계 표본에서 제외하되 누적 장수에는 포함한다. `forced`는 `demoForceGrade`를 실제 적용한 발급만 표시한다. 두 사용자 모두 데모 강제 등급 권한은 환경 설정에 따르며, admin만 월 진행 권한을 갖는다.
3. 같은 quality의 두 user 질문으로 정렬 차이, 답변완료1개·pending인증1개를 구성한다. 준비한 10장은 입장 자격과 강화 후에도 유지되는 누적 기록 기준을 보여 준다. 테스트는 RPC 또는 명시적 로컬 fixture setup을 사용한다.
4. userA가 10장을 강화해 같은 템플릿 rare 1장을 받아도 누적 발급 10장과 입장 자격·Buddy badge는 유지된다. 4/5회 누적 발급 경계와 퇴장 후 달력 월 라운드 0/2/3회 재입장 경계는 독립 fixture로 검증한다.
5. 전체 재현 기준은 **로컬 db reset+demo setup**. seed upsert만으로 사용자상태 전체 초기화를 약속하지 않음.

### 10.2 환경변수

| 위치 | 변수 | 규칙 |
| --- | --- | --- |
| 프론트 .env.local | NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | 처음에는 로컬 값만. §2.1 원격 값은 명시적 원격 연결 단계에서 사용 |
| Node .env.backend.local | BB_LOCAL_SUPABASE_URL / BB_LOCAL_PUBLISHABLE_KEY / BB_LOCAL_SECRET_KEY / BB_LOCAL_DATABASE_URL | 실행 중인 로컬 stack에서 수집. 로컬 setup·테스트 전용, 브라우저에 주입하지 않음 |
| CLI 저장소·셸 | SUPABASE_ACCESS_TOKEN / 필요시 SUPABASE_DB_PASSWORD | 비밀값 문서/Git 금지 |
| Edge runtime | SUPABASE_URL / SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS | 서버만, key map의 `default` 항목 사용 |
| 로컬 Edge .env | BB_LOCAL_PUBLISHABLE_KEY / BB_LOCAL_SECRET_KEY | 로컬 key fallback만. 호스트 URL·관리 DB URL은 넣지 않음. 호스팅에서는 이 fallback을 사용하지 않음 |
| Edge .env/Secrets | ANTHROPIC_API_KEY / TYPESAFE_API_KEY / ALLOWED_ORIGINS | hosted provider key는 §2.7대로 Edge 전용 Secrets에 저장하고 Deno.env에서 읽음. 미설정 시 계약된 fallback을 쓰며 live AI와 구분 |
| Edge .env/Secrets | ALLOWED_ORIGINS | localhost:3000·승인된 프리뷰 origin allowlist |

publishable key는 apikey, 사용자 access token은 Authorization Bearer. 공개키를 JWT로 보지 않는다. legacy anon/service_role key를 신규 기준으로 쓰지 않는다. 런타임 key JSON의 키 이름을 명시하고 서버 비밀모듈의 브라우저 import를 막는다.

로컬 key fallback은 자체 BB_LOCAL_* 변수로 읽어 런타임 예약 변수명을 사용자 Secrets로 덮어쓰지 않는다. **Edge의 API URL은 로컬·hosted 모두 플랫폼 SUPABASE_URL만 사용한다.** 브라우저/Node의 127.0.0.1 URL은 컨테이너 내부에서 다른 주소를 가리키므로 Edge fallback으로 쓰지 않는다. _shared 설정 계층이 플랫폼 URL과 검증된 key를 client 초기화 값으로 매핑한다. hosted에서는 플랫폼 제공 key JSON을 사용한다. local:env가 생성한 .env.backend.local과 Functions .env는 Git에서 제외하고 소유자만 읽고 쓸 수 있는 권한으로 저장한다. 로컬 키·DB URL을 터미널 로그나 검증 기록에 출력하지 않는다.

사용자 Edge는 verify_jwt=true 기본이며 handler도 user JWT를 검증한다. gateway가 선택 서명키/런타임 JWT를 처리하지 못하면 원인 기록 후에만 verify_jwt=false+getUser/getClaims 또는 공식 auth:user wrapper로 전환. 어느 설정이든 key만 가진 호출은 거부. OPTIONS는 인증 전 CORS 응답만, DB/LLM 호출 없음.

### 10.3 개발 시 실행 명령

아래 scripts를 backend 개발·로컬 검증의 기준으로 사용한다. 기존 package manager가 npm이 아니면 같은 의미로 맞춘다.

**처음부터의 순서:** package/고정 CLI 준비 → config가 없을 때만 §2.3의 init → migration·seed·Function·SDK·scripts 작성 → local:start(stack 시작+env 수집) → reset → 타입 생성 → demo setup → 정적/DB/Edge/SDK 검증이다. 실제 로컬 키는 stack 시작 전에는 요구하지 않는다. 타입 출력 디렉터리 lib/supabase도 리다이렉션 전에 생성한다.

`local:start`는 `node scripts/prepare-local-env.mjs --start`, `local:env`는 stack이 실행 중일 때 `node scripts/prepare-local-env.mjs`로 실행한다. 고정 CLI 출력은 캡처해 상태·정리된 오류만 표시하고 키 값을 로그에 복사하지 않는다. Functions `.env`가 달라지면 값을 runtime에 적용하기 위해 local stack을 중지·재시작한다(기본 stop은 로컬 data volume을 보존한다). Backend 검증은 `.env.backend.local`만 읽는다. 기존 프론트 `.env.local`이 원격 URL을 가리키면 내용을 덮어쓰지 않고 backend/Edge local 설정만 기록한다.

수집 로직은 고정 CLI의 `supabase status --output json`을 자식 프로세스로 실행해 stdout을 메모리에서만 파싱한다. 실제 출력 필드명에 맞춰 로컬 API URL·publishable key·secret key·DB URL을 정규화한다. 필수 값이 없으면 설명 가능한 오류로 중단하고 원격 URL/key·legacy 키로 조용히 대체하지 않는다.

정규화된 값으로 Node `.env.backend.local`과 Functions `.env`를 만든다. Frontend `.env.local`이 없거나 loopback을 가리킬 때만 local public URL/key를 기록한다. 원격 프론트 환경이 이미 있으면 보존하고 local backend 검증은 해당 파일을 읽지 않는다. Functions `.env`에 local publishable/secret key fallback, localhost allowlist, 명시적 local fixture flag를 넣는다. 기본 local 개발은 provider key 없이 진행하며 지정 marker로 AI 흐름을 sample 처리한다. `demo:setup`은 DB host도 loopback으로 확인한 뒤에만 `local_issue_card.sql`을 적용한다. 함수가 비어 있거나 기존 함수에 같은 local fixture marker가 있을 때만 적용하며 실제 owner 구현은 보존한다. 이 파일은 migration이 아니고 `db reset` 뒤 local setup에서 설치된다. hosted Secret을 local env로 자동 복사하지 않는다. 기존 env의 비밀값은 덮어쓰기 전에 비교하고 보존한다. URL/DB host가 loopback이 아니면 local:env와 로컬 쓰기 script가 거부한다.

```bash
npm ci
npm run local:start
npx supabase db reset
npx supabase gen types typescript --local > lib/supabase/database.types.ts
npm run demo:setup
npm run typecheck
npx supabase db lint
npx supabase test db
npx supabase functions serve --env-file supabase/functions/.env
# 별도 터미널
npm run test:backend
npm run verify:backend
```

신규 package는 npm install로 lockfile을 먼저 만든 뒤 npm ci를 사용한다. 명령 flag는 고정 CLI의 --help로 확인한다. scripts는 다음 계약으로 구현한다.

| script | 수행 내용 |
| --- | --- |
| local:start | CLI start 출력을 비로그로 캡처한 뒤 local:env 수집 로직 수행. Docker/서비스 오류를 비밀값 없이 보고 |
| local:env | 위 로컬 연결 값 수집·env 생성. 관리 키를 로그에 출력하지 않음 |
| demo:setup | Node의 --env-file=.env.backend.local로 실행하는 독립 .mjs. 로컬 Auth Admin과 pg로 계정/시나리오 준비 |
| typecheck | tsc --noEmit -p tsconfig.backend.json으로 Node/SDK/tests 검사 후 별도 deno check로 Edge 검사. Node tsc에 Deno import를 섞지 않음 |
| test:backend | tsx 기반 Node 테스트로 SDK·권한·동시성 검증, 별도 deno test로 Edge 단위 계약 검증. DB pgTAP은 위 supabase test db에서 실행 |
| verify:backend | .env.backend.local만 사용해 실행 중인 로컬 Functions·Auth·DB·Realtime의 P0/P1/P2 스모크. 위 단위 테스트의 반복 실행으로 대체하지 않음 |

명령 실패는 exit code로 반영한다. database.types.ts는 reset 후 실제 schema에서 생성하며 setup을 위해 임시 수기 타입을 만들지 않는다. demo setup과 local:env는 생성 DB 타입·브라우저 코드에 의존하지 않는다.

Docker가 없으면 코드·테스트 작성과 정적검사를 계속하고 런타임 미검증으로 기록한다. 원격 DB를 테스트 대용으로 reset하지 않는다.

## 11. 티켓·수행 순서

P0/P1/P2는 PRD 순서이며 전체완료 요청에서 P2를 임의 제외하는 기준이 아니다. B-12는 AI 전송계층, B-13은 전체 검증, B-14는 마지막 P2 순서인 influencer 프로필 사진 지원이다.

| ID | 산출물 | 티어·선행 | 완료 기준 |
| --- | --- | --- | --- |
| B-01 | root bootstrap → toolchain·CLI고정·schema/Auth/RLS/grants | P0/없음 | 첫 1시간 안에 package/lockfile·lib·supabase 뼈대를 main에 올려 F-01 시작 가능. 이후 schema/Auth/RLS·가입user·metadata무시·reset·역할검증 진행 |
| B-02 | seed·placeholder·계정script | P0/B-01 | 10인/30template/10방+11번째 pending·5계정·반복안전·비밀없음 |
| B-03 | complete_round·config·멱등·cards SDK + private.issue_card 연동 | P0/B-01,02,A-09 계약 | issue_card를 같은 transaction에서 호출·강제등급권한·재시도·오류 rollback·4→5회 entryUnlocked·5→6회 false. 추첨 경계/1,000회 분포는 A-09 |
| B-04 | collection/inventory_view·upgrade_card·SDK | P0/B-03 | 9/10장·special·동시차감·템플릿 30종/보유 등급별 수량 |
| B-05 | room_catalog·join_room·입장 기간·SDK | P1/B-04 | 누적 4/5회 입장·카드 준비 중·월 0/2/3회 재입장·입장 기간 시작/종료·재입장 시 과거 기간 재개 |
| B-06 | 내부저장RPC·submit-message·SDK·Realtime | P1/B-05 | JWT·3판정·직접우회 거부·제안 소비/저장 원자성·입장 기간 RLS·전송 중 권한 변경·checkpoint/through 복구·답변 isReplyToMe 보강 |
| B-07 | demo_clock·월마감·getMyRoundGaugeSummary·SDK | P1/B-05 | 2/3/4회 게이지 변화·입장/재입장 월 정산 제외·중복 1회 마감·같은 월 3회 재입장·별도 세션 상태 조회로 퇴장/구독 정리 |
| B-08 | 점수·inbox·filtered reply·SDK | P1/B-06 | 배지/스타일 snapshot·묶음 조회/최고 점수/활성 고유 수·revision 페이지·예상 묶음 version·불변 답변 링크·MESSAGE_BLOCKED·KST 오늘 차단 수·소유권 |
| B-09 | 신청·심사·이력·SDK | P2/B-01,02 | pending UQ·동시검토·배지일관·승인 시 11번째 방 생성 |
| B-10 | filters/config·version·cleanup | P2/B-06 | 필터 선택/항상차단 분리·도배제한·소유권·version·7일정리 |
| B-11 | 연결·환경·배포·복구runbook | P0/B-01 | 로그인·권한 구분·고정 ref·migration/seed/Functions/Secrets/Auth/Storage/Realtime·스모크·복구 절차 |
| B-12 | cluster/summary·작업RPC·adapter | P2/B-06,08 | 미답변 질문만 묶기·답변된 묶음 닫기·구성 변경 version·일시 퇴장 시 이력 유지·대표문장/활성 질문자 수의 영속 조회·source 검증·실패 보존 |
| B-13 | 테스트·SDK통합·증거·인계예제 | 전구간/각티켓 | §12 통과·모의/실제·로컬/원격 구분 |
| B-14 | influencer profile photo bucket·SDK·RPC | P2 마지막/B-01,B-09,B-17 | 입력 5MiB/JPG·PNG·WebP→WebP·고유 경로/digest 재시도·verified owner·과거 말풍선 사진·본인 즉시/타 세션 상태 조회 반영·fallback |
| B-15 | 인사말 조회·설정 Edge·첫 입장 snapshot | P2/B-05,B-10 | 200자·필수 필터/MESSAGE_BLOCKED·차단 시 기존 문구 유지·빈 값 reset·최초 1회·재입장 미발송 |
| B-16 | influencer broadcast Edge·SDK | P2/B-05,B-08,B-10 | 필수 필터/MESSAGE_BLOCKED·방 잠금 후 생성 시각의 active 팬만 열람·입장 기간 RLS·실시간 전달 |
| B-17 | influencer answer/broadcast soft delete·Realtime UPDATE | P2/B-08,B-16 | 본인 answer/broadcast만 삭제·삭제 표시 실시간 반영·답변 삭제 시 질문/묶음 재개방·greeting/팬 메시지 불가 |

순서:

점수 계산 SQL helper는 메시지 저장에 필요하므로 B-06에서 먼저 구현한다. B-08은 그 helper의 공식·정렬 검증과 inbox/reply 기능을 완성한다. B-06이 아직 없는 B-08 함수를 기다리거나 임의 점수로 저장하지 않는다.

1. B-01 root bootstrap을 1일차 오전 첫 1시간 안에 main에 올린 뒤 F-01을 시작한다. B-01 schema/Auth/RLS는 F-01과 병행하고 완료를 기다리게 하지 않는다. B-02 계정/setup은 필요한 schema 뒤에 진행하며 B-11 연결·환경 안내는 병행한다.
2. B-03→B-04→P0 SDK 통합(Auth→draw→collection→upgrade).
3. B-05→B-06→B-08→P1 SDK 통합(join→판정→Realtime→inbox→reply).
4. B-07 연결→퇴장·신규이벤트거부·퇴장 효력 월 3회 달성 후 재입장.
5. P2는 PRD 순서대로 B-09 인증 → B-12 유사 질문 묶기 → B-12 대화 요약 → B-10 필터 설정 → B-15 인사말 → B-16 전체 메시지 → B-17 influencer 답변/전체 메시지 삭제 → B-14 프로필 사진 순으로 구현한다. 실제 AI가 없어도 fixture 계약을 구현한다.
6. P2 마지막 B-14 이후 B-13→fresh reset 재검증→SDK 인계. 원격조건·요청 충족 시 B-11 적용, 팀화면 리허설2회.

일정 참고: 1일차 오전 기반·추첨, 오후 강화·입장·전송, 저녁P0, 밤게이지·인박스. 2일차 오전인증·필터·AI계층, 점심P1, 오후수정·동결·리허설. 생략한 티켓은 완료로 표시하지 않는다.

migration 순서: core/config→private/Auth→RLS/helpers→문환P A-09 `issue_card`→cards/views의 `complete_round`→rooms/month→messages/score/inbox→verification/filters/config→AI/cleanup→Storage/Realtime. `issue_card`는 private/Auth 이후, `complete_round` 전에 추가한다. B-01 병합 전에 만든 migration은 B-01 병합 후 타임스탬프 순서를 다시 확인한다. CLI로 기존 파일과 충돌 없는 이름을 만들고 적용된 migration은 수정하지 않고 새 migration으로 보완한다.

## 12. 필수 검증

| 묶음 | 사례·합격 조건 |
| --- | --- |
| 재현 | 빈 로컬 DB에서 migration+seed+setup 및 재실행 성공. 타입 검사·DB lint 통과 |
| 초기화·env | supabase/·예제 env 없는 상태에서 절차로 생성 가능. stack 시작 후 로컬 키 수집, Node/브라우저와 Edge URL 분리, 원격 host 쓰기 거부, 비밀값 비출력 확인 |
| 역할 | anon/userA/userB/방 소유자/다른 influencer/admin 각각 허용·거부 확인. 가입 metadata의 admin/demo 값 무시 |
| 오늘 차단 집계 | KST 날짜 경계·해당 방의 고유 block request만 계산, suggest 제외, keyword fallback block 포함, 차단 원문 미저장, verified 소유자만 조회·타 방 거부 |
| 지급 | 같은 requestId 20회 병렬 호출 시 round/draw 각 1개·카드 +1. 다른 payload 재사용 거부. 누적 4→5회 발급만 entryUnlocked=true, 5→6회는 false. 같은 template 최초 동시 지급의 isNew=true는 정확히 1개 |
| 강화 | 9장 거부·10장 성공·special 거부. 10장에 서로 다른 요청 2개 병렬 호출 시 1개 성공·1개 부족. 음수·부분 지급 없음 |
| 발급 연동 | complete_round가 A-09 private.issue_card를 같은 transaction으로 한 번 호출하고 재시도 시 최초 결과 반환. 일반 user·꺼진 force 설정·권한 없음은 FORBIDDEN과 draw 없음. 4→5회 entryUnlocked true·5→6회 false. 확률 경계와 1,000회 분포는 A-09 증거를 검토하고 중복 구현하지 않음 |
| 입장 | 누적 발급 4/5회 경계·카드 미소모·강화 후 자격 유지. 퇴장 후 해당 월 0/2/3회 재입장 경계와 gauge50 초기화. eligible면 left인 모든 방을 입장 가능. 카드 템플릿 없는 방은 "카드 준비 중"으로 입장 거부 |
| 월 | 정산 대상 월은 기준3회에서 2회면 -12.5·3회면 유지·4회면 +12.5, 8회에서 최대100. 입장/재입장 월은 라운드 0/2/4회 모두 증가·감소 없이 완전 제외. getMyRoundGaugeSummary의 유효 월·전체 라운드 수·목표·잔여 회수 확인. 게이지12.5 이하 인앱 경고, 같은 월 병렬 요청 마감 1회, 월 마감·라운드 저장 경합과 비데모 데이터 보존 확인 |
| 메시지·기간 | 팬은 자기 질문·현재/과거 본인 입장 기간의 influencer 메시지만 조회. 입장 전·퇴장 기간의 전체 메시지와 다른 팬 질문은 차단. 재입장 후 과거 기간 복귀, 퇴장 중 내 질문의 답변은 재입장 후만 예외 조회. greeting은 최초 1회 수신자/본문 snapshot, 재입장 재전송 없음 |
| 안전·인용 | pass만 저장. optional 필터가 꺼져 있어도 질문 passesAllFilters=false이면 답변 인용문을 다른 팬에게 숨김. 항상 차단 7개(hate 포함)는 설정으로 끌 수 없음. suggestion은 10분·1회·본문 hash 일치 시 재검사 없이 rewriteQuality 사용, 수정 문구는 새 판정. fallback pass quality=50, 모든 fallback의 passesAllFilters=false, 선택 항목 fallback은 suggest/rewrite null, 필수 항목 fallback은 block |
| influencer 발송·삭제 | 답변·전체 메시지·인사말 설정에 필수 필터. 전체 메시지는 작성 시 active 팬만 열람. 답변/전체 메시지 삭제는 body null + UPDATE, greeting/팬 메시지 삭제 거부. 답변 삭제 뒤 질문/묶음 미답변 복귀 |
| 신뢰 | JWT 없음·만료·위조·key만 가진 요청 거부. 내부 RPC 직접 호출·직접 INSERT·actor/verdict/quality 위조 거부 |
| AI 장애 | Jev timeout·키 누락·5xx·응답 형식 불량은 keyword fallback. fallback block은 오늘 차단 집계에 포함하며 fallback 여부를 분리한 위반 누적은 실서비스 과제. 불량 최종 adapter 반환값·예외·fallback 불가 때 FILTER_UNAVAILABLE·저장 없음. moderateAndScore 8초, cluster/summary adapter 20초·Edge signal 25초·lease 29초, 자동 재시도 없음. 판정 중 퇴장·필터 변경 거부 |
| 인박스 | PRD의 Badge+style bonus 점수 예시·과거 snapshot 불변. 동점 페이지 중복·누락 없음. 타방·답변 대상·중복 답변 거부 |
| Realtime | 두 세션 송수신, 타방·left 이벤트 차단, 초기 버퍼 중복 제거, INSERT 복구, 오프라인 중 삭제된 오래된 행의 updated_at cursor 복구, 삭제 UPDATE의 삭제 표시 반영, 계정 전환 정리, 폴링 중단. 큰 bigint 문자열과 동일 방 동시 전송도 확인 |
| 인증 | 본인 신청만 허용·pending 중복 거부. 승인/반려 경합 1회 성공. type·배지·이력 일관. 승인 시 11번째 방 생성, 카드 템플릿 30개 불변. 증빙 URL fetch 없음 |
| 필터·보관 | 선택 필터만 해제 가능, 항상 차단과 도배 규칙은 유지. 6번째 전송/10초 경계와 30초 차단, requestId 재시도 중복 미계수. version 충돌·저장 경합 및 만료 metadata/operations/rate window/suggestion token 정리 |
| 묶기·요약 | 소유자만 허용, source 밖·중복 ID 거부, 길이·호출 제한. 빈 source는 AI 0회. singleton 제외·처리 중 답변이면 SOURCE_CHANGED·실패 시 기존 결과 보존 |
| Storage | card-assets 관리자 쓰기 경계, profile photo 조회·verified owner 전용 WebP 업로드, 5MiB/MIME·고유 경로·덮어쓰기 거부, 가상 이미지 교체의 과거 답변/전체 메시지/인사말 반영, 카드 일러스트/이름 fallback 확인 |
| 노출 | 번들·Git·fixture·로그에 secret/JWT/암호 없음. private 비노출·민감 RPC의 PUBLIC 실행 금지·권한 상실 후 캐시 조회 거부 |
| 제안 수락 원자성 | token 검증·소비 직후 실패 주입 시 token 사용·메시지·operations 성공이 함께 롤백. 같은 수락 requestId의 성공 응답 유실/재시도는 최초 결과 복구. 다른 requestId의 동시 소비는 재검사 생략 저장 1회만 성공. 만료·사용·본문 불일치 token은 소비 없이 일반 판정, 판정 실패 시 미저장. token 원문 DB/cache/로그 미보관 |
| 메시지·입장 시각 경계 | 방 잠금 대기 중 입장/월마감 퇴장과 방송/답변을 경합시켜 잠금 후 시각·반개구간 기준 포함/제외 확인. 최초 greeting 시각=period 시작, created_at=updated_at 및 ID 할당 순서 확인. 같은 실제 시각/역보정 모의에서 과거 ID UPDATE도 last_write_at보다 전진. owner 경로의 membership row lock 역순 없음, 여러 방 월마감·입장·팬 전송·owner 발송 병렬에서 deadlock/기간 겹침/변경 cursor 누락 없음 |
| 게이지 설정 경계 | start=0·max=0·start>max·delta=0/0.01/100 초과 거부, 설정 값/version 불변. start=max>0·delta=0.1/12.5/100 허용 및 실제 저장 정밀도 유지. 거부 설정으로 입장/정산 상태가 부분 변경되지 않음 |
| 프로필 업로드 복구 | 업로드 성공 뒤 응답 유실·RPC 실패·RPC 성공 응답 유실을 각각 재현하고 같은 bytes/ID/경로/digest로 복구. 같은 requestId의 다른 File/bytes/digest 거부, 기존 객체 확인 실패 시 포인터 보존, UPDATE/DELETE 없이 재개. SDK digest 비교와 DB의 경로/소유권·객체 존재·멱등 payload 검증을 구분 |
| 복구 checkpoint 경합 | checkpoint 50 확보→history→구독 성립 전 51~99 생성→live 100 수신 경합에서 전부 복구. live 100으로 checkpoint 전진 금지, 고정 through로 pagination 종료, 중간 page 실패/상한 조회 실패는 checkpoint 보존. 복구 중 오래된 답변 삭제와 최신 live 이벤트를 합쳐도 본문이 되살아나지 않음. SUBSCRIBED 중 답변 보강 1회 실패도 pending 재시도로 복구 |
| 묶음 인박스·답변 이력 | 새로고침 후 대표문장/활성 고유 수/최고 점수/최근 동점 ID 재현. 활성 1명은 유지·0명은 숨김·재입장 복원. revision 변경 시 page 재시작, 같은 ID의 구성 version 변경은 SOURCE_CHANGED. 묶음/개별 동시 답변 중복 거부. 삭제→재묶기 후에도 불변 링크로 isReplyToMe·퇴장 기간 답변 예외와 원래 reply_context 유지. 팬에게 타 질문 ID/링크 원본 미노출 |
| influencer 차단 응답 | 답변·전체 메시지·인사말에 MESSAGE_BLOCKED/category/고정 reason 반환. 메시지 미저장·설정/version 불변·원문 미반환, 같은 requestId는 동일 안전 오류, 수정 후 새 requestId는 재판정 |
| 별도 세션 상태 갱신 | messages가 없는 동안 admin 월 경과→팬의 정상 SUBSCRIBED 상태에서도 다음 상태 재조회로 gauge/left 반영·전송 차단·구독/cache 정리. 11월 마감→12월 퇴장→12월 0/2회 거부·3회 재입장, 지난 월 3회 이월 금지. 사진 변경·묶음 팬 퇴장/재입장도 다음 3초 상태 조회 성공 때 반영. 로그아웃/계정·방 전환 후 늦은 응답 무시·timer 누수 없음 |

실제 역할/JWT/RPC 경계로 검증한다. 관리자 직접 쓰기만으로 대체하지 않는다. 보안 거부 사례가 실패하면 시연이 되어도 미완료다. 명령·결과·환경·실패 원인을 기록한다.

## 13. 원격 적용·인계·복구

이 절은 실제 원격 적용 기준과 진행 증거다. `md 파일 기반으로 개발 시작해`는 B-01~B-17 로컬 구현·검증의 지시이며, 이 대화의 별도 요청에서 사용자가 §2.1 프로젝트 `main / PRODUCTION` 직접 적용도 허용했다. 범위는 아래 원격 적용 요약에 기록한다.

### 13.1 원격 작업 범위와 사전 조건

적용 전 작업 기록에 대상 ref, 환경, 작업 commit, 예상 migration, 실행할 function, 필요한 Secret **이름**, Auth URL 변경, Storage/Realtime 변경, seed/이미지/계정 단계, 백업 위치, 확인 담당을 남긴다. 비밀값이나 토큰은 기록하지 않는다. 2026-11-11 사용자가 §2.1 ref의 `main / PRODUCTION`에 직접 반영하라고 지정했다. 사전 조회에서 프로젝트 상태는 ACTIVE_HEALTHY·PostgreSQL 17.11이고, public/private 테이블·migration·Edge Function·Auth user·Storage object는 비어 있었다.

- 원격 적용 대상은 `kjfaqfpvfvgbrvdoosyi`인지 매번 확인한다. 사용자가 지정한 이번 직접 적용 대상은 main/PRODUCTION이며, 다른 ref/프리뷰/운영은 별도 대상 승인 없이 연결하지 않는다.
- 변경 범위는 reviewed migration과 필요한 함수(`submit-message`, `send-influencer-message`, `update-room-greeting`, `summarize-room`, `cluster-questions`)로 제한한다. 문서상 예정 함수 목록을 실제 배포 완료로 보지 않는다.
- `local_issue_card.sql`, `BB_USE_LOCAL_AI_FIXTURE`, fictional local seed/Auth/Storage setup은 hosted environment에 적용·배포하지 않는다. Jev/Claude provider adapter source는 main에 병합됐지만 live 호출·Edge 배포는 미검증이다. 키 부재 시 계약된 moderation fallback을 쓰며 provider 호출 오류는 `FILTER_UNAVAILABLE`로 변환한다.
- 현재 schema, migration history, DB major version, 기존 함수/Secret 이름, Storage bucket/object, `messages` publication, Auth URL/redirect, 기존 사용자와 데이터를 읽어 baseline을 만든다. 소유되지 않은 기존 구조와 이력은 임의로 채택·삭제·repair하지 않는다.
- §12의 로컬 migration/권한/Function 검증을 통과한 commit을 대상으로 한다. 사용 중인 DB와 호환성을 확인하고, 기존 사용자/Storage 데이터가 있으면 복구 백업과 기존 Function 소스를 확보하지 못한 상태로 쓰기 단계에 넘어가지 않는다. 사전 조회로 두 데이터가 모두 비어 있음을 확인한 신규 설치는 이를 기록하고 계속할 수 있다.
- 실제 Jev 검증에는 `TYPESAFE_API_KEY`, Claude suggest/summary 검증에는 `ANTHROPIC_API_KEY`가 필요하다. 전체 AI 경로의 시연 검증은 §2.7에 따라 두 hosted Secrets를 설정하고 호출량/비용 조건을 확인한 뒤 수행한다. 키가 없을 때는 문환P adapter의 계약된 fallback을 쓰며 실제 모델 판정으로 보고하지 않는다. 키가 없다고 fail-closed만 하지는 않으며 fallback pass는 PRD대로 quality 50으로 저장한다.

### 13.2 인증 및 읽기 전용 preflight

1. CLI가 계획의 고정 버전 `supabase@3.0.0`인지 확인하고, 사용할 `link`, `migration list`, `db push`, `functions deploy`, `secrets set`의 `--help`를 다시 읽는다. Supabase CLI v3에서 원격 명령은 `--remote=<project-ref>` 형식으로 대상 ref를 지정한다. v2 예시나 축약된 `--linked` 옵션을 그대로 복사하지 않는다.
2. §2.5의 Supabase 계정/PAT와 프로젝트 권한을 확인한다. DB 암호는 CLI가 요구할 때만 보호된 셸/보안 저장소에서 공급한다. PAT·DB 암호를 명령행 인수로 붙이거나 로그에 출력하지 않는다.
3. known ref를 연결한 다음 읽기 전용 프로젝트·migration 상태를 확인한다. `projects list`는 계정 전체 프로젝트 조회 권한이 필요할 수 있어 대상 접근 확인의 필수 조건으로 삼지 않는다.

```bash
# 미래 실행 예시. 현재는 실행하지 않음. 로그인/권한 확인 뒤 read-only 조사.
npx --yes supabase@3.0.0 link --project-ref kjfaqfpvfvgbrvdoosyi
npx --yes supabase@3.0.0 migration list --remote=kjfaqfpvfvgbrvdoosyi
npx --yes supabase@3.0.0 db push --remote=kjfaqfpvfvgbrvdoosyi --dry-run
```

CLI의 출력 대상과 대시보드 ref가 일치하지 않으면 즉시 중단한다. 원격 migration history와 로컬 파일이 충돌하거나, 예상 밖 migration/기존 schema 차이/DB 버전 불일치가 있으면 `db push`를 진행하지 않는다. 수동 baseline 또는 `migration repair`는 별도 검토된 변경으로 다룬다. dry-run 결과와 목록을 비교해 추가/변경될 migration 및 데이터 영향을 승인 범위와 대조한다.

### 13.3 Auth URL과 hosted Secrets 준비

- 로컬 `supabase/config.toml`은 개발용 `localhost`·이메일 확인 설정을 포함하므로 원격에 통째로 push하지 않는다. `config push`가 필요한 경우 먼저 현재값과 계획값의 차이를 항목별 검토하고 승인된 Auth URL/redirect/CORS 설정만 반영한다. hosted confirmation 정책을 로컬 설정값으로 낮추지 않는다.
- Auth `site_url` 및 redirect allowlist는 배포할 실제 origin만 설정한다. `localhost`, 임의 wildcard, 확인되지 않은 프리뷰 URL을 운영 allowlist에 추가하지 않는다. 브라우저 Auth 동작은 실제 공개 배포 origin과 로그인 세션으로 별도 확인한다.
- Functions Secrets는 프로젝트 전역에서 여러 함수에 영향을 줄 수 있으므로 기존 Secret 이름과 사용 함수를 먼저 확인한다. Edge platform이 제공하는 `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`는 존재 여부만 확인하고 직접 덮어쓰거나 사용자 Secret으로 만들지 않는다. `SUPABASE_*` 예약 이름, PAT, DB 암호, 로컬 `BB_LOCAL_*` 키는 hosted custom Secrets에 넣지 않는다.
- hosted custom Secrets의 provider key는 §2.7대로 `TYPESAFE_API_KEY`와 `ANTHROPIC_API_KEY` 두 이름으로 설정한다. 키 값은 이 문서·명령행 인수·Git·일반 로그에 적지 않고, 채팅 등에 노출된 값은 회전/재발급 후에만 저장한다. 정확한 `ALLOWED_ORIGINS`는 별도 설정이다. 로컬 mock/테스트 fixture를 원격에 복사하지 않는다. provider key는 schema/Edge 배포 및 fallback 경로의 선행 조건은 아니지만, 실제 AI 검증과 전체 AI 시연 경로에는 필요한 조건이다.
- scoped PAT 또는 DB 암호를 Functions runtime Secret으로 저장하지 않는다. secret key도 플랫폼에서 제공되는지 먼저 확인하고, 제공되지 않을 때만 승인된 서버용 값을 보호 경로로 공급한다.

### 13.4 DB migration과 선택적 초기 데이터

먼저 §13.2의 원격 dry-run으로 대상과 변경 목록을 재확인한다. migration이 예상대로만 추가되고, 현재 원격 schema와 호환되며 백업/복구 기록이 있을 때에만 사용자 승인 범위 안에서 적용한다. `--dry-run`은 실행 대상/변경 목록 확인이지 seed SQL의 각 데이터 결과를 검증하는 것은 아니다. seed 내용을 별도로 검토한다.

```bash
# 미래 실행 예시. --yes는 scope가 승인된 비대화형 변경에만 사용.
# reviewed schema migration만 반영할 때:
npx --yes supabase@3.0.0 db push --remote=kjfaqfpvfvgbrvdoosyi --yes

# 비밀값이 아닌 §10.1 seed를 이 환경에 넣기로 명시적으로 승인한 경우에만,
# seed SQL의 데이터 영향도 검토하고 seed 포함 dry-run을 다시 확인한 뒤 적용한다.
npx --yes supabase@3.0.0 db push --remote=kjfaqfpvfvgbrvdoosyi --include-seed --dry-run
npx --yes supabase@3.0.0 db push --remote=kjfaqfpvfvgbrvdoosyi --include-seed --yes
```

`db push`는 기본적으로 `seed.sql`을 자동 실행하지 않는다. `--include-seed`는 현재 CLI 설정의 seed 파일을 실행하므로 첫 해커톤 데이터 투입처럼 환경·데이터 내용·멱등 동작을 검토하고 명시적으로 허용한 경우에만 사용한다. schema migration과 seed 검토/결과를 별도 기록한다. §10.1의 `ON CONFLICT` 규칙은 기존 카드·membership·필터·clock/game 설정을 임의 덮어쓰지 않도록 지켜야 한다. local `setup-demo-accounts.mjs`, Auth fixture 사용자, 로컬 카드·메시지 데이터는 원격에 실행하지 않는다. 원격 데모 계정은 이름이 지정된 별도 데모 환경과 작업 요청이 있을 때만 Auth Admin으로 따로 만들며 운영 사용자를 덮어쓰지 않는다.

### 13.5 Functions·Storage·Realtime 반영

Migration 성공과 DB health 확인 후 승인된 함수만 배포한다. v3 hosted mutation에는 `--yes`를 명시하고 매 호출에 동일한 원격 ref를 넣는다. `--prune`은 다른 함수 삭제 위험이 있으므로 routine deploy에서 사용하지 않는다. `verify_jwt`를 끄거나 gateway 검증을 우회하지 않는다.

```bash
# secrets file은 비추적/보호 경로에만 만들고 승인된 이름만 포함한다.
npx --yes supabase@3.0.0 secrets set --env-file "$FUNCTIONS_REMOTE_ENV_FILE" --remote=kjfaqfpvfvgbrvdoosyi --yes

npx --yes supabase@3.0.0 functions deploy submit-message --remote=kjfaqfpvfvgbrvdoosyi --yes
npx --yes supabase@3.0.0 functions deploy send-influencer-message --remote=kjfaqfpvfvgbrvdoosyi --yes
npx --yes supabase@3.0.0 functions deploy update-room-greeting --remote=kjfaqfpvfvgbrvdoosyi --yes
npx --yes supabase@3.0.0 functions deploy summarize-room --remote=kjfaqfpvfvgbrvdoosyi --yes
npx --yes supabase@3.0.0 functions deploy cluster-questions --remote=kjfaqfpvfvgbrvdoosyi --yes
```

`FUNCTIONS_REMOTE_ENV_FILE`은 보호된 파일 경로로 작업 실행 환경에서 공급한다. 여기에 값을 직접 출력하거나 이 문서에 경로/내용을 저장하지 않는다. Secrets 업데이트 전에 기존 함수의 사용 영향과 Owner/Administrator 변경 권한을 확인한다.

Secrets 변경은 통상 즉시 runtime에 반영되며 함수 재배포가 필요하지 않을 수 있다. CLI `secrets list` 등으로는 이름/메타데이터만 확인하고 값을 출력하지 않는다. Secret 변경은 프로젝트의 기존 함수에도 영향을 줄 수 있으므로 기존 사용 여부를 확인한다. 전체 삭제 명령을 쓰지 않는다.

두 Storage bucket과 RLS 정책, `messages` Realtime publication은 승인된 migration을 통해 반영·확인한다. `realtime` 관리 schema 자체는 만들거나 수정하지 않는다. 정책이 성공해도 object 파일 업로드는 별도 작업이다. 실제 placeholder/가상 프로필 이미지 object는 승인된 경로와 덮어쓰기 규칙을 검토한 후 별도로 넣는다. Auth 사용자 생성, 인증 redirect, Storage object, Realtime publication을 migration만으로 자동 준비됐다고 간주하지 않는다.

### 13.6 원격 스모크와 완료 증거

배포 후 app publishable key + 실제 사용자 JWT로 본인/타 사용자/방 소유자/관리 역할을 검증한다. 서버 secret key로 RLS 스모크를 대신하지 않는다. 비파괴 요청 ID로 인증·RLS·RPC·Edge JWT·멱등성·fail-closed·Realtime 분리를 확인하고, 테스트용 remote demo user가 필요하면 명시된 해커톤 환경에 한정해 별도 준비한다. 원격 `reset`, 로컬 setup script, 기존 사용자로 데이터 오염을 만드는 smoke는 금지한다.

- migration history와 원격 schema 상태가 의도한 commit과 일치한다.
- 다섯 사용자 호출 함수의 배포 대상/ref·버전·JWT 설정을 확인하고 사용자 없는 요청/잘못된 JWT가 거부된다.
- Secrets는 이름만 확인하며 실제 키가 필요할 때만 기능 호출로 검증한다. fixture 통과를 live AI 증거로 기록하지 않는다.
- RLS/RPC를 두 사용자 세션으로 확인하고 Realtime에서 타 사용자/left member 정보가 오지 않는지 확인한다.
- card-assets 공개 읽기·관리자 쓰기, influencer-profiles 공개 읽기·인증된 소유자 업로드·타 인플루언서 덮어쓰기 거부, Auth origin/redirect를 확인한다. 기존 운영 데이터에 대한 cleanup/삭제 스모크는 하지 않는다.
- 작업 commit, CLI 버전, ref, migration 목록, deployed function 이름/시점, Secret 이름(값 금지), 테스트 역할·결과·오류·미실행 항목을 `harness/verification-log.md`에 기록한다.

로그인 확인, 프로젝트 ref 접근, DB dry-run, 실제 migration, Function 배포, Secrets 반영, Storage/Auth/Realtime 설정, 실제 JWT 스모크, live AI 호출은 각각 독립된 증거다. 한 단계 성공을 나머지 완료로 묶지 않는다. 전체 범위 중 미실행 조건이 있으면 원격 적용 완료로 보고하지 않는다.

### 13.7 부분 실패·복구

단계가 실패하면 추가 쓰기를 멈추고, 어떤 migration·Function·Secret·Auth/Storage 설정이 적용됐는지와 에러를 비밀값 없이 기록한다. migration이 적용된 뒤에는 수정/이력 삭제/reset으로 되돌리지 말고 새 보정 migration으로 전진 복구한다. 확장 후 축소가 필요한 경우 호환되는 두 단계 변경과 데이터 변환 복구안을 검토한다. Function은 이전의 확인된 정상 commit과 동일한 JWT 정책으로 재배포한다. 잘못된 Secret은 이름/영향 함수를 확인한 후 검증된 값으로 교체·회전하며 전체 Secret을 일괄 삭제하지 않는다. Auth URL 설정은 기록한 기존값으로 복구한다. DB 백업 복구는 영향·시점·다른 팀 데이터 손실 범위를 확인한 뒤 별도 승인된 recovery 절차로만 한다.

### 13.8 프론트 인계

Vercel 등 프론트 호스팅을 실제로 사용할 때 공개 URL과 publishable key만 해당 환경의 공개 환경변수에 둔다. Supabase PAT, DB 암호, secret key, provider key는 프론트 변수에 두지 않는다. URL/key 설정은 백엔드 DB·Functions 배포와 구별해 기록한다. 화면 코드와 배포 요청이 없으면 SDK export·타입 인계까지만 하고 프론트 원격 배포 완료로 보고하지 않는다.

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

### 13.9 PR #14 화면 SDK 인계 확인

2026-11-11 PR #14 본문에서 홍주P에게 요청한 SDK 타입 대조, 데모 계정 매핑, UI 패키지 결정을 현재 `lib/api`와 `npm run demo:setup` 기준으로 확인했다. 별도 리뷰 댓글·스레드는 없었다.

- **패키지 결정:** 해커톤 기간에는 안 A를 사용한다. `BirdieBuddy-ui/`는 Next.js 16·TypeScript 5.9 패키지로 유지하고, 루트 Node 24·TypeScript 7 백엔드 도구 체인에 Next 의존성을 섞지 않는다. API 런타임과 타입의 단일 원본은 루트 `lib/api`다. 프론트 패키지에서 이 코드를 참조하는 방법과 Vercel 빌드 범위는 배포 전 확인한다. 현재 선택만으로 UI 통합·배포 완료를 뜻하지 않는다.
- **타입 비교:** `UUID`, `MessageId`, `Result`, `Page`, `Membership`, `SupportBadge`, `RoomCatalogItem` 등 기본 타입은 대체로 일치한다. UI 목업의 `Message`에는 `isReplyToMe`가 빠져 있다. UI `InboxItem = Message & ...`는 SDK의 `question | cluster` 판별 union과 다르고 `InboxPage.revision`도 빠져 있다. `replyToMessage`는 SDK의 `expectedClusterId`·`expectedClusterVersion`을 전달해야 한다. 메시지 재조회는 `updatedAfter/afterId` 대신 SDK의 `checkpoint` 계약을 사용한다. `getMyMembership` 입력은 문자열이 아니라 `{roomId}`다. pass 결과의 `rewriteQuality`, `suggestionToken`, `expiresAt`은 SDK 타입에서 `null`로 포함된다. 구독 상태 문자열 값은 같으므로 UI 별칭을 둘 수 있다.
- **SDK 보완:** `advanceDemoMonth`의 구현 반환값은 계획·RPC 응답과 일치하지만 SDK에서 `Record<string, unknown>`으로만 선언돼 있었다. 이를 `AdvanceDemoMonthData`로 구체화했다. UI에서 이 반환 계약을 별도로 복사하지 않고 루트 SDK 타입을 사용한다.
- **데모 계정 매핑:** `demo:setup`은 로컬 전용 Auth 사용자와 `profiles.role`을 만든다. `userA`는 `user`이며 샘플 카드/라운드 10건, 입장하지 않은 상태다. `userB`는 `user`이며 샘플 카드/라운드 5건과 첫 방 active 멤버십이 있다. `influencer`는 influencer UUID `20000000-0000-4000-8000-000000000001`에 연결된 인증 완료 인플루언서다. `pendingInfluencer`는 UUID `20000000-0000-4000-8000-000000000011`에 연결된 미승인 신청자이며 `profiles.role`은 역시 `influencer`다. `admin`은 admin이며 데모 월 경과 권한을 갖는다. setup에는 UI에서 요청한 다섯 계정 외 `influencerB`와 `outsider`도 있다.
- **로그인 연결 규칙:** `demo:setup`이 발급하는 실제 Auth UUID는 로컬 재생성마다 결정된 상수로 보장되지 않으며 `.demo-passwords.json`에 로컬 전용으로 저장한다. UI의 mock `userA` 같은 문자열 ID를 실제 사용자 ID로 쓰지 않는다. 실제 로그인은 Supabase Auth 세션의 `user.id`를 쓰고, 역할/닉네임 표시 정보는 프로필에서 조회한다. 권한은 클라이언트 역할값으로 판단하지 않고 RLS/RPC에서 다시 확인한다. `user_metadata`를 인가 근거로 쓰지 않는다.
- **프론트 후속 조건:** 중복 타입을 SDK import/`Pick<BackendApi, ...>`로 교체하고 묶음 revision/version과 복구 checkpoint 인자를 보존한다. `pendingInfluencer`는 역할만으로 승인 상태가 구별되지 않으므로 신청 조회 결과에 따라 화면 진입을 결정한다. 이 항목은 자성P 화면 구현 완료를 표시하지 않는다.

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
- [ ] B-14 인플루언서 프로필 사진
- [ ] B-15 인사말 조회·설정·최초 입장 snapshot
- [ ] B-16 인플루언서 전체 메시지
- [ ] B-17 답변·전체 메시지 삭제

### 14.2 상태 구분

| 상태 | 조건 | 현재 |
| --- | --- | --- |
| 계획 단독 실행 준비 | 범위·기본값·타입·권한·순서·검증·외부조건 | 문서 보완·정적 교차 검토 완료 |
| 백엔드 로컬 완료 | B-01~17 코드·필수로컬검증 | 진행 중: 로컬 11 ordered migrations·seed·7개 local 계정·SDK·5개 Edge 함수. 현재 `typecheck`, Node 3 + Deno 113, pgTAP 113, SQL lint 통과. A-09 1,000회 표본과 `complete_round` 재시도·단일 draw·force 권한·4→5/5→6 경계·실패 rollback도 local transaction에서 통과. 나머지 cross-ticket `verify:backend` 시나리오, browser·Realtime·Storage·live AI, 전체 acceptance는 별도 미검증 |
| LLM hosted Secrets 준비 | `TYPESAFE_API_KEY`·`ANTHROPIC_API_KEY` 존재 여부와 회전된 값의 실제 호출 검증 | Dashboard에서 두 Secret 이름 저장 확인. 값·회전 여부 미열람·미확인, live 호출 미실행 |
| 실제AI 검증 | live 호출·3판정·장애 | 미검증 |
| 팀화면 통합 | 담당화면 P0/P1/P2·오류·구독 | 미검증 |
| Supabase 관리 연결 | 프로젝트·DB 관리 경로 | Supabase MCP로 대상 읽기/적용 확인. CLI deploy는 로컬 `SUPABASE_ACCESS_TOKEN` 부재로 실패했으나 MCP deploy로 계속함 |
| Supabase 로그인·프로젝트 권한 | 계정/PAT 범위/프로젝트 멤버십 및 Owner/Administrator Secret 쓰기 권한 | MCP에서 §2.1 ref 접근 및 migration/function 반영 성공. Secret 권한은 사용하지 않았고 별도 확인하지 않음. Production 직접 적용은 사용자 명시 지시 |
| 원격 preflight | target ref·환경·DB major version·기존 데이터/schema baseline | MCP read-only 완료: main/PRODUCTION, PostgreSQL 17.11, 적용 전 테이블·migration·함수·Auth user·Storage object 0. CLI dry-run은 미실행, 사용자 데이터 부재로 데이터 backup 대상 없음 |
| 원격 적용 | 승인환경 migration/Functions/Secrets·스모크 | 마지막 기록은 9 migrations·5 Edge Functions(active, verify_jwt=true), game_config 5 rows·Storage buckets 2·messages Realtime publication 1이다. 이번 작업은 원격 상태를 재조회하거나 변경하지 않았으므로 main에 병합된 A-09와 후속 fix migration의 hosted 적용은 미확인. provider Secrets·Auth origin·실데이터·smoke도 이번에 변경/실행 안 함 |
| 데모 완료 | 동결 후 전체리허설2회 | 미실행 |

보고 순서는 변경 파일 → 명령/증거 → 완료 티켓 → 외부 조건/미검증 → 재개 방법이다. 외부 권한·AI 모듈이 없어도 독립 가능한 구현은 끝까지 진행한다.

#### 티켓별 현재 진행 상태

아래 checklist는 해당 티켓의 전체 완료 기준이다. 부분 구현·local fixture·remote 배포만으로 체크하지 않는다.

| 티켓 | 현재 구현 | 아직 필요한 작업 |
| --- | --- | --- |
| B-01 | toolchain, schema/Auth/RLS/grants, SDK 기반과 production migration 적용 완료 | fixture 변경 뒤 검증 재실행 및 다른 화면과 세션 통합 |
| B-02 | local seed, 반복 가능한 7개 local Auth 계정, 30 placeholder와 샘플 카드 발급 준비 | 최종 콘텐츠 사용권 확인; production에는 fictional user/object를 올리지 않음 |
| B-03 | complete-round/SDK 계약에 A-09 migration 통합. local marker fixture만 교체하는 안전 가드와 `regprocedure` 동적 호출 수정 추가. pgTAP에서 결과·재시도·draw 1건·force 권한·4→5/5→6·실패 rollback 확인 | 더 넓은 cross-ticket `verify:backend` 시나리오와 동시 요청 경계를 추가 검증 |
| B-04 | collection/inventory·upgrade RPC와 SDK 구현 | 현호P 화면 통합 및 전체 acceptance 재확인 |
| B-05 | catalog/join/re-entry RPC와 SDK 구현 | 자성P 화면·세션 흐름 통합 |
| B-06 | submission RPC·JWT Edge·SDK·Realtime history/recovery와 Jev moderation adapter 연결; explicit local fixture도 유지 | live provider 호출/장애 조건, 화면 Realtime delivery와 실제 권한 통합 |
| B-07 | demo clock·월 정산·round gauge 계약 구현 | 자성P 월 경과/퇴장/재입장 UI 통합 |
| B-08 | score·inbox/revision·filtered answer·answer history 구현 | 인박스 UI와 실제 두 세션 흐름 통합 |
| B-09 | verification 신청·심사·이력 backend 구현 | 자성P 관리자 신청/승인 UI 통합 |
| B-10 | filters/version/rate-limit/metadata cleanup 구현 | latest fixture 이후 회귀 검증, 운영 cron 실제 실행 관찰 |
| B-11 | 이전 기록에서 migrations·Functions 반영, recovery 절차 문서화 | 이번 main 병합분의 hosted 적용 여부 재조회, exact Auth/CORS origin, user JWT/Storage/Realtime smoke |
| B-12 | source/lease/commit RPC, Edge wrappers와 main에 병합된 Jev/Claude adapter | live provider 품질/안전 회귀 및 hosted 실행 검증 |
| B-13 | 현재 local Node 3·Deno 113·pgTAP 113·typecheck·DB lint와 A-09 distribution/integration checks 통과 | demo-data 쓰기형 `verify:backend`, 브라우저·Realtime·Storage·실AI·production smoke |
| B-14 | bucket/RLS/photo RPC와 SDK upload flow 구현 | 실제 browser File→WebP, 재시도·복구·과거 메시지 갱신 smoke |
| B-15 | greeting read/update Edge·RPC와 first-entry snapshot 구현 | 자성P 설정/첫 입장 UI 통합 |
| B-16 | influencer broadcast Edge/RPC·SDK 구현 | 자성P compose/수신 화면·Realtime 통합 |
| B-17 | owner message soft-delete RPC·SDK 및 UPDATE 전달 구현 | 자성P 삭제/질문 재개방/Realtime UI 통합 |

#### 정책 결정 권한과 타 담당자 영향

- backend가 계약을 바꾸지 않는 기술 구현값(verified JWT 사용, 역할 재검사, atomic transaction, idempotency, local-only fixture, production sample 배제, exact-origin allowlist)은 홍주P가 독립적으로 정해도 다른 담당자 API 계약에 영향이 없다. 이 기준을 현재 구현과 architecture에 적용했다.
- PRD가 이미 정한 달력 월·3회 재입장·게이지·메시지 공개/차단 정책은 개인 재결정 대상이 아니다. 자성P 화면에 영향이 있으므로 PRD와 현재 SDK/backend 계약을 그대로 사용한다.
- 실제 LLM 모델·비용 상한은 문환P, 실존/최종 인물 이미지와 권리는 현호P/콘텐츠 소유자, 데모 역할 전환 UI·Auth origin은 자성P/배포 담당, 실서비스 차단 원문 보관·제재·이의제기는 제품·법무·운영 협의가 필요하다. 홍주P는 제안은 할 수 있지만 단독 확정·타 담당자 계획 수정은 하지 않는다.
- 현재 시행한 prototype 기본값은 차단 본문 저장 금지, moderation metadata 7일, owner에게 오늘 차단 건수만 반환이다. PRD의 실서비스 90일 위반/원문 보관과 법무 확인은 prototype 완료로 간주하지 않는다.

### 14.3 계획 이력과 현재 개발 진행

2026-11-11 개발 착수 및 local 검증: migration·seed·데모 계정·Supabase 브라우저 SDK·Edge 전송 함수와 local verification 도구를 구현했다. `db reset`, `demo:setup`, `db:types`, `typecheck`, Node/Deno tests(3+4), pgTAP(19), SQL lint(0 errors), `verify:backend`(초기 31 checks) 통과. local Edge에서 missing JWT 401과 owner AI adapter 미연결 시 503 `FILTER_UNAVAILABLE`·미저장 동작도 확인했다. 전체 계획 checker는 현재 다른 담당자인 문환P 계획의 오래된 custom REST API 계약 때문에 실패하며, 담당 범위상 해당 파일은 수정하지 않았다. MoonhwanP 소유 `private.issue_card`가 아직 없어 `complete_round`는 fail-closed이고 실제 AI adapter도 병합되지 않았다. 화면·Realtime 구독·live AI·원격 Supabase는 검증하지 않았으며, ticket acceptance가 모두 충족되기 전에는 완료 표시하지 않는다.

2026-11-11 검증 보강: 초기화한 local stack에서 강화의 동시 요청·멱등 replay·잔액 부족·special 상한, 입장 카드 부족, 신청/심사별 역할 경계, owner 필터의 정규화/version 충돌과 원상복구, admin 설정 검증/불변성, AI adapter 부재 시 인사말·전체 메시지 fail-closed/미저장, greeting/fan question 삭제 거부를 추가했다. `npm run verify:backend` 51 checks를 연속 2회 통과했다. `npm run typecheck`, `npm run test:backend`(Node 3·Deno 4), `npm run db:test`(19 assertions), `npm run db:lint`(오류 없음), `git diff --check`도 통과했다. `node harness/scripts/check-plan.mjs`는 다른 담당자인 `문환P_plan.md`의 기존 REST endpoint 계약 한 건만 보고했다. 필터 설정은 원래 값으로 복구했고, AI 미연결 경로는 메시지/인사말을 저장하지 않았다. DB reset·Auth/Storage fixture는 local stack만 대상으로 했다. 나머지 concurrency 경계, 실제 Realtime delivery, browser photo upload, live AI, remote deployment는 미검증이다.

2026-11-10 준비 상태 기록은 당시 삭제된 `supabase/` 및 예제 파일 상태를 설명한다. 아래 항목은 계획·개발 이력으로 보존하며 현재 파일·실행 상태를 나타내지 않는다.

2026-11-10 준비 상태 정리: 사용자 요청에 따라 로컬 `supabase/` 폴더 전체와 루트 `.env.example`을 삭제한다. 위 연결 값과 생성 기준은 이 문서에 보존하며 다음 개발 착수 시 B-01에서 생성한다. 원격 Supabase는 변경하지 않는다.

준비 단계의 전체 계획 검사기는 아직 이 파일들이 존재한다고 가정하므로 파일 누락 또는 읽기 오류로 중단할 수 있다. 이는 의도된 개발 전 상태이며 검사 때문에 파일을 미리 생성하지 않는다. 개발 착수 후 전체 검사는 참고 결과로 기록하되, 알려진 다른 담당자 문서의 과거 계약 실패를 B-13/B-14 백엔드 완료의 게이트로 삼지 않는다. 새로 구현한 백엔드의 필수 검증 실패는 예외 없이 수정한다.

기존 문서의 독립성·계약·권한을 검토하고 위 공백을 보완했다. Supabase 값은 사용자가 전달한 그대로 §2.1에 기록했다. 이번 추가 보완에서는 Supabase 로그인/PAT·프로젝트 및 DB 권한 구분·CLI v3 고정 ref·migration/선택적 seed·Functions/Secrets·Auth/Storage/Realtime·역할별 smoke·복구 기준을 정리했다. 프로젝트 설정파일 생성·CLI 로그인/link·schema/RPC 생성·원격배포는 이번 작업의 범위가 아니다.

문서 자체 검증: 주요 절 15개, 티켓·체크리스트 13개 일치, TypeScript 예시 5개 구문 분석, 설정 JSON 6개 파싱, 전달받은 URL/key 일치, 코드 블록 짝·공백 검사를 통과했다. git diff --check도 통과했다. 이는 문서 검증이며 DB·Edge·브라우저 실행 증거가 아니다.

2026-11-10 원격 적용 준비 보완: §2에 Supabase 계정/PAT·프로젝트 권한·DB 접속·앱 JWT의 구분과 Full Access/MCP/CLI 권한 차이, scoped PAT 가용성 및 회수 절차를 추가했다. §13에 CLI v3 고정 ref·읽기 전용 preflight·선택적 seed·Functions/Secrets·Auth/Storage/Realtime·역할별 스모크·부분 실패 복구 순서를 추가했다. 문서 검사에서 15개 주요 절, B-01~B-13 표와 체크박스, TypeScript 예시 5개, 코드 fence 짝, 전달 URL/key 유지, 구식 원격 CLI 문법 부재를 확인하고 git diff --check를 통과했다. `supabase/`·`.env.example`·실제 env 파일은 없는 상태이며 로그인·권한 변경·설정·개발·원격 배포는 실행하지 않았다.

초기 전체계획 검사(check-plan.mjs)는 architecture와 다른 담당자 문서의 과거 서버 API·권한 설명 때문에 실패했다. 2026-11-10 사용자 요청으로 architecture.md의 예정 폴더 구조·CSR 흐름·서비스 목록·역할을 이 계획에 맞춰 동기화하고 anonymous-plan.md도 U-01 시연·발표 범위로 정리했다. 자성P·문환P·현호P 계획의 과거 계약과 검사기는 별도 정리 대상으로 남아 있다. 이 검사 결과를 런타임 검증 증거로 사용하지 않는다.

2026-11-10 최종 독립 실행 검토에서는 로컬 키 획득 순서, setup의 직접 DB 연결, Node/Deno 검사 분리, 설정값 변경 적용, 비공개 월 정보 helper, lease nullability와 AI source 변경 처리를 추가 확인·보완했다. 구현 시 harness/verification-log.md가 없으면 날짜·티켓·환경·명령·결과·미검증 필드로 생성한다. 기존 하네스 파일이 없다는 이유로 구현을 멈추지 않으며 이 문서의 §12 검증 기준을 사용한다.

2026-11-10 PRD 교차 검토 및 실행계획 갱신 (main 병합 전 기록; 현재 기준은 아래 사후 검토): 당시 기준으로 카드 라인업 5/3/2, 등급 확률, 누적 발급 입장 자격·보유 배지·우선순위, 게이지와 월 정산, 메시지 RLS·필터·인증·프로필 사진 등 기존 규칙을 반영했다. “게이지 소진까지 남은 기간” 산식과 알림 채널은 PRD에 없어 잔여 게이지·월 마감일 표시와 12.5 이하 인앱 경고를 프로토타입 해석으로 적었다. 뒤이어 main에 반영된 PRD 개정은 다음 기록에서 다시 대조했다. 이 이전 검토의 제품 규칙 목록을 현재 계약으로 사용하지 않는다.

2026-11-10 main 병합 후 PRD·커밋 변경분 재검토: `e9e6757`로 `origin/main`을 병합했다. 병합분에는 `GLOSSARY.md`, `docs/prd.md`, 자성P·문환P·현호P 계획이 포함됐고, PRD 변경 이력의 월 재입장·혐오 필수 차단·AI 폴백 및 전체 메시지·인사말·삭제·열람 기간 규칙을 근거로 담당 계약을 다시 대조했다. 이 문서에는 퇴장 후 월 3회 달성 시 모든 left 방 재입장 및 gauge 50, 입장/재입장 월 게이지 증감 전체 제외, 멤버십 기간별 메시지 RLS와 재입장 복원, 첫 입장 인사말 snapshot, 전체 메시지 수신 범위, 삭제와 답변 재개방, 모든 필터 통과 여부에 따른 질문 인용, 수정 제안 10분·1회 token과 재시도, 필수 필터 및 keyword fallback을 반영했다. 문환P A-09 소유 `private.issue_card(p_force_grade)`와 `draws.forced` 위임 계약도 유지했다. B-15~B-17을 P2 순서·체크리스트·배포 함수·완료 기준에 추가했고, 아키텍처의 SDK 복구·프로필 사진 반영 범위를 함께 맞췄다. PRD에서 확정되지 않은 게이지 잔여 기간/알림 채널은 프로토타입 해석으로 구분했다. 최종 정적 검토에서 담당 계획·공통 아키텍처에 남은 PRD 규칙 충돌을 찾지 못했고 `git diff --check`를 통과했다. 제품 코드·DB·Edge·브라우저·실제 AI·원격 환경 검증은 수행하지 않았다.

2026-11-10 착수 전 확인 회신(후속 요청으로 root 순서는 아래 기록에서 변경): F-01이 최초 `package.json`을 만들어 main에 올리고 B-01은 그 위에 backend scripts/toolchain을 더하는 순서로 검토했다. 보유 카드·강화 경로를 `/collection/owned`·`/collection/upgrade`로 맞추고 architecture의 역할 표를 F-01~F-16으로 고쳤다. `getRoomDailyBlockCount`는 원문을 보관하지 않고 비공개 moderation metadata에서 KST 오늘의 block 수만 읽는 소유자 전용 SDK/RPC로 추가했다. Realtime 상태 union, 3초 fallback 조건, `reconcileRoomMessages`의 내부 pagination·병합, 인플루언서 SDK 입력/반환 계약을 §6·§9에 반영했다. 로컬 demo setup·계정 암호 발급은 실행하지 않았다.

2026-11-10 착수 순서 재조정: 새 요청에 따라 B-01 root bootstrap(package·lockfile·backend toolchain/scripts·lib/supabase skeleton)을 F-01보다 먼저 main에 올리고, F-01은 그 위에 Next.js/Tailwind/app을 추가하도록 변경했다. bootstrap은 첫 1시간 목표이며 B-01의 schema/Auth/RLS는 후속 작업으로 F-01과 병행하고 선행조건으로 두지 않는다. `docs/자성P_plan.md`는 사용자 요청에 따라 수정하지 않았다. 실제 root bootstrap, main 반영, local setup은 실행하지 않았다.

2026-11-10 AI 공급자 키 관리 결정 및 설정 결과: §2.7에 `TYPESAFE_API_KEY`는 Jev 필터, `ANTHROPIC_API_KEY`는 Claude suggest/요약·묶기용으로 Supabase Edge Function hosted Secrets에 저장하고 Edge에서만 읽는 방식을 추가했다. 로컬 키 없는 개발/fallback과 live AI·시연 검증을 분리하고 §2.3·§10.2·§10.3·§13·§14.2를 맞췄다. MCP와 Dashboard에서 §2.1 ref 및 Edge Secrets 페이지를 확인했다. 사용자가 Dashboard에서 두 Secret을 저장했고 이름 표시를 확인했으며 값은 열람하지 않았다. live 공급자 호출은 하지 않았다. Dashboard는 `main PRODUCTION`으로 표시되지만 해커톤 시연 환경으로 적합한지, 값이 회전·재발급된 키인지, 프로젝트의 Owner/Administrator 역할인지는 확인되지 않았다. migration·Function 배포·smoke는 실행하지 않았다.

### 14.4 기술 근거

2026-11-10 확인한 공식 자료다. 제품 요구사항을 찾기 위해 추가로 읽어야 하는 기획 문서는 아니다.

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys): 공개/서버키·사용자JWT 구분.
- [Personal access tokens](https://supabase.com/docs/guides/platform/personal-access-tokens): CLI관리인증·DB암호 차이 및 scoped token 제공 범위/계정 역할 제한. 현재 제공 상태는 계정별로 다시 확인.
- [Supabase CLI v3 migration guide](https://supabase.com/docs/guides/local-development/cli/migrating-to-v3): 원격 대상 문법·hosted mutation의 비대화형 실행·seed 옵션. 배포 시 고정 CLI 버전의 `--help`도 다시 확인.
- [Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets): platform 예약값·hosted Secret 권한/반영.
- [CLI local/hosted targets](https://supabase.com/docs/guides/local-development/local-and-hosted-projects): 로컬·원격대상. 실제flag는 고정CLI --help 확인.
- [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Database views](https://supabase.com/docs/guides/database/views): RLS·security_invoker 경계.
- [Edge authentication](https://supabase.com/docs/guides/functions/auth), [JWT verification](https://supabase.com/docs/guides/auth/jwts): 사용자인증을 키존재로 대체하지 않는 검증.
- [RealtimeChannel subscribe states](https://github.com/supabase/supabase-js/blob/master/packages/core/realtime-js/src/RealtimeChannel.ts): 현재 `REALTIME_SUBSCRIBE_STATES`와 subscribe callback의 status/error. B-01에서 고정할 SDK 버전 타입도 다시 확인한다.

## 15. 전체 검수 반영과 다른 담당자 에이전트 인계

### 15.1 이번 반영 범위와 소유권

2026-11-11 계약 1.6: 전체 검수의 9개 항목은 DB/RPC·Edge·브라우저 SDK의 계약을 정하는 **홍주P 소유 작업**으로 이 계획에 반영했다. 제안 토큰 수락 원자성, 조회 완료 checkpoint, 묶음 인박스 조회/답변 이력, 잠금 후 시각, 같은 월 재입장, influencer block 오류, 다른 세션 상태 갱신, gauge 설정 범위, 사진 업로드 중간 실패 복구를 §§4~9·11~12에 구체화했다. 이는 구현 완료 표시가 아니다.

화면에서 바뀐 계약을 사용하는 방법과 기존 AI 결과의 경계 검증은 아래 담당자가 자기 에이전트로 확인·보완할 후속 작업이다. 이번 변경은 다른 담당자의 계획/코드를 직접 수정하거나 아래 인계를 완료 처리하지 않는다. `anonymous-plan.md` 및 시연 대본/발표 데이터 차이는 사용자 요청으로 이번 범위에서 제외한다.

### 15.2 담당별 확인·보완 목록

| 담당·관련 티켓 | 바뀐 계약과 확인 이유 | 에이전트가 보완할 내용·완료 조건 |
| --- | --- | --- |
| 자성P F-05 | §§6.3/6.5·9.1: 화면 최신 메시지는 복구 완료 기준이 아님. Message.isReplyToMe는 불변 답변 링크에서 SDK가 보강 | 자성P 계획과 더미 타입을 계약 1.6에 맞춘다. checkpoint를 최초 history 전에 확보하고 live buffer와 분리. checkpoint/through·부분 실패·pending 보강 재시도·늦은 응답 정리·isReplyToMe 표시를 명시. 50→51~99 누락→live100 경합과 삭제→재묶기 후 본인 답변 표시 검증을 추가 |
| 자성P F-03/F-07 | §§5.3~5.4·9.1: 메시지가 없어도 다른 세션의 월 마감으로 퇴장할 수 있음 | 메시지 장애 폴링과 독립된 3초 상태 재조회·focus/복귀 재조회, left 시 전송/구독/cache 정리, 같은 퇴장 효력 월 3회 재입장 안내를 반영. admin·팬 분리 세션에서 메시지 없는 퇴장/재입장을 확인 |
| 자성P F-08/F-09 | §§6.1·7.1·8.3: InboxItem은 question/cluster 구분형, 묶음 점수/인원은 서버 집계 | InboxPage.revision과 replyTo/expectedClusterId/expectedClusterVersion을 그대로 사용. 묶음 대표문장·활성 고유 수를 표시하고 단일 page를 화면에서 임의로 재묶지 않음. SOURCE_CHANGED는 목록을 다시 읽고 답변 대상을 재확인한 뒤 새 사용자 동작으로 전송. 활성 1명/0명·재입장·revision 변경/답변 삭제에 따른 첫 page 재조회 기준을 추가 |
| 자성P F-08/F-14/F-15 | §§6.2·7.2: influencer block은 Result 오류 MESSAGE_BLOCKED, 팬의 SubmitMessageData와 다른 반환 위치 | category/고정 reason 표시·draft 유지·인사말 기존 문구 유지·본문 수정 시 새 requestId를 명시. 네트워크 재전송은 기존 requestId. 더미도 동일 오류 형식으로 맞춤 |
| 자성P F-12/F-13 | §§6.5·8.5·9.3: SDK가 원본 File 변환/동일 bytes 재시도/포인터 갱신을 담당 | 화면은 원본 File·requestId를 전달하고 SDK와 중복 인코딩하지 않음. 실패 시 파일/동작 ID를 유지하고 새 파일은 새 ID. 본인 성공 응답으로 즉시 사진 cache 갱신, 다른 열린 화면은 다음 3초 상태 조회 성공 시 과거 말풍선까지 반영. 업로드 완료 뒤 응답 유실/RPC 실패를 검증 항목에 추가 |
| 문환P A-02/A-04/A-07 | §8.1~8.3의 AiAdapter 입출력·시한·fallback 소유권은 유지. 묶음 최고 점수 정렬/답변 링크/version은 홍주P DB 책임 | 문환P 계획에서 대표문장 전 항목 재검사·안전하지 않은 묶음 제외·실패 시 예외·source 밖/중복 ID·시한 회귀 검증이 유지되는지 확인. AI 반환에 DB clusterId/version·권한·점수 정렬을 새로 떠넘기지 않음. 기존 계약과 다르면 근거/대안을 기록해 공동 문서에 해결 요청 |
| 문환P A-02/A-04/A-07 구현 인계 | main PR #15에 Jev/Claude provider adapter가 병합됐고 local selector는 별도 marker/host guard를 유지. provider unit tests는 mock 기반 | 실 provider call·품질/비용·hosted Edge 동작은 별도 검증. fallback과 `passesAllFilters` 경계를 PRD·adapter 계약대로 함께 확인 |
| 문환P A-09 구현 인계 | main PR #15의 `issue_card` migration을 local에 적용했다. 명시된 local fixture marker만 교체하며, 기존 `complete_round`의 `regprocedure` 문자열 호출 오류는 후속 migration으로 수정하고 pgTAP 통합 회귀를 추가했다 | owner 구현 인계/리뷰와 force-grade 권한, `complete_round` wrapper의 4→5 entry 경계 및 rollback을 추가 확인. local deterministic fixture 결과는 확률 표본에 포함하지 않음 |
| 현호P D-01 및 자성P와의 공통 상태 디자인 | 카드 지급·강화 API와 A-06 이미지 생성 소유권은 이번에 바뀌지 않음 | 필요한 경우 묶음 1명/0명·목록 갱신·차단 reason·퇴장/재입장·사진 갱신 상태를 자성P와 맞추고 본인 디자인 계획에 반영. 채팅 SDK/DB를 대신 구현하지 않고 기존 카드 화면 검증 범위를 유지 |

### 15.3 다른 담당자에게 전달할 에이전트 작업 지시

아래 지시와 §15.2에서 본인에게 해당하는 행을 함께 전달한다. 코드 개발을 시작하는 요청과 구별되는 **계획 검토·보완 요청**이다.

```text
BirdieBuddy에서 내 담당 계획을 최신 백엔드 계약과 대조해 보완해줘.
먼저 AGENTS.md, harness/README.md, docs/prd.md, docs/architecture.md,
docs/홍주P_plan.md 계약 1.6의 §§6~9·12·15와 내 담당 *_plan.md를 읽어줘.
§15.2에서 내 담당 행을 기준으로 기존 계획/더미 타입/검증 조건과 다른 부분을 확인하고,
내 담당 계획의 입력·반환·오류·상태 갱신·재시도·완료 조건을 구체적으로 업데이트해줘.
백엔드 계약의 모순을 발견하면 출처·재현 시나리오·제안을 기록하고 조용히 별도 계약을 만들지 말아줘.
다른 담당자의 수정은 보존하고, 다른 담당 계획/코드를 임의로 덮어쓰지 말아줘.
이번 요청에서는 시연 계획, 앱 구현, Supabase/환경 파일 생성, 원격 변경은 제외해줘.
결과에는 바꾼 파일/계약, 추가한 검증 조건, 남은 공동 결정, 실제 실행하지 않은 검증을 구분해줘.
```

### 15.4 반영 확인 상태

- 홍주P: 위 9개 계약과 필수 검증 시나리오를 계획에 반영하고 공통 아키텍처 요약도 같은 기준으로 갱신했다. TypeScript 예시 6개 구문·JSON 예시 4개·상대 링크 10개·public 모델 12개·B-01~17 표/체크리스트 일치와 git diff --check를 정적으로 확인했다. 전체 check-plan.mjs는 의도적으로 없는 supabase/config.toml에서 ENOENT로 중단했으며 전체 통과로 기록하지 않는다.
- 자성P·문환P·현호P: 자기 계획의 확인·보완은 대기. 이 문서의 인계 작성만으로 다른 담당 작업 완료를 표시하지 않는다.
- 실행 증거: 문서 정적 검증만 수행한다. 코드·DB/RLS·Edge·Storage·Realtime·실제 AI·브라우저·원격 검증은 개발 이후 별도 기록한다.

---

**착수 문장:** `md 파일 기반으로 개발 시작해`

이 문장으로 홍주P 구현·로컬검증을 시작하고 완료한 작업은 보존하며 이어간다. 외부계정권한·실제AI자격증명·실행환경은 문서가 대신 만들 수 없다. 원격적용은 명시적 요청과 대상 확인 후 수행한다.

### 15.5 2026-11-11 — 외부 담당 산출물 대기 중 local fixture 연결

- AI: local-only adapter selector와 marker 기반 pass/suggest/block/cluster/summary sample을 추가했다. local API/DB host와 명시 flag를 모두 검사하며 다른 환경은 fail-closed다. `lib/ai`와 다른 담당자 계획은 수정하지 않았다.
- 카드: `local_issue_card.sql`의 결정적 sample 발급 함수를 `demo:setup`에서 로컬 DB에만 준비한다. 함수가 없거나 기존 local marker가 있을 때만 적용하고 다른 구현은 보존한다. 이것은 확률 알고리즘이나 A-09 완료가 아니다.
- local setup: `local:env`가 로컬 Edge fixture flag를 설정하고, 이 변경 후 `npm run local:env`, `npm run demo:setup`을 실행해 local stack에만 반영했다. 실제 AI·카드 확률·원격 환경·브라우저/UI·Realtime delivery는 미검증이며 ticket 완료로 표시하지 않는다.
- 원격 Supabase: 사용자 지시에 따라 `main / PRODUCTION`에 직접 적용했다. 개발 브랜치는 만들지 않았다. 9개 ordered migration, 기본 `game_config` 5건, Storage bucket 2개, `messages` Realtime publication, 5개 Edge Function을 반영했다. local fixtures·fictional seed/Auth users·이미지는 production에 올리지 않았다.
- 원격 사후 확인: 프로젝트 ACTIVE_HEALTHY, migration 9개, Edge Function 5개 모두 ACTIVE/`verify_jwt=true`, Auth users 0, profiles 0, influencers 0, Storage objects 0, buckets 2, Realtime publication 1. Security advisor의 19개 SECURITY DEFINER 경고는 authenticated 사용자가 호출하도록 설계된 RPC들이며 role/owner checks와 명시 GRANT 대상이다. Performance advisor의 미사용 인덱스 안내 21개는 workload가 없는 상태에서 생성된 권고로, 인덱스를 삭제하지 않았다. Foreign-key 미인덱스 12건은 별도 migration으로 보완했다. Health advisor는 비어 있다.
- migration 이력 정합성: MCP 기록 `version`은 원격 적용 시각이고 `name`은 원래 파일 stem이었다. Supabase CLI는 timestamp만 비교하므로 로컬 파일 prefix를 원격 version에 맞췄다. SQL 내용과 production history row는 수정하지 않았다. `npm run db:reset` 후 `npx supabase@3.0.0 migration list`에서 9개 local version의 적용 일치를 확인했다. CLI의 linked-remote list/dry-run은 보호된 `SUPABASE_ACCESS_TOKEN`이 없어 실행하지 않았다.
- 외부 조건: Supabase CLI 원격 deploy에는 로컬 `SUPABASE_ACCESS_TOKEN`이 없어 실패했지만 Supabase MCP 경로로 migration/function 반영을 완료했다. UI origin이 정해지지 않아 Auth `site_url`/redirect와 `ALLOWED_ORIGINS`는 조정하지 않았고 provider Secrets도 변경하지 않았다. owner AI module absent라 hosted moderation/summary/cluster는 fail-closed다. 원격 사용자 JWT smoke·실제 AI·Storage upload는 실행하지 않았다.
- 테스트: 이번 fixture 코드 변경 후 tests/checks는 실행하지 않았다. 로컬 DB는 9개 migration reset과 demo setup까지 다시 적용했다.

### 15.6 2026-11-11 — main 병합 후 A-09/complete_round 통합 보완

- 병합 기준: PR #14 UI preview와 PR #15 Jev/Claude adapter·A-09 migration이 main에서 병합됐다. 홍주P 작업은 backend SDK/계약, A-09 transaction 경계, 검증 도구와 이 계획 문서에 한정했다.
- 구현: `test:backend`와 Deno task가 전체 Edge shared test tree를 실행하도록 넓혔다. `verify-backend.mjs`는 확률 기반 grade 범위, 동일 requestId replay, 반환 draw의 user/round 연결을 확인하도록 고쳤다. A-09 migration은 정확한 local fixture marker일 때만 기존 함수 교체를 허용한다. 실제 `complete_round` 호출에서 `regprocedure`가 전체 signature 문자열을 반환해 생성 SQL이 실패하는 점을 발견해, 새 migration `20261111083319_fix_complete_round_issue_card_call.sql`에서 schema-qualified 고정 함수 호출로 수정했다. pgTAP transaction test가 wrapper 결과·retry·round/draw 1건·force 권한·4→5/5→6 경계·실패 rollback을 확인한다.
- 로컬 DB: `supabase migration up`으로 A-09와 호출 수정 migration 두 개를 local stack에 적용했다. reset은 하지 않았다. DB contract/integration 및 1,000회 확률 SQL은 transaction rollback으로 실행해 기존 demo data를 보존했다.
- 검증: `npm run typecheck` 통과; `npm run test:backend` Node 3 + Deno 113 통과; `npm run db:test` 113 pgTAP assertion 통과; `supabase db lint` 오류 없음. A-09 1,000회 표본은 common 696, rare 184, epic 92, special 28로 각 정의 구간에 들었고 template 30종을 모두 사용했다. wrapper 통합 test에서 force 권한·4→5/5→6 경계·실패 시 round/draw/idempotency rollback도 확인했다. `git diff --check` 통과.
- 미검증: `npm run verify:backend`는 local demo/Auth 데이터를 변경하는 시나리오라 실행하지 않았다. 나머지 cross-ticket/동시 요청 시나리오, 실제 provider API·비용, 브라우저/UI·Realtime·Storage, remote migration/function 상태와 production smoke는 이번 결과로 완료 처리하지 않는다. 원격 Supabase에는 접속하거나 쓰지 않았다.

### 15.7 2026-11-12 — PR #16 스토킹 필수 차단 계약 대조

- 병합 기준: `main`의 PR #16 (`248dacb`)이 `stalking` 설명을 “방송 밖”에서 “공개되지 않은 시간·장소”로 좁히고, 회귀 자료에 공개 행사 목격 정상 문장과 공개 장소의 사적 시간 목격 차단 문장을 추가했다. 문환P 계획 §6.2는 시간·장소 중 하나만 사적이어도 차단한다는 결정을 명시한다.
- 영향 확인: `jev.ts`는 `CATEGORIES` 설명을 Jev 요청에 직접 사용한다. 팬 전송은 기본 `user`, 인플루언서 전송은 `senderType:'influencer'`로 같은 판정 adapter에 전달한다. `validateModeration`은 `stalking`을 필수 카테고리로 허용하고 이 경우 `block`만 받는다. 따라서 병합된 설명이 두 발신 경로에 적용되며 SDK/RPC·DB 구조 변경은 필요하지 않다.
- 문서 반영: §8.2에 시간 또는 장소 중 하나가 비공개인 경우와 공개 장소의 사적 시간 목격을 명시했다. 공통 architecture의 PR 병합 현황 및 검증 한계를 갱신했다.
- 검증 범위: 소스·계약 정적 대조 및 `git diff --check`. 문환P 계획 §7.2에 기록된 upstream Deno 회귀는 71/71·73/73이지만 이번 홍주P 브랜치에서 재실행하지 않았다. 홍주P Edge 경로 실호출, hosted AI, 원격 적용은 미확인이고 B-06 통합 확인으로 처리하지 않는다.
