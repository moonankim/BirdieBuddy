# AI 이미지 생성 기록: 시연용 선수 카드 36장

시연용 가상 인플루언서 12명의 카드(BASIC·RARE·LEGEND, 1024×1536 PNG)를 만들 때 쓴 도구, 프롬프트, 스크립트, 배운 점을 한 문서에 모았다.
작성일은 2026-11-13이다. 카드 36장, `scripts/`, `PROMPTS.md`는 레포에 넣지 않았고 문환P 로컬의 `~/Downloads/birdiebuddy-demo-cards/`에 있다. 이 문서에서 `scripts/…`는 그 폴더 기준이다.
레포와 CDN의 카드(`docs/card-assets.md`, `docs/assets/card-images.json`)는 아직 기존 12명 그대로다. 새 세트로 바꿀지는 현호P가 정한다.

## 1. 한눈에 보기

```
[1] 인물 사진 생성       Z-Image Turbo 4bit (mflux, 로컬, 무료)     gen-photos.mjs + prompt-lib.mjs
[2] 후보 검수·선택       macOS Vision 관절·얼굴 + 확대 시트           qa.mjs, zoom.mjs, shaft.py
[3] 사진 보정           OpenCV + LaMa 인페인팅                    apply-retouch.mjs, retouch.py, lama_fill.py
[4] 인물 분리·배치       macOS Vision 전경 마스크 + 보정             prep.mjs, vision.swift, refine_mask.py
[5] 뒤 연필 스케치       얼굴만 남긴 마스크 + 연필화 필터             sketch_mask.py (prep.mjs 안에서 실행)
[6] 카드 합성           HTML/SVG 템플릿을 Chromium으로 렌더링       card.html, render.mjs, textures.mjs
[7] 검증               OCR·픽셀 비교·배치 검사 + 독립 검수(다른 모델)  verify.mjs, place-test.mjs, holes.mjs
```

이미지 생성은 인물 사진(1단계)에만 썼다. 카드의 프레임·패널·글자·배지는 생성 모델이 아니라 코드로 그렸다. 그래서 이름 철자가 틀리지 않고, 세 등급의 인물이 픽셀 단위로 같다.

## 2. 쓴 도구

### 이미지 생성·편집 모델 (모두 로컬, 무료)

