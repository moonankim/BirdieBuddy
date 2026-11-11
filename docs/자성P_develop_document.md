# BirdieBuddy — 자성P 프론트엔드 개발 정의서

**대상:** 자성P와 자성P의 코딩 에이전트

**작성 기준:** 2026-11-10, `main` 2d144f4 (홍주P 계약 §6.5 인플루언서 SDK·§9.1 구독 계약, architecture §4 root bootstrap·라우트). [자성P_plan.md](./자성P_plan.md)(무엇을·언제), 이 문서(어떻게 만드는가)

**기준 문서 우선순위:** 제품 동작은 [prd.md](./prd.md) → SDK·타입·오류는 [홍주P_plan.md](./홍주P_plan.md) §§6~9 → 구조는 [architecture.md](./architecture.md) → 화면 구현 세부는 이 문서. 이 문서가 위 문서와 어긋나면 위 문서를 따르고 이 문서를 고친다.

## 0. 에이전트 실행 지시

사용자가 **"자성P 개발 정의서 기반으로 개발 시작해"** 또는 특정 티켓(예: "F-05 진행해")을 요청하면 다음 순서로 진행한다.

1. `git status`와 실제 파일을 확인한다. 기존 수정사항을 보존하고, 체크 표시만 보고 완료를 가정하지 않는다.
2. 루트 `package.json`·`package-lock.json`·toolchain이 있는지 확인한다. 홍주P B-01 root bootstrap이 `main`에 없으면 **레포 밖 샌드박스 `../BirdieBuddy-ui/`에서 개발**한다(15절). 레포 루트 파일은 직접 만들지 않는다. bootstrap이 생긴 뒤 샌드박스가 있으면 15.3 이전 절차를 먼저 수행한다. 커밋 메시지는 `CONTRIBUTING.md` 형식을 따른다.
3. `lib/api`가 있는지 확인한다. 있으면 실제 SDK를, 없으면 6절의 더미 SDK를 주입해 화면을 만든다.
4. 요청된 티켓을 8절 정의대로 구현한다. 담당 경로(2절) 밖의 파일은 수정하지 않는다. 필요한 변경은 11절 형식으로 담당자 요청 목록에 남긴다.
5. 13절 검증을 실행하고 실패를 고친다. 실행하지 못한 검증은 이유를 남긴다.
6. 14절 형식으로 보고한다. 더미 완료와 실제 SDK 연동 완료를 구분한다.

커밋·push·원격 배포·개발 서버 장시간 실행은 사용자 요청이 있을 때만 한다.

## 1. 범위

| 구분 | 포함 |
| --- | --- |
| P0 | F-01 Next.js 앱 골격, F-02 로그인·세션·계정 전환 |
| P1 | F-03 방 목록, F-04 입장, F-05 대화(버블형)·실시간, F-06 전송·판정, F-07 게이지·월 경과, F-08 인박스 |
| P2 (순서대로) | F-10 인증 신청·심사, F-09 묶기·요약, F-11 필터 설정, F-14 인사말, F-15 전체 메시지, F-16 메시지 삭제, F-13 프로필 사진 표시, F-12 프로필 사진 변경 |
| 제외 | 카드 뽑기·컬렉션·강화·보유 카드 화면(현호P), SDK·DB·Edge(홍주P), AI 판정(문환P), 디자인 시안(현호P) |

## 2. 기술 스택과 담당 경로

| 항목 | 기준 |
| --- | --- |
| 프레임워크 | Next.js App Router + TypeScript(strict) + Tailwind CSS |
| 렌더링 | CSR. 상태·이벤트가 있는 컴포넌트는 파일 첫 줄 `'use client'`. 서버 컴포넌트는 레이아웃·정적 shell만 |
| 데이터 | `lib/api` SDK만 호출. API Route·Server Action·Route Handler 금지 |
| 상태 관리 | React state·Context·커스텀 훅. 전역 상태 라이브러리 추가하지 않음 |
| 단위 테스트 | Vitest + React Testing Library (루트 scripts는 홍주P와 합의해 추가) |
| 환경변수 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만. 암호·secret key·AI 키 금지 |

**자성P 소유 경로 (이 밖은 수정하지 않는다)**

```text
app/layout.tsx                      공통 레이아웃 (F-01)
app/page.tsx                        역할별 첫 화면으로 이동 (F-02)
app/login/page.tsx                  로그인·계정 전환 (F-02)
app/(user)/chat/page.tsx            방 목록 (F-03)
app/(user)/chat/[roomId]/page.tsx   입장·대화 (F-04~F-07)
app/inbox/page.tsx                  인박스 방 선택·목록 (F-08~F-09, F-15~F-16)
app/inbox/settings/page.tsx         인박스 설정: 필터·인사말·프로필 사진 (F-11, F-14, F-12)
app/inbox/verification/page.tsx     인증 신청 (F-10)
app/admin/page.tsx                  관리자: 인증 심사·데모 월 경과 (F-10, F-07)
components/chat/                    채팅·인박스·관리자 컴포넌트, 훅, 더미 SDK
components/ui/                      공통 UI 기본 컴포넌트 셋업 (디자인 적용은 현호P)
lib/session/                        세션 Provider·useSession (F-02)
```

