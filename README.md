# BirdieBuddy

> **카드 UI 후속 인계:** [목록·상세·강화 변경과 담당자별 연결 사항](docs/card-ui-handoff.md)을 먼저 확인합니다. 사용자 지시로 이번 단계의 API 연결은 제외했습니다. 장수·수집 현황·강화 결과는 목업이며 실제 데이터나 서버 성공으로 취급하지 않습니다.

> **실제 카드 이미지 인계:** [R2 CDN 주소·DB/프론트 적용 지침](docs/card-assets.md), [36개 이미지 JSON 목록](docs/assets/card-images.json)을 사용합니다. 선수 식별자 12개·3등급이며 최종 이미지는 R2 출처입니다. 기존 Supabase Storage URL 생성·스타일 기반 경로를 그대로 적용하지 않습니다. DB·SDK·화면 연결은 아직 별도 작업입니다.

> **디자인 시스템 적용 인계:** 화면·공통 UI 작업 전 [에이전트 적용 가이드](design-system/AGENT_GUIDE.md)를 확인합니다. 최신 원본·적용 상태·샘플 전용 구성·담당 경계와 검증 기준을 정리했습니다. 실제 API 연결을 보존하고 이전 카드 정의를 신규 요구사항으로 복제하지 않습니다.

> **에이전트·담당자 카드 작업 참고:** 최신 카드 기준은 스타일 없음, 유형 `kpga/klpga/gtour/media`, 등급 `basic/rare/legend`입니다. 최종 카드 path는 `<유형>-<선수명>-<레벨>.png`(예: `gtour-공태풍-basic.png`)이며 디자인 스타일은 사용하지 않습니다. 작업 전 [변경 명세와 담당별 인계](docs/card-spec.md), [현호P 계획](docs/현호P_plan.md)을 확인합니다. 기존 DB·SDK·화면은 이전 계약이 남아 있어 전환 작업이 필요합니다.

앱용 공통 스타일과 에셋은 [디자인 시스템 개발 가이드](design-system/DEVELOPMENT.md)를 따릅니다. UI 테스트는 `npm run test:ui`로 실행하며, 실행기가 프로젝트 내부 `.tmp/`를 임시 경로로 사용합니다. `.tmp/`는 Git에서 제외됩니다.

골프존 AI 해커톤 프로젝트입니다. 브라우저는 Supabase Auth, Data API, RPC, Edge Functions, Realtime, Storage를 직접 호출하고 서버 데이터 처리는 Supabase에 둡니다.

카드 목록은 `/collection`(전체)·`/collection/owned`(보유)로 나누며 선수·유형·등급 필터, 등급순·장수순 정렬과 강화 미리보기를 제공합니다. 사용자 요청에 따라 API는 연결하지 않았고, 장수·수집 현황은 화면에 명시된 목업입니다.

카드 상세는 `/collection/c1` 등의 목업 페이지로 추가되어 있습니다. 홈·컬렉션에서 진입하며 실제 카드 아트 대신 공통 디폴트 이미지를 사용합니다. BASIC 예시 카드 `/collection/c2`는 11장으로 준비되어 강화 미리보기에 진입할 수 있습니다. 강화 화면은 `/collection/upgrade?cardId=c2`이며 확인·결과 미리보기만 제공합니다. 실제 DB 수량 조회·카드 차감·저장은 연결하지 않았습니다.

## 화면(Next.js) 로컬 실행

화면은 루트의 단일 Next.js 앱이다(`app/`, `components/`, `lib/session/`). 설치는 루트 `package.json`·`package-lock.json` 하나를 기준으로 한다.

- **실제 모드(기본):** 루트 `.env`의 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`로 Supabase에 연결한다. 로그인은 Supabase Auth 이메일·암호이며 역할·닉네임은 `profiles`에서 읽는다. 화면 SDK는 루트 `lib/api`의 `createBackendApi`다. 데모 계정 이메일은 로그인 화면의 버튼으로 채우고, 암호는 해당 프로젝트에 `npm run demo:setup`을 실행한 사람의 `.demo-passwords.json`(로컬 전용)에 있다.
- **목 모드:** `NEXT_PUBLIC_DATA_MODE=mock npm run dev`. 목 SDK(`components/chat/api/mock`)와 더미 계정 버튼으로 동작한다. 단위 테스트와 E2E는 목 모드를 쓴다.

```bash
npm ci
npm run dev        # http://localhost:3000
```

역할별 첫 화면은 다음과 같다(목 모드의 더미 계정 이름, 실제 모드는 `demo:setup` 계정).

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