| 도구 | 용도 | 비고 |
| --- | --- | --- |
| [mflux](https://github.com/filipstrand/mflux) 0.24.0 | Apple Silicon(MLX)에서 이미지 생성 모델 실행 | `uv tool install mflux --python 3.12`로 설치. 지울 때는 `uv tool uninstall mflux` |
| Z-Image Turbo 4bit (`mflux-community/z-image-turbo-mflux-q4`) | **최종 인물 사진 12장** | 약 5.9GB, Apache-2.0. 9단계, 896×1344, 한 장에 70~135초 |
| FLUX.1-schnell 4bit (`madroid/flux.1-schnell-mflux-4bit`) | 첫 버전(서 있는 자세) | 남자 사진의 자세·신체가 어색해서 반려됐다. 최종본에는 쓰지 않음 |
| Z-Image Turbo ControlNet (`...controlnet-union-2-1-mflux-q4`) | 내려받았지만 쓰지 않음 | 약 8.2GB가 `~/.cache/huggingface`에 남아 있다 |
| [LaMa](https://github.com/advimman/lama) (`big-lama.pt`, TorchScript) | 사진 일부 지우기(인페인팅) | 약 200MB, Apache-2.0. [내려받기](https://github.com/enesmsahin/simple-lama-inpainting/releases/download/v0.1.0/big-lama.pt) |

### 이미지 처리·분석

| 도구 | 용도 |
| --- | --- |
| macOS Vision (Swift CLI: `vision.swift`, `pose.swift`, `ocr.swift`) | 배경 분리(전경 마스크), 얼굴 상자, 손·몸 관절, 카드 글자 OCR |
| OpenCV (mflux 도구 환경의 python) | 로고 지우기, 마스크 보정, 스케치 마스크, 샤프트 직선 검사 |
| sharp (레포 `node_modules`) | 합성, 크기 조정, 연필화 필터, 시트 만들기 |
| Playwright Chromium (`CHROME_EXE`) | `card.html`을 PNG로 렌더링 |
| 폰트 | Impact(영문 이름), Apple SD Gothic Neo Bold(한글), Avenir Next Condensed Heavy Italic(배지) |

### Claude Code 쪽 (스킬·플러그인·에이전트)

| 항목 | 쓴 곳 |
| --- | --- |
| `superpowers:brainstorming` 스킬 | 이름 아이데이션을 시작할 때 불렀다. 사용자가 "질문 없이 기본값으로 진행"을 지시해 질문 단계는 건너뛰었다 |
| 서브에이전트(Opus) 독립 검수 4회 | 사진과 카드를 다른 모델에게 보여 주고 자세·신체·보정 흔적을 판정하게 했다. 요청서는 `REVIEW-BRIEF.md` 형식(아래 6절) |
| advisor | 접근 방식을 정할 때와 끝내기 전에 검토를 받았다 |
| WebSearch | 가상 선수 이름 13개가 실존 선수와 겹치지 않는지 확인 |
| 이미지 생성 플러그인·외부 API | 쓰지 않았다. 모든 생성은 사용자 Mac에서 로컬로 했다 |

## 3. 프롬프트

### 3-1. 템플릿 (`scripts/prompt-lib.mjs`)

선수 데이터(`scripts/lineup.json`)의 나이·성별·역할·외모·옷·표정을 끼워 넣는다. 최종본에는 3판(9명)과 2판·4판(높은 피니시, 각 1명)을 썼다.

**3판: 정통 피니시(손을 목 옆, 샤프트가 목 뒤)**

```text
Professional studio profile photograph of a fictional {age}-year-old Korean {male|female} {role}, holding the classic finish pose of a golf swing.
{His} chest and face are turned toward the camera. {His} two hands hold the grip of one golf club together beside {his} neck, just above one shoulder.
The straight dark shaft of the club lies across the back of {his} neck and shoulders, below {his} ears, and comes out behind {his} other shoulder, pointing slightly downward.
[behindNote] {His} elbows are bent naturally.
[손 문장]
{gaze}. {look}. {He} wears {outfit}.
Framed from the waist up, with {his} head and both hands fully inside the frame and empty space above them.
Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

- `behindNote`(샤프트가 목 앞으로 그려지기 쉬운 선수에게만): `The middle of the shaft is hidden behind {his} neck, so no part of the club crosses {his} throat, {his} chin or the front of {his} shirt.`
- 손 문장 (둘 중 하나):
  - 양손 맨손: `Both of {his} hands are bare, with natural skin, knuckles and fingernails, and all of {his} fingers are wrapped around the grip.`
  - 한 손 장갑: `One of {his} hands wears a white leather golf glove. {His} other hand is bare, with its bare fingers wrapped around the grip right next to the glove.`

**4판: 높은 피니시(손을 머리 옆)**: 3판의 둘째 문장을 아래로 바꾼다.

```text
Both of {his} hands grip the handle of a single golf club together, held high beside {his} head above one shoulder, and the dark graphite shaft of the club passes behind {his} head and extends diagonally down behind {his} other shoulder.
```

**2판: 처음 쓴 피니시**: 4판과 같은 높은 피니시이고, 손 문장 대신 옷 문장 끝에 `and a plain white golf glove on one hand`를 붙인다.

### 3-2. 생성 명령

```bash
mflux-generate-z-image-turbo --model mflux-community/z-image-turbo-mflux-q4 --steps 9 \
  --width 896 --height 1344 --seed <시드> --prompt "<프롬프트>" \
  [--image <초기 이미지> 0.15] --output <파일>
```

같은 시드·프롬프트·초기 이미지면 픽셀까지 같은 사진이 나온다(5장을 다시 생성해 확인).

### 3-3. 프롬프트에서 배운 것

- **부정문을 쓰지 않는다.** Z-Image Turbo는 부정 프롬프트가 없어서 "no logo"라고 쓰면 오히려 로고가 생긴다. 옷은 `plain solid`로만 적고, 남은 작은 무늬는 보정으로 지웠다.
- **손을 구체적으로 적는다.** 적지 않으면 양손 장갑에 맨살 손가락이 섞여 나온다. "양손 맨손"이나 "한 손 장갑 + 맨손"으로 적으면 손이 자연스럽다.
- **좌우를 지정하지 않는다.** 모델이 잘 지키지 못한다. 손이 반대쪽에 나오면 사진을 고른 뒤 좌우로 뒤집었다(카드의 이름 열 반대쪽에 손이 오게).
- **여성 사진은 샤프트가 목·옷깃 앞을 지나가게 그려지는 일이 많다.** 머리를 묶은 모습으로 적어도 그렇다. 통한 방법은 세 가지다.
  1. 구도가 좋은 다른 사진을 초기 이미지로 약하게(강도 0.15) 준다. 얼굴은 새로 그려지고 구도만 따라온다. 0.25 이상이면 얼굴까지 닮고, 옷 색도 초기 이미지를 따라가니 옷 색이 비슷한 사진을 고른다(강소윤).
  2. 손을 머리 옆까지 올리는 높은 피니시(2·4판)로 만든다(하은솔, 백서하).
  3. 손과 얼굴이 좋은 사진이면, 목 앞을 지나는 샤프트 구간만 LaMa로 지워 목 뒤로 지나가게 고친다(오세나).
- **한 선수에 여러 시드를 만들고 고른다.** 선수당 4~18장을 만들었다. 고른 기준: 팔이 어깨→팔꿈치→손목으로 자연스럽게 이어질 것, 양손이 한 그립에 모일 것, 클럽이 하나이고 샤프트가 곧게 목·머리 뒤로 지날 것, 시선이 카메라를 향할 것.

## 4. 스크립트 (`scripts/`)

`scripts/`는 참고 자료이고 이 폴더에서 바로 실행되지 않는다. BirdieBuddy 레포의 `node_modules`(sharp)를 절대 경로로 불러오고, Swift 파일은 `swiftc`로 컴파일해야 하며, `photos2/`(생성 원본), `photos/`(보정본), `assets/`, `out/` 폴더 구조를 기대한다.

### 실행 순서

```bash
node gen-photos.mjs [slug...]          # 1. lineup.json의 시드마다 사진 생성 → photos2/
node qa.mjs <out.png> <photo...>        # 2. 후보 검수 시트(전신·얼굴·손 확대 + 관절 수치)
# 3. picks.json(고른 시드), retouch-log.json(보정 인자)에 기록
node apply-retouch.mjs [slug...]        # 4. 기록대로 뒤집기·무늬 지우기·LaMa → photos/
node prep.mjs <slug> <photo>            # 5. 배경 분리·배치·뒤 스케치 → assets/<slug>/
node holes.mjs                          # 6. 배경 분리 구멍 점검
node textures.mjs                       # 7. RARE·LEGEND 금속 질감(한 번만)
CHROME_EXE=... node render.mjs [slug...] # 8. 카드 3장씩 렌더링 → out/
node verify.mjs && node place-test.mjs  # 9. 자동 검사
node sheet-all.mjs                      # 10. 36장 시트
node repro-check.mjs <slug...>          # (선택) 같은 조건으로 다시 생성해 픽셀 비교
node dump-prompts.mjs && node build-readme.mjs   # 문서 생성
```

### 파일별 역할

| 파일 | 역할 |
| --- | --- |
| `lineup.json` | 선수 12명의 이름·유형·외모·옷·표정·프롬프트 판·시드·초기 이미지 |
| `prompt-lib.mjs` | 프롬프트 템플릿과 mflux 인자 |
| `gen-photos.mjs` | 사진 생성(없는 시드만) |
| `repro-check.mjs` | 기록된 조건으로 다시 생성해 원본과 픽셀 비교 |
| `picks.json`, `retouch-log.json` | 고른 사진과 보정 인자 기록 |
| `apply-retouch.mjs` | 보정 기록을 그대로 실행 |
| `retouch.py` | 좌우 뒤집기, 단색 바탕 위 로고 지우기(`--dark`), 맨살 손가락을 장갑색으로(`--whiten`), 줄 지우기(`--erase`) |
| `lama_fill.py` | LaMa 인페인팅. 띠 모양으로 지우고, `--only`로 일부 구간만 반영 |
| `vision.swift` | Vision 전경 마스크·얼굴·손 관절 → JSON |
| `refine_mask.py` | Vision이 놓친 가는 샤프트 다시 붙이기, 마스크 구멍 채우기(`--fill`), 잔머리 사이 배경 덜어 내기(`--clear`) |
| `prep.mjs` | 얼굴을 샘플 위치에 맞추고 손·몸이 아트 영역에 들어오게 배치, 뒤 스케치 생성 |
| `sketch_mask.py` | 스케치용으로 얼굴만 남기는 마스크(클럽·손 제거) |
| `prep-overrides.json` | 선수별 손 조정값(스케치 위치·크기, 구멍 채우기, 스케치 원본 인페인팅 등) |
| `card.html`, `render.mjs`, `textures.mjs`, `textures/` | 카드 템플릿과 렌더러, 등급별 금속 질감 |
| `verify.mjs`, `ocr.swift` | OCR로 이름·유형·등급 대조, 세 등급 인물 픽셀 비교 |
| `place-test.mjs`, `holes.mjs`, `shaft.py` | 배치 조건 검사, 마스크 구멍 점검, 샤프트 직선 검사 |
| `qa.mjs`, `pose.swift`, `zoom.mjs`, `contact.mjs`, `artgrid.mjs`, `chest.mjs`, `preview.mjs` | 검수용 시트와 확대 이미지 |
| `sheet-all.mjs` | 36장 한눈에 보기 |
| `dump-prompts.mjs`, `build-readme.mjs`, `readme-*.md` | `PROMPTS.md`, `README.md` 생성 |

## 5. 카드 합성 방식

- **기준 샘플:** 최나비 BASIC 카드에서 프레임·사선 패널·글자·배지 좌표를 쟀다.
- **인물:** 얼굴 중심 (597, 706), 폭 252px에 맞춘다. 손은 x 300~993 안, 손 윤곽 오른쪽 끝은 985, 인물 아래 끝은 카드 아래 끝에 닿게 한다.
- **뒤 스케치:** 같은 사진에서 얼굴만 남겨 1.5배 크기로 (689, 442)에 놓고 연필화(닷지 블렌드 + 약한 명암, 흑연색, y 700부터 흐려짐)한다. 클럽이 스케치를 꿰뚫어 보이지 않도록 스케치에는 클럽·손을 남기지 않는다.
- **등급:** 같은 인물 레이어 위에 프레임·패널·이름 색·배지만 바꾼다. BASIC은 초록, RARE는 크림슨 메탈, LEGEND는 블랙 메탈과 금선이다.

## 6. 검수 방법

- **자동 검사:** 36장 모두 통과했다. 크기·형식, 폰트 로드, 유형 라벨·등급 배지 OCR, 세 등급 인물 픽셀 동일, 배치 조건을 본다.
- **독립 검수:** 사진과 카드를 다른 모델(서브에이전트)에게 보여 주고 판정하게 했다. 내 눈으로 놓친 문제(샤프트가 목 앞을 지남, 배경 분리에서 지워진 샤프트, 장갑 손가락, 스케치 잘림)를 네 번 모두 잡아 줬다. 요청서의 핵심은 다음과 같다.
  - "관대하게 보지 말고 사람이 보면 이상하다고 느낄 부분을 찾는다"고 적는다.
  - 판정 항목: 팔·손·클럽·몸통·얼굴·옷과 보정 흔적·전체 인상, 카드에서는 샤프트 연결·잘림·테두리·스케치.
  - 판정은 통과 / 조건부 / 불합격으로 받고, 확인하지 못한 것은 "미확인"으로 적게 한다.
  - 읽기 전용으로 하고, 확대 이미지만 만들게 한다.
- 남은 지적은 `README.md`의 "알려진 특이점"에 있다.

## 7. 다시 할 때 주의할 것

- 사진을 고르기 전에 원본 크기로 손·클럽·목을 확대해 본다. 작은 미리보기로 고르면 샤프트가 목 앞을 지나는 것을 놓친다.
- 배경 분리 뒤 샤프트가 끊기지 않았는지 카드에서 확인한다(Vision은 가는 샤프트를 자주 지운다).
- LaMa로 물체를 지울 때는 물체 전체를 띠에 넣는다. 끝이 띠 밖에 남으면 모델이 다시 이어 그린다. 일부만 지우려면 띠는 전체에 그리고 `--only`로 반영 범위를 줄인다.
- img2img로 다시 그리기, 거울 복사, 단순 OpenCV 인페인팅은 목 앞 샤프트를 지우는 데 실패했다(번짐, 이음매, 샤프트 재생성).
- 용량: 카드는 장당 평균 약 1.5MB다. 올리기 전에 압축한다.

## 부록: 선수별 프롬프트 원문·시드·보정

아래는 `PROMPTS.md`의 선수별 부분을 그대로 옮긴 것이다.

### 한도윤 (HAN DO YUN, `han_do_yun`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 양손 맨손
- 시드: 1113 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip` — 보정 없음, 좌우만 뒤집음(맨손)
- 만들어 보고 쓰지 않은 시드: 1101, 1102, 1103, 1111, 1112, 1114, 1115

```text
Professional studio profile photograph of a fictional 29-year-old Korean male professional golfer, holding the classic finish pose of a golf swing. His chest and face are turned toward the camera. His two hands hold the grip of one golf club together beside his neck, just above one shoulder. The straight dark shaft of the club lies across the back of his neck and shoulders, below his ears, and comes out behind his other shoulder, pointing slightly downward. His elbows are bent naturally. Both of his hands are bare, with natural skin, knuckles and fingernails, and all of his fingers are wrapped around the grip. He looks straight into the camera with a calm confident smile. Short neat black hair with a side part, a slim oval face, clean-shaven. He wears a plain solid white short-sleeve polo shirt with a thin navy trim on the collar. Framed from the waist up, with his head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 민태건 (MIN TAE GEON, `min_tae_geon`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 양손 맨손
- 시드: 1213 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip` — 보정 없음, 좌우만 뒤집음(맨손)
- 만들어 보고 쓰지 않은 시드: 1201, 1202, 1211, 1212

```text
Professional studio profile photograph of a fictional 33-year-old Korean male professional golfer, holding the classic finish pose of a golf swing. His chest and face are turned toward the camera. His two hands hold the grip of one golf club together beside his neck, just above one shoulder. The straight dark shaft of the club lies across the back of his neck and shoulders, below his ears, and comes out behind his other shoulder, pointing slightly downward. The middle of the shaft is hidden behind his neck, so no part of the club crosses his throat, his chin or the front of his shirt. His elbows are bent naturally. Both of his hands are bare, with natural skin, knuckles and fingernails, and all of his fingers are wrapped around the grip. He looks straight into the camera with a composed, serious expression. Very short cropped black hair, a light stubble beard, a square jaw, thick eyebrows and tanned skin. He wears a plain solid black short-sleeve polo shirt. Framed from the waist up, with his head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 서한결 (SEO HAN GYEOL, `seo_han_gyeol`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 양손 맨손
- 시드: 1313 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip` — 보정 없음, 좌우만 뒤집음(맨손)
- 만들어 보고 쓰지 않은 시드: 1301, 1302, 1312

```text
Professional studio profile photograph of a fictional 26-year-old Korean male professional golfer, holding the classic finish pose of a golf swing. His chest and face are turned toward the camera. His two hands hold the grip of one golf club together beside his neck, just above one shoulder. The straight dark shaft of the club lies across the back of his neck and shoulders, below his ears, and comes out behind his other shoulder, pointing slightly downward. The middle of the shaft is hidden behind his neck, so no part of the club crosses his throat, his chin or the front of his shirt. His elbows are bent naturally. Both of his hands are bare, with natural skin, knuckles and fingernails, and all of his fingers are wrapped around the grip. He looks straight into the camera with a bright friendly smile. A plain white golf cap over wavy dark brown hair, a round youthful face with dimples. He wears a plain solid sky-blue short-sleeve polo shirt. Framed from the waist up, with his head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 문예린 (MOON YE RIN, `moon_ye_rin`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 한 손 장갑 + 맨손
- 시드: 2111 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip 292,630,324,656 286,664,346,728 314,728,372,772` — 장갑 등의 검은 타원 무늬와 고리 무늬, 손목 여밈의 검은 테두리 제거
- 만들어 보고 쓰지 않은 시드: 2101, 2102, 2112

```text
Professional studio profile photograph of a fictional 23-year-old Korean female professional golfer, holding the classic finish pose of a golf swing. Her chest and face are turned toward the camera. Her two hands hold the grip of one golf club together beside her neck, just above one shoulder. The straight dark shaft of the club lies across the back of her neck and shoulders, below her ears, and comes out behind her other shoulder, pointing slightly downward. Her elbows are bent naturally. One of her hands wears a white leather golf glove. Her other hand is bare, with its bare fingers wrapped around the grip right next to the glove. She looks straight into the camera with a bright smile. Long straight black hair with see-through bangs, a small oval face. She wears a plain solid mint-green short-sleeve polo shirt. Framed from the waist up, with her head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 하은솔 (HA EUN SOL, `ha_eun_sol`)

- 프롬프트: 2판 (높은 피니시, 손 묘사 없음)
- 시드: 2201 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): 없음 · LaMa(`lama_fill.py` 인자, 뒤집은 뒤 좌표): `289,636,290,690,4 290,690,284,722,4 284,722,272,768,4` — 손이 이미 오른쪽이라 뒤집지 않음. 머리카락의 흰 가닥(이어폰 줄처럼 보임, 독립 검수 지적)을 LaMa로 지움
- 만들어 보고 쓰지 않은 시드: 2202, 2211, 2212, 2213, 2214, 2215, 2221, 2222

```text
Professional studio profile photograph of a fictional 25-year-old Korean female professional golfer, posing in the finish position of a golf swing. Her chest and face are turned toward the camera. Both of her hands grip the handle of a single golf club together, held high beside her head above one shoulder, and the dark graphite shaft of the club rests behind her neck and extends diagonally behind her other shoulder. Her elbows are bent naturally. She looks straight into the camera with a cheerful smile. A chin-length brown bob under a plain white sun visor, a heart-shaped face. She wears a plain solid coral-pink short-sleeve polo shirt and a plain white golf glove on one hand. Framed from the waist up, with her head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 강소윤 (KANG SO YUN, `kang_so_yun`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 한 손 장갑 + 맨손
- 시드: 2334 · 크기: 896×1344 · 9단계
- 초기 이미지: `photos2/min_tae_geon_seed_1213.png` 강도 0.15 (구도만 빌림)
- 보정(`retouch.py` 인자): `--flip` · LaMa(`lama_fill.py` 인자, 뒤집은 뒤 좌표): `410,554,566,556,18 --only 404,530,526,580` — 좌우 뒤집음. 턱 피부 위에 쐐기 모양으로 그려진 샤프트 끝과 포니테일 위에 붉게 비치던 샤프트 구간을 LaMa로 지움(샤프트가 목과 포니테일 뒤에서 나오도록, 독립 검수 지적)
- 만들어 보고 쓰지 않은 시드: 2301, 2302, 2311, 2312, 2321, 2322, 2331, 2332, 2333

```text
Professional studio profile photograph of a fictional 24-year-old Korean female professional golfer, holding the classic finish pose of a golf swing. Her chest and face are turned toward the camera. Her two hands hold the grip of one golf club together beside her neck, just above one shoulder. The straight dark shaft of the club lies across the back of her neck and shoulders, below her ears, and comes out behind her other shoulder, pointing slightly downward. The middle of the shaft is hidden behind her neck and her ponytail, so no part of the club crosses her throat, her chin or the front of her shirt. Her elbows are bent naturally. One of her hands wears a white leather golf glove. Her other hand is bare, with its bare fingers wrapped around the grip right next to the glove. She looks straight into the camera with a gentle confident smile. Long dark brown hair tied in a low ponytail, a soft round face. She wears a plain solid navy short-sleeve polo shirt. Framed from the waist up, with her head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 구민재 (KOO MIN JAE, `koo_min_jae`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 양손 맨손
- 시드: 1412 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip` — 보정 없음, 좌우만 뒤집음(맨손)
- 만들어 보고 쓰지 않은 시드: 1401, 1402, 1411

```text
Professional studio profile photograph of a fictional 31-year-old Korean male professional screen golf tour player, holding the classic finish pose of a golf swing. His chest and face are turned toward the camera. His two hands hold the grip of one golf club together beside his neck, just above one shoulder. The straight dark shaft of the club lies across the back of his neck and shoulders, below his ears, and comes out behind his other shoulder, pointing slightly downward. His elbows are bent naturally. Both of his hands are bare, with natural skin, knuckles and fingernails, and all of his fingers are wrapped around the grip. He looks straight into the camera with a relaxed confident smile. A buzz cut, a broad face and a sturdy muscular build. He wears a plain solid charcoal gray long-sleeve quarter-zip golf pullover. Framed from the waist up, with his head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 탁세윤 (TAK SE YUN, `tak_se_yun`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 한 손 장갑 + 맨손
- 시드: 1511 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip 502,814,566,864` — 가슴의 글자 로고 제거
- 만들어 보고 쓰지 않은 시드: 1501, 1502, 1512

```text
Professional studio profile photograph of a fictional 27-year-old Korean male professional screen golf tour player, holding the classic finish pose of a golf swing. His chest and face are turned toward the camera. His two hands hold the grip of one golf club together beside his neck, just above one shoulder. The straight dark shaft of the club lies across the back of his neck and shoulders, below his ears, and comes out behind his other shoulder, pointing slightly downward. His elbows are bent naturally. One of his hands wears a white leather golf glove. His other hand is bare, with its bare fingers wrapped around the grip right next to the glove. He looks straight into the camera with a friendly smile. A two-block haircut with textured bangs falling over his forehead, a slim face with a sharp jawline. He wears a plain solid cream-white knit polo shirt with a navy collar. Framed from the waist up, with his head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 남아린 (NAM A RIN, `nam_a_rin`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 한 손 장갑 + 맨손
- 시드: 2413 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip 500,878,544,916 --erase 654,818,684,817,10` — 소매의 금속 엠블럼 제거, 옷깃의 옅은 글자 같은 자국 제거
- 만들어 보고 쓰지 않은 시드: 2401, 2411, 2412, 2414

```text
Professional studio profile photograph of a fictional 26-year-old Korean female professional screen golf tour player, holding the classic finish pose of a golf swing. Her chest and face are turned toward the camera. Her two hands hold the grip of one golf club together beside her neck, just above one shoulder. The straight dark shaft of the club lies across the back of her neck and shoulders, below her ears, and comes out behind her other shoulder, pointing slightly downward. The middle of the shaft is hidden behind her head and her long hair, so no part of the club crosses her throat, her chin or the front of her shirt. Her elbows are bent naturally. One of her hands wears a white leather golf glove. Her other hand is bare, with its bare fingers wrapped around the grip right next to the glove. She looks straight into the camera with a playful smile. Shoulder-length wavy brown hair, bright eyes. She wears a plain solid lavender short-sleeve polo shirt. Framed from the waist up, with her head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 오세나 (OH SE NA, `oh_se_na`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 양손 맨손
- 시드: 2541 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip` · LaMa(`lama_fill.py` 인자, 뒤집은 뒤 좌표): `0,679,504,651,17 --only 224,626,420,704`, `437,656,456,656,15` — 좌우 뒤집음(맨손). 샤프트가 목과 옷깃 앞을 지나가게 그려져서, 그 구간만 LaMa로 지워 목 뒤로 지나가게 고침. 샤프트의 흰 띠에 있던 글자 같은 무늬는 띠째 지움(독립 검수 지적)
- 만들어 보고 쓰지 않은 시드: 2511, 2512, 2513, 2514, 2515, 2516, 2517, 2521, 2522, 2533, 2535, 2536, 2542, 2543, 2544, 2545, 2546

```text
Professional studio profile photograph of a fictional 28-year-old Korean female golf content creator, holding the classic finish pose of a golf swing. Her chest and face are turned toward the camera. Her two hands hold the grip of one golf club together beside her neck, just above one shoulder. The straight dark shaft of the club lies across the back of her neck and shoulders, below her ears, and comes out behind her other shoulder, pointing slightly downward. The middle of the shaft is hidden behind her neck, so no part of the club crosses her throat, her chin or the front of her shirt. Her elbows are bent naturally. Both of her hands are bare, with natural skin, knuckles and fingernails, and all of her fingers are wrapped around the grip. She looks straight into the camera with a big warm smile. Light-brown hair tied up in a high ponytail, a bright open face. She wears a plain beige knit cardigan over a plain white polo shirt. Framed from the waist up, with her head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 백서하 (BAEK SEO HA, `baek_seo_ha`)

- 프롬프트: 4판 (높은 피니시, 손 묘사 있음), 한 손 장갑 + 맨손
- 시드: 2621 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip --dark 172,386,220,444 --whiten 160,308,232,354 --whiten 214,374,240,408` — 장갑의 검은 엠블럼 제거, 장갑 밖으로 나온 맨살 손가락을 흰색으로
- 만들어 보고 쓰지 않은 시드: 2611, 2612, 2622

```text
Professional studio profile photograph of a fictional 24-year-old Korean female golf content creator, posing in the finish position of a golf swing. Her chest and face are turned toward the camera. Both of her hands grip the handle of a single golf club together, held high beside her head above one shoulder, and the dark graphite shaft of the club passes behind her head and extends diagonally down behind her other shoulder. Her elbows are bent naturally. One of her hands wears a white leather golf glove. Her other hand is bare, with its bare fingers wrapped around the grip right next to the glove. She looks straight into the camera with a bright cheerful smile. A short black bob with bangs under a plain white bucket hat. She wears a plain solid pastel-yellow short-sleeve polo shirt. Framed from the waist up, with her head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```

### 마준혁 (MA JUN HYEOK, `ma_jun_hyeok`)

- 프롬프트: 3판 (정통 피니시, 샤프트가 목 뒤), 양손 맨손
- 시드: 1615 · 크기: 896×1344 · 9단계
- 초기 이미지: 없음
- 보정(`retouch.py` 인자): `--flip` — 보정 없음, 좌우만 뒤집음(맨손)
- 만들어 보고 쓰지 않은 시드: 1601, 1602, 1611, 1612, 1613, 1614, 1621, 1622

```text
Professional studio profile photograph of a fictional 32-year-old Korean male golf content creator, holding the classic finish pose of a golf swing. His chest and face are turned toward the camera. His two hands hold the grip of one golf club together beside his neck, just above one shoulder. The straight dark shaft of the club lies across the back of his neck and shoulders, below his ears, and comes out behind his other shoulder, pointing slightly downward. His elbows are bent naturally. Both of his hands are bare, with natural skin, knuckles and fingernails, and all of his fingers are wrapped around the grip. He looks straight into the camera with a confident grin. Short wavy black hair, round wire-frame glasses, a friendly round face. He wears a plain navy sleeveless knit vest over a plain white long-sleeve polo shirt. Framed from the waist up, with his head and both hands fully inside the frame and empty space above them. Plain light gray seamless studio backdrop, soft even studio lighting, sharp focus, realistic skin texture, natural body proportions. 85mm lens.
```
