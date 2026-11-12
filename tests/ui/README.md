# 패널3 테스트 인계

검증 기준: PRD → 홍주P SDK 계약 §§6~9 → architecture → 자성P 개발 정의서.
샌드박스 user 첫 화면은 `/chat` 예외를 적용한다.

## 완료 기준별 검증 범위 (§6·§8·§13)

`U`는 최신 작업본 unit/RTL 108건, `S`는 이전 고정 production snapshot smoke 10건이다.
두 증거를 합쳐 현재 F01~F16 전체 완료로 판정하지 않는다. 아래 미검증은 미구현으로 추정하지
않고, 소스로 확실히 확인한 누락만 별도로 적는다. 새 화면 인계 후 이 표와 테스트를 갱신한다.

| 티켓 | 이미 검증한 사용자 동작/계약 | 미구현 확인 또는 남은 mock 가능 검증 |
| --- | --- | --- |
| F-01 골격 | S: mock 5역할의 주요 라우트·390px 화면, root의 고정본 webpack build | 최신 작업본 전체 lint/build와 최종 snapshot은 미검증. 카드 소유 경로·루트 이전/backend script 보존은 §15 경계 |
| F-02 세션 | U: 5계정·listener·저장소 복원/로그아웃·reset·계정/방 세대 격리. S: 역할 이동·복원/전환 | 늦은 submit 응답 UI와 모든 화면 캐시 정리는 추가 검증 필요 |
| F-03 목록 | U: userB 배지 none·재입장 자격. S: 입장 가능/입장 중/승인 후 카드 준비 중 | 6상태 전체 UI 문구·버튼·조회 오류 재시도는 최신 화면 인계 후 RTL 검증 예정 |
| F-04 입장 | U: admission details(missingCards/monthlyRoundCount)·3회 재입장 gauge50. S: 최초 입장·인사말 | 입장 UI 연타·오류 details 표시·welcomeMessage 즉시 적용은 새 인계 후 검증 예정 |
| F-05 대화 | U: 버퍼·중복·삭제·100건 밖 cursor·폴링/복구·fatal/정리·늦은 local. S: 답변/삭제를 계정 전환 후 확인 | 기본 4종/인용 유무 샘플이 새로 추가됨. UI 인용/본인 답변/삭제 라벨 숨김·퇴장 입력 제거는 추가 검증 필요 |
| F-06 판정 | U: requestId·중복·token 만료/소비/타계정·지속/1회 오류. S: pass/suggest2종/block·실패 입력 보존/재시도 | UI token expiry·편집 token 제외·재시도 rewrite 누락 보관·RATE_LIMITED countdown/전송 잠금은 미검증 |
| F-07 게이지 | U: 초기 월 라운드 자격과 재입장50. S: 기본 gauge 표시 | 월3회 경과→퇴장→3round 재입장·동일 targetMonth 새ID applied=false·경고/상세·퇴장 정리는 미검증. admin 결과의 방/라운드수·applied=false 안내는 확인 당시 미구현 |
| F-08 인박스 | S: 질문→답변→완료 토글·팬 계정 전환 후 답변 표시. U: 본인 방 경계·count 실패 분리 | cursor50+ 더보기/토글 reset·서버 순서·ALREADY_REPLIED·block/오류별 입력 보존과 retry는 최신 인계 후 추가 검증 |
| F-10 인증 | U: 미인증/승인 전후 Guard·room11 설정. S: HTTPS 제한·승인→인박스 허용→카드 준비 중 | 반려 1~500자·신청/심사 오류별 재시도·PENDING_EXISTS/ALREADY_REVIEWED·모든 유형 배지는 미검증 |
| F-09 묶기/요약 | SDK 및 UI 진입 코드가 추가된 것을 확인 | 현재 검증 증거 없음. 묶음 답변 진입/한 번 답변 후 닫힘·실패 결과 보존·빈 결과/SOURCE_CHANGED·진행 표시 검증 필요 |
| F-11 필터 | U: 조회 오류/retry·count 분리·동일ID mutation retry/version·충돌 재조회 성공/실패·3제어 재사용·잠금/취소·room11·정규화 | 팬에게 필터 안내가 없는지·동시 room/계정 변경의 늦은 UI 응답은 미검증 |
| F-14 인사말 | S: 201자 제한·저장 후 재진입 보존·빈 값 기본 복원 | 최초 입장 snapshot 불변/재입장 미발송·정확한 Unicode 경계·block/실패 보존·동일ID retry/version은 미검증 |
| F-15 방송 | S: 전송 즉시 목록 반영·삭제 후 팬 계정 전환 결과 | active 시점 수신자 범위·실패/block 입력 보존·동일ID retry는 추가 mock 검증 필요 |
| F-16 삭제 | U: tombstone 최신 버전 보존. S: 방송 확인 후 삭제·팬 삭제 표시 | 취소·답변 삭제 후 미답변 복귀(묶음 전체 포함)·팬/인사말 삭제 불가·삭제 실패 retry는 미검증 |
| F-13 Avatar | S: 기본 대체 표시를 포함한 화면 smoke | null/로드 실패/URL 변경 단위와 사진 변경 후 세 위치·과거 말풍선 즉시 갱신은 미검증 |
| F-12 사진 | U: useRequest의 동일 File/ID 재시도. S: GIF·5MiB+1 거부, 정확히5MiB 선택 허용, 정상 PNG 업로드/미리보기 | JPEG/WebP·6MiB 명시·실패 이전 사진·URL revoke·세 위치 갱신·512×512 WebP/메타데이터 제거는 별도 검증 필요 |

