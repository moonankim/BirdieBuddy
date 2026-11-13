# 카드 목록·상세·강화 UI 인계

**기준일:** 2026-11-12 · **담당:** 현호P

> 다른 담당자·에이전트는 카드 화면을 수정하거나 API를 연결하기 전에 이 문서를 먼저 확인합니다. 제품 기준은 [최신 카드 명세](./card-spec.md), 이미지 출처는 [CDN 인계](./card-assets.md), 기획 배경은 [현호P 계획](./현호P_plan.md) §2.2·§3을 따릅니다.

## 이번 변경의 범위

기획·아키텍처와 [최신 카드 명세](./card-spec.md)를 기준으로 카드 화면의 **UI 목업**을 보완했습니다. 사용자가 이번 단계의 API 연결을 명시적으로 제외했습니다. 로그인 방식과 관계없이 카드 장수·수집 현황·강화 비용·강화 결과는 예시이며 실제 소유 정보가 아닙니다. DB·RLS·SDK·발급 확률·원격 배포는 변경하지 않았습니다.

보유 카드 이미지는 공통 목업 이미지 `https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/default-card-at.png`(`lib/cards/presentation.ts`의 `previewCardImageUrl`)를 사용합니다. 미보유 카드는 실루엣을 유지하고, 이미지 로드 실패 시 실루엣으로 대체합니다. 이 이미지는 선수·등급별 실제 아트가 아닙니다. [CDN manifest](./assets/card-images.json)에서는 선수 식별자와 유형만 재사용하고 선수별 이미지를 요청하지 않습니다. 선수 12개를 DB UUID·템플릿 12개로 확정하거나 기존 시드와 순서대로 연결하지 않습니다.

## 화면과 진입 계약

| 경로 | 구현 내용 |
| --- | --- |
| `/collection` | **컬렉션(도감)**: 정적 카드 목록(manifest)의 선수×등급 전체 카드를 실제 아트로 전시. 보유 표시만 덧입히고 미보유는 흑백 |
| `/collection/owned` | **보유 카드**: 양수 수량의 선수×등급 조합·보유 현황·필터·정렬·강화 진입. 실제 연결 대상 |
| `/collection?tab=owned` | 기존 링크 호환용. `/collection/owned`로 이동 |
| `/collection/[cardId]?grade=basic&from=owned` | 선택 등급의 상세·장수, 등급 전환, 미보유 표시, 인증 근거가 있을 때 배지 |
| `/collection/upgrade?cardId=c2&grade=basic&from=owned` | 소모·획득·잔여·다음 등급 수량 확인 → 기본 강화 연출 → 결과 미리보기 |

`grade`는 basic/rare/legend만 허용합니다. 상세에서 생략하면 목업의 최고 보유 등급, 미보유는 basic을 선택합니다. 명시된 잘못된 등급이나 카드 ID는 다른 카드로 대체하지 않고 카드 없음 화면을 표시합니다. `from=owned`의 복귀는 `/collection/owned`로 고정하며 외부 주소를 받지 않습니다. 경로의 cardId는 현재 목업 식별자이며 서버 UUID가 아닙니다.

## 재사용할 파일과 구성요소 계약

| 파일 | 역할 |
| --- | --- |
| `components/card/card-catalog.tsx` | 컬렉션(도감)·수집 현황·등급/유형 칩 필터 |
| `components/card/card-collection.tsx` | 보유 카드 목록·칩 필터·선수 선택·정렬 토글·상태 표시·강화 진입 |
| `components/card/card-controls.tsx` | `CardTabs`(컬렉션↔보유 카드), `ChipGroup`, `Segmented` |
| `components/card/card-detail.tsx` | 카드 상세·등급 전환·미보유 표시 |
| `components/card/card-upgrade.tsx` | 강화 확인·기본 강화 연출·일시적인 결과 미리보기 |
| `lib/cards/presentation.ts` | 4유형·3등급 표시 타입, 다음 등급, 시안 비용·목업 이미지·연출 시간 상수 |
| `lib/cards/collection.ts` | 합산·최고 보유 등급·필터·정렬·보유 조합 선택 |
| `app/(user)/_mock/cards.ts` | 예시 템플릿과 수량 시나리오(`findMockCard`, `findMockTemplate`). 실제 수량의 폴백으로 사용 금지 |
| `components/ui/card-artwork.tsx` | 공통 이미지 표시·이미지 실패/미보유 실루엣 대체·등급 배지 |
| `design-system/app.css` | 공통 `bb-detail-*`, `bb-collection-*`, `bb-upgrade-*` 스타일 |

