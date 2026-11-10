# BirdieBuddy — 자성P 작업 계획

**역할:** 프론트엔드 — 채팅 서비스 화면 중심 (프로젝트 셋업·인박스·관리자 화면 포함)

**최종 갱신:** 2026-11-10 (`main` 551c9dd 기준. 홍주P 계획·architecture.md가 prd 개정을 반영한 계약 기준)

**공통 기준:** 제품 규칙은 [prd.md](./prd.md), 구조는 [architecture.md](./architecture.md), 백엔드·SDK 계약은 [홍주P_plan.md](./홍주P_plan.md) §§5~9, 동료 요청은 [문환P_plan.md](./문환P_plan.md) 1절, 디자인 인계는 [현호P_plan.md](./현호P_plan.md) §2.3, 용어는 [GLOSSARY.md](../GLOSSARY.md)를 따른다.

> **우선순위:** 화면에 보이는 제품 동작은 `prd.md`, 호출 방법·타입·오류 코드는 `홍주P_plan.md`를 따른다. 551c9dd에서 홍주P 계약이 prd에 맞춰졌으므로 이 계획은 홍주P SDK 이름·타입을 그대로 쓴다. 아직 계약에 없는 것은 9절에 모았다.
>
> 이 문서는 계획이다. 문서 갱신이 코드 착수나 완료를 뜻하지 않으며, 더미 검증과 실제 SDK 연동 완료는 구분해 기록한다.

## 1. 목표와 담당 경계

우선 목표는 **방 목록 → 입장 → 메시지 전송(판정 3분기) → 실시간 수신 → 인플루언서 인박스 답변** 흐름을 더미로 먼저 완성하고, 홍주P SDK가 준비되면 같은 화면을 실제 호출로 바꾸는 것이다. 그 전에 팀 전체가 쓰는 Next.js 골격(F-01)과 로그인·계정 전환(F-02)을 가장 먼저 넘긴다.

| 구분 | 자성P 작업 | 경계 |
| --- | --- | --- |
| 직접 구현 | 채팅방 목록·입장·대화, 게이지, 판정 안내, 인박스(답변·전체 메시지·삭제·묶기·요약), 인박스 설정(인사말·필터·프로필 사진), 관리자 화면(인증 심사·데모 월 경과), 인증 신청, 프로필 사진 표시 | `app/(user)/chat/`, `app/inbox/`, `app/admin/`, `components/chat/` |
| 구독 연결 | 홍주P의 `subscribeRoomMessages`·`getMessageChanges`·`reconcileRoomMessages`를 화면 상태로 연결, 장애 시 폴링 | `components/chat/use-room-messages.ts` |
| 팀 공통 셋업 | Next.js 골격, 공통 레이아웃·라우팅, 세션 Provider·계정 전환 | 루트 Next.js 설정, `app/layout.tsx`, `components/ui/` (디자인은 현호P) |
| 다른 담당자 영역 | SDK·DB·RLS·Edge·toolchain 스크립트(홍주P), AI·발급(문환P), 카드 화면·디자인·카드 이미지(현호P) | `lib/api`, `lib/supabase`, `supabase/`, `scripts/`, `lib/ai`, `components/card/`는 수정하지 않고 필요하면 요청한다 |

**지키는 규칙 (architecture §2, 홍주P §§6~9)**

1. 상태가 있는 화면은 `'use client'`. 서버 컴포넌트는 정적 shell에만 쓴다.
2. 데이터 호출은 항상 `lib/api` SDK. Next.js API Route·Server Action·Route Handler를 만들지 않는다.
3. 모든 mutation에 `requestId`(UUID). **새 사용자 동작은 새 ID, 결과를 모르는 재시도는 같은 ID.** 7일 지난 미확정 요청은 자동 재전송하지 않는다.
4. 브라우저에서 `userId`·`role`·점수·판정을 만들어 보내지 않는다. 사용자는 Supabase 세션으로만 정해진다.
5. `MessageId`는 문자열로만 다룬다. `Number()` 변환·숫자 비교 금지.
6. 모든 SDK 응답은 `Result<T>`. `ok:false`면 `error.code`로 분기하고 `retryable`일 때만 재시도 버튼을 보여 준다. 자동 무한 재시도는 하지 않는다.
7. AI 폴백 여부는 응답에 없으므로 화면에서 추정해 표시하지 않는다.
8. 프론트 env에는 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 둔다. 계정 암호·secret key·AI 키는 프론트 코드와 env에 넣지 않는다.