`app/(user)/draw/`, `app/(user)/collection/`(하위 `owned/`·`upgrade/` 포함), `components/card/`는 현호P 소유다. F-01은 이 경로들의 빈 placeholder 페이지만 만들고 이후 수정하지 않는다.

## 3. 공통 규칙

1. **requestId:** 모든 mutation에 `crypto.randomUUID()`. 사용자가 새로 누른 동작은 새 ID, 결과를 모르는 재시도(네트워크 오류·REQUEST_IN_PROGRESS·FILTERS_CHANGED)는 같은 ID. 화면 상태에 "진행 중 요청의 ID"를 보관하고, 성공·확정 실패 시 비운다.
2. **Result 처리:** 모든 SDK 응답은 `Result<T>`. `ok:false`면 5.4 오류 표로 분기한다. `retryable=true`일 때만 재시도 버튼. 자동 재시도는 하지 않는다(실시간 폴링 제외).
3. **ID:** `MessageId`는 문자열. 정렬·비교는 `BigInt(a) < BigInt(b)` 또는 SDK가 준 순서로만. `Number()` 변환 금지.
4. **신뢰 경계:** 브라우저에서 userId·role·점수·판정·게이지 계산 결과를 서버로 보내지 않는다. 표시용 계산(여유 라운드 = gauge ÷ 12.5)만 허용.
5. **중복 클릭:** 전송·저장·삭제·입장 버튼은 요청 중 비활성화.
6. **표시 범위:** 서버가 준 목록을 그대로 렌더한다. 다른 팬 데이터를 화면에서 걸러 내거나 재정렬하는 로직을 만들지 않는다(RLS·서버 정렬이 기준).
7. **접근성:** 버튼·입력에 label, 상태 변화는 `aria-live="polite"`, 색 외에 텍스트로도 상태 표시.
8. **모바일 기준:** 최대 폭 480px 레이아웃을 기본으로 하고 데스크톱에서는 가운데 정렬.

## 4. 라우트와 권한

| 경로 | 허용 역할 | 비로그인 | 다른 역할 |
| --- | --- | --- | --- |
| `/login` | 모두 | 표시 | 로그인 상태면 역할별 첫 화면으로 |
| `/` | 로그인 사용자 | `/login` | user→`/draw`, influencer→`/inbox`, admin→`/admin` |
| `/chat`, `/chat/[roomId]` | user | `/login` | "이 화면은 팬 계정에서 볼 수 있어요" 안내 |
| `/inbox`, `/inbox/settings` | influencer (인증됨) | `/login` | 권한 없음 안내 |
| `/inbox/verification` | influencer | `/login` | 권한 없음 안내 |
| `/admin` | admin | `/login` | 권한 없음 안내 |

화면 가드는 UX용이며 권한의 기준은 서버(RLS·RPC)다. 서버가 FORBIDDEN을 주면 같은 권한 없음 안내를 보인다.

## 5. 공통 인프라

### 5.1 세션 (`lib/session/`)

```ts
type SessionUser = { userId: string; role: 'user' | 'influencer' | 'admin'; nickname: string };
type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: SessionUser };

function SessionProvider(props: { children: React.ReactNode }): JSX.Element;
function useSession(): SessionState & {
  signIn(email: string, password: string): Promise<Result<SessionUser>>;
  signOut(): Promise<void>;
  onSessionChange(cb: (s: SessionState) => void): () => void; // 현호P 사용
};
```

- 실제 모드: Supabase Auth `signInWithPassword` / `signOut`, `onAuthStateChange` 구독. role·nickname은 본인 profiles 1행에서 읽는다(홍주P에게 `getMyProfile` SDK 요청, 없으면 SessionProvider 한 곳에서만 `lib/supabase/client`로 본인 행 조회).
- 더미 모드: 6절 더미 계정 5개로 즉시 로그인.
- 계정 전환 = signOut 후 signIn. 전환·로그아웃 시 `session-reset` 이벤트를 내보내고, 구독·캐시·폴링 타이머를 가진 훅은 이 이벤트에서 모두 정리한다.

### 5.2 SDK 주입 (`components/chat/api/`)

```ts
// components/chat/api/chat-api.ts
export type ChatApi = Pick<BackendApi,
  'getRooms' | 'getMyMembership' | 'joinRoom' | 'getMyRoundGaugeSummary' | 'advanceDemoMonth'
  | 'getMessages' | 'subscribeRoomMessages' | 'reconcileRoomMessages' | 'submitMessage'
  | 'getRoomInbox' | 'replyToMessage' | 'sendBroadcast' | 'deleteInfluencerMessage' | 'getRoomDailyBlockCount'
  | 'getRoomGreeting' | 'updateRoomGreeting' | 'clusterQuestions' | 'summarizeRoom'
  | 'getRoomFilters' | 'updateRoomFilters'
  | 'requestVerification' | 'getMyVerifications' | 'getPendingVerifications' | 'approveVerification'
  | 'getMyInfluencerProfile' | 'uploadInfluencerProfilePhoto'>;

export function ChatApiProvider(props: { api: ChatApi; children: React.ReactNode }): JSX.Element;
export function useChatApi(): ChatApi;
```

