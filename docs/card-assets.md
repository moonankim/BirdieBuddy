# 실제 카드 CDN 이미지 인계

**기준일:** 2026-11-12

**출처:** 사용자가 실제 업로드된 이미지라고 제공한 R2 CDN URL 목록입니다. 앱·DB 연결은 미완료입니다. 2026-11-12에 36개 URL 모두 Range GET으로 HTTP 206·image/png·PNG 시그니처(앞 8바이트)를 확인했습니다. 전체 파일 디코딩·육안 검수·브라우저 CORS는 미검증입니다. Python HEAD 확인은 403이었으나 curl Range GET은 전부 통과했으므로 HEAD 결과만으로 이미지 접근 실패로 판단하지 않습니다.

## 공통 원본

- 기계 판독용 목록: [assets/card-images.json](./assets/card-images.json)
- 카드 제품 기준: [card-spec.md](./card-spec.md)
- CDN base URL: `https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev`
- 현재 전달 목록: 선수 식별자 12개 × BASIC·RARE·LEGEND 각 1개 = PNG 36개. 유형별 선수 3개씩입니다. 이는 전달된 에셋 수이며 DB 템플릿 수나 발급 대상 확정과는 구분합니다.
- 최종 path: `<유형>-<선수명>-<레벨>.png`. 선수명은 아래 `playerSlug`를 그대로 사용합니다. 한글명이나 UUID로 재생성하지 않습니다.

## 선수·등급별 실제 주소