## 2. 현재 상태와 착수 판단

`main` 551c9dd 기준 저장소에는 문서, `GLOSSARY.md`, 문환P의 `lib/ai` 스텁·시험 폴더만 있다. Next.js 앱, `package.json`, `lib/api`, `supabase/`는 아직 없다.

**판단: 개발 착수 가능.** F-01 골격과 F-02(더미 세션), 홍주P §§6~7 타입을 그대로 쓰는 더미 기반 P1 화면은 지금 바로 시작할 수 있다. 실제 연동은 홍주P B-01·B-02(로컬 stack·데모 계정) 이후다. 착수 전에 아래 2가지만 팀과 맞추면 된다.

| 착수 전 합의 | 이유 | 제안 |
| --- | --- | --- |
| `package.json` 생성 순서 | F-01(Next.js)과 홍주P B-01(toolchain·`tsconfig.backend.json`·backend scripts)이 같은 루트 파일을 만든다. 동시에 만들면 충돌 | **F-01을 먼저 `main`에 올리고**, 홍주P가 그 위에 backend scripts를 추가한다 (홍주P 계획도 "기존 파일 구조 존중") |
| 보유 카드·강화 라우트 경로 | architecture는 `app/(user)/owned-cards/`, 현호P 계획은 `/collection/owned`·`/collection/upgrade` | 현호P 경로(`/collection/owned`, `/collection/upgrade`)로 F-01을 만들고 architecture 표기를 맞추자고 제안. 확정 전에는 F-01에서 두 경로를 만들지 않고 `/collection` 아래 현호P가 추가 |

| 필요한 입력 | 담당 | 준비 전 진행 방법 | 교체 지점 |
| --- | --- | --- | --- |
| `lib/api` SDK·타입 (B-03~B-17) | 홍주P | 홍주P §§6~7 타입 그대로의 **더미 구현** | `lib/api` 브라우저 export |
| 로컬 Supabase·env (`local:start`·`local:env`) | 홍주P B-01·B-11 | 더미 모드는 Supabase 없이 실행 | 자동 생성되는 `.env.local` |
| 데모 계정 5종 (userA·userB·influencer·pendingInfluencer·admin) | 홍주P B-02 | 더미 세션 5종 | 실제 `signInWithPassword` |
| 화면 시안·배지 (D-01 토큰·상태, D-10 보유 배지, D-09 인증 배지, D-11 프로필 사진) | 현호P | 기본 Tailwind 스타일·텍스트 배지 | 현호P 시안·자산 |
| 판정 결과 | 문환P adapter → 홍주P Edge | 입력 문장별 고정 결과를 주는 더미 | `submitMessage` 실제 응답 |

**더미 원칙:** 더미는 홍주P SDK와 같은 함수 이름·타입·`Result` 형식을 쓰고 `components/chat/` 안에만 둔다. `lib/api`를 대신 만들지 않는다. 더미 동작을 실제 연동 완료로 보고하지 않는다.

## 3. 화면별 사용할 SDK (홍주P §§6~7)