| 구성요소 | props | 비고 |
| --- | --- | --- |
| `CardCatalog` | `templates?`, `ownership?: 'ready'\|'loading'\|'error'`, `onRetryOwnership?` | 카드 목록은 정적. 보유 조회 실패 시에도 목록은 보이고 보유 표시만 숨김 |
| `CardCollection` | `templates?`, `status?: 'ready'\|'loading'\|'error'`, `onRetry?` | `templates` 기본값은 목업. 실제 연결 시 조회 결과를 전달하고 실패를 목업으로 대체하지 않음 |
| `CardDetail` | `card: CardPreview`, `counts?: Record<CardLevel, number>`, `returnToOwned?` | `counts`가 있을 때만 등급 전환 표시. `card.count===0`이면 미보유 표시 |
| `CardUpgrade` | `card: CardPreview`, `nextCount?: number`, `returnToOwned?` | `nextCount`는 다음 등급의 현재 보유 수량. 없으면 해당 행을 숨김 |

| 상수 (`lib/cards/presentation.ts`) | 현재 값 | 실제 연결 시 |
| --- | --- | --- |
| `previewCardImageUrl` | R2 `default-card-at.png` | SDK의 선수·등급별 `imageUrl`로 교체. basic 이미지를 다른 등급에 재사용하지 않음 |
| `previewUpgradeCost` | 10 | `getGameConfig`의 `upgrade_cost`로 교체. 설정 오류 시 임의 기본값으로 요청하지 않음 |
| `upgradeRevealMs` | rare 3000·legend 5000 | 연출 시간 시안. 확정 전 디자인 값이며 서버 규칙과 무관 |

UI 배지는 신규 basic/legend와 기존 common/epic/special을 함께 지원하며 기존 rare의 기본 한글 라벨도 유지합니다. 신규 화면의 영문 라벨은 명시적으로 전달합니다. 이는 호환 표시 지원이며 서버 등급을 변환하는 로직이 아닙니다.

## 목록의 표시 규칙

**화면 분리 (2026-11-13 사용자 결정):** 컬렉션은 API와 무관한 정적 도감 화면, 보유 카드는 실제 데이터 화면으로 나눴습니다. PRD의 "컬렉션 = 미보유 포함 전체 템플릿(getCollection)"과 달리, 컬렉션의 카드 목록은 manifest가 원본입니다. 수집 현황은 보유 조회 결과(현재 목업)를 겹쳐 표시합니다. 따라서 `getCollection`의 미보유 0 채움은 화면 필수 요건이 아닙니다.

- **컬렉션(`/collection`)**: 표시 단위는 선수×등급 카드(현재 12명×3 = 36장)입니다. 순서는 manifest 순·등급 순으로 고정하고 정렬은 두지 않습니다. 등급·유형 칩으로 거릅니다. 미보유 카드는 실제 아트를 흑백·반투명으로 보여 주고 "미보유"를 텍스트로 병기합니다. 현황은 모은 카드 n/36, 선수 n/12, 등급별 n/12입니다. 보유 조회가 실패하면 오류·재시도를 안내하되 목록은 유지하고 보유 표시(흑백·수량)만 숨깁니다.
- **보유 카드(`/collection/owned`)**: 수량이 1장 이상인 선수×등급 조합만 표시하며, 한 선수의 BASIC과 RARE는 별개 항목입니다. 현황은 보유 합계·종류·등급별 장수입니다. 필터는 등급·유형 칩과 선수 선택(보유한 선수만)입니다. 정렬은 등급순(기본)·장수순 토글이며, 획득 시각이 없어 최근 획득순은 제공하지 않습니다. 필터 결과 없음에서 초기화해도 정렬은 유지합니다.
- 필터 UI는 디자인 시스템 칩(`.bb-chip`, 등급 칩은 평행사변형·등급색)·정렬 토글(`.bb-segmented`)·현황 패널(`.bb-stat`)을 사용합니다. 입력 폼용 select 그리드는 사용하지 않습니다.
- 충분한 수량과 다음 등급이 있는 조합만 보유 목록·상세에서 강화 미리보기로 연결합니다.
- 상태 구분: 등록 카드 없음, 컬렉션 전체 미보유(라운드 완료 안내), 보유 카드 없음(라운드 완료 이동), 필터 결과 없음(필터 초기화), 로딩, 조회 오류/재시도. `status`·`ownership`·`onRetry`는 표시 인수용이며 실제 요청은 없습니다.
- 이미지: 컬렉션은 manifest의 등급별 실제 아트, 보유 카드·상세·강화 목업은 공통 이미지(`previewCardImageUrl`)입니다. 상세·강화의 실제 아트 연결은 후속입니다.