- 화면은 `useChatApi()`로만 SDK를 쓴다. `lib/api`를 직접 import하는 곳은 `app/layout.tsx`의 Provider 연결 한 곳뿐이다.
- `lib/api`가 없는 동안은 `createMockChatApi()`(6절)를 주입한다. 실제 SDK가 생기면 Provider에 넣는 값 한 줄만 바꾼다.
- `BackendApi` 타입은 `lib/api/types.ts`에서 가져온다. 아직 없으면 `components/chat/api/types.ts`에 홍주P §§6.1·6.3·6.5·7.1·7.2 타입을 그대로 옮겨 두고, SDK가 생기면 이 파일을 지우고 import 경로만 바꾼다.
- `getMessageChanges`는 SDK 저수준 API다. 화면 복구 경로는 `reconcileRoomMessages`만 쓴다.

### 5.3 요청 훅 (`components/chat/hooks/use-request.ts`)

```ts
function useRequest<I, T>(call: (input: I & { requestId: string }) => Promise<Result<T>>): {
  run(input: I): Promise<Result<T>>;   // 새 동작: 새 requestId
  retry(): Promise<Result<T>>;         // 결과 모르는 재시도: 같은 requestId·같은 input
  pending: boolean;
  error: ApiError | null;
  reset(): void;
};
```

- `run`은 새 ID를 만들고 input과 함께 보관한다. `retry`는 보관한 ID·input을 그대로 다시 보낸다.
- 성공하거나 `retryable=false` 오류면 보관한 ID를 비운다.

### 5.4 오류 코드 → 화면 처리

| code | 화면 문구 | 처리 |
| --- | --- | --- |
| UNAUTHENTICATED | 다시 로그인해 주세요. | `/login`으로 이동 |
| FORBIDDEN | 이 화면을 사용할 권한이 없어요. | 권한 없음 상태 |
| NOT_FOUND | 찾을 수 없어요. | 목록으로 돌아가기 |
| VALIDATION_ERROR | 입력 내용을 확인해 주세요. | 입력 유지 |
| INSUFFICIENT_CARDS | 이 인플루언서 카드를 {missingCards}장 더 모으면 입장할 수 있어요. | details 사용 |
| REJOIN_NOT_AVAILABLE | 이번 달 라운드를 3회 완료하면 다시 입장할 수 있어요. (이번 달 {monthlyRoundCount}회) | details 사용 |
| ROOM_INACTIVE | 채팅방에서 퇴장한 상태예요. | 구독 해제, 입력 비활성화, 재입장 안내 |
| REQUEST_IN_PROGRESS | 처리 중이에요. 잠시 후 다시 시도해 주세요. | 같은 requestId 재시도 버튼 |
| FILTERS_CHANGED | 채팅방 필터 설정이 바뀌었어요. 다시 보내 주세요. | 같은 requestId 재시도 버튼 |
| RATE_LIMITED | 메시지를 너무 빨리 보내고 있어요. {retryAfterSeconds}초 후에 다시 보내 주세요. | 카운트다운 후 버튼 활성화 |
| FILTER_UNAVAILABLE | 지금은 메시지를 확인할 수 없어요. 잠시 후 다시 시도해 주세요. | 같은 requestId 재시도 버튼, 입력 유지 |
| SOURCE_CHANGED | 그사이 질문 상태가 바뀌었어요. 다시 실행해 주세요. | 같은 requestId 재시도 |
| ALREADY_REPLIED | 이미 답변한 질문이에요. | 인박스 새로고침 |
| ALREADY_REVIEWED | 이미 처리된 신청이에요. | 목록 새로고침 |
| PENDING_EXISTS | 이미 심사 중인 신청이 있어요. | 내 신청 목록 표시 |
| INVALID_MONTH_TRANSITION | 바로 다음 달만 진행할 수 있어요. | 현재 월 다시 조회 |
| IDEMPOTENCY_CONFLICT | 같은 요청이 다른 내용으로 처리됐어요. 화면을 새로고침해 주세요. | 상태 다시 조회 |
| NETWORK_ERROR | 연결이 불안정해요. 다시 시도해 주세요. | 같은 requestId 재시도 |
| INTERNAL_ERROR / 그 외 | 문제가 생겼어요. 잠시 후 다시 시도해 주세요. | 같은 requestId 재시도 |

문구는 `components/chat/copy.ts` 한 파일에 모은다. 서버 `error.message`는 화면에 그대로 출력하지 않는다.

### 5.5 공통 UI (`components/ui/`)

Button, IconButton, TextArea(글자 수 표시), Modal(확인 대화상자), Toast, Badge, Avatar(이미지 → 실패 시 이름 첫 글자), Spinner, EmptyState, ErrorState(재시도 버튼), GaugeBar. 현호P 디자인 토큰이 오기 전에는 Tailwind 기본값으로 만들고, 토큰은 `tailwind.config`의 theme 확장으로 받는다.

## 6. 더미 SDK (`components/chat/api/mock/`)

`createMockChatApi(options?)`는 `ChatApi`와 같은 시그니처로 메모리 상태를 다룬다. 실제 연동 완료로 보고하지 않는다.

