# BirdieBuddy

> **카드 API 경계:** `/home`·`/draw`는 기존 BackendApi를 사용하지만 DB·SDK는 이전 스타일·4등급 계약입니다. `/collection/**`는 새 3등급 UI 목업으로, 장수·수집 현황·강화 결과가 실제 데이터는 아닙니다. 상세는 [카드 UI 인계](docs/card-ui-handoff.md), 백엔드 이관 조건은 [카드 기준 변경](docs/card-spec.md)을 확인합니다.

> **실제 카드 이미지 인계:** [R2 CDN 주소·DB/프론트 적용 지침](docs/card-assets.md), [36개 이미지 JSON 목록](docs/assets/card-images.json)을 사용합니다. 선수 식별자 12개·3등급이며 최종 이미지는 R2 출처입니다. 기존 Supabase Storage URL 생성·스타일 기반 경로를 그대로 적용하지 않습니다. DB·SDK·화면 연결은 아직 별도 작업입니다.

> **디자인 시스템 적용 인계:** 화면·공통 UI 작업 전 [에이전트 적용 가이드](design-system/AGENT_GUIDE.md)를 확인합니다. 최신 원본·적용 상태·샘플 전용 구성·담당 경계와 검증 기준을 정리했습니다. 실제 API 연결을 보존하고 이전 카드 정의를 신규 요구사항으로 복제하지 않습니다.

> **에이전트·담당자 카드 작업 참고:** 최신 카드 기준은 스타일 없음, 유형 `kpga/klpga/gtour/media`, 등급 `basic/rare/legend`입니다. 최종 카드 path는 `<유형>-<선수명>-<레벨>.png`(예: `gtour-공태풍-basic.png`)이며 디자인 스타일은 사용하지 않습니다. 작업 전 [변경 명세와 담당별 인계](docs/card-spec.md), [현호P 계획](docs/현호P_plan.md)을 확인합니다. 기존 DB·SDK·화면은 이전 계약이 남아 있어 전환 작업이 필요합니다.

앱용 공통 스타일과 에셋은 [디자인 시스템 개발 가이드](design-system/DEVELOPMENT.md)를 따릅니다. UI 테스트는 `npm run test:ui`로 실행하며, 실행기가 프로젝트 내부 `.tmp/`를 임시 경로로 사용합니다. `.tmp/`는 Git에서 제외됩니다.

골프존 AI 해커톤 프로젝트입니다. 브라우저는 Supabase Auth, Data API, RPC, Edge Functions, Realtime, Storage를 직접 호출하고 서버 데이터 처리는 Supabase에 둡니다.

카드 목록은 `/collection`(전체)·`/collection/owned`(보유)로 나누며 선수·유형·등급 필터, 등급순·장수순 정렬과 강화 미리보기를 제공합니다. 새 유형·등급과 R2 에셋 계약이 백엔드에 이관되기 전까지 목록·상세·강화 데이터는 목업입니다.

카드 상세는 `/collection/c1` 등의 목업 페이지로 추가되어 있습니다. 홈·컬렉션에서 진입하며 실제 카드 아트 대신 공통 디폴트 이미지를 사용합니다. BASIC 예시 카드 `/collection/c2`는 11장으로 준비되어 강화 미리보기에 진입할 수 있습니다. 강화 화면은 `/collection/upgrade?cardId=c2`이며 확인·결과 미리보기만 제공합니다. 실제 DB 수량 조회·카드 차감·저장은 연결하지 않았습니다.

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
- 모바일 화면(390px) 기준이다. `/home`(이번 달 라운드·나의 카드·라운드 완료)과 `/draw`(발급 결과)는 SDK(`getMyRoundGaugeSummary`·`getOwnedCards`·`completeRound`)에 연결돼 있다. `/collection/**`(목록·상세·강화)는 새 카드 규격(3등급) 목업이며 백엔드 규격 이관 뒤 연결한다([카드 UI 인계](docs/card-ui-handoff.md)).
- 화면 타입은 루트 `lib/api/types.ts`를 그대로 쓴다. `app/design-system.css`는 `design-system/styles.css`(디자인 시스템 0.2)를 옮긴 사본이다.

```bash
npm run typecheck:ui   # 화면 TypeScript (백엔드는 npm run typecheck)
npm run lint
npm run test:ui        # vitest (tests/ui/unit)
npm run test:e2e       # Playwright (tests/ui/e2e, 3313 포트 dev 서버)
npm run build
```

## 카드 시연 데이터와 초기화

PR #30은 `main`의 `4003863`에 병합됐다. `/home`·`/draw`는 기존 SDK를 통해 실제 모드의 라운드·발급 데이터를 저장하고, `/collection/**`는 새 카드 규격의 목업을 사용한다. 실제 모드의 저장 대상은 현재 로그인한 프로젝트이며 화면 이동·새로고침·로그아웃으로 DB 데이터가 초기화되지 않는다. 공유 hosted 프로젝트의 데이터를 유지하면서 새 시연을 시작하려면 별도 팬 계정을 준비한다. 계정 생성·권한 지정은 홍주P가 대상 계정을 확인해 진행하며, 기존 계정의 카드·채팅·공유 데모 월을 초기화하는 기능은 제공하지 않는다.

로컬 Supabase를 통째로 재현할 때만 다음 명령을 사용한다. 기본 실행은 계획만 출력하고, `--apply` 실행은 해당 checkout의 로컬 DB와 Auth 데이터를 삭제하고 migration·seed·데모 계정/카드/이미지를 다시 준비한다.

```bash
npm run local:start -- --backend-only
npm run demo:reset                 # 실행 계획 확인
npm run demo:reset -- --apply      # 로컬 전체 재설정
```

`demo:setup`만 다시 실행하면 이미 있는 카드·라운드·멤버십은 유지된다. `demo:reset`은 backend 전용 환경만 준비하며 브라우저의 `.env`·`.env.local`을 변경하지 않는다. 로컬 화면을 확인하려면 `.env.local`의 공개 URL/key가 로컬을 가리키는지 확인하고 Next.js를 재시작한 뒤 다시 로그인한다. PR #30의 발급 결과는 탭의 `sessionStorage`에도 남으므로 초기화 후 새 브라우저 세션으로 확인한다. 공유 hosted 프로젝트의 카드 시연과 로컬 reset은 서로 영향을 주지 않는다.

관리자 월 조회 SDK와 PR #30/#32 이후 담당별 조치는 [홍주P 계획 §13.14](docs/홍주P_plan.md)를 따른다.

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