§6 mock 기본 10방/승인11번째·5계정·판정4종·failOnce/지속실패·큰ID는 일부 U/S 증거가 있다.
새 기본 4종 샘플은 기본값으로 유지하며, 빈 기록을 전제로 한 mock 계약 테스트만
`emptyMessages:true`를 명시한다. `[slow]` 2초·일일 block 중복 집계·기본 샘플 전체 계약은 미검증이다.

**실제 SDK 전용 미검증:** 실제 Auth 로그인/로그아웃, RLS/DB 멱등성/입장 구간·권한,
두 브라우저 userB/influencer의 실시간 답변/방송/삭제 및 장애 복구, 실제 관리자 현재 월 조회,
Storage 권한/영구 이미지 저장·실제 SDK의 변환/메타데이터 제거, 실제 AI 판정은 전부 남아 있다.
mock 제어/SDK 경계 주입으로 검증 가능한 화면 동작을 이 목록으로 넘겨 완료 처리하지 않는다.

§13 검사: tester의 최신 `npm run typecheck`와 U108은 통과. 테스트 전용 lint는 통과했으나
최신 제품 전체 lint/build·새 최종 snapshot E2E는 t6 전체 구현 인계 후 root와 조율한다.
이전 S10은 root가 기록한 고정본이며 실제 SDK 연동 완료 증거가 아니다.

## 현재 테스트

- `unit/use-request.test.ts`: 11건. 새 UUID, 5종 retryable 오류의 같은 ID/입력 재시도,
  transport throw, 확정 실패 정리, concurrent clicks 뒤 원 요청 재시도, 같은 File 재사용,
  명시적 reset 및 자동 재시도 없음.
- `unit/session.test.tsx`: 13건. 5계정 역할, 잘못된 계정, 전환 reset 및 이전 user 제거,
  session-change 알림/unsubscribe, provider 유지 중 소비자 unmount 정리,
  새로고침 복원·로그아웃 후 복원 방지·잘못된 저장값·Storage 사용 불가.
- `unit/guard.test.tsx`: 14건. 비로그인 redirect, loading 비노출, 역할별 안내/차단,
  인증 신청 링크 범위, mock 관리자가 승인한 동일 pending 계정의 verified Guard 통과.
- `unit/use-room-messages.test.tsx`: 37건. bigint 정렬·버퍼·중복·삭제·구독/폴링/복구/정리,
  fatal 오류 3종, 초기 NETWORK_ERROR 복구, reconcile 중 INSERT/applyLocal/older 경합,
  tombstone 버전 우선, reset·방 전환 및 계정 전환 후 같은 방으로 돌아온 과거 closure 차단.
- `unit/mock-chat-api.test.ts`: 19건. actor/operation/requestId 멱등성, 판정 4종, 지속/일회 실패,
  userB 배지, 입장 오류 details와 재입장, token 수명/소유권/소비/재시도, 가시성과 100건 밖 삭제 복구.
- `unit/settings-filters.test.tsx`: 14건. 초기 필터 오류/조회 재시도, count 실패 분리,
  mutation 동일 ID/input 재시도·다음 version, FILTERS_CHANGED 복구 실패 오안내 방지,
  해제 취소·필수 7개 한글/잠금·승인 계정 room-11 접근·disabledFilters 정규화,
  FILTERS_CHANGED 최신조회 성공 후 change/retry 두 경로의 3개 제어 재활성화 및 다음 토글,
  소유 방 discovery의 network retry/FORBIDDEN/UNAUTHENTICATED/빈 방 구분.