**계정 (로그인 화면의 더미 모드 선택지)**

| 키 | role | 상태 |
| --- | --- | --- |
| userA | user | 첫 인물 누적 10장, 입장 안 함, Buddy |
| userB | user | 첫 인물 누적 5장, 첫 방 입장 중·게이지 50 |
| influencer | influencer | 첫 방 소유, 인증됨 |
| pendingInfluencer | influencer | 11번째 신청자, 심사 대기 |
| admin | admin | 월 경과·심사 권한 |

**데이터:** 방 10개(인증됨) + 승인 시 11번째 방(`cardStatus='preparing'`). 메시지 4종 샘플, 답변 1건(`replyContext` 있음)과 1건(없음), 삭제된 전체 메시지 1건.

**판정 규칙 (본문 키워드로 고정):** `[block]` 포함 → block, `[suggest]` → suggest + rewrite, `[suggest-null]` → suggest + rewrite null, `[slow]` → 2초 지연, `[fail]` → FILTER_UNAVAILABLE, 그 외 → pass.

**실시간:** `subscribeRoomMessages`는 메모리 이벤트 버스. 다른 계정이 보낸 답변·전체 메시지·삭제가 열린 화면에 INSERT/UPDATE로 전달된다. `options.dropConnection()`은 `onStatus('CHANNEL_ERROR')`, `options.restoreConnection()`은 `onStatus('SUBSCRIBED')`를 보낸다. `reconcileRoomMessages`는 메모리 상태에서 cursor 이후 변경을 upsert한 전체 목록을 돌려준다.

**오늘 차단 수:** `getRoomDailyBlockCount`는 더미 상태에서 block 판정이 날 때마다 1씩 오른 값을 `{roomId, day, count}`로 돌려준다.

## 7. 실시간 구독 훅 (`components/chat/use-room-messages.ts`)

```ts
type SubscribeStatus = 'SUBSCRIBED' | 'TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED';
function useRoomMessages(roomId: string): {
  messages: Message[];           // id 오름차순, 중복 없음
  status: 'connecting' | 'live' | 'polling' | 'stopped';
  loadOlder(): Promise<void>;    // beforeId 페이지
  hasOlder: boolean;
  applyLocal(message: Message): void; // 내 pass 전송 결과·인플루언서 발송 결과 즉시 반영
};
```

홍주P §9.1 계약을 그대로 따른다.

1. `subscribeRoomMessages({roomId, onMessage, onStatus})`와 `getMessages({roomId, limit:50})`를 동시에 시작한다. 첫 조회가 끝나기 전 `onMessage` 이벤트는 버퍼에 두고 조회 결과와 병합 → id 중복 제거 → id 오름차순.
2. `onMessage`: 없는 id면 추가, 있는 id면 교체(삭제 UPDATE는 `body=null`·`deletedAt`). UPDATE로 새 행을 만들지 않는다.
3. `onStatus('SUBSCRIBED')`: 폴링을 멈추고 `reconcileRoomMessages({roomId, currentMessages: messages, updatedAfter, afterId})`를 한 번 호출해 결과 `messages`로 목록을 교체하고 cursor(`updatedAfter`·`afterId`)를 저장한다. `status='live'`.
4. `onStatus('TIMED_OUT' | 'CHANNEL_ERROR' | 'CLOSED')`: 3초 간격으로 같은 `reconcileRoomMessages` 호출(`status='polling'`). 화면이 직접 unsubscribe한 뒤 오는 `CLOSED`는 무시한다.
5. ROOM_INACTIVE·FORBIDDEN·UNAUTHENTICATED 오류, membership left, 로그아웃이면 구독과 폴링을 모두 멈춘다(`status='stopped'`).
6. roomId 변경·언마운트·`session-reset`에서 unsubscribe 함수 호출, 타이머·버퍼·cursor 정리.

단위 테스트: 버퍼 병합, 중복 INSERT, 삭제 UPDATE 교체, CHANNEL_ERROR → 폴링 → SUBSCRIBED 복구, unsubscribe 뒤 CLOSED 무시, 정리.

## 8. 화면 정의

각 화면은 **로딩 / 빈 상태 / 오류 / 권한 없음**을 모두 가진다. 아래는 화면별 추가 정의다.

### F-01 Next.js 앱 골격 (P0)

- 홍주P root bootstrap의 `package.json`·`package-lock.json`에 Next.js·Tailwind 의존성을 추가하고 `next.config`·`tailwind.config`·`app/layout.tsx`·빈 페이지(`/login`, `/draw`, `/collection`, `/collection/owned`, `/collection/upgrade`, `/chat`, `/inbox`, `/admin`)를 만든다. 기존 루트 scripts는 지우지 않고 `dev`·`build`·`lint`를 추가한다(`test:frontend`는 홍주P와 합의 후).
- 레이아웃: 상단 바(앱 이름, 현재 계정, 계정 전환 버튼), 본문 최대 폭 480px.
- **완료 기준:** `npm run build`·`npm run lint` 통과, 8개 경로 이동, 홍주P backend scripts 동작 유지, env 파일 미생성.