## 카드 상세 규칙

- 같은 카드의 BASIC·RARE·LEGEND 전환을 제공하며 각 등급의 장수 또는 미보유를 텍스트로 표시합니다. 현재 등급은 `aria-current="page"`이고 `from=owned`를 유지합니다.
- 0장 등급은 미보유 실루엣과 "아직 보유하지 않은 등급이에요"를 표시하며 "나의 카드"로 안내하지 않습니다.
- 다음 등급까지 진행률과 부족 장수를 표시하고, 부족하면 강화 버튼을 비활성화합니다. LEGEND는 최고 등급 안내만 표시합니다.
- 인증 배지는 `verifiedAt`이 있을 때만 표시합니다. 목업 값은 모두 null입니다.

## 강화 미리보기와 실제 강화의 경계

체험 가능한 예시는 c2 BASIC 11장입니다. 화면 단계는 `confirm` → `revealing` → `result`입니다.

1. **확인**: 현재·다음 등급 카드, 현재 보유·필요 수량·다음 등급 보유 수량·잔여를 표시합니다. 되돌릴 수 없음과 "현재 장수만 줄고 입장 자격·보유 배지·누적 획득 기록은 유지"를 안내합니다. 수량 확인 체크 전에는 버튼이 비활성입니다. 최고 등급·부족 수량·잘못된 카드 선택은 직접 주소로 진입해도 차단합니다.
2. **기본 강화 연출**: 카드가 모인 뒤 다음 등급 카드를 공개합니다(`bb-upgrade-reveal`, `data-level`). RARE 약 3초·LEGEND 약 5초이며 LEGEND는 골드 테두리로 구분합니다. 건너뛰기를 제공하고 `prefers-reduced-motion`이면 연출 없이 결과로 갑니다. 진행 문구는 `role="status"`로 알리고, 화면 이탈 시 타이머를 정리합니다. 연출 종료나 건너뛰기는 결과를 바꾸거나 새 강화를 실행하지 않습니다.
3. **결과**: 사용·획득·다음 등급 보유 수량(예: 0장 → 1장)·잔여를 표시하고 결과 제목으로 포커스를 이동합니다. 복귀 버튼은 진입 경로(컬렉션/보유 카드)를 따릅니다.

결과는 컴포넌트 안의 일시적 상태이며 목업 원본·실제 장수·인증·입장 자격을 변경하지 않습니다. 복귀·새로고침 시 초기화됩니다. API 요청·멱등 ID·실패 복구·계정별 결과 저장은 구현하지 않았습니다. 실제 강화가 완료됐다고 보고하거나 결과를 실제 소유 정보로 반영하면 안 됩니다.

### API 연결 시 교체 지점

| 현재 목업 | 실제 연결 기준 |
| --- | --- |
| 페이지가 `findMockCard`·`findMockTemplate`로 `card`·`counts`·`nextCount` 구성 | 새 3등급 계약의 조회 결과에서 같은 형태로 구성. 조회 실패는 오류 상태로 표시하고 목업으로 대체하지 않음 |
| `showResult`가 즉시 `revealing` 시작 | 확인 → 요청 중(버튼 잠금·같은 requestId) → **서버 성공 확인 후** `revealing`. 거부·미확정은 연출 없이 오류/복구 안내 |
| 결과 수량을 화면에서 계산 | 응답의 잔여·획득 수량을 사용하고 성공 후 목록을 재조회. 재조회 실패는 별도 안내하며 강화를 다시 실행하지 않음 |
| 계정과 무관한 화면 상태 | 계정 전환·로그아웃 시 결과·선택·진행 중 연출을 비움 |

오류 코드별 문구(부족 장수, 최고 등급, 처리 중, 설정 오류, 인증·권한)는 [현호P 계획](./현호P_plan.md) §3.3을 따릅니다.

## 뽑기 연출 목업 (`/draw/preview`)