| 화면 | SDK | 화면에서 처리할 오류 |
| --- | --- | --- |
| 로그인·계정 전환 | Supabase Auth `signInWithPassword` / `signOut`, 본인 profiles(role·nickname) | UNAUTHENTICATED |
| 방 목록 | `getRooms()` → `RoomCatalogItem` | NETWORK_ERROR |
| 입장 | `joinRoom({requestId, roomId})` → `{membership, alreadyActive, welcomeMessage}`, `getMyMembership(roomId)` | INSUFFICIENT_CARDS(requiredCards·earnedCards·missingCards), REJOIN_NOT_AVAILABLE(requiredRoundsThisMonth·monthlyRoundCount·currentMonth·leftMonth), REQUEST_IN_PROGRESS |
| 게이지·이번 달 라운드 | `getMyMembership(roomId)`의 gauge, `getMyRoundGaugeSummary()` → `{currentMonth, monthlyRoundCount, targetRounds, remainingRounds}` | NETWORK_ERROR |
| 대화 | `getMessages({roomId, beforeId?, afterId?, limit?})`, `subscribeRoomMessages({roomId, onMessage, onStatus})`, 재연결 `getMessageChanges({roomId, updatedAfter?, afterId?, limit?})`·`reconcileRoomMessages` | ROOM_INACTIVE, NETWORK_ERROR |
| 전송 | `submitMessage({requestId, roomId, body, suggestionToken?})` → `SubmitMessageData` (pass / suggest / block) | FILTER_UNAVAILABLE, FILTERS_CHANGED, RATE_LIMITED(retryAfterSeconds), REQUEST_IN_PROGRESS(retryAfterMs), ROOM_INACTIVE, VALIDATION_ERROR, IDEMPOTENCY_CONFLICT |
| 인박스 | `getRoomInbox({roomId, includeAnswered?, cursor?, limit?})` → `Page<InboxItem>`, `replyToMessage({requestId, roomId, replyTo, body})` | ALREADY_REPLIED, FORBIDDEN, 답변 block |
| 묶기·요약 | `clusterQuestions({requestId, roomId})`, `summarizeRoom({requestId, roomId})` | RATE_LIMITED, SOURCE_CHANGED, FILTER_UNAVAILABLE |
| 전체 메시지 | `sendBroadcast({requestId, roomId, body})` | FORBIDDEN, VALIDATION_ERROR, block |
| 메시지 삭제 | `deleteInfluencerMessage({requestId, roomId, messageId})` → `{message}` | FORBIDDEN, NOT_FOUND |
| 인사말 설정 | `getRoomGreeting({roomId})` → `{text, isDefault, maxLength:200}`, `updateRoomGreeting(...)` (빈 값 = 기본 문구 복원) | FORBIDDEN, VALIDATION_ERROR, block |
| 필터 설정 | `getRoomFilters({roomId})` → `{disabledFilters, mandatoryFilters, version}`, `updateRoomFilters({requestId, roomId, disabledFilters, expectedVersion})` | FILTERS_CHANGED, VALIDATION_ERROR |
| 프로필 사진 | `getMyInfluencerProfile()` → `{profileImageUrl, fallbackImageUrl, ...}`, `uploadInfluencerProfilePhoto(...)` (Storage `<influencer_uuid>/<requestId>.webp` + `set_influencer_profile_photo`) | FORBIDDEN, VALIDATION_ERROR, NETWORK_ERROR |
| 인증 신청 | `requestVerification({requestId, type, evidenceUrl})`, `getMyVerifications({cursor?, limit?})` | PENDING_EXISTS, VALIDATION_ERROR |
| 인증 심사 (admin) | `getPendingVerifications({cursor?, limit?})`, `approveVerification({requestId, verificationId, decision, reason?})` | ALREADY_REVIEWED |
| 데모 월 경과 (admin) | `advanceDemoMonth({requestId, targetMonth})` → `{closedMonth, currentMonth, applied, members}` | FORBIDDEN, INVALID_MONTH_TRANSITION |

`updateRoomGreeting`·`uploadInfluencerProfilePhoto`·`sendBroadcast`·`deleteInfluencerMessage`의 정확한 SDK 입력 형식은 홍주P §7 RPC·Edge 입력에서 `p_` 접두어를 뺀 camelCase로 예상하고, SDK가 나오면 맞춘다.

**화면에서 쓰는 주요 필드**

