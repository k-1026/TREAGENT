# 2D 지도 시안 프롬프트 v1 (GPT 이미지)

- 작성일: 2026-11-17
- 상태: **보류 (2026-11-17)**. 지도는 API 화면을 그대로 쓰기로 해서 이 이미지 프롬프트는 쓰지 않습니다. 홈 화면은 brand/home_prompts_v1.md가 이어받습니다. 이 문서는 기록으로 남깁니다.
- 표기: **사실** (근거 파일), **사용자 결정**, **창작**, `[확인 필요]`
- 짝 문서: brand/character/prompts.md (하랑이 프롬프트 기록), storyboard/app_screen_storyboard_v1.md (S-05)
- 문서 분담: 이 문서는 지도 배경 이미지의 지시문과 점검 기준만 다룹니다. 하랑이 이미지는 prompts.md가 맡습니다.

---

## 1. 정한 것 (사용자 결정, 2026-11-17)

| 항목 | 값 | 왜 굳이 | 없으면 깨지는 것 |
|---|---|---|---|
| 용도 `[확정]` | 앱 S-05 여행 지도 화면의 배경 | 지도 화면에는 진행률 바와 스탬프 슬롯만 있고 직접 그린 지도가 없습니다 (app_screen_storyboard_v1.md S-05) | 화면이 목록처럼 보이고 "길을 걷는다"는 느낌이 약해집니다 |
| 비율 `[확정]` | 세로 9:16 | 스마트폰 전체 화면 기준입니다 | 앱에서 잘라 쓰면 장소 배지가 잘립니다 |
| 화풍 `[확정, 창작 후보 중 선택]` | 부드러운 수채 동화풍 | 캐릭터 시트의 선 느낌과 다른 후보라 지도가 하랑이를 가리지 않습니다 `[확인 필요]` | 지도와 캐릭터가 같은 질감이면 하랑이가 지도에 묻힙니다 |
| 지리 `[확정]` | 실제 지도에 가깝게 | 실제 방문 안내와 이어지는 지도입니다 | 가상 지형이면 이용자가 현장 위치와 맞춰 보기 어렵습니다 |
| 범위 `[확정]` | 코스 A, 중구: 동성로 → 근대골목 → 약령시 박물관 → 서문시장 (dev/app/src/data/courseA.ts, plan/spec/treagent_tech_spec_v1.md:468) | 첫 코스 데모가 이 4곳입니다 | 다른 코스는 지도를 새로 만들어야 합니다 |
| 날씨 `[확정]` | 맑음 한 장을 기본으로 먼저 만듦. 기본본이 끝나면 날씨 변형본을 만듦 | 기본본의 구도와 색을 먼저 고정해야 변형이 같은 지도로 이어집니다 | 처음부터 여러 장이면 지도가 장마다 달라집니다 |
| 하랑이 `[확정]` | 지도 안에는 넣지 않음. 화면 맨 아래에 **고정 이미지**를 얹어 걷는 느낌만 냄 | 이미지 한 장에서는 걷는 움직임을 만들 수 없습니다 | 지도에 그려 넣으면 위치와 크기를 앱에서 바꿀 수 없습니다 |
| 파일 `[확정]` | 지도 프롬프트는 이 문서에 따로 기록 | 캐릭터 프롬프트와 섞이지 않게 합니다 | 시도 기록 표가 두 용도로 뒤섞입니다 |

- 하랑이 얹는 방식: 앱에서 하랑이 이미지를 아래쪽에 두고 좌우로 천천히 오가게 할 수 있습니다 (개발 범위는 `[확인 필요]`). 쓸 이미지는 `brand/character/images/harangi_6actions.png`, `harangi_motion.gif` 등에서 걷는 포즈가 있는지 확인합니다 `[확인 필요]`.

## 2. 화면 배치 (창작, 확인 필요)

- 위 12%: 진행률 바 자리. 지도는 흐릿하고 단순하게 둡니다.
- 가운데 약 65%: 코스와 장소 4곳이 보이는 지도 본체.
- 아래 약 23%: 하랑이가 서는 **빈 바닥 띠**. 건물과 장소 없이 풀밭과 길 정도만 둡니다.
- 다음 장소 카드가 올라갈 위치(지도 위에 겹침 / 바닥 띠 위)는 아직 정하지 않았습니다 `[결정 필요]`.

## 3. 프롬프트 v1 (영문 원문, 창작)

```
Vertical 9:16 illustrated 2D map background for a mobile walking-tour app. Soft watercolor storybook style on a warm cream paper texture, gentle visible paper grain, soft blended washes, no hard outlines. Flat top-down view, no perspective, no 3D.

Area: a simplified but geographically faithful map of the old downtown (Jung-gu) of Daegu, South Korea: a compact street network, city blocks, a historic alley district with tiled-roof buildings, a traditional medicine museum area, and a large covered traditional market. Tree-lined, shaded streets.

One walking route drawn as a dashed apple-red line connecting 4 stops in order: (1) a busy shopping street, (2) an old modern-era alley, (3) a traditional herbal medicine museum, (4) a big traditional market. Each stop is a small illustrated landmark on a round badge. Add two small rest-spot icons (tree and bench) along the route.

Palette: cream paper background, sage green for trees, pale blue-grey for roads, muted yellow for sunlit main streets. Apple red (#dc3b30, adjust to taste) only for the route line and stop badges. Clear sunny summer daytime, soft warm light, calm and cheerful.

Layout: keep the top 12% calm and low-detail for a progress bar. The bottom 23% must be an empty, flat, low-detail ground strip (soft grass and a pale path, no landmarks, no buildings) as a stage where a character sprite will be placed later. The map itself fills the middle.

NO text, NO letters, NO numbers, NO logos, NO brand names, NO shop names, NO people, NO animals, NO characters, NO watermark.
```

