# 담당자 에이전트용 디자인 시스템 인계

> **실제 카드 이미지 인계:** [R2 CDN 주소·DB/프론트 적용 지침](../docs/card-assets.md), [36개 이미지 JSON 목록](../docs/assets/card-images.json)을 사용합니다. 선수 식별자 12개·3등급이며 최종 이미지는 R2 출처입니다. 기존 Supabase Storage URL 생성·스타일 기반 경로를 그대로 적용하지 않습니다. DB·SDK·화면 연결은 아직 별도 작업입니다.

**기준일:** 2026-11-12 · **시각 기준:** 0.4

## 먼저 읽을 자료

1. [최신 카드 명세](../docs/card-spec.md): 스타일 없음, 4유형·3등급, `<유형>-<선수명>-<레벨>.png`. 이전 코드·샘플의 카드 값보다 우선합니다.
2. [앱 디자인 가이드](../docs/design.md): 제품 화면의 시각 원칙과 상태 요구사항.
3. [개발 적용 가이드](./DEVELOPMENT.md): import 경계·구성요소·에셋 사용법.
4. [상태 샘플](./sample/states.html), [홈](./sample/index.html), [컬렉션](./sample/collection.html), [채팅](./sample/chat.html): 배치 참고용 정적 시안. 화면의 데이터·등급 값·버튼 동작은 최신 제품 계약을 대신하지 않습니다.

## 현재 적용 상태

| 항목 | 상태 | 다음 작업 |
| --- | --- | --- |
| 딥그린·아이보리 토큰, 버튼·입력·탭·하단 탐색 | 실제 앱에서 공유 | 기존 공통 원본을 재사용 |
| 홈 카드 쇼케이스·컬렉션 표면 깊이 | 브랜치의 목업 화면에 적용 | API 연결 화면에 시각 구조만 통합 |
| CSS 스피너·오류·404 레이아웃 | 공통 스타일·정적 샘플 준비 | 실제 Spinner·오류 경계·라우트 연결은 별도 |
| 기본 프로필 SVG | 에셋·크기별 샘플 준비 | Avatar의 기존 이름 첫 글자 대체는 아직 유지 |
| 최신 4유형·3등급 카드·PNG 경로 | 문서 확정 | DB·SDK·UI·시드 전환 미완료 |

기존 디자인 보강·상태 샘플·에셋은 `f0fc8d9`에 포함됩니다. 카드 규격·R2 CDN manifest·인계 문서는 별도 후속 변경이므로, 다른 브랜치·클론에서 사용하려면 해당 문서까지 반영된 버전을 확인해야 합니다. 공유 완료·main 반영·원격 배포를 이 문서만으로 판단하지 않습니다.

## 스타일 원본과 로딩 순서

현재 루트 앱의 `app/globals.css`는 다음 순서입니다. 동일 앱에서는 추가 import를 중복하지 않습니다.

```css
@import 'tailwindcss';
@import './design-system.css';
@import '../design-system/app.css';
```

- `design-system/app.css`가 `tokens.css`, `club.css`, `states.css`를 직접 불러옵니다.
- `app/design-system.css`는 기존 화면 호환용입니다. 신규 공통 구성요소는 `design-system/app.css`에 추가하고 화면별로 복제하지 않습니다.
- `design-system/styles.css`, `foundation.css`, `.phone`, `.sample-*`는 시안 전용입니다. 앱에 통째로 import하거나 휴대폰 외곽 프레임을 실제 화면에 옮기지 않습니다.
- `app.css`의 공통 구성요소는 `components` 레이어, `club.css`·`states.css`는 일반 규칙입니다. 유틸리티가 항상 덮어쓴다고 가정하지 말고 충돌 시 원본의 역할과 선택자를 확인합니다.

## 시각 적용 기준

| 역할 | 사용할 토큰·규칙 |
| --- | --- |
| 배경·본문·보조 글자 | `--surface-screen`, `--text-primary`, `--text-secondary` |
| 버튼·포커스·오류 | `--action-primary`, `--focus-ring`, `--status-error` |
| 패널·카드 깊이 | `--shadow-panel`, `--shadow-card`. 카드·수집 화면에 집중 |
| 모서리 | 조작 6px, 패널 12px, 배너 20px, 카드 16px 토큰 |
| 서체 | 제목 `--font-display`, 본문 `--font`; 페이지 28px, 본문 16px, 보조 최소 12px |
| 카드 | 2:3·`object-fit: contain`, 이름·유형·등급·수량은 이미지 밖에 표시 |
| 동작 | `--motion-feedback`, `--motion-card`와 동작 줄이기 존중 |

