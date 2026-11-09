# BirdieBuddy — anonymous 작업 계획

**역할:** 담당 미정 — 개발 완료 후 담당자 결정

> 기준 문서: [BirdieBuddy 해커톤 개발 설계 & 역할 분담](https://claude.ai/artifact/HQ7wLf6Cewh2thGTH37Dof) · 작성일 2026-11-09
> 기획안: spec_BirdieBuddy.md (스크린골프 인플루언서 카드 컬렉션)

## 1. 전체 시스템 아키텍처

화면 3종이 하나의 Next.js 앱을 거쳐 Supabase(DB·실시간·스토리지)와 LLM API에 닿는 구조입니다.
실제 골프존 라운드·회원 연동은 하지 않고 **'라운드 완료' 버튼 + 데모 계정 전환**으로 대체합니다.

```mermaid
flowchart LR
  subgraph Client["화면 (Next.js App Router)"]
    U["유저 웹 (모바일)<br/>뽑기 · 컬렉션 · 채팅"]
    I["인플루언서 인박스<br/>우선순위 · 묶음 · 요약"]
    A["관리자 화면<br/>인증 승인 · 배지"]
  end
  subgraph Server["Next.js API Route"]
    C["카드 서비스<br/>뽑기 · 강화 · 컬렉션"]
    CH["채팅 서비스<br/>입장 · 메시지 · 게이지"]
    AI["AI 모듈 (lib/ai)<br/>필터 · 점수 · 묶기 · 요약"]
  end
  DB[("Supabase Postgres")]
  RT["Supabase Realtime"]
  ST["Supabase Storage<br/>카드 이미지 30장"]
  LLM["LLM API"]

  U --> C
  U --> CH
  I --> CH
  A --> CH
  CH --> AI
  AI --> LLM
  C --> DB
  CH --> DB
  DB --> RT
  RT -. 구독 .-> U
  RT -. 구독 .-> I
  U -. 이미지 .-> ST
```

### 기술 스택 (확정)

| 영역 | 선택 | 비고 |
| --- | --- | --- |
| 프론트·API | Next.js (App Router) + TypeScript + Tailwind | 화면과 API를 한 레포에서 |
| DB | Supabase Postgres | 스키마: `supabase/schema.sql` (홍주P B-01) |
| 실시간 채팅 | Supabase Realtime (`messages` 테이블 구독) | 막히면 3초 폴링으로 대체 |
| 이미지 | Supabase Storage | 카드 이미지 30장 사전 생성 |
| AI | LLM API (메시지당 1회 호출) | 필터 + 품질 점수를 JSON 하나로 |
| 배포 | Vercel | 1일차 오전 첫 배포 |
| 보안 | RLS 끔, API Route에서만 service role 키 사용 | 클라이언트는 Realtime 구독용 anon 키만 |

### 레포 구조와 담당 경계

```
BirdieBuddy/
├─ docs/                     # architecture.md + 담당자별 plan 파일
├─ app/
│  ├─ (user)/draw/            # 카드 뽑기 연출·결과        — 현호P
│  ├─ (user)/collection/      # 컬렉션·강화                — 현호P
│  ├─ (user)/chat/            # 채팅방 목록·입장·대화       — 자성P
│  ├─ inbox/                  # 인플루언서 인박스          — 자성P
│  ├─ admin/                  # 관리자 인증 승인            — 자성P
│  └─ api/                    # 모든 API Route              — 홍주P
│     ├─ rounds/  cards/  me/  rooms/  verifications/  admin/  demo/
├─ components/
│  ├─ card/                   # 카드·카드팩·등급 효과       — 현호P
│  ├─ chat/                   # 메시지·게이지·배지          — 자성P
│  └─ ui/                     # 공통 UI (디자인 토큰)       — 자성P 셋업, 현호P 디자인
├─ lib/
│  ├─ ai/                     # moderateAndScore 등         — 문환P
│  ├─ db/                     # Supabase 클라이언트·쿼리    — 홍주P
│  ├─ scoring.ts              # ownScore·priority 공식      — 홍주P
│  └─ config.ts               # game_config 읽기            — 홍주P
└─ supabase/
   ├─ schema.sql              # 테이블 12개 + upgrade_card  — 홍주P
   └─ seed.sql                # 데모 계정·인플루언서·템플릿 — 홍주P
```

### 개발 규칙 (전원)

1. **상태가 있는 화면은 클라이언트 컴포넌트로** — 뽑기 연출, 채팅, 인박스, 게이지처럼 상태·이벤트가 있는 컴포넌트는 파일 맨 위에 `'use client'`를 붙입니다. 서버 컴포넌트는 레이아웃·정적 껍데기에만 씁니다.
2. **데이터는 항상 `/api/*`를 거쳐서** — 화면에서 Supabase 쿼리를 직접 호출하지 않습니다. Supabase를 클라이언트에서 직접 쓰는 건 `messages` **실시간 구독뿐**입니다. API 명세(T-01)가 화면과 서버 사이의 유일한 기준입니다.

### 데이터 모델 (테이블 12개)

| 테이블 | 주요 컬럼 | 용도 |
| --- | --- | --- |
| users | id, nickname, role(user/influencer/admin) | 데모 계정 3종 |
| influencers | id, user_id, name, type(youtuber/media_pro/tour), verified_at | 후보 10명, 배지 = verified_at + type |
| card_templates | id, influencer_id, style(illust/retro/holo), image_url | 인물 × 스타일 = 30행 |
| user_cards | user_id, template_id, grade, count | 등급별 보유 장수, 강화 시 grade 한 칸 이동 |
| rounds | id, user_id, played_at | 라운드 완료 기록 (게이지 계산에도 사용) |
| draws | id, user_id, round_id, template_id, grade, is_new | 뽑기 결과 이력 |
| chat_rooms | id, influencer_id, filter_options(jsonb) | 인플루언서당 1개 |
| room_members | room_id, user_id, gauge, status(active/left) | 입장 상태와 게이지 |
| messages | id, room_id, sender_id, sender_type, reply_to, body, filter_verdict, own_score, quality_score, priority, cluster_id | 유저 메시지 + 인플루언서 답변, 차단 건도 저장 |
| message_clusters | id, room_id, representative, member_count | 유사 질문 묶음 |
| verifications | id, influencer_id, type, evidence_url, status, reviewed_by | 인증 신청과 심사 |
| game_config | key, value(jsonb) | 확률·기준값 (코드에 하드코딩 금지) |

등급: `common`(일반) → `rare`(레어) → `epic`(에픽) → `special`(스페셜)

### 설정값 (game_config, 잠정 확정 · 배포 없이 값만 변경)

| key | 값 |
| --- | --- |
| grade_rates | 일반 70 · 레어 22 · 에픽 7 · 스페셜 1 (%) |
| upgrade_cost | 같은 템플릿·등급 10장 → 다음 등급 1장 |
| room_entry | 해당 인플루언서 카드 5장 (등급 무관) |
| priority_weights | 보유 0.6 : 품질 0.4 |
| gauge | 시작 100, 월 3회 미만이면 달마다 -50, 0이면 퇴장 |

### API 목록

| 메서드 · 경로 | 하는 일 | 티어 | 구현 | 사용 화면 |
| --- | --- | --- | --- | --- |
| POST /api/rounds/complete | 라운드 기록 + 카드 1장 추첨, 결과 반환 | P0 | 홍주P B-03 | 현호P |
| GET /api/me/collection | 인물별·등급별 보유 현황 | P0 | 홍주P B-04 | 현호P |
| POST /api/cards/upgrade | 10장 소모 → 다음 등급 1장 (`upgrade_card` 함수) | P0 | 홍주P B-04 | 현호P |
| GET /api/rooms | 채팅방 목록 + 입장 가능 여부 | P1 | 홍주P B-05 | 자성P |
| POST /api/rooms/:id/join | 입장 조건 확인 후 입장 | P1 | 홍주P B-05 | 자성P |
| GET /api/rooms/:id/messages | 유저용 대화 목록 | P1 | 홍주P B-06 | 자성P |
| POST /api/rooms/:id/messages | 필터 → 점수 → 저장, 차단·수정 제안 반환 | P1 | 홍주P B-06 + 문환P A-02·A-03 | 자성P |
| GET /api/rooms/:id/inbox | 인플루언서용 우선순위 정렬 목록 | P1 | 홍주P B-08 | 자성P |
| POST /api/rooms/:id/reply | 인플루언서 답변 | P1 | 홍주P B-08 | 자성P |
| POST /api/demo/advance-month | 한 달 경과 시뮬레이션 (게이지 감소·퇴장) | P1 | 홍주P B-07 | 자성P |
| POST /api/verifications | 인증 신청 | P2 | 홍주P B-09 | 자성P |
| PATCH /api/admin/verifications/:id | 승인·반려, 배지 부여 | P2 | 홍주P B-09 | 자성P |
| POST /api/rooms/:id/summary | 대화 요약 | P2 | 문환P A-05 | 자성P |
| PATCH /api/rooms/:id/filter | 선택 필터 해제 | P2 | 홍주P B-10 | 자성P |

### AI 모듈 인터페이스 (문환P 제공 → 홍주P 호출)

우선순위 계산(`ownScore`, `priority`)은 AI가 아닌 공식이므로 홍주P가 `lib/scoring.ts`에 둡니다. AI 모듈은 LLM을 호출하는 함수만 제공합니다.

```ts
// lib/ai/index.ts
export type Verdict = 'pass' | 'suggest' | 'block';

export async function moderateAndScore(input: {
  body: string;
  disabledFilters: string[];          // 인플루언서가 끈 선택 필터 (욕설, 비하 등)
}): Promise<{
  verdict: Verdict;
  category?: string;                  // 협박, 성희롱, 스팸 등
  reason?: string;                    // 유저에게 보여줄 짧은 사유
  rewrite?: string;                   // suggest일 때 수정 제안
  quality: number;                    // 0~100, 메시지 품질 점수
}>;

export async function clusterQuestion(roomId: string, body: string): Promise<string | null>; // P2, cluster_id
export async function summarize(messages: { body: string; sender: string }[]): Promise<string>;  // P2
```

### 범위 우선순위와 체크포인트

| 티어 | 범위 | 완료 시점 |
| --- | --- | --- |
| P0 | 라운드 완료 → 카드 뽑기 연출 → 컬렉션 → 10장 강화 | 1일차 저녁 (T-03) |
| P1 | 채팅방 입장 조건, 유저 채팅, AI 안전 필터·안내, 우선순위 인박스, 유지 게이지 | 2일차 점심 (T-04) |
| P2 | 인증 신청·관리자 승인·배지, 유사 질문 묶기, 대화 요약, 필터 해제 | 2일차 오후 동결 전 |

### 공통 티켓 (전원)

- [ ] **T-01** API 명세 합의 — 위 API별 요청·응답 JSON 예시를 킥오프 2시간 안에 고정 (P0)
- [ ] **T-02** 미정 항목 결정 — 인플루언서 10명, 스타일 3종 (등급 확률·입장 기준·뽑기 로직은 확정) (P0)
- [ ] **T-03** P0 통합 체크포인트 — 라운드 완료 → 뽑기 → 컬렉션 → 강화가 배포 URL에서 동작 (P0)
- [ ] **T-04** P1 통합 체크포인트 — 입장 → 전송 → 필터 → 인박스 정렬 (P1)
- [ ] **T-05** 기능 동결 후 시연 리허설 2회 (P0)

### 담당 미정 티켓

| ID | 티켓 | 티어 | 담당 | 비고 |
| --- | --- | --- | --- | --- |
| U-01 | 시연 대본·발표 자료 | P1 | 미정 (anonymous) | 개발 완료 후 담당 결정 |

### 뽑기 로직 (확정)

1. game_config의 grade_rates로 **등급을 먼저** 뽑고, 30장(10명 × 3스타일) 중 하나를 **균등 추첨** (인플루언서별 가중치 없음)
2. **신규(isNew)** = 해당 템플릿(인물 + 스타일)을 등급 무관하게 처음 보유한 경우
3. 시연용 **등급 고정 옵션**: `POST /api/rounds/complete` 요청에 `{"demoForceGrade": "special"}`을 넣으면 그 등급으로 지급 (데모 계정 전용, 시연 대본에서 스페셜 연출 보여줄 때 사용)

## 2. anonymous 담당 범위

아직 담당자가 정해지지 않은 티켓을 모아 둔 파일입니다. 개발이 끝나면 담당자를 정하고, 그 사람의 plan 파일로 옮깁니다.

**작업 경로:** `docs/` (시연 대본·발표 자료)

**받는 것 (의존)**

- 전원: 완성된 기능과 배포 URL (T-03, T-04)
- 문환P: 시연용 필터 문장 판정 결과 (A-08)
- 홍주P: 시연용 데모 상태 시드 (B-02), 등급 고정 옵션 demoForceGrade (B-03)

**주는 것**

- 시연 대본·발표 자료 (U-01) → 전원 리허설 (T-05)

## 3. anonymous 티켓

| ID | 티켓 | 티어 | 선행 | 완료 기준 |
| --- | --- | --- | --- | --- |
| U-01 | 시연 대본·발표 자료 — 5분 시연 흐름(라운드 완료 → 스페셜 카드 연출 → 채팅방 입장 → 필터 차단 → 인박스 우선순위), 장표 | P1 | T-03 | 리허설 2회(T-05) 전에 대본과 장표 공유 |

### 체크리스트

- [ ] **U-01** 시연 대본·발표 자료 — 5분 시연 흐름(라운드 완료 → 스페셜 카드 연출 → 채팅방 입장 → 필터 차단 → 인박스 우선순위), 장표 (P1)

## 4. anonymous 타임라인

| 구간 | 할 일 |
| --- | --- |
| 2일차 오전 | 담당자 결정 후 U-01 착수 |
| 2일차 오후 | T-05 리허설 전 공유 |