| 타입 | 필드 | 화면 사용 |
| --- | --- | --- |
| `RoomCatalogItem` | `cardStatus`('ready'·'preparing'), `canJoin`, `joinReason`('eligible'·'need_cards'·'already_active'·'rejoin_rounds_needed'·'card_preparing'), `missingCards`, `earnedCards`, `currentMonthRoundCount`, `requiredRoundsToRejoin`, `membership`, `profileImageUrl`, `supportBadge`, `verifiedAt`·`influencerType` | 방 카드 상태 문구·버튼, 사진, 인증 배지, 본인 보유 배지 |
| `Message` | `messageKind`('user_question'·'influencer_answer'·'influencer_broadcast'·'greeting'), `replyTo`, `replyContext`, `deletedAt`, `body`(삭제 시 null), `clusterId`, `supportBadge`, `senderName` | 말풍선 종류, 질문 인용, "삭제된 메시지", 본인 보유 배지 |
| `InboxItem` | `Message` + `answered`, `replyId`, `passesAllFilters` | 인박스 목록·답변 상태 |
| `SubmitMessageData` | `verdict`, `reason`, `rewrite`(null 가능), `rewriteQuality`, `suggestionToken`, `expiresAt` | 판정 3분기, "이대로 보내기" |

**구독 처리 (`use-room-messages.ts`, 홍주P §9.1)**

- 구독 SUBSCRIBED → 초기 조회 → 버퍼 병합 → id 중복 제거 → id 오름차순.
- INSERT는 새 말풍선, UPDATE는 같은 id를 교체한다(삭제 시 `body=null`·`deletedAt`). UPDATE로 새 행을 추가하지 않는다.
- 재연결 시 `getMessageChanges`의 (updated_at, id) cursor로 끊긴 동안 생성·삭제된 행을 복구한다.
- 연결 장애일 때만 3초 폴링, 복구되면 중단. 권한 거부·퇴장(left)·로그아웃이면 폴링도 중단한다.
- 방·계정 전환·로그아웃 시 이전 채널·캐시·폴링 타이머를 모두 정리한다. 재입장하면 새로 구독하고 과거 입장 구간 메시지를 다시 조회한다.

## 4. 제품 규칙 중 화면이 지켜야 할 것 (prd 4~6절, 서버가 판단)

| 항목 | 화면 동작 |
| --- | --- |
| 메시지 공개 범위 | 팬은 자기 질문과 인플루언서 메시지(답변·전체 메시지·인사말)만 본다. RLS가 막으므로 받은 목록을 그대로 렌더하고, 다른 팬 질문을 따로 거르지 않는다 |
| 열람 범위 | 퇴장 중이면 대화 화면을 열지 않고 재입장 안내. 재입장 후에는 예전 입장 기간 대화와 퇴장 기간에 달린 내 질문의 답변이 보인다 |
| 답변의 질문 인용 | `replyContext`가 있으면 답변 위에 닉네임 없이 인용. 없으면 답변만 보이되, `replyTo`가 내 질문이면 내 질문 원문을 인용하고 "내 질문에 대한 답변" 표시. 묶음 답변은 `replyContext`의 대표 질문을 쓴다 |
| 인사말·전체 메시지 | 인플루언서 말풍선으로 표시. 인사말이 있으므로 첫 입장 빈 상태 안내는 두지 않음. 첫 입장 응답의 `welcomeMessage`를 바로 보여 준다 |
| 삭제된 메시지 | `deletedAt`이 있으면 본문 대신 "삭제된 메시지". 수정 기능은 없음 |
| 보유 배지 | 본인 메시지와 인박스에만 표시. 다른 팬에게 노출하지 않음 |
| 게이지 | 바 + "여유 라운드 N회"(50=4회, 100=8회), 이번 달 남은 라운드(`remainingRounds`)와 월 마감일. 12.5 이하이면 "다음 월 마감에 퇴장할 수 있어요" 인앱 경고. 퇴장 날짜 예측은 하지 않음 |
| 퇴장·재입장 | "나가기" 버튼 없음. `joinReason='rejoin_rounds_needed'`면 "이번 달 라운드 3회를 완료하면 다시 입장할 수 있어요 (현재 N회)". 재입장 시 게이지 50 |
| 입장 자격 | `joinReason='need_cards'`면 "카드 N장 더 필요"(누적 획득 기준, 강화로 줄지 않음) |
| 카드 준비 중 | `cardStatus='preparing'`이면 인증 배지와 "카드 준비 중", 입장 버튼 없음 |
| 입장 안내 문구 | "이 채팅방은 AI가 부적절한 메시지를 자동으로 걸러냅니다. 내 질문은 답변과 함께 닉네임 없이 다른 팬에게 보일 수 있습니다." |
| 수정 제안 | suggest의 `rewrite`가 null이면 사유만. 있으면 "이대로 보내기"(새 requestId + `suggestionToken`, `expiresAt` 10분 안 1회)와 "고쳐서 보내기"(token 없이 새 requestId). 같은 requestId 재시도는 `rewrite`가 null로 올 수 있으므로 최초 수정안을 메모리에 보관 |
| 필터 항목 | `mandatoryFilters`(항상 차단 7종)는 잠금 표시, 선택 3종만 해제 가능. 목록은 응답으로 그리고 하드코딩하지 않음. 팬에게 "필터 꺼짐" 안내는 하지 않음 |
| 인박스 | 서버 순서(priority DESC, id DESC) 그대로. 퇴장 중인 팬 질문·인원수 제외도 서버가 처리. 화면에서 재정렬하지 않음 |
| 프로필 사진 | 방 목록·방 상단·인플루언서 말풍선에 방의 `profileImageUrl`. null이거나 로드 실패면 이름 첫 글자 |