### F-02 로그인·세션·계정 전환 (P0)

- `/login`: 이메일·비밀번호 입력, 로그인 버튼. 더미 모드에서는 5개 계정 버튼만 표시.
- 상단 바의 "계정 전환": 로그아웃 → `/login`.
- `/`: 역할별 첫 화면으로 이동.
- **완료 기준:** 전환 후 이전 계정의 방·메시지·구독이 남지 않음. 암호가 코드·로그에 없음. 현호P가 `useSession()`으로 현재 사용자와 변경을 받음.

### F-03 방 목록 `/chat` (P1)

데이터: `getRooms()`. 각 방 카드는 프로필 사진(Avatar), 인플루언서 이름, 인증 배지(`verifiedAt`·`influencerType`), 본인 보유 배지(`supportBadge`, none이면 숨김), 상태 영역을 가진다.

| `joinReason` / 상태 | 상태 문구 | 버튼 |
| --- | --- | --- |
| `already_active` | 입장 중 · 게이지 {gauge} | 들어가기 → `/chat/[roomId]` |
| `eligible` (membership 없음) | 입장할 수 있어요 | 입장하기 → `/chat/[roomId]` |
| `eligible` (membership left) | 다시 입장할 수 있어요 | 다시 입장하기 |
| `need_cards` | 카드 {missingCards}장 더 모으면 입장할 수 있어요 (누적 {earnedCards}/{requiredCards}) | 없음 |
| `rejoin_rounds_needed` | 이번 달 라운드 3회를 완료하면 다시 입장할 수 있어요 (이번 달 {currentMonthRoundCount}회) | 없음 |
| `card_preparing` | 카드 준비 중 | 없음 |

- **완료 기준:** 6가지 상태가 문구·버튼대로 나옴. 퇴장 중인 방은 대화 화면으로 들어갈 수 없음.

### F-04 입장 `/chat/[roomId]` (membership이 active가 아닐 때) (P1)

- 안내 문구(9절 `entryNotice`)와 "입장하면 게이지 50으로 시작해요. 한 달에 라운드 3회를 기준으로 오르내려요." 표시.
- "입장하기" → `joinRoom({requestId, roomId})`. 성공 시 `getMyMembership`으로 최신 상태를 읽고 대화 화면으로 전환. 응답의 `welcomeMessage`가 있으면 첫 말풍선으로 바로 보인다.
- **완료 기준:** INSUFFICIENT_CARDS·REJOIN_NOT_AVAILABLE이 details 값으로 안내됨. 입장 버튼 연타 시 1회만 처리.

### F-05 대화 `/chat/[roomId]` (membership active) (P1)

구성: 상단(프로필 사진, 이름, 인증 배지, GaugeBar) / 메시지 목록 / 입력창(F-06).

| `messageKind` | 정렬 | 내용 |
| --- | --- | --- |
| `user_question` (내 것) | 오른쪽 | 본문, 본인 보유 배지 |
| `influencer_answer` | 왼쪽 + 프로필 사진 | 위에 인용(아래 규칙), 본문, "내 질문에 대한 답변" 표시(해당 시) |
| `influencer_broadcast` | 왼쪽 + 프로필 사진 | 본문, "전체 메시지" 라벨 |
| `greeting` | 왼쪽 + 프로필 사진 | 본문, "인사말" 라벨 |
| 삭제됨 (`deletedAt` 있음) | 원래 위치 | "삭제된 메시지" (회색), 인용·라벨 숨김 |

**인용 규칙:**

1. `replyContext`가 있으면 닉네임 없이 인용 블록으로 표시.
2. 없고 `replyTo`가 현재 목록의 내 질문 id면 내 질문 본문을 인용.
3. 둘 다 아니면 답변만 표시.

**"내 질문에 대한 답변" 판별:** `replyTo`가 내 질문 id이거나, 답변의 `clusterId`가 내 질문의 `clusterId`와 같을 때. 팬 화면은 `message_clusters`를 조회하지 않는다.

- 과거 메시지: 목록 상단 "이전 메시지 보기" 버튼으로 `loadOlder`.
- 첫 입장 빈 상태 안내는 두지 않는다(인사말이 첫 메시지).
- 퇴장(ROOM_INACTIVE·membership left) 시 입력창을 감추고 재입장 안내로 바꾼다.
- **완료 기준:** 두 브라우저(userB·influencer)에서 답변·전체 메시지·삭제가 새로고침 없이 반영. 연결을 끊었다 복구해도 누락·중복 없음. 다른 팬 질문이 보이지 않음.

### F-06 전송·판정 (P1)

- 입력: TextArea, 1~2000자(공백 제외 기준은 서버 판단, 화면은 trim 후 1자 이상일 때 전송 활성화), 글자 수 표시.
- 전송: `submitMessage({requestId, roomId, body})`.

| 결과 | 화면 |
| --- | --- |
| pass | 입력 비우기, `applyLocal(message)` |
| suggest + rewrite 있음 | 경고 카드: 사유 + 수정 문장 + 버튼 2개. "이대로 보내기" → 새 requestId + `suggestionToken`으로 전송(만료 `expiresAt` 지나면 버튼 숨김). "고쳐서 보내기" → 수정 문장을 입력창에 넣고 카드 닫기(이후 전송은 token 없이 새 requestId) |
| suggest + rewrite null | 경고 카드: 사유만, 입력 유지 |
| block | 차단 카드: 사유만, 입력 유지 |

