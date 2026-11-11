# BirdieBuddy-ui — 자성P 채팅 UI 미리보기

홍주P 실제 SDK와 연결하기 전, 더미 SDK로 채팅 화면을 먼저 만든 별도 Next.js 프로젝트다. 루트 백엔드 패키지와 의존성이 섞이지 않도록 이 폴더 안에서만 설치·실행한다. 레포 루트 `app/`으로 합치는 방법은 `docs/자성P_develop_document_v2.md`를 따른다.

## 실행

```bash
cd BirdieBuddy-ui
npm install
npm run dev        # http://localhost:3000
```

환경변수와 Supabase 없이 동작한다. 로그인 화면에서 더미 계정 버튼을 누른다.

| 계정 | 첫 화면 | 볼 수 있는 것 |
| --- | --- | --- |
| 팬 A (userA), 팬 B (userB) | `/chat` | 하단 바(홈·카드·채팅), 채팅방 목록·입장·대화 |
| 인플루언서 (influencer) | `/inbox` | 인박스, 전체 메시지, 묶기·요약, 설정(필터·인사말·사진) |
| 신청자 (pendingInfluencer) | `/inbox` | 인증 신청 |
| 관리자 (admin) | `/admin` | 데모 월 경과, 인증 심사 |

- 더미 데이터는 브라우저 탭 안에만 있다. 팬 ↔ 인플루언서 주고받기는 같은 탭에서 계정을 전환해 확인한다.
- 모바일 화면(390px) 기준이다. 개발자 도구의 기기 모드로 보는 것을 권장한다.
- `/home`·`/collection`·`/draw`는 현호P 화면이 들어올 자리의 목업이다(`app/(user)/_mock/cards.ts`).

## 검사

```bash
npm run typecheck
npm run lint
npx vitest run
npx playwright test   # 3313 포트로 dev 서버를 직접 띄운다
npm run build
```

## 디자인

`app/design-system.css`는 `../design-system/styles.css`(현호P 디자인 시스템 0.2)의 토큰과 컴포넌트 규칙을 옮긴 것이다. 원본이 바뀌면 이 파일을 다시 맞춘다.
