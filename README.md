# BirdieBuddy

앱용 공통 스타일과 에셋은 [디자인 시스템 개발 가이드](design-system/DEVELOPMENT.md)를 따릅니다. UI 테스트는 `npm run test:ui`로 실행하며, 실행기가 프로젝트 내부 `.tmp/`를 임시 경로로 사용합니다. `.tmp/`는 Git에서 제외됩니다.

골프존 AI 해커톤 프로젝트입니다. 브라우저는 Supabase Auth, Data API, RPC, Edge Functions, Realtime, Storage를 직접 호출하고 서버 데이터 처리는 Supabase에 둡니다.

## 화면(Next.js) 로컬 실행

화면은 루트의 단일 Next.js 앱이다(`app/`, `components/`, `lib/session/`). 설치는 루트 `package.json`·`package-lock.json` 하나를 기준으로 한다.

- **실제 모드(기본):** 루트 `.env`의 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 공유 hosted Supabase에 연결한다(`.env.local`이 있으면 그 설정이 우선한다). 로그인은 Supabase Auth 이메일·암호이며 역할·닉네임은 `profiles`에서 읽는다. 화면 SDK는 루트 `lib/api`의 `createBackendApi`다. 로그인 화면의 데모 이메일 버튼은 이메일만 채운다. 공유 프로젝트의 암호는 계정을 발급한 담당자에게 전달받는다. `npm run demo:setup`과 `.demo-passwords.json`은 로컬 Supabase 전용이며 공유 프로젝트의 계정·암호를 준비하지 않는다.
- **목 모드:** `NEXT_PUBLIC_DATA_MODE=mock npm run dev`. 목 SDK(`components/chat/api/mock`)와 더미 계정 버튼으로 동작한다. 단위 테스트와 E2E는 목 모드를 쓴다.

```bash
npm ci
npm run dev        # http://localhost:3000
```

역할별 첫 화면은 다음과 같다(목 모드의 더미 계정 이름, 실제 모드는 연결 프로젝트에서 발급받은 계정).

| 계정 | 첫 화면 | 볼 수 있는 것 |
| --- | --- | --- |
| 팬 A (userA), 팬 B (userB) | `/chat` | 하단 바(홈·카드·채팅), 채팅방 목록·입장·대화 |
| 인플루언서 (influencer) | `/inbox` | 인박스, 전체 메시지, 묶기·요약, 설정(필터·인사말·사진) |
| 신청자 (pendingInfluencer) | `/inbox` | 인증 신청 |
| 관리자 (admin) | `/admin` | 데모 월 경과, 인증 심사 |

- 목 모드 데이터는 브라우저 탭 안에만 있다. 팬 ↔ 인플루언서 주고받기는 같은 탭에서 계정을 전환해 확인한다.
- 모바일 화면(390px) 기준이다. `/home`·`/collection`·`/draw`는 현호P 화면이 들어올 자리의 목업이다(`app/(user)/_mock/cards.ts`).
- 화면 타입은 루트 `lib/api/types.ts`를 그대로 쓴다. `app/design-system.css`는 `design-system/styles.css`(디자인 시스템 0.2)를 옮긴 사본이다.

```bash
npm run typecheck:ui   # 화면 TypeScript (백엔드는 npm run typecheck)
npm run lint
npm run test:ui        # vitest (tests/ui/unit)
npm run test:e2e       # Playwright (tests/ui/e2e, 3313 포트 dev 서버)
npm run build
```

## 카드 시연 데이터와 초기화

아직 병합되지 않은 PR #30은 홈·컬렉션·발급 결과를 실제 카드 SDK에 연결하는 변경이다. 아래 카드 저장 동작은 PR #30 적용 후 기준이며, 현재 홍주P 브랜치의 해당 화면은 위에서 설명한 목업 상태다. PR 적용 후 실제 모드에서 라운드 완료를 누르면 현재 로그인한 프로젝트에 라운드와 카드가 저장된다. 화면 이동·새로고침·로그아웃으로 DB 데이터가 초기화되지 않는다. 공유 hosted 프로젝트의 데이터를 유지하면서 새 시연을 시작하려면 별도 팬 계정을 준비한다. 계정 생성·권한 지정은 홍주P가 대상 계정을 확인해 진행하며, 기존 계정의 카드·채팅·공유 데모 월을 초기화하는 기능은 제공하지 않는다.