## 5. 티켓별 실행 계획

상태는 이 표 한 곳에서 관리한다. 완료 표시에는 검증 결과가 필요하며, 더미 완료와 실제 SDK 연동 완료를 따로 적는다.

### P0·P1

| ID / 우선순위 | 작업과 산출물 | 선행 | 완료 기준 | 현재 상태 |
| --- | --- | --- | --- | --- |
| F-01 / P0 | Next.js(App Router·TS·Tailwind) 골격, 공통 레이아웃, 빈 라우트 `/draw` `/collection` `/chat` `/inbox` `/admin`(보유 카드·강화 경로는 2절 합의 후), lint·format·`dev`/`build` scripts | 2절 합의 | `npm run build` 통과. 홍주P가 backend scripts를, 현호P가 카드 화면을 같은 `package.json`에 이어서 추가 가능. env 파일은 만들지 않음 | 미착수 |
| F-02 / P0 | 세션 Provider(`useSession()` → userId·role·nickname, 세션 변경 알림), 로그인·계정 전환(이메일+암호 입력), 역할별 첫 화면(user→/draw, influencer→/inbox, admin→/admin) | F-01, 실제 연결은 B-01·B-02 | 전환 시 실제 signOut→signIn, 이전 구독·캐시 정리. 암호를 코드에 넣지 않음. 현호P가 `useSession()`으로 현재 사용자와 변경을 받음 | 미착수 |
| F-03 / P1 | 방 목록: `joinReason`별 상태 문구·버튼, 입장 중·퇴장 중·카드 준비 중, 인증 배지, 본인 보유 배지 | F-02, B-05 | `canJoin=false`는 사유 표시, 입장 중이면 대화로 이동, 퇴장 중이면 대화를 열지 않음, 카드 준비 중은 입장 버튼 없음 | 미착수 |
| F-04 / P1 | 입장 화면: 안내 문구 2문장, 게이지 50 시작 안내, `joinRoom`, 응답의 `welcomeMessage` 표시 | F-03, B-05 | INSUFFICIENT_CARDS·REJOIN_NOT_AVAILABLE 상세값 안내, 성공 후 `getMyMembership`으로 최신 상태 | 미착수 |
| F-05 / P1 | 대화 화면 (버블형): 내 질문 + 인플루언서 말풍선(답변·전체 메시지·인사말), 질문 인용 규칙, "내 질문에 대한 답변", "삭제된 메시지", 본인 보유 배지, 과거 메시지 더보기, `use-room-messages.ts` | F-04, B-06 | 두 브라우저에서 답변·전체 메시지·삭제가 새로고침 없이 반영. 끊겼다 복구해도 누락·중복 없음 | 미착수 |
| F-06 / P1 | 전송·판정 UI: pass 즉시 표시, suggest는 사유 + 수정안(없으면 사유만) → "이대로 보내기"(token) 또는 고쳐서 보내기, block은 사유만 | F-05, B-06·A-02 | 3분기 모두 동작. token 전송은 재검사 없이 저장, 만료 후는 일반 판정. FILTERS_CHANGED·REQUEST_IN_PROGRESS는 같은 requestId로 재시도, RATE_LIMITED는 남은 초 안내 | 미착수 |
| F-07 / P1 | 방 상단 게이지 + 여유 라운드 + 이번 달 남은 라운드·월 마감일 + 12.5 이하 경고, 퇴장 화면과 재입장 안내. admin 데모 관리의 "한 달 경과" 버튼과 결과 표 | F-05, B-07 | 시연 흐름: 입장 → 월 경과 3회(입장 월 정산 없음, 50→12.5→0)로 퇴장 → 라운드 3회 완료로 재입장(게이지 50). 퇴장 시 구독 해제·전송 차단 | 미착수 |
| F-08 / P1 | 인플루언서 인박스: 서버 순서 미답변 질문, 보유 배지, 답변 완료 포함 토글, 답변 작성(block 안내 포함) | F-02, B-08 | 같은 품질이면 보유 배지 높은 질문이 위, 동점이면 최신순. 답변이 팬 화면에 실시간 표시. ALREADY_REPLIED 처리 | 미착수 |