- 현재 합계 108건이며 concurrent clicks와 oldApply 세대 격리 회귀 테스트가 포함된다.
- 첫 실행(Node22, Vitest 4.1.12)은 `@testing-library/dom` 누락으로 2 suite 수집 실패,
  테스트 본문은 0건 실행됐다. RTL 16.3.3의 peer 범위는 `@testing-library/dom ^10.0.0`이다.
- 테스트 설정은 `vitest.config.mts`로 ESM을 명시하고 설치된 Vite의 oxc JSX 설정을 쓴다.
- 의존성 설치 후 기존 20건 실행: 16 passed / 4 failed. requestId 11건은 모두 통과.
  실패 4건은 sessionStorage 복원 추가 후 테스트 간 저장소 잔존으로 발생한 격리 결함이다.
- 테스트별 sessionStorage 초기화 및 세션 복원 시나리오 4건 추가 후 재실행:
  **2026-11-11 14:32 KST, Node22.14.0 / Vitest4.1.12, 2 files / 24 tests passed, exit0**.
  config 경고는 재현되지 않았다. 제품 코드와 assertion 기준은 변경하지 않았다.
- 확장 검증: 63건 중 4실패(reconcile 경합·loadOlder fatal 정리), t6 수정 후 63/63 통과.
  87건 중 2실패(older가 최신 tombstone 부활·operation 간 ID 충돌), t6 수정 후
  추가 회귀까지 **2026-11-11 14:49 KST, Node22.14.0 / Vitest4.1.12,
  5 files / 94 tests passed, exit0**.
- F11 추가 후 최신 작업본 검증: **2026-11-11 15:04 KST, 6 files / 102 tests passed,
  exit0**. 필수 범주 표시는 제품의 한글 동의어를 허용하되 서로 다른 7개 범주와 잠금 표시를
  모두 확인한다. 테스트 전용 lint도 0 errors / 0 warnings, exit0.
- 추가 회귀: **2026-11-11 15:07 KST, 102 passed / 6 failed, exit1**. 기존 102건은 통과.
  실패 2건은 FILTERS_CHANGED 이후 성공 재조회에도 retryable 오류가 남아 3개 checkbox가
  영구 비활성화되는 change/retry 경로다. 실패 4건은 소유 방 조회에서 네트워크 재시도,
  권한 거부, 로그인 이동, 방 없음이 generic error로 통합되는 문제다. assertion은 유지했다.
  제품 수정 요청은 t5에 전달했으며 담당자의 수정 완료 알림 뒤 재검증한다.
- F11 reset 수정 후 **2026-11-11 15:15 KST, 104 passed / 4 failed, exit1**.
  change/retry 모두 최신조회 후 3개 checkbox 재활성화 및 다음 토글 version 2 전송이 통과했다.
  남은 4건은 소유 방 discovery의 network retry/fatal/빈 상태 구분이다.
- 소유 방 경계 수정 후 **2026-11-11 15:22 KST, 108/108 passed, exit0**.
  새 기본 샘플 추가 후 빈 기록 계약 fixture만 `emptyMessages:true`로 격리했고
  **15:25 KST 108/108 passed, exit0**로 재확인했다. RTL `findByRole`에서 지원하지 않는
  `exact` 옵션을 제거했다(name 문자열은 기본 정확 매칭). `npm run typecheck`도 exit0.
- 테스트 전용 lint: `eslint tests vitest.config.mts playwright.config.ts`는 session 테스트의
  effect dependency를 destructuring으로 정리한 뒤 0 errors / 0 warnings, exit0.

의존성 설치는 t6 담당이다. 설치 완료 보고 전에는 실행/설치를 반복하지 않는다.
`package.json`, lockfile 및 제품 코드는 패널3에서 수정하지 않는다.

## 설치 완료 후 실행

모든 명령은 레포 루트에서 실행한다(2026-11-12 루트 이관). 아래 PATH 예시는 이전 기록이다.

```sh
PATH=/Users/gdrfront/.nvm/versions/node/v22.14.0/bin:$PATH ./node_modules/.bin/vitest run
```

전체 앱 준비 후 다음 검사를 실행한다. 각 명령의 exit code와 실패 재현을 기록한다.

