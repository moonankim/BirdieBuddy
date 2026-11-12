# BirdieBuddy — 자성P 프론트엔드 개발 정의서 v2

- 작성일: 2026-11-11 (최종 갱신 2026-11-12: 루트 단일 Next.js 앱으로 이관)
- 기준 문서: `prd.md`, `architecture.md`, `홍주P_plan.md`(SDK 계약 §6~9), `현호P_plan.md`, `design.md`, `design-system/README.md`
- 상세 화면 스펙·오류 처리·더미 SDK 규칙은 v1(`자성P_develop_document.md`)을 그대로 따른다. v2는 **현재 상태와 남은 작업**만 다룬다.

## 1. 현재 상태 요약

- 더미 SDK 기준 F-01~F-16 화면이 루트 단일 Next.js 앱(`app/`·`components/`·`lib/session/`)에 있다. 설치는 루트 `package.json`·`package-lock.json` 하나, 실행은 루트에서 `npm ci && npm run dev`.
- 화면 타입은 루트 `lib/api/types.ts`를 그대로 쓴다(`ChatApi = Pick<BackendApi, ...>`). 화면 쪽 타입 복사본은 없다.
- 디자인 시스템 0.2·`docs/design.md`를 전 화면에 적용했다(`app/design-system.css`).
- 2026-11-12 v2: 실제 Supabase Auth 로그인·`createBackendApi` 연결 코드 완료(기본 실제 모드, `NEXT_PUBLIC_DATA_MODE=mock`이면 목 모드). 실제 데이터로 화면 흐름 확인은 아직이다. 현호P 화면 교체도 아직이다.
- 검증(2026-11-12, 루트): `typecheck:ui`·vitest 158건·`next build`·lint 오류 0, 백엔드 `tsc -p tsconfig.backend.json`·`tests/backend` 4건 통과. Playwright E2E·deno 검사는 맥에서 실행 필요.

## 2. v1 이후 바뀐 것

| 구분 | 내용 | 파일 |
| --- | --- | --- |
| 말풍선 | 내용 폭에 맞춤(최대 80%), 내 메시지 오른쪽·인플루언서 왼쪽, 삭제된 메시지는 보낸 사람 쪽 유지 | `app/(user)/chat/[roomId]/page.tsx` |
| 보낸 시각 | 말풍선 오른쪽 아래 `오후 4:27` 형식(브라우저 시간대). PRD에는 없는 UI 보강 | 같은 파일 |
| 게이지 미리 알림 | 입장 시 "이번 달 라운드 N/3회 · N회 남음 · 마감일" 항상 표시(PRD 4절) | 같은 파일 |
| 재입장 안내 | 퇴장 후 재입장 화면에도 AI 필터·닉네임 노출 안내 표시(PRD 6절) | 같은 파일 |
| 채팅방 개설 안내 | 인박스 상단에 "자동 필터 기본 켜짐·설정에서 끌 수 있음·인사말 써 보기" 안내, 확인 시 숨김(PRD 6절) | `components/chat/influencer-open-notice.tsx` |
| 디자인 시스템 | 토큰·버튼·배지·입력·게이지·말풍선·작성창 등 시안 규칙 적용, Noto Sans KR | `app/design-system.css`, 전 화면 |
| 하단 바 | 팬 계정에만 홈·카드·채팅 하단 내비게이션 | `components/chat/bottom-nav.tsx`, `components/chat/shell.tsx` |
| 목업 화면 | `/home`(라운드 정보·라운드 완료→`/draw`), `/collection`(카드 3장·탭·등급 필터), `/draw`(자리표시) | `app/(user)/home`, `collection`, `draw`, `_mock/cards.ts` |
| 위치 | 2026-11-12 루트로 이관(홍주P §13.10). `BirdieBuddy-ui/`와 그 package·lockfile은 삭제, 화면 테스트는 `tests/ui/`, 설정 파일은 루트 | `app/`, `components/`, `lib/session/`, `tests/ui/` |

## 3. 남은 작업

우선순위 순서다. 체크하면서 진행한다.

### 3.1 검증 (바로)