- 최초 suggest의 수정 문장은 메모리에 보관한다(같은 requestId 재시도 응답은 rewrite가 null일 수 있음).
- 오류는 5.4 표대로. FILTERS_CHANGED·REQUEST_IN_PROGRESS·NETWORK_ERROR·FILTER_UNAVAILABLE은 같은 requestId 재시도.
- **완료 기준:** 판정 4가지·token 만료·재시도 오류별 화면. 연타·재시도 시 메시지 1건만 생성.

### F-07 게이지·월 경과 (P1)

- 방 상단 GaugeBar: `gauge`(0~100) 바, "여유 라운드 {gauge ÷ 12.5}회".
- 게이지 상세(상단 탭 시 펼침): `getMyRoundGaugeSummary()` → "이번 달 라운드 {monthlyRoundCount}/{targetRounds}회 · {remainingRounds}회 남음", 월 마감일(현재 월 말일).
- `gauge ≤ 12.5`이면 경고: "이번 달 라운드 3회를 채우지 못하면 월 마감에 퇴장할 수 있어요."
- 퇴장 화면: "게이지가 모두 소진되어 퇴장했어요. 보유한 카드와 입장 자격은 그대로예요. 이번 달 라운드 3회를 완료하면 다시 입장할 수 있어요."
- 관리자 `/admin` 데모 영역: 현재 월 표시, "한 달 경과" 버튼 → `advanceDemoMonth({requestId, targetMonth: 다음 달 1일})`, 결과 `members` 표(방·사용자·라운드 수·이전 게이지→게이지·상태). `applied=false`면 "이미 처리된 달이에요".
- **완료 기준:** 시연 흐름 — userB 입장 상태에서 월 경과 3회(입장 월 정산 없음 → 50→12.5 → 0)로 퇴장, 라운드 3회 후 재입장 시 게이지 50.

### F-08 인박스 `/inbox` (P1)

- 방 선택(본인 방 1개면 생략). 목록: `getRoomInbox({roomId, includeAnswered, cursor, limit:50})`, 서버 순서 그대로, "더 보기"로 cursor 페이지.
- 항목: 본문, 보유 배지, 시각, 답변 상태. "답변 완료 포함" 토글.
- 답변: 항목 펼침 → TextArea → `replyToMessage({requestId, roomId, replyTo, body})`. block이면 사유 표시, ALREADY_REPLIED면 목록 새로고침.
- 상단 요약: `getRoomDailyBlockCount({roomId})` → "오늘 AI가 {count}건을 걸러냈어요". 인박스 진입·답변 후 다시 조회하고 count가 0이어도 표시한다. 같은 문구를 인박스 설정의 필터 영역에도 보여 준다.
- **완료 기준:** 같은 품질이면 보유 배지 높은 질문이 위, 동점은 최신순. 답변이 팬 화면에 실시간 반영.

### F-10 인증 신청·심사 (P2-1)

- `/inbox/verification` (pendingInfluencer): 유형 선택(유튜버·미디어 프로·투어 선수), 증빙 URL(https만), 신청 → `requestVerification`. 내 신청 목록 `getMyVerifications`(상태·반려 사유).
- `/admin` 심사 영역: `getPendingVerifications` 목록, 승인 / 반려(사유 1~500자) → `approveVerification`.
- **완료 기준:** 11번째 신청자 승인 → 방 목록에 새 방, 인증 배지, "카드 준비 중".

### F-09 질문 묶기·대화 요약 (P2-2·3)

- 인박스 상단 버튼 "비슷한 질문 묶기" → `clusterQuestions`, "대화 요약" → `summarizeRoom`. 실행 중 최대 20초 진행 표시.
- 묶음 항목: 대표 질문, "{N}명이 질문했어요", 펼치면 원 질문들. 묶음 답변은 F-08과 같은 답변 동작.
- **완료 기준:** 묶음 1회 답변 후 묶음이 닫힘. 빈 결과·SOURCE_CHANGED 안내.

### F-11 필터 설정 `/inbox/settings` (P2-4)

- `getRoomFilters` → 항상 차단 항목(`mandatoryFilters`)은 잠금 표시, 선택 항목만 토글. 목록은 응답으로 그린다.
- 선택 항목을 끄려 하면 확인 대화상자: "끄면 욕설·비하성 메시지가 그대로 보일 수 있어요. 계속할까요?" 동의 후 `updateRoomFilters({..., expectedVersion})`. FILTERS_CHANGED면 최신값을 다시 읽고 안내.
- 팬 화면에 필터 해제 안내를 만들지 않는다.

### F-14 인사말 `/inbox/settings` (P2-5)

- `getRoomGreeting` → 현재 문구(`isDefault`면 "기본 문구" 라벨)와 `version`, TextArea 200자, 저장 → `updateRoomGreeting({requestId, roomId, expectedVersion: version, text})`. 비우고 저장하면 기본 문구로 복원. 성공 응답의 `RoomGreeting`으로 화면과 version을 갱신한다.
- 안내: "새로 처음 입장하는 팬에게만 적용돼요."
- **완료 기준:** 200자 초과 저장 불가, block·실패 시 이전 문구 유지.