```sh
PATH=/Users/gdrfront/.nvm/versions/node/v22.14.0/bin:$PATH npm run typecheck
PATH=/Users/gdrfront/.nvm/versions/node/v22.14.0/bin:$PATH npm run lint
PATH=/Users/gdrfront/.nvm/versions/node/v22.14.0/bin:$PATH npm run build
PATH=/Users/gdrfront/.nvm/versions/node/v22.14.0/bin:$PATH ./node_modules/.bin/vitest run
PATH=/Users/gdrfront/.nvm/versions/node/v22.14.0/bin:$PATH ./node_modules/.bin/playwright test
```

Playwright 1.65.0용 Chromium을 설치했다. `playwright.config.ts`와 `e2e/smoke.spec.ts`는
10개 smoke를 정의한다. `webServer`는 Node22 PATH에서 Next 공식 `--webpack` dev 모드로
127.0.0.1:3313에 한시적으로 시작하며 성공/실패 종료 시 SIGTERM으로 정리한다.
기존 서버를 재사용하지 않는다. 라우트는 globalSetup에서 순서대로 사전 컴파일한다.
브라우저 작업 전에 ego-browser 및 Playwright skill을 읽었다. 명시적으로 요청된
Playwright 테스트 파일을 실제 브라우저에서 실행한다.

첫 E2E: 3 passed / 7 failed, exit1. userB/admin 역할 전환과 pending 승인→인박스→
카드 준비 중은 통과했다. 로그인 loading 중 click 유실과 Next `Manifest file is empty` /
`Unexpected end of JSON input` 및 Fast Refresh reload가 섞여 있어 나머지를 완료로 보지 않는다.
로그인 loading 처리는 t6가 수정했다. 테스트의 중복 login navigation과 입장 준비 전
isVisible 확인 경합을 수정했다. 안정화 snapshot 재실행을 진행한다.
첫 실행 증거는 `output/playwright/attempt-1/`에 보존했다. 첫 서버의 포트 종료를 확인했다.

안정화 후 두 번째 dev 실행도 manifest 오류가 반복되어 종료했다: 1 passed / 5 failed /
1 interrupted / 3 not run, exit130. 증거는 `output/playwright/attempt-2/`에 보존했고
3313 LISTEN 없음 및 테스트 hc 터미널 정리를 확인했다.

## 고정 production snapshot E2E 결과

- 대상: `/private/tmp/birdiebuddy-e2e-pwe5d4e5`, root의 `snapshot-metadata.json` hash 기록.
- root가 Node22에서 webpack production build 후 3314에 시작한 고정본이다.
  현재 편집 중인 제품 코드·실제 SDK 연동과 별개의 검증 시점이다.
- 명령: Node22 PATH + `E2E_BASE_URL=http://127.0.0.1:3314 ./node_modules/.bin/playwright test`.
- 첫 snapshot 실행: 9 passed / 1 failed. 실패는 Next route-announcer와 제품 오류 alert의
  locator 충돌이었다. 제품 `main` 범위와 FILTER_UNAVAILABLE 문구를 정확히 검증하도록 수정했다.
- 재실행: **10 passed / 0 failed / 0 skipped, exit0, 6.6s**.
  5계정 로그인·역할 이동·새로고침 복원/로그아웃, 입장·판정 4종·지속 실패 재시도,
  인박스 답변·방송·삭제 및 팬 전환 후 반영, 인증 승인·카드 준비 중,
  인사말 저장/기본값 복원, 사진 MIME·크기 경계와 정상 PNG 업로드를 확인했다.
- 최종 JSON: `output/playwright/results.json`. 첫 snapshot 실패 증거는
  `output/playwright/snapshot-attempt-1/`에 보존했다.
- 외부 서버 모드는 자체 서버를 시작하지 않는다. root가 t1j를 종료하고 3314 LISTEN 없음을 확인했다.
- 이 smoke는 두 브라우저 실시간이나 F01~F16 전체 완료를 의미하지 않는다.

## API가 준비되면 필요한 최소 test seam

제품 구조를 테스트에 맞춰 교체하지 않는다. 실제 export에 맞춰 테스트 adapter를 작성하고,
없는 제어 기능은 t5를 통해 t6에 요청한다. 전역 디버그 객체나 비밀 env는 만들지 않는다.