- [x] lockfile 불일치: `BirdieBuddy-ui/` lockfile을 없애고 루트 lockfile 하나로 정리(루트 `npm ci` 정상)
- [x] 루트에서 `typecheck:ui`·`lint`·`build`·`test:ui` 통과
- [ ] 맥에서 `npm run test:e2e`(Playwright) 실행
- [ ] `tests/ui/README.md`의 미검증 항목 보강: F-09 묶음 답변·요약 전체, F-07 월 경과 → 퇴장 → 라운드 3회 재입장, F-06 토큰 만료·RATE_LIMITED 잠금, F-12 사진 형식·크기·세 위치 갱신
- [ ] 화면 전체 글자 크기를 시안 기준(본문 16·라벨 14·보조 12)으로 점검

### 3.2 실제 SDK 연동 (홍주P 확인 필요)

**계약 1.6 차이 (2026-11-12 `lib/api/types.ts` 대조).** 실제 SDK로 바꾸기 전에 목 SDK 타입과 화면을 먼저 맞춘다.

- [x] ① 인박스 목록 구조: `getRoomInbox`가 `InboxPage`(`items` + `nextCursor` + `revision`)를 돌려주고, 항목은 `kind: 'question' | 'cluster'` 유니온이다(`inboxKey`·`priority`·`tieMessageId`·`replyTo`·`answered`·`replyId` 공통). 묶음은 인박스 목록 안의 항목으로 온다 → F-08·F-09 화면 재구성
- [x] ② 답변 전송: `replyToMessage`에 `expectedClusterId`·`expectedClusterVersion`을 함께 보낸다(질문 항목은 `null`). 묶음이 바뀌었으면 오류 → 목록 재조회
  - 2026-11-12 완료: 목 SDK·인박스 화면·테스트를 계약 1.6 형태로 변경. SOURCE_CHANGED는 목록을 다시 읽고 작성 중인 답변은 보존, 같은 ID 재시도 대신 새 전송. vitest 156건 통과, lint 오류 0
- [x] ③ 누락 메시지 복구: `reconcileRoomMessages`가 `updatedAfter`/`afterId` 대신 `checkpoint: MessageChangeCursor | null`을 주고받는다 → F-05 `use-room-messages`
- [x] ④ 본인 답변 표시: `Message.isReplyToMe`를 그대로 쓴다(질문 ID·묶음 ID 비교 제거) → F-05
- [x] ⑤ `getMyMembership(roomId)` → `getMyMembership({ roomId })` → F-04

  - 2026-11-12 완료: ③ `use-room-messages`가 `checkpoint`를 보관해 다음 복구에 넘김(초기·초기화 시 null), ④ 목 SDK가 보는 사람 기준으로 `isReplyToMe`를 계산하고 채팅방은 그 값으로 "내 질문에 대한 답변" 표시, ⑤ `getMyMembership({ roomId })`. vitest 157건·`next build` 통과
- [x] 타입 단일화: `components/chat/api/types.ts` 삭제, 모든 화면·목 SDK·테스트가 `@/lib/api/types`를 import. `ChatApi = Pick<BackendApi, ...>`(홍주P §13.9). 목 SDK는 실제 SDK와 같은 타입을 만족한다
- [ ] Vercel 빌드 루트를 레포 루트로 지정하고 배포 확인
- [x] `ChatApiProvider`: 실제 모드는 `createBackendApi(getBrowserClient())`, 목 모드는 목 SDK(`components/chat/providers.tsx`)
- [x] `lib/session`: 실제 모드는 Supabase Auth `signInWithPassword`·세션 복원·`onAuthStateChange`, `userId`는 Auth `user.id`, 역할·닉네임은 `profiles`(본인 행). 프로필이 없으면 로그아웃 후 FORBIDDEN. 로그인 화면은 이메일·암호 + 데모 계정 이메일 채우기 버튼(암호는 화면에 두지 않음)
- [x] 클라이언트는 `createBrowserSupabaseClient()`를 한 번만 만든다(`lib/session/client.ts`). 환경변수는 루트 `.env`(공개 값)
- [x] `next.config.ts`: 루트 `lib/api`의 `.js` 확장자 import를 webpack이 `.ts`로 찾도록 설정. `dev`·`build`는 `--webpack`
- [x] 관리자 월 경과: 실제 모드는 KST 이번 달로 시작하고 `INVALID_MONTH_TRANSITION`의 `details.currentMonth`로 맞춤
- [x] 실시간 구독 `onMessageEnrichmentError` → 복구 실행
- [x] 세션 실제 모드 단위 시험 4건(로그인·세션 복원·잘못된 암호·프로필 없음). vitest 162건·`next build --webpack`·lint 오류 0
- [ ] **맥에서 실제 데이터 확인:** 데모 계정 암호(`.demo-passwords.json`) 받아 팬 입장·질문 → 인플루언서 답변·방송·삭제 → 관리자 월 경과·인증 심사 흐름
- [ ] 실시간 구독·재연결, 두 브라우저(팬/인플루언서) 실시간 답변·방송·삭제 확인

