# 앱 개발 적용 방법

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
<GradeBadge grade="special" />
<StatusPanel tone="error" title="목록을 불러오지 못했어요" onRetry={reload}>
  연결을 확인한 후 다시 시도해 주세요.
</StatusPanel>
<button type="button" className="bb-button" disabled={pending} aria-busy={pending}>
  <Icon name="refresh" />다시 조회
</button>
```

예시의 `template`과 `reload`는 호출 화면에서 제공하는 값입니다. 등급은 `common/rare/epic/special`을 사용합니다. 등급 배지는 이미지 밖에 표시합니다. 카드 영역은 2:3이며 이미지는 잘리지 않게 `contain`으로 표시합니다. URL 누락·로드 실패에는 코드 기반 실루엣이 나타나고 `unowned`는 이미지가 있어도 미보유 실루엣을 표시합니다. 최종 카드 디자인과 뽑기 연출은 포함하지 않습니다.

`StatusPanel`의 `tone`은 `info/error/loading/empty`입니다. 오류는 alert, 나머지는 status로 알리고 loading 중 재시도 버튼은 표시하지 않습니다. 요청과 멱등 ID·권한 처리는 호출 화면과 SDK가 책임집니다. 의미 없는 정적 설명 전체를 live region으로 감싸지 않습니다.

## HTML과 스타일 사용

- `.bb-panel`, `.bb-stack`, `.bb-actions`: 표면·세로 간격·줄바꿈되는 행동 영역
- `.bb-button`, `.bb-button--secondary`: 기본·보조 버튼. 진행 중에는 실제 `disabled`와 `aria-busy`를 함께 지정합니다. 링크의 `aria-disabled`는 클릭을 차단하지 않으므로 비활성 행동에는 버튼을 사용합니다.
- `.bb-field`: input·textarea·select. 별도 label, 오류 ID와 `aria-describedby`, `aria-invalid`를 연결합니다.
- `.bb-badge[data-grade]`: 색상과 등급 텍스트를 함께 사용합니다.
- `.bb-card-grid`, `.bb-card-art`: 2열 목록과 2:3 이미지 영역. 카드명·스타일·수량은 영역 밖에도 텍스트로 제공합니다.
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
