# 앱 개발 적용 방법

> **실제 카드 이미지 인계:** [R2 CDN 주소·DB/프론트 적용 지침](../docs/card-assets.md), [36개 이미지 JSON 목록](../docs/assets/card-images.json)을 사용합니다. 선수 식별자 12개·3등급이며 최종 이미지는 R2 출처입니다. 기존 Supabase Storage URL 생성·스타일 기반 경로를 그대로 적용하지 않습니다. DB·SDK·화면 연결은 아직 별도 작업입니다.

> **디자인 시스템 적용 인계:** 화면·공통 UI 작업 전 [에이전트 적용 가이드](./AGENT_GUIDE.md)를 확인합니다. 최신 원본·적용 상태·샘플 전용 구성·담당 경계와 검증 기준을 정리했습니다. 실제 API 연결을 보존하고 이전 카드 정의를 신규 요구사항으로 복제하지 않습니다.

> **최신 카드 기준:** 스타일 없음 / `kpga·klpga·gtour·media` / `basic·rare·legend`. 최종 카드 path는 `<유형>-<선수명>-<레벨>.png`이며 레벨은 등급과 같습니다. [공통 변경 명세](../docs/card-spec.md)를 우선합니다. 아래 이전 등급·스타일 예시와 실제 UI 타입은 전환 전 상태이며 신규 계약으로 복제하지 않습니다.

## 파일과 적용 경계

| 파일 | 사용처 |
| --- | --- |
| `tokens.css` | 색상·간격·서체·상태 토큰의 공통 원본. 정적 시안과 앱에서 직접 import |
| `states.css` | 공통 스피너·상태 화면·기본 프로필 스타일. 앱과 시안에서 직접 import |
| `../public/assets/avatar-default.svg` | 기본 프로필 단일 원본. 앱에서는 `/assets/avatar-default.svg`로 참조 |
| `assets/connection-error.svg` | 오류 화면의 장식용 일러스트 |
| `club.css` | 앱·시안이 공유하는 카드 중심 배너·원본 카드 표시 규칙 |
| `app.css` | 프레임워크와 무관한 앱 구성요소. `bb-` 접두사, `components` 레이어 사용 |
| `assets/icons.json` | 24×24 viewBox·1.75 선 굵기용 SVG path 목록 |
| `assets/card-placeholder.svg` | 정적 HTML 등에서 사용하는 2:3 자리표시자 |
| `styles.css`·`sample/` | 디자인 검토 페이지용 레이아웃과 예시 |

현재 앱은 `app/globals.css`에서 공통 `app.css`를 직접 불러옵니다. 기존 `app/design-system.css`는 레거시 화면 호환 스타일이며 토큰은 공통 원본을 참조합니다. 새 구성요소를 추가할 때 공통 파일을 수정하고 앱에 복사하지 않습니다. 앱만 별도 저장소로 분리할 경우 이 공통 디렉터리도 함께 전달해야 합니다.

## React 사용

`components/ui/card-artwork.tsx`는 다음 구성요소를 제공합니다.

```tsx
import {CardArtwork, GradeBadge, StatusPanel} from '@/components/ui/card-artwork';
import {Icon} from '@/components/ui/icon';

<CardArtwork name={template.influencerName} src={template.imageUrl} grade="rare" />
<GradeBadge grade="rare" />
<StatusPanel tone="error" title="목록을 불러오지 못했어요" onRetry={reload}>
  연결을 확인한 후 다시 시도해 주세요.
</StatusPanel>
<button type="button" className="bb-button" disabled={pending} aria-busy={pending}>
  <Icon name="refresh" />다시 조회
</button>
```

예시의 `template`과 `reload`는 호출 화면에서 제공하는 값입니다. 현재 구현의 타입은 `common/rare/epic/special`이며 위 코드는 기존 구현 재사용 예시입니다. 신규 요구사항의 `basic/rare/legend` 지원은 SDK·공통 배지 전환 후 적용합니다. 이전 등급으로 임의 매핑하지 않습니다. 등급 배지는 이미지 밖에 표시합니다. 카드 영역은 2:3이며 이미지는 잘리지 않게 `contain`으로 표시합니다. URL 누락·로드 실패에는 코드 기반 실루엣이 나타나고 `unowned`는 이미지가 있어도 미보유 실루엣을 표시합니다. 최종 카드 디자인과 뽑기 연출은 포함하지 않습니다.