로컬 Supabase를 통째로 재현할 때만 다음 명령을 사용한다. 기본 실행은 계획만 출력하고, `--apply` 실행은 해당 checkout의 로컬 DB와 Auth 데이터를 삭제하고 migration·seed·데모 계정/카드/이미지를 다시 준비한다.

```bash
npm run local:start -- --backend-only
npm run demo:reset                 # 실행 계획 확인
npm run demo:reset -- --apply      # 로컬 전체 재설정
```

`demo:setup`만 다시 실행하면 이미 있는 카드·라운드·멤버십은 유지된다. `demo:reset`은 backend 전용 환경만 준비하며 브라우저의 `.env`·`.env.local`을 변경하지 않는다. 로컬 화면을 확인하려면 `.env.local`의 공개 URL/key가 로컬을 가리키는지 확인하고 Next.js를 재시작한 뒤 다시 로그인한다. PR #30의 발급 결과는 탭의 `sessionStorage`에도 남으므로 초기화 후 새 브라우저 세션으로 확인한다. 공유 hosted 프로젝트의 카드 시연과 로컬 reset은 서로 영향을 주지 않는다.

관리자 월 조회 SDK와 PR #30 담당별 수정 사항은 [홍주P 계획 §13.13](docs/홍주P_plan.md#1313-2026-11-12--pr-30-카드-화면-연동과-시연-초기화-인계)를 따른다.

## 백엔드 로컬 개발

필요한 환경은 Node.js 24, npm, Deno 2, Supabase CLI 3.0.0, Docker 호환 런타임입니다. 이 저장소는 CLI와 앱 패키지 버전을 lockfile에 고정합니다.

```bash
npm ci
npm run local:start
npm run db:reset
npm run db:types
npm run demo:setup
npm run typecheck
npm run db:lint
npm run db:test
npm run test:backend
npm run verify:backend
```

`npm run local:start`는 로컬 Supabase stack만 시작하고 실행 중인 로컬 값을 `.env.backend.local`과 `supabase/functions/.env`에 기록합니다. 기존 `.env.local`이 원격 URL을 가리키면 보존하며, backend 검증은 이 파일을 읽지 않습니다. Functions env가 바뀌면 stack을 재시작해 적용합니다. 원격 Supabase 값은 자동으로 사용하지 않습니다. 외부 담당자의 AI 모듈 대신 로컬 주소와 명시 설정에서만 작동하는 샘플 adapter를 사용합니다. `[[fixture:suggest]]`, `[[fixture:block]]`, 공통 id를 가진 `[[fixture:cluster=<id>]]`로 제안·차단·묶음을 시연하고 나머지는 quality 50의 pass fixture로 처리합니다. 이는 실제 안전 필터나 live AI 검증이 아닙니다. 로컬 데모 계정 준비는 카드 발급 구현이 아직 없을 때만 결정적 샘플 `private.issue_card`를 로컬 DB에 설치합니다. 실제 담당 구현이 있으면 보존합니다.

Node SDK와 Edge Function은 별도 TypeScript 설정으로 검사합니다. `lib/supabase/database.types.ts`는 migration을 로컬 DB에 적용한 뒤 Supabase CLI로 생성하며 직접 편집하지 않습니다. SQL/RLS 변경은 모두 reviewable migration에 둡니다.

제품·보안·API 계약은 [PRD](docs/prd.md), [공통 아키텍처](docs/architecture.md), [홍주P 백엔드 계획](docs/홍주P_plan.md)을 따릅니다. 검증 환경과 실행 결과는 `harness/verification-log.md`에 기록합니다.
