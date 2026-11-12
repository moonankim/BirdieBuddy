# BirdieBuddy

골프존 AI 해커톤 프로젝트입니다. 브라우저는 Supabase Auth, Data API, RPC, Edge Functions, Realtime, Storage를 직접 호출하고 서버 데이터 처리는 Supabase에 둡니다.

## 화면(Next.js) 로컬 실행

화면은 루트의 단일 Next.js 앱이다(`app/`, `components/`, `lib/session/`). 설치는 루트 `package.json`·`package-lock.json` 하나를 기준으로 한다. 현재 채팅 화면은 목 SDK(`components/chat/api/mock`)로 동작하며, 실제 Supabase 로그인·SDK 연결은 후속 작업이다.

```bash
npm ci
npm run dev        # http://localhost:3000
```

로그인 화면에서 더미 계정 버튼을 누른다.

| 계정 | 첫 화면 | 볼 수 있는 것 |
| --- | --- | --- |
| 팬 A (userA), 팬 B (userB) | `/chat` | 하단 바(홈·카드·채팅), 채팅방 목록·입장·대화 |
| 인플루언서 (influencer) | `/inbox` | 인박스, 전체 메시지, 묶기·요약, 설정(필터·인사말·사진) |
| 신청자 (pendingInfluencer) | `/inbox` | 인증 신청 |
| 관리자 (admin) | `/admin` | 데모 월 경과, 인증 심사 |

- 목 데이터는 브라우저 탭 안에만 있다. 팬 ↔ 인플루언서 주고받기는 같은 탭에서 계정을 전환해 확인한다.
- 모바일 화면(390px) 기준이다. `/home`·`/collection`·`/draw`는 현호P 화면이 들어올 자리의 목업이다(`app/(user)/_mock/cards.ts`).
- 화면 타입은 루트 `lib/api/types.ts`를 그대로 쓴다. `app/design-system.css`는 `design-system/styles.css`(디자인 시스템 0.2)를 옮긴 사본이다.

```bash
npm run typecheck:ui   # 화면 TypeScript (백엔드는 npm run typecheck)
npm run lint
npm run test:ui        # vitest (tests/ui/unit)
npm run test:e2e       # Playwright (tests/ui/e2e, 3313 포트 dev 서버)
npm run build
```

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