### P2 (prd 8절·홍주P §11 순서)

| 순서 / ID | 작업과 산출물 | 선행 | 완료 기준 | 현재 상태 |
| --- | --- | --- | --- | --- |
| 1 / F-10 | 인증 신청 화면(pendingInfluencer), 관리자 심사 화면(승인·반려 사유 1~500자), 방 목록·채팅방 유형별 인증 배지 | F-02, B-09·D-09 | 11번째 신청자 승인 → 방 목록에 새 방, 인증 배지, "카드 준비 중" | 미착수 |
| 2·3 / F-09 | 질문 묶기 실행·묶음 표시(대표 질문, 활성 고유 질문자 수), 묶음 답변, 대화 요약 | F-08, B-12·A-04·A-05 | 묶음 1회 답변이 묶인 질문 전체에 반영되고 묶음이 닫힘, 요약문 표시, SOURCE_CHANGED·빈 결과 처리 | 미착수 |
| 4 / F-11 | 인박스 설정의 필터: 항상 차단 7종 잠금, 선택 3종 해제·해제 동의 문구, 버전 충돌 시 최신값 다시 읽기 | F-08, B-10 | 항상 차단 항목은 끌 수 없음. 저장 후 다음 메시지부터 반영 | 미착수 |
| 5 / F-14 | 인박스 설정의 인사말: 현재 문구(`isDefault`면 기본 문구 표시), 200자 이내 수정, 비우면 기본 문구 복원 | F-08, B-15 | 저장 후 새로 처음 입장한 팬에게만 새 문구. 실패·block 시 이전 문구 유지, 200자 초과 안내 | 미착수 |
| 6 / F-15 | 인박스의 전체 메시지 작성 칸 (`sendBroadcast`) | F-08, B-16 | 보낸 시점에 입장 중인 팬 화면에 실시간 도착. 실패·block 시 입력 유지·재시도 | 미착수 |
| 7 / F-16 | 인플루언서 메시지 삭제: 본인 답변·전체 메시지, 되돌릴 수 없다는 확인 문구 | F-08·F-15, B-17 | 팬 화면 "삭제된 메시지" 실시간 반영, 답변 삭제 시 질문(묶음이면 전체)이 인박스 미답변으로 복귀. 인사말·팬 메시지는 삭제 버튼 없음 | 미착수 |
| 8 / F-13 | 프로필 사진 표시: 방 목록·방 상단·인플루언서 말풍선의 원형 사진, null·로드 실패면 이름 첫 글자 | F-03·F-05, B-14·D-11 | 사진 변경 후 과거 메시지에도 새 사진 | 미착수 |
| 8 / F-12 | 인박스 설정의 프로필 사진 변경: 현재 사진(`getMyInfluencerProfile`), 파일 선택, 미리보기, JPG·PNG·WebP 5MiB 이하 검사, 브라우저에서 512×512 WebP로 재인코딩(메타데이터 제거) 후 업로드 | F-13, B-14·D-11 | 변경 즉시 세 곳 반영, 실패 시 이전 사진 유지, 재시도는 같은 requestId·경로. 인코딩 결과가 WebP가 아니면 업로드하지 않고 안내 | 미착수 |