한국어 참고: 모바일 걷기 투어 앱용 세로 9:16 2D 지도 배경. 크림색 종이 질감의 부드러운 수채 동화풍, 윤곽선 없이 번지는 색. 위에서 내려다본 평면, 원근·3D 없음. 대구 중구 옛 도심을 실제 지형에 가깝게 단순화. 점선 능금 빨강 경로로 4곳(번화한 쇼핑 거리, 옛 근대 골목, 한약재 박물관, 큰 전통시장)을 순서대로 이음. 각 장소는 둥근 배지 위 작은 랜드마크. 쉼터 아이콘(나무·벤치) 2개. 맑은 여름 낮. 위 12%는 진행률 바용으로 단순하게, 아래 23%는 캐릭터를 얹을 빈 바닥 띠(풀과 옅은 길). 글자·숫자·로고·가게 이름·사람·동물·캐릭터 없음.

- 프롬프트에 넣은 이유:
  - **글자 금지**: GPT는 한글을 자주 틀립니다. 지명 라벨은 앱에서 올립니다.
  - **캐릭터·동물 금지**: 하랑이를 앱에서 따로 얹기 때문에 지도에 다람쥐 같은 것이 섞이면 겹쳐 보입니다.
  - **빨강은 경로와 배지에만**: 하랑이 빨강과 같은 색이라 시선이 같은 곳으로 모입니다 (색값은 팀 확인 `[확인 필요]`).
  - **가게 이름 금지**: 실존 가게 이름은 허가 범위 확인이 필요합니다 (CLAUDE.md).

## 4. 생성 뒤 점검

- [ ] 글자, 숫자, 간판 글씨가 없는가 (생기면 지우거나 다시 생성)
- [ ] 장소 4곳이 이 순서로 경로에 이어지는가
- [ ] 실제 위치와 크게 어긋나지 않는가: 네 장소의 상대 위치와 도로 모양은 확인하지 않았습니다 `[확인 필요]`. 실제 지도와 대조합니다
- [ ] 위 12%와 아래 23%가 비어 있는가
- [ ] 실존 가게 이름, 로고, 사람이 없는가
- [ ] 경로와 배지 외에 빨강이 튀지 않는가
- [ ] 위치는 분위기 참고용임을 앱에서 알리는가: 길찾기는 외부 지도 앱이 맡습니다 (S-05)

## 5. 시도 기록

| 번호 | 날짜 | 버전 | 프롬프트 요약 | 결과 (채택 / 보류 / 폐기) | 메모 |
|---|---|---|---|---|---|
| 1 | | 맑음 v1 | 위 프롬프트 v1 | | |

## 6. 변형 계획 (기본본 완성 뒤)

- 기본본(맑음) 채택 후 같은 이미지를 참고로 첨부해 날씨만 바꿉니다: 폭염, 비, 선선한 저녁 등 `[결정 필요: 변형 종류]`.
- 변형마다 경로와 장소 위치가 바뀌지 않아야 합니다 (4절 점검에 추가).
- 폭염 변형은 기준(시각, 운영 시간, AWS 여부)을 이미지가 아니라 앱 문구로 적습니다 (CLAUDE.md 민감한 소재).

## 7. 결정 필요

- [ ] 다음 장소 카드 위치 (2절)
- [ ] 수채 동화풍과 하랑이 시트(도트 RPG 스타일, prompts.md v3)의 질감 차이를 받아들일지: 하랑이를 얹은 모습은 첫 생성 뒤 확인합니다
- [ ] 하랑이 걷는 포즈 이미지: 기존 파일 사용 / 새로 생성
- [ ] 경로 빨강 색값
- [ ] 변형 종류와 개수
- [ ] 결과 이미지 보관 위치 (후보: `brand/map/`, 파일이 생길 때 만듦)

## 출처

- storyboard/app_screen_storyboard_v1.md (S-05 여행 지도·진행)
- plan/spec/treagent_tech_spec_v1.md:468 (첫 코스 A 4곳)
- dev/app/src/data/courseA.ts (코스 A 장소)
- brand/worldview.md 0절 (대프리카 이름 규칙: 위치 표시는 정식 명칭 사용)
- brand/character/prompts.md (프롬프트 기록 형식, 영문 원문 + 한국어 참고)
- CLAUDE.md (민감한 소재, 브랜드·캐릭터 작업, 개인정보)
- 사용자 제공 (대화, 2026-11-17): 용도·비율·화풍·지리·날씨·하랑이 얹는 방식