| 항목 | 내용 |
| --- | --- |
| 경로 | `/draw/preview?grade=basic\|rare\|legend&new=1\|0&unlocked=1`. 잘못된 등급은 카드 없음 화면. 실제 `/draw`(자성P, 이전 규격 API)와 분리 |
| 구성요소 | `CardDrawReveal({result:{card(+imageUrl),isNew,ownedCount,entryUnlocked}, autoRevealMs?})` (`components/card/card-draw-reveal.tsx`) |
| 단계 | `data-phase`: intro → heartbeat → ready(탭 또는 자동 공개) → flip → result. 시간은 `lib/cards/presentation.ts`의 `drawRevealTiming` |
| 등급 암시 | 박동 BASIC 2·RARE 3·LEGEND 4회, `data-grade`별 빛 색, RARE 이상 반짝임, LEGEND 플래시·광택 |
| 접근성 | 단계 문구 `role="status"`, 카드는 ready 단계에서만 열리는 버튼, 건너뛰기, 동작 줄이기 시 결과만, 결과 제목 포커스 |
| 목업 데이터 | `app/(user)/_mock/draw.ts`: 김홍차(manifest 실제 아트), 보유 장수는 목업 +1 |
| 진입점 | `/draw`의 결과 없음 화면과 결과 화면 하단 링크 "새 뽑기 연출 미리보기 (목업)"(`PreviewLink`). 연출을 `/draw`에 적용하면 링크와 `/draw/preview`를 제거 |

연결 기준: 새 3등급 SDK 전환 시 `/draw`는 `completeRound` 결과를 `DrawRevealResult`로 바꿔 `CardDrawReveal`에 넘깁니다. 처음 도착했을 때만 연출하고, 새로고침·재진입이면 결과만 보여 줍니다(예: 세션 저장소에 공개 완료 표시). 연출·탭·건너뛰기·이탈은 결과를 바꾸지 않고 새 발급을 하지 않습니다.

## 담당자별 후속 작업

| 담당 | 참고·확인할 작업 |
| --- | --- |
| 자성P | 기존 Auth·세션·공통 UI를 유지하며 위 경로·구성요소 재사용. 실제 화면을 목업 데이터로 덮어쓰지 않음. 승인된 API 연동 단계에서 계정 전환·재조회·오류·미보유 상태 검증 |
| 홍주P | getCollection/getOwnedCards/getGameConfig/upgradeCard는 존재하지만 기존 스타일·4등급 계약임. 새 계약의 인물/템플릿 UUID·유형·3등급 수량·설정 비용·등급별 URL 확정과 이관을 별도로 진행. 기존 등급을 임의 병합하지 않음 |
| 문환P | 발급 결과의 인물·등급과 새 카드 계약 일치 확인. 이번 목업은 실제 발급·강화 구현이나 확률 변경의 근거가 아님 |
| 현호P | 새 SDK 계약과 실제 아트 연결, 서버 확정 이후 강화 연출 연결·수량 갱신·결과 미확정 복구, 연출 시간 확정, 모바일·접근성 육안 검수 |

[CDN 인계](./card-assets.md)의 `<유형>-<선수명>-<레벨>.png`·R2 출처·slug 보존 규칙은 유지합니다. 로그인 상태가 실제여도 카드 페이지의 목업 장수가 실제라고 가정하지 않습니다. API 연결은 후속 사용자 승인 범위에서 진행합니다.

## 검증과 남은 제약

`tests/ui/unit/card-collection.test.tsx`, `card-detail.test.tsx`, `card-upgrade.test.tsx`가 다음을 검증합니다.

- 컬렉션: 36장 전시·실제 아트·미보유 흑백, 수집 현황, 등급/유형 칩, 보유 조회 실패 시 목록 유지, 전체 미보유·등록 없음
- 뽑기 연출: 등급별 박동 시간, 탭 공개·포커스, 자동 공개, 건너뛰기, 동작 줄이기, 타이머 정리, NEW/+1장·입장 안내, 잘못된 등급 주소
- 보유 카드: 양수만·등급순 기본, 칩·선수 선택·정렬 토글 조합과 필터만 초기화, 보유 선수만 선택지, 빈 상태·오류·로딩
- 상세: 등급 전환, 미보유 표시, 카드 없음, 복귀 경로
- 강화: 확인/결과, 등급별 연출 시간, 건너뛰기, 동작 줄이기, 이탈 시 타이머 정리, 다음 등급 수량

실행 명령은 `npm run test:ui`, `npm run build`, `npm run lint`, `npm run typecheck:ui`이며 타입 검사는 빌드와 동시에 실행하지 않습니다. 2026-11-13 기준 UI 테스트 218개 통과, 타입 검사·빌드 성공, lint 오류 없음(기존 파일 경고 4건)입니다.

브라우저·미리보기는 열지 않았습니다. 연출과 CDN 이미지의 실제 렌더링, 모바일 육안 검수, 실제 로그인 사용자의 카드 API 연동과 원격 배포는 미검증입니다. 기본 이미지 URL은 curl Range 요청으로 HTTP 206·image/png 응답만 확인했습니다.