**인박스 추가 기능(F-14·F-15·F-16) 공통 화면 상태:** 전송·저장·삭제 중 중복 클릭을 막는다. 실패하면 입력을 유지하고 재시도를 제공한다. 본인 방이 아니면 권한 없음을 안내한다. 답변·전체 메시지·인사말은 항상 차단 7종 검사를 받으므로 block 사유 안내가 필요하다.

## 6. 단계별 실행 순서

### 단계 1 — 팀 골격 (1일차 오전, 최우선)

1. 2절 합의(`package.json` 순서, 보유 카드 경로)를 킥오프에서 정한다.
2. F-01 골격을 만들어 `main`에 먼저 올린다. 홍주P(backend scripts·`lib/api`)와 현호P(카드 화면)가 이 위에서 시작한다.
3. F-02 세션 Provider와 계정 전환을 더미 세션 5종으로 먼저 만들고 `useSession()` 사용법을 현호P에게 넘긴다.

### 단계 2 — 더미 기반 P1 화면 (1일차 오후)

1. `components/chat/` 안에 홍주P §§6~7 타입 그대로의 더미 SDK를 만든다(방 10개 + 카드 준비 중 1개, 메시지 4종, 판정 3분기, 삭제 UPDATE).
2. F-03 → F-04 → F-05 → F-06 순서로 화면 흐름을 완성한다.

### 단계 3 — 실제 SDK 연결 (1일차 저녁 ~ 밤)

1. T-03 P0 통합 때 F-02를 실제 Auth로 교체한다.
2. B-05·B-06이 나오는 대로 F-03~F-06을 실제 SDK로 바꾸고 `use-room-messages.ts`를 실제 구독에 연결한다.
3. F-07 게이지와 F-08 인박스를 연결한다.

### 단계 4 — P2와 시연 준비 (2일차)

1. 순서: F-10 인증 → F-09 묶기·요약 → F-11 필터 → F-14 인사말 → F-15 전체 메시지 → F-16 삭제 → F-13·F-12 프로필 사진.
2. T-04 P1 통합 후 기능 동결, T-05 리허설. 동결 시점에 끝나지 않은 P2는 순서 뒤쪽부터 뺀다.

| 구간 | 할 일 |
| --- | --- |
| 1일차 오전 | T-01·T-02 킥오프와 2절 합의, F-01, F-02(더미) |
| 1일차 오후 | 더미 SDK, F-03~F-06 |
| 1일차 저녁 | T-03 P0 통합, F-02 실제 Auth 전환 |
| 1일차 밤 | F-03~F-06 실제 연결, F-07, F-08 |
| 2일차 오전 | F-10, F-09, F-11, F-14 |
| 2일차 점심 | T-04 P1 통합 |
| 2일차 오후 | (여유 시) F-15, F-16, F-13, F-12 → 기능 동결 → T-05 리허설 |

> P2가 8개다. 1일차 밤까지 P1이 끝나지 않으면 F-15 이후를 시연 범위에서 빼는 것을 팀과 문환P에게 미리 공유한다.

## 7. 검증과 완료 판단