### F-15 전체 메시지 `/inbox` (P2-6)

- 인박스 상단 작성 칸 → `sendBroadcast({requestId, roomId, body})`, 응답 `Message`를 인박스 대화 목록에 바로 반영. 안내: "지금 입장 중인 팬 모두에게 보여요."
- **완료 기준:** 입장 중인 팬 화면에 실시간 도착. 실패·block 시 입력 유지.

### F-16 메시지 삭제 (P2-7)

- 인박스의 내 답변·전체 메시지에 "삭제" → 확인 "삭제하면 되돌릴 수 없어요. 팬 화면에는 '삭제된 메시지'로 보여요." → `deleteInfluencerMessage`.
- 답변 삭제 후 인박스를 새로고침해 질문이 미답변으로 돌아왔는지 반영. 인사말·팬 메시지에는 삭제 버튼 없음.

### F-13 프로필 사진 표시 (P2-8)

- Avatar 컴포넌트: `profileImageUrl` → 이미지, null 또는 로드 실패 → 이름 첫 글자 원형.
- 방 목록·방 상단·인플루언서 말풍선 모두 방의 `profileImageUrl` 하나를 쓴다.

### F-12 프로필 사진 변경 `/inbox/settings` (P2-8)

- `getMyInfluencerProfile` → 현재 사진(없으면 `fallbackImageUrl` 또는 이름 첫 글자), 파일 선택, 미리보기(`URL.createObjectURL`).
- 화면 사전 검사: MIME `image/jpeg`·`image/png`·`image/webp`, 5MiB(5,242,880 bytes) 이하. 아니면 업로드하지 않고 "JPG·PNG·WebP 형식의 5MB 이하 사진만 올릴 수 있어요" 안내.
- 업로드: `uploadInfluencerProfilePhoto({requestId, file})`. 512×512 WebP 변환·메타데이터 제거·Storage 업로드·RPC 갱신은 SDK 내부에서 한다. 화면은 변환하지 않는다. 재시도는 같은 requestId·같은 file.
- 성공 응답 `MyInfluencerProfile`로 현재 사진을 바꾸고 `getRooms`를 다시 읽는다. 실패 시 이전 사진 유지.
- **완료 기준:** 6MiB 파일·GIF는 화면에서 거부, 변경 즉시 방 목록·방 상단·인플루언서 말풍선에 반영.

## 9. 고정 문구 (`components/chat/copy.ts`)

| 키 | 문구 |
| --- | --- |
| entryNotice | 이 채팅방은 AI가 부적절한 메시지를 자동으로 걸러냅니다. 내 질문은 답변과 함께 닉네임 없이 다른 팬에게 보일 수 있습니다. |
| myAnswerLabel | 내 질문에 대한 답변 |
| deletedMessage | 삭제된 메시지 |
| broadcastLabel | 전체 메시지 |
| greetingLabel | 인사말 |
| cardPreparing | 카드 준비 중 |
| gaugeWarning | 이번 달 라운드 3회를 채우지 못하면 월 마감에 퇴장할 수 있어요. |
| rejoinGuide | 이번 달 라운드 3회를 완료하면 다시 입장할 수 있어요. |
| filterDisableConfirm | 끄면 욕설·비하성 메시지가 그대로 보일 수 있어요. 계속할까요? |
| filteredToday | 오늘 AI가 {N}건을 걸러냈어요 |

차단·수정 제안 사유(`reason`)는 서버가 주는 문구를 그대로 쓴다(문환P 고정 안내문 10개).

## 10. 대기 중인 계약 (구현 시 처리 방법)

| 항목 | 현재 처리 | 확정되면 |
| --- | --- | --- |
| `getMyProfile` | SessionProvider 한 곳에서 본인 profiles 조회 | SDK로 교체 |
| 디자인 토큰·시안 | Tailwind 기본값 | `tailwind.config` theme 확장, 컴포넌트 스타일 교체 |
| 데모 계정 이메일·암호 | 더미 계정 5개 | 홍주P demo:setup 후 전달받은 이메일을 로그인 화면 안내에 반영, 암호는 입력 |
| 프론트 단위 테스트 script | Vitest 설정만 준비 | 홍주P와 합의 후 `test:frontend` 추가 |

## 11. 다른 담당자에게 요청할 때

담당 경로 밖의 변경이 필요하면 직접 고치지 않고 보고에 아래 형식으로 남긴다.

```text
[요청] 홍주P / lib/api/chat.ts
- 필요한 것: getRoomInbox 반환에 ...
- 이유: F-05 재연결 복구에서 ...
- 임시 처리: ...
```

## 12. 구현 순서

1. F-01 → F-02(더미) → 5.2~5.5 공통 인프라 → 6절 더미 SDK → 7절 훅
2. F-03 → F-04 → F-05 → F-06 (더미)
3. 실제 SDK 연결: F-02 Auth → F-03~F-06 → F-07 → F-08
4. P2: F-10 → F-09 → F-11 → F-14 → F-15 → F-16 → F-13 → F-12