| 제어 지점 | 재현할 상황 | 검증할 결과 |
| --- | --- | --- |
| ChatApiProvider 주입 및 확정된 ChatApi 타입 | API 메서드별 deferred Promise와 Result 주입 | 화면과 훅이 SDK 계약을 따름 |
| subscribe의 onMessage/onStatus 캡처 및 unsubscribe spy | 초기 history 응답 전 INSERT/삭제 UPDATE, 중복 이벤트, 큰 문자열 ID | 최신 삭제 상태 보존, 중복 없음, 정밀도 유지 |
| history/reconcile 응답 지연과 명시적 cursor | 조회/복구 중 이벤트, 방·계정 전환 뒤 늦은 응답 | 기존 계정/방 데이터가 새 화면에 유입되지 않음 |
| mock 연결 drop/restore 및 Vitest fake timer | CHANNEL_ERROR/TIMED_OUT/CLOSED, 3초 경과, SUBSCRIBED 복구 | 폴링 1개, 복구 시 중단, cursor 전달, 복구 결과 반영 |
| 직접 해제 뒤 CLOSED 전달 | unmount/room 변경/session-reset/권한 오류/left | unsubscribe·timer·buffer·cursor 정리, 폴링 재시작 없음 |
| 같은 mock 인스턴스의 actor 전환과 초기 seed | 팬 A/B 및 방 소유자 권한, 멱등 payload 충돌 | 자기 질문·입장 구간·수신자 가시성, 동일 요청 중복 생성 없음 |
| 일회 오류 주입과 지속 오류의 별도 경로 | 첫 호출 NETWORK_ERROR 후 같은 ID 성공 / `[fail]` 반복 | 미확정 재시도 회복과 지속 FILTER_UNAVAILABLE을 구분 |
| 제어 가능한 expiresAt/시계 | 제안 만료 직전·정확한 만료시각·직후, RATE_LIMITED | 만료 token 제출 불가, countdown 후 활성화 |
| mock seed로 membership/월 라운드 수 지정 | 월 경과 퇴장과 라운드 3회 재입장 | 50→50→12.5→0, 퇴장 시 정리, 재입장 50 |
| File 및 이미지 오류 이벤트, object URL spy | MIME/크기 경계·preview 교체/unmount | 업로드 전 거부, 이전 사진 유지, object URL revoke |

SDK 경계 주입은 실제 SDK 내부의 서버 멱등성/RLS 검증을 대체하지 않는다.
서버가 준 목록은 UI에서 팬 필터링하거나 재정렬하지 않는지도 확인한다.

## 후속 UI/E2E 시나리오

1. 비로그인·역할별 직접 URL 및 5계정 전환. 이전 계정 데이터와 권한이 남지 않는다.
2. 6가지 방 상태, entry notice, 입장 연타, details 오류, welcomeMessage와 최신 membership.
3. pass/suggest+rewrite/suggest+null/block. 최초 rewrite 보관, token 새 ID 제출,
   편집 시 token 제외, 만료, 1~2000자 및 입력 보존, retryable 오류/속도 제한.
4. 메시지 4종·인용·본인 답변 표시·이전 페이지, 삭제 후 본문/인용/라벨 숨김.
5. 인박스 서버 순서/cursor/answered 토글, 답변/ALREADY_REPLIED, 오늘 block 0건 표시,
   block 재시도 중복 집계 방지. 묶음 답변/요약/빈 결과/SOURCE_CHANGED/실패 시 결과 유지.
6. 인증 HTTPS·pending 중복·승인/반려 사유 1~500자, 11번째 방 인증 배지/카드 준비 중.
7. 필수 필터 잠금·선택 필터 해제 확인/취소·expectedVersion 충돌.
8. 인사말 200 Unicode code point 경계, 빈 값 복원, block/실패 보존,
   첫 입장 snapshot 유지·재입장 재발송 없음.
9. 방송 입력 보존/중복 방지, 삭제 확인/취소·미답변 복귀, 팬 질문/인사말 삭제 불가.
10. Avatar null/로드 실패, JPEG/PNG/WebP 및 정확히 5,242,880 bytes 허용,
    1 byte 초과·6MiB·GIF 거부, 업로드 재시도 같은 ID/File, 성공 후 세 위치/과거 말풍선 갱신.

## 미검증 경계

- 실제 SDK/Auth/RLS/Realtime/Storage/AI는 아직 없다. mock 결과를 실제 연동 완료로 보고하지 않는다.
- 관리자 현재 월 조회와 두 브라우저 간 실시간은 실제 SDK 의존으로 남긴다.
  단일 브라우저 메모리 이벤트 버스 성공으로 대체하지 않는다.
- 실제 512×512 WebP 변환·메타데이터 제거·Storage 권한은 SDK 검증 대상이다.
- 제품 결함은 `hc send t5`로 재현과 함께 요청하며, assertion 완화나 skip으로 통과시키지 않는다.
