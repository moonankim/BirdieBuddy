# BirdieBuddy — 자성P 프론트엔드 개발 정의서 v2

- 작성일: 2026-11-11
- 기준 문서: `prd.md`, `architecture.md`, `홍주P_plan.md`(SDK 계약 §6~9), `현호P_plan.md`, `design.md`, `design-system/README.md`
- 상세 화면 스펙·오류 처리·더미 SDK 규칙은 v1(`자성P_develop_document.md`)을 그대로 따른다. v2는 **현재 상태와 남은 작업**만 다룬다.

## 1. 현재 상태 요약

- 더미 SDK 기준으로 F-01~F-16 화면을 `BirdieBuddy-ui/`(레포 안 별도 Next.js 프로젝트)에 구현했다. 팀원이 `cd BirdieBuddy-ui && npm install && npm run dev`로 바로 볼 수 있다.
- 현호P 디자인 시스템 0.2를 전 화면에 적용했다(`BirdieBuddy-ui/app/design-system.css`).
- 실제 Supabase 연동, 레포 루트 `app/`으로의 통합, 현호P 화면 교체는 아직이다.
- 검증: 이전 작업본 기준 `typecheck`·단위/RTL 108건 통과. 오늘 디자인·기능 수정 후에는 `tsc --noEmit`만 통과를 확인했다. lint·build·vitest·Playwright는 다시 돌려야 한다.

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
| 위치 | 샌드박스를 레포 안 `BirdieBuddy-ui/`로 복사(빌드 산출물 제외). 원래 형제 폴더 샌드박스는 더 수정하지 않는다 | `BirdieBuddy-ui/` |

## 3. 남은 작업

우선순위 순서다. 체크하면서 진행한다.

### 3.1 검증 (바로)

- [ ] `BirdieBuddy-ui`에서 `npm install` 후 `typecheck`·`lint`·`build`·`npx vitest run`·`npx playwright test` 실행, 깨진 테스트 수정
- [ ] `tests/README.md`의 미검증 항목 보강: F-09 묶음 답변·요약 전체, F-07 월 경과 → 퇴장 → 라운드 3회 재입장, F-06 토큰 만료·RATE_LIMITED 잠금, F-12 사진 형식·크기·세 위치 갱신
- [ ] 화면 전체 글자 크기를 시안 기준(본문 16·라벨 14·보조 12)으로 점검

### 3.2 실제 SDK 연동 (홍주P 확인 필요)

**계약 1.6 차이 (2026-11-12 `lib/api/types.ts` 대조).** 실제 SDK로 바꾸기 전에 목 SDK 타입과 화면을 먼저 맞춘다.

- [x] ① 인박스 목록 구조: `getRoomInbox`가 `InboxPage`(`items` + `nextCursor` + `revision`)를 돌려주고, 항목은 `kind: 'question' | 'cluster'` 유니온이다(`inboxKey`·`priority`·`tieMessageId`·`replyTo`·`answered`·`replyId` 공통). 묶음은 인박스 목록 안의 항목으로 온다 → F-08·F-09 화면 재구성
- [x] ② 답변 전송: `replyToMessage`에 `expectedClusterId`·`expectedClusterVersion`을 함께 보낸다(질문 항목은 `null`). 묶음이 바뀌었으면 오류 → 목록 재조회
  - 2026-11-12 완료: 목 SDK·인박스 화면·테스트를 계약 1.6 형태로 변경. SOURCE_CHANGED는 목록을 다시 읽고 작성 중인 답변은 보존, 같은 ID 재시도 대신 새 전송. vitest 156건 통과, lint 오류 0
- [ ] ③ 누락 메시지 복구: `reconcileRoomMessages`가 `updatedAfter`/`afterId` 대신 `checkpoint: MessageChangeCursor | null`을 주고받는다 → F-05 `use-room-messages`
- [ ] ④ 본인 답변 표시: `Message.isReplyToMe`를 그대로 쓴다(질문 ID·묶음 ID 비교 제거) → F-05
- [ ] ⑤ `getMyMembership(roomId)` → `getMyMembership({ roomId })` → F-04

- [ ] 루트 `lib/api/types.ts`와 `BirdieBuddy-ui/components/chat/api/types.ts` 차이 비교, 다르면 실제 타입 기준으로 화면 수정
- [ ] `ChatApiProvider` 주입을 더미 → `createBackendApi(client)`로 교체(더미는 테스트용으로 유지)
- [ ] `lib/session`을 Supabase Auth 로그인/로그아웃으로 교체, 데모 계정 5종(userA·userB·influencer·pendingInfluencer·admin) 매핑은 `npm run demo:setup` 결과 기준
- [ ] 클라이언트는 `lib/supabase/client.ts`의 `createBrowserSupabaseClient()`를 쓰고, 환경변수는 `.env.example`의 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 따른다(`npm run local:env`로 생성). 값은 커밋하지 않는다
- [ ] 실시간 구독·재연결, 두 브라우저(팬/인플루언서) 실시간 답변·방송·삭제 확인

### 3.3 레포 통합 방식 결정 (홍주P와 합의)

- 루트 `package.json`은 TypeScript 7.0·Node 24, 프론트는 TypeScript 5.9(Next.js 16 호환)다. v1 §15.3처럼 루트에 합치면 버전 충돌을 먼저 풀어야 한다.
- [ ] 안 A: 해커톤 기간에는 `BirdieBuddy-ui/`를 별도 패키지로 유지하고 `lib/api`만 상대 경로로 가져온다. 배포도 이 폴더를 Vercel 루트로 지정
- [ ] 안 B: 루트에 Next.js를 추가하고 tsconfig를 프론트/백엔드로 분리(v1 §15.3)
- 결정 전까지는 안 A로 진행한다.

### 3.4 현호P 화면 교체 (현호P와 합의)

- [ ] 홈 경로 확정: `/home` 별도(라운드 완료 → `/draw` 결과) 또는 `/draw` 하나로 겸용. 정해지면 하단 바·로그인 후 첫 화면(`homeFor`, 현재 팬은 `/chat`)을 맞춘다. 뽑기 연출은 미정이다.
- [ ] `/home`·`/collection`·`/draw` 목업과 `_mock/cards.ts`를 현호P 화면으로 교체
- [ ] 뽑기 결과의 "입장 가능" 안내에서 `/chat/[roomId]`로 이동하는 링크 합의
- [ ] 홈 라운드 정보에 "이번 달 라운드 N회 남음, 소진 전까지 남은 기간" 포함(PRD 4절 "게임 시작 전" 알림)
- [ ] 디자인 시스템 원본이 바뀌면 `app/design-system.css` 재동기화
- [ ] 앱 화면은 `design.md`와 디자인 시스템을 따르고 카드 표시 영역은 2:3으로 준비한다. 최종 카드 디자인은 별도 프로젝트에서 전달받는다.

### 3.5 남은 기능 보강 (P2 후순위)

- [ ] F-13 사진이 없을 때 일러스트 카드 이미지로 대체(현재는 이름 첫 글자). 카드 이미지 URL 제공 방식 필요
- [ ] (선택) 채팅 날짜 구분선, 인박스 질문 카드 시각 형식 통일

## 4. 시연 제외로 만들지 않는 것

PRD 6절 위반·제재·재검토 요청, 인플루언서 숨기기·신고, 팬 메시지 삭제, 운영자 사진 삭제·재인증 잠금은 실서비스 범위라 구현하지 않는다.