사선·등고선은 주요 배너에 사용하고 채팅·설정·관리자는 차분하게 유지합니다. 화면별 새 색상표나 동일한 장식용 그림자를 늘리지 않습니다. 골드는 희소성과 수집 성취에 한정합니다.

## 공통 구성과 에셋

- `components/ui/card-artwork.tsx`: CardArtwork·GradeBadge·StatusPanel. 이미지 실패·미보유 대체를 재사용합니다. 현재 CardGrade·배지는 이전 4등급이므로 새 basic/legend를 억지로 common/special로 매핑하지 않습니다. SDK 전환과 함께 타입·표시 규칙을 갱신합니다.
- `components/ui/index.tsx`: 기존 Button·Spinner·ErrorState·EmptyState. 이름이 있다고 새 상태 샘플이 적용됐다고 판단하지 않습니다. Spinner는 현재 텍스트 표시입니다.
- `components/ui/avatar.tsx`: 현재 이미지 실패 시 이름 첫 글자를 표시합니다. 새 기본 프로필 연결은 후속입니다.
- `/assets/avatar-default.svg`: `public/assets/avatar-default.svg` 단일 원본. 메시지 32px·목록 44px·설정 72px. 이름이 옆에 있으면 `alt=""`를 사용합니다.
- `design-system/assets/connection-error.svg`: 오류 샘플의 장식용 일러스트. 현재 public URL은 없습니다. 실제 라우트 적용 시 공개 제공 방법을 정하고 존재하지 않는 `/assets/connection-error.svg`를 참조하지 않습니다.
- `design-system/assets/course-contours.svg`: club.css의 상대 URL로 불러오는 배너 장식.
- `design-system/assets/card-placeholder.svg`: 정적 시안용 이전 자리표시자. 민트 색상이 남아 있으므로 최신 최종 카드 아트로 취급하지 않습니다.

## 담당자별 적용 경계

| 담당 | 적용할 내용 |
| --- | --- |
| 자성P | 실제 API 연결 화면에 공통 토큰·구성요소 적용. Spinner·Avatar·오류/404 연결과 로딩·빈 상태·재시도 처리. 기존 Auth·SDK·세션·입력값 보존 |
| 현호P | 카드 상세·강화·발급 연출·이미지 규격·카드 배지. 공통 원본과 디자인 샘플 갱신 |
| 홍주P | 새 카드 모델·등급별 이미지 URL·SDK 계약·실패 응답 제공. UI 장식 때문에 DB나 권한 동작을 바꾸지 않음 |
| 문환P | 발급·필터·수정 제안·묶기·요약 결과를 계약대로 제공. 로딩/제안/차단/오류를 화면이 구분할 수 있게 하며 CSS를 서버 코드에 연결하지 않음 |

## 인수·검증

- API 연결 화면을 목업으로 덮어쓰지 않고 JSX의 배치·클래스만 필요한 범위에서 통합합니다.
- 기본·처리 중·빈 상태·실패·재시도·이미지 실패·최고 등급을 구분합니다. 정적 시안의 비활성 버튼을 실제 앱에 그대로 옮기지 않습니다.
- 새 등급은 공통 카드 명세와 SDK 전환 완료 여부를 확인합니다. 데모용 이전 등급을 신규 계약으로 복제하지 않습니다.
- 변경 범위에 따라 `npm run lint`, `npm run test:ui`, `npm run build`를 수행합니다. 별도 `npm run typecheck:ui`는 빌드와 동시에 실행하지 않습니다(생성 타입 파일 갱신 충돌 방지).
- 모바일·긴 이름·키보드 포커스·대비·안전 영역·동작 줄이기를 확인합니다. 실행하지 않은 검증과 샘플 상태를 완료로 보고하지 않습니다.
- 서버·브라우저·미리보기는 사용자 요청 없이 열지 않습니다. 커밋·push 역시 별도 사용자 요청을 따릅니다.