`StatusPanel`의 `tone`은 `info/error/loading/empty`입니다. 오류는 alert, 나머지는 status로 알리고 loading 중 재시도 버튼은 표시하지 않습니다. 요청과 멱등 ID·권한 처리는 호출 화면과 SDK가 책임집니다. 의미 없는 정적 설명 전체를 live region으로 감싸지 않습니다.

## HTML과 스타일 사용

- `.bb-panel`, `.bb-stack`, `.bb-actions`: 표면·세로 간격·줄바꿈되는 행동 영역
- `.bb-button`, `.bb-button--secondary`: 기본·보조 버튼. 진행 중에는 실제 `disabled`와 `aria-busy`를 함께 지정합니다. 링크의 `aria-disabled`는 클릭을 차단하지 않으므로 비활성 행동에는 버튼을 사용합니다.
- `.bb-field`: input·textarea·select. 별도 label, 오류 ID와 `aria-describedby`, `aria-invalid`를 연결합니다.
- `.bb-badge[data-grade]`: 색상과 등급 텍스트를 함께 사용합니다.
- `.bb-card-grid`, `.bb-card-art`: 2열 목록과 2:3 이미지 영역. 카드명·유형·등급·수량은 영역 밖에도 텍스트로 제공합니다. 스타일 표시는 최신 카드 명세에 따라 제거합니다.
- `.bb-details`: details/summary 기반 질문 펼침. 실제 인박스 데이터와 묶음 버전 검증은 SDK 계약을 따릅니다.
- `.bb-skeleton`: 정적인 로딩 자리표시자. 상위 영역에 읽을 수 있는 로딩 안내를 제공합니다.

아이콘은 장식용으로 숨기며 아이콘만 있는 조작에는 접근 가능한 이름을 부여합니다. 이 파일들은 게임 규칙·인증·SDK 데이터를 정의하지 않습니다. 실제 적용 예시는 기존 컬렉션 화면에서 확인할 수 있습니다.

## 카드 전시 구성

홈 컨테이너는 `.bb-home`, 컬렉션 컨테이너는 `.bb-album`을 사용합니다. `.bb-feature`는 배너, `.bb-feature-art`는 컬렉션으로 이동하는 카드 링크이며 `.bb-album-summary`와 `.bb-album-count`는 수집 현황을 표시합니다. 코스 등고선은 `assets/course-contours.svg`를 CSS 장식 배경으로 참조합니다. 그림자는 카드와 수집 패널에 한정하며 동작 줄이기 설정에서는 카드 변형과 전환을 제거합니다.

## 로딩·오류·프로필 샘플

`sample/states.html`에 화면 로딩, 버튼 처리 중, 연결 오류, 404와 프로필 예시가 있습니다. 실제 앱의 Spinner·Avatar·오류 라우트 적용은 별도입니다.

- `.bb-spinner`: 24px CSS 스피너. 버튼 안에서는 `.bb-spinner--small`로 16px을 사용합니다. 스피너는 `aria-hidden="true"`, 안내 컨테이너는 `role="status"`로 제공하며 읽을 수 있는 문구를 함께 둡니다. 중복 요청을 막을 버튼에는 `disabled`와 `aria-busy`를 사용합니다.
- `.bb-status-screen`: 오류·404 샘플 레이아웃. 실제 비동기 오류 안내에는 적절한 alert를 제공하되 정적 샘플 전체를 live region으로 감싸지 않습니다.
- `.bb-profile-default`: 44px, `--small`은 32px, `--large`는 72px입니다. 옆에 이름이 있으면 `alt=""`, 독립적인 프로필 예시에는 `alt="기본 프로필"`을 사용합니다. 향후 이미지 누락·삭제·로드 실패에 같은 에셋을 적용합니다. 기본 이미지 자체가 실패할 때의 반복 재시도는 막아야 합니다.