| 유형 | playerSlug | BASIC | RARE | LEGEND |
| --- | --- | --- | --- | --- |
| `gtour` | `gong_tae_pung` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-gong_tae_pung-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-gong_tae_pung-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-gong_tae_pung-legend.png) |
| `gtour` | `kim_hong_cha` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-kim_hong_cha-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-kim_hong_cha-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-kim_hong_cha-legend.png) |
| `gtour` | `moon_seo_rap` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-moon_seo_rap-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-moon_seo_rap-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/gtour-moon_seo_rap-legend.png) |
| `klpga` | `hwang_yu_ja` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-hwang_yu_ja-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-hwang_yu_ja-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-hwang_yu_ja-legend.png) |
| `klpga` | `park_hyeon_kong` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-park_hyeon_kong-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-park_hyeon_kong-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-park_hyeon_kong-legend.png) |
| `klpga` | `yoon_i_ppal` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-yoon_i_ppal-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-yoon_i_ppal-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/klpga-yoon_i_ppal-legend.png) |
| `kpga` | `heo_in_saeng` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-heo_in_saeng-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-heo_in_saeng-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-heo_in_saeng-legend.png) |
| `kpga` | `jung_ji_bung` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-jung_ji_bung-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-jung_ji_bung-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-jung_ji_bung-legend.png) |
| `kpga` | `lee_seung_nyang` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-lee_seung_nyang-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-lee_seung_nyang-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/kpga-lee_seung_nyang-legend.png) |
| `media` | `kim_jin_sil` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-kim_jin_sil-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-kim_jin_sil-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-kim_jin_sil-legend.png) |
| `media` | `park_ha_pum` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-park_ha_pum-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-park_ha_pum-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-park_ha_pum-legend.png) |
| `media` | `choi-na-bee` | [BASIC](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-choi-na-bee-basic.png) | [RARE](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-choi-na-bee-rare.png) | [LEGEND](https://pub-6f54ef3ca9cb44659b6f40ae35e9c7ad.r2.dev/media-choi-na-bee-legend.png) |

`choi-na-bee`에는 하이픈, 다른 선수 식별자에는 밑줄이 포함됩니다. `choi_na_bee` 등으로 정규화하면 존재하지 않는 주소가 됩니다. 파일명을 하이픈으로 단순 분할해 선수명을 추출하지 말고 manifest의 명시 필드로 매핑합니다. 한글 표시명은 아래 표를 사용하고 slug에서 자동 변환하지 않습니다. 인물 UUID는 별도 대조 후 연결합니다.

## 선수 한글 표시명

**확정:** 2026-11-13 현호P. 화면 목업(`app/(user)/_mock/cards.ts`의 `playerNames`)에 반영했습니다. DB 시드·SDK 표시명 연결은 홍주P 작업이며 인물 UUID 매핑은 아직 정하지 않았습니다.

| 유형 | playerSlug | 한글 표시명 |
| --- | --- | --- |
| `kpga` | `heo_in_saeng` | 허인생 |
| `kpga` | `jung_ji_bung` | 정지붕 |
| `kpga` | `lee_seung_nyang` | 이승냥 |
| `klpga` | `hwang_yu_ja` | 황유자 |
| `klpga` | `park_hyeon_kong` | 박현콩 |
| `klpga` | `yoon_i_ppal` | 윤이빨 |
| `gtour` | `gong_tae_pung` | 공태풍 |
| `gtour` | `kim_hong_cha` | 김홍차 |
| `gtour` | `moon_seo_rap` | 문서랍 |
| `media` | `kim_jin_sil` | 김진실 |
| `media` | `park_ha_pum` | 박하품 |
| `media` | `choi-na-bee` | 최나비 |

`moon_seo_rap`의 표시명은 slug 발음(문서랩)과 다른 **문서랍**입니다. slug와 파일명은 바꾸지 않습니다.

## DB·SDK 담당자 적용

1. manifest의 `category`, `playerSlug`, `grade`와 인물 UUID의 매핑을 확정합니다. 기존 가상 시드의 UUID에 순서대로 배정하지 않습니다.
2. 이미지 경로를 저장할 때 `imagePath`를 원문 그대로 저장합니다. CDN base URL은 배포 설정으로 분리하고 `baseUrl + '/' + imagePath`로 공개 URL을 해석합니다. 상대 경로 저장 관례를 유지하는 권장 연결 방식이며 구체적인 테이블·설정 이름은 백엔드 계약에서 확정합니다.
3. 기존 SDK의 `storage.from('card-assets').getPublicUrl(path)`는 Supabase 주소를 생성하므로 이 R2 파일에 사용하지 않습니다. 기존 Supabase fixture 경로와 R2 최종 이미지의 출처를 구분해서 전환합니다. 원본 PNG를 Supabase로 재업로드한 것으로 간주하지 않습니다.
4. 이미지가 선수·등급별로 다릅니다. 현재 template당 `image_path` 하나인 구조에 세 등급 이미지를 덮어쓰지 말고 등급별 매핑 테이블·필드 및 조회 계약을 설계합니다. 실제 migration은 이번 인계에 포함하지 않습니다.
5. 조회·발급·강화 결과에서 해당 선수와 **실제 등급**에 맞는 `imageUrl`을 반환합니다. basic 이미지를 rare·legend에도 사용하는 자동 대체를 도입하지 않습니다.

## 프론트 담당자 적용

- 운영 화면은 SDK가 반환한 등급별 `imageUrl`을 사용합니다. 개발·시안에서 직접 참조할 때도 manifest 값을 사용하며 별도 URL 목록을 복제하지 않습니다.
- 기존 CardArtwork는 `src`로 공개 URL을 받으며 현재 `unoptimized`입니다. 원격 최적화를 켜는 경우 Next.js의 해당 CDN host·HTTPS·PNG 경로 허용 설정을 확인합니다. 현재 설정에 CDN `remotePatterns`가 추가됐다고 가정하지 않습니다.
- 2:3 비율·contain·이미지 실패 대체를 유지합니다. 이미지 실패가 카드 소유 여부·등급을 바꾸지 않습니다.
- 이미지의 CORS·캐시·실제 PNG MIME·크기와 접근 가능 여부는 연결 시 검증합니다. JSON 목록의 존재를 네트워크 검증으로 보고하지 않습니다.

## 인계 범위

홍주P는 DB·시드·이미지 해석 SDK, 자성P는 화면의 등급별 URL 표시, 문환P는 발급 결과의 인물·등급 일관성, 현호P는 아트·선수 매핑과 렌더링 검수를 담당합니다. 이번 변경은 목록·문서만 추가하며 실제 DB·SDK·UI·배포·CDN 파일은 수정하지 않습니다.