| 묶음 | 확인할 것 |
| --- | --- |
| 골격 | `npm run build`·lint 통과, 라우트 이동, 홍주P backend scripts와 함께 실행 |
| 세션 | 5계정 전환 시 화면·역할·구독이 바뀌고 이전 사용자 데이터가 남지 않음 |
| 버블형 | userA·userB 두 브라우저에서 서로의 질문이 보이지 않고 인플루언서 메시지만 공유됨. `replyContext`가 없는 답변은 질문한 본인에게만 원문 인용 |
| 열람 범위 | 퇴장 중 방이 열리지 않음, 재입장 후 예전 대화와 퇴장 기간 내 질문의 답변이 보임 |
| 실시간 | 연결을 끊었다 복구해도 생성·삭제 누락·중복 없음, 장애 중에만 3초 폴링 |
| 판정 | pass·suggest(수정안 있음/없음, token 전송/고쳐서 전송/만료 후 전송)·block과 재시도 오류 코드별 화면 |
| 멱등 | 전송 버튼 연타·결과 모르는 재시도 시 메시지 1건만 생성 |
| 인박스 | 서버 순서 유지, 답변 후 팬 화면 실시간 반영, 중복 답변 차단, 답변 삭제 시 미답변 복귀 |
| 게이지 | 월 경과 3회로 퇴장(입장 월은 변동 없음), 라운드 3회로 재입장(게이지 50), 12.5 이하 경고 |
| 권한 | admin이 남의 대화·인박스를 볼 수 없고 influencer 명의로 답변 못 함. 다른 인플루언서 방 설정 진입점 없음 |
| 인사말·전체 메시지 | 처음 입장한 팬에게만 입장 시점 인사말, 재입장 시 다시 오지 않음. 전체 메시지는 그 시점 입장 중인 팬에게만 |
| 프로필 사진 | 6MiB 파일·GIF 거부, 정상 이미지는 512×512 WebP로 올라가고 위치정보가 남지 않음, 변경 즉시 세 곳 반영, 실패 시 이전 사진 유지, 없을 때 이름 첫 글자 |

검증 기록에는 환경(더미/로컬/원격)·계정·결과·미검증 범위를 함께 남긴다.

## 8. 시연 데이터 (홍주P §10.1)

| 계정 | 시작 상태 | 내 화면에서 보여 줄 것 |
| --- | --- | --- |
| userA | 첫 인물 일반 10장, 입장 안 함, Buddy | 방 목록 "입장 가능" → 입장 → 인사말 → 질문 전송 |
| userB | 첫 인물 일반 5장, 첫 방 입장 중·게이지 50 | 판정 3분기, 월 경과로 퇴장·재입장 |
| influencer | 첫 방 소유 | 인박스 정렬·답변·전체 메시지·삭제·설정 |
| pendingInfluencer | 11번째 신청자, 심사 대기 | 인증 신청 상태 |
| admin | 월 경과·인증 심사 권한 | 승인 → "카드 준비 중" 방, 한 달 경과 |

암호는 홍주P setup이 로컬 비밀 저장소로 전달한다. F-02 로그인 폼에서 입력하고 코드·문서에 적지 않는다.

## 9. 확인할 것과 인계

**홍주P에게 확인 (계약에 아직 없는 것)**

1. **"오늘 AI가 N건을 걸러냈어요"** (prd 6절 인플루언서 안내): 차단 메시지는 저장하지 않으므로 별도 집계 SDK가 필요한데 §§6~7에 없음. 추가 여부, 없으면 화면에서 숨김.
2. `subscribeRoomMessages`의 `onStatus` 상태 값 목록 (폴링 전환 조건).
3. `updateRoomGreeting`·`uploadInfluencerProfilePhoto`·`sendBroadcast`·`deleteInfluencerMessage`의 SDK 입력 형식 확인.
4. `reconcileRoomMessages`의 역할 (재연결 복구를 SDK가 대신하는지, 화면이 `getMessageChanges`를 직접 부르는지).
5. 2절 `package.json` 생성 순서.

**현호P·홍주P에게 확인**

- 보유 카드·강화 라우트 경로 통일 (`/collection/owned`·`/collection/upgrade` vs architecture의 `owned-cards/`).

**현호P에게 확인**

1. D-01 시안에 전체 메시지 작성 칸, 인사말 설정, 삭제된 메시지, "카드 준비 중", 게이지 경고가 들어가는지와 전달 시점.
2. D-10 보유 배지, D-09 인증 배지, D-11 프로필 사진 시안·샘플 전달 시점.
3. `components/ui/` 공통 컴포넌트 범위 (골격은 자성P, 디자인 적용은 현호P).

**architecture.md 표기 정정 요청 (홍주P)**

- 역할 표의 자성P 티켓 범위 F-01~F-11 → F-01~F-16.

**넘겨줄 것**

- F-01 골격과 실행 방법 → 전원
- `useSession()` 사용법과 계정 전환 동작 → 현호P
- 화면에서 실제로 호출하는 SDK 목록과 발견한 계약 문제 → 홍주P