### 3.3 레포 통합 방식 (결정·완료)

- 2026-11-12 홍주P §13.10: 루트 단일 Next.js 앱으로 통합. 홍주P가 루트 package를 화면 버전(Next 16.4.6·TypeScript 5.9.3 등)에 맞췄다.
- [x] 자성P 이관: `app/`·`components/`·`lib/session/`·화면 설정(`next.config.ts`·`postcss`·`eslint`·`vitest`·`playwright`)·`tests/ui/`를 루트로 `git mv`. 프론트 `tsconfig.json`은 백엔드(`tsconfig.backend.json`)와 범위를 나눔(supabase·lib/ai·tests/backend·scripts 제외). 루트 scripts에 `dev`·`build`·`start`·`lint`·`typecheck:ui`·`test:ui`·`test:e2e` 추가(홍주P scripts 유지)

### 3.4 현호P 화면 교체 (현호P와 합의)

- [ ] 홈 경로 확정: `/home` 별도(라운드 완료 → `/draw` 결과) 또는 `/draw` 하나로 겸용. 정해지면 하단 바·로그인 후 첫 화면(`homeFor`, 현재 팬은 `/chat`)을 맞춘다. 뽑기 연출은 미정이다.
- [x] 2026-11-12 `/home`·`/collection`·`/draw`를 SDK에 연결(목업 `_mock/cards.ts` 삭제)
  - 홈: `getMyRoundGaugeSummary`(이번 달 라운드), `getOwnedCards`(나의 카드 상위 2장), 라운드 완료 → `completeRound`(같은 requestId 재시도) → 결과를 세션 저장소에 두고 `/draw`
  - 카드 탭: `getCollection`(미보유 포함·등급 필터), `getOwnedCards`(보유 카드 탭)
  - 발급 결과: 카드·등급·신규/중복·보유 수, `entryUnlocked`면 해당 인플루언서 채팅방(`getRooms`의 influencerId로 찾음) 링크
  - 목 SDK에 카드 30종·completeRound·입장 자격 연동 추가, 시험 5건
- [ ] 현호P: 카드 상세·강화(`upgradeCard`), 뽑기 연출, 최종 카드 아트로 화면 보강
- [ ] 뽑기 결과의 "입장 가능" 안내에서 `/chat/[roomId]`로 이동하는 링크 합의
- [ ] 홈 라운드 정보에 "이번 달 라운드 N회 남음, 소진 전까지 남은 기간" 포함(PRD 4절 "게임 시작 전" 알림)
- [ ] 디자인 시스템 원본이 바뀌면 `app/design-system.css` 재동기화
- [ ] 앱 화면은 `design.md`와 디자인 시스템을 따르고 카드 표시 영역은 2:3으로 준비한다. 최종 카드 디자인은 별도 프로젝트에서 전달받는다.

### 3.4.1 디자인 가이드(`docs/design.md`) 반영

- [x] 카드 표시 영역 2:3(홈·컬렉션 목업), 하단 바·본문 끝 여백에 기기 안전 영역 포함(`viewport-fit=cover`), 하단 바에 포커스가 가려지지 않게 스크롤 여백
- [x] 로그인 처리 중 상태(버튼 잠금·"로그인 중..."), 로그인 오류를 경고 영역으로 표시
- [x] `/draw` 자리표시를 "발급 결과" 화면으로 정정(뽑기 연출 미정)
- [ ] 실제 화면에서 확대·긴 이름·키보드 포커스·대비 점검(브라우저로 확인 필요)

### 3.5 남은 기능 보강 (P2 후순위)

- [ ] F-13 사진이 없을 때 일러스트 카드 이미지로 대체(현재는 이름 첫 글자). 카드 이미지 URL 제공 방식 필요
- [ ] (선택) 채팅 날짜 구분선, 인박스 질문 카드 시각 형식 통일

## 4. 시연 제외로 만들지 않는 것

PRD 6절 위반·제재·재검토 요청, 인플루언서 숨기기·신고, 팬 메시지 삭제, 운영자 사진 삭제·재인증 잠금은 실서비스 범위라 구현하지 않는다.