## 13. 검증

| 종류 | 명령·방법 | 기준 |
| --- | --- | --- |
| 타입·린트·빌드 | `npm run typecheck`(있으면), `npm run lint`, `npm run build` | 오류 0 |
| 단위 테스트 | `npm run test:frontend` (Vitest, 합의 후) | `use-room-messages` 병합·폴링·복구·정리, `use-request` ID 규칙, 오류 매핑, Avatar 대체, 사진 파일 사전 검사 |
| 더미 시나리오 | 더미 모드로 6절 계정 전환하며 8절 완료 기준 확인 | 티켓별 통과 |
| 실제 연동 | 홍주P 로컬 stack + demo:setup 후 같은 시나리오 | 티켓별 통과, 두 브라우저 실시간 확인 |
| 권한 | admin·다른 influencer로 인박스·다른 방 접근 | 권한 없음 안내, 서버 FORBIDDEN 처리 |

## 14. 완료 보고 형식

```text
티켓: F-05
상태: 더미 완료 | 실제 연동 완료 | 대기(이유)
변경 파일: ...
검증: 실행한 명령과 결과, 확인한 시나리오
미검증: ...
담당자 요청: (11절 형식)
```

[자성P_plan.md](./자성P_plan.md) 5절 티켓 표의 "현재 상태"도 같은 내용으로 갱신한다.

## 15. 샌드박스 선개발과 레포 이전

### 15.1 언제 쓰는가

홍주P B-01 root bootstrap(`package.json`·`package-lock.json`·`lib/`·`supabase/` 뼈대)이 `main`에 올라오기 전에 UI를 먼저 만들기 위해 쓴다. bootstrap이 올라오면 15.3대로 옮기고, 이후 개발은 레포에서만 한다.

### 15.2 샌드박스 구성

- 위치: `ax-hackerton/BirdieBuddy-ui/` (레포 `ax-hackerton/BirdieBuddy/`의 형제 폴더). git 저장소로 만들지 않는다.
- 패키지(샌드박스 자체 `package.json`): `next@16.4`, `react@19.3`, `react-dom@19.3`, `typescript@5.9`, `tailwindcss@4.3`·`@tailwindcss/postcss@4.3`, `eslint`·`eslint-config-next@16.4`, `@types/react`·`@types/node`, `vitest`·`@testing-library/react`·`jsdom`. TypeScript 7.x는 Next.js 호환이 확인되지 않아 쓰지 않는다. 버전은 `package-lock.json`으로 고정하고 이전할 때 같은 버전을 쓴다.
- 경로: 2절 자성P 소유 경로를 그대로 쓴다. 현호P 경로(`app/(user)/draw`, `app/(user)/collection/**`, `components/card/`)와 `lib/api`·`lib/supabase`·`supabase/`는 만들지 않는다.
- SDK: `ChatApiProvider`에 `createMockChatApi()`만 주입한다. 타입은 `components/chat/api/types.ts`에 홍주P 계약을 옮겨 둔다. Supabase 연결·env 파일은 만들지 않는다.
- 범위: F-01(샌드박스 골격), F-02(더미 세션), 5~7절 공통 인프라, F-03~F-08 더미 화면. P2도 더미로 진행할 수 있다.
- 검증: 샌드박스에서 `npm run build`·`npm run lint`·`npx vitest run`.

### 15.3 레포 이전 절차

1. 레포 `main` pull, bootstrap 파일 확인. `git status`가 깨끗한지 확인한다.
2. 루트 `package.json`에 샌드박스와 같은 버전의 프론트 의존성을 `npm install`로 추가하고 `dev`·`build`·`lint` scripts를 추가한다. 홍주P scripts·`tsconfig.backend.json`·backend 의존성은 지우거나 덮어쓰지 않는다. 프론트용 `tsconfig.json`은 backend tsconfig와 범위가 겹치지 않게 `app/`·`components/`·`lib/session/`·`lib/api/`를 포함한다.
3. 샌드박스에서 복사: `app/`(자성P 경로), `components/chat/`, `components/ui/`, `lib/session/`, `next.config.*`, `postcss.config.*`, `eslint.config.*`, `vitest.config.*`. `node_modules/`·`.next/`·샌드박스 `package.json`·lockfile은 복사하지 않는다.
4. 현호P 경로 placeholder(`/draw`, `/collection`, `/collection/owned`, `/collection/upgrade`)를 추가한다.
5. `lib/api/types.ts`가 있으면 `components/chat/api/types.ts`를 지우고 import 경로를 바꾼다. 실제 SDK가 있으면 `ChatApiProvider` 주입 값을 실제 SDK로 바꾸고, 없으면 더미를 유지한다.
6. `npm run build`·`npm run lint`·프론트 테스트, 홍주P `npm run typecheck`가 여전히 통과하는지 확인한다.
7. `CONTRIBUTING.md` 형식으로 커밋한다(예: `feat: F-01 Next.js 앱 골격과 샌드박스 선개발 화면 이전`). 이전 후 샌드박스 폴더는 더 수정하지 않는다.

