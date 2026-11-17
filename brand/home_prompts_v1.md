# 홈 화면 도트 배경 프롬프트 v1 (GPT 이미지)

- 작성일: 2026-11-17
- 상태: 초안. 아직 생성하지 않았습니다. 결정은 팀이 합니다.
- 표기: **사용자 결정**, **창작**, `[확인 필요]`
- 짝 문서: storyboard/app_home_screen_v1.md (요소·배치·변형 기준), brand/character/prompts.md (하랑이 프롬프트)
- 문서 분담: 이 문서는 홈 배경 이미지의 지시문과 점검 기준만 다룹니다. 화면 구성 이유는 짝 문서에 있습니다.

---

## 1. 쓰는 법

- 순서: ① 기본본(평상시·낮) 생성 → 채택 → ② 그 이미지를 첨부해 날씨·시간대 변형 → ③ 외출 전환 프레임.
- 첨부할 이미지: 하랑이 도트 시트 `brand/character/images/harangi_fullbody_pixel.webp` (화풍 기준으로만 첨부). 변형은 채택한 기본본을 첨부합니다.
- 하랑이는 그리지 않습니다. 앱이 스프라이트와 말풍선을 따로 얹습니다 (storyboard/app_home_screen_v1.md 2절).
- 글자·숫자는 모든 프롬프트에서 금지합니다. GPT는 한글을 자주 틀리고, 글자는 앱이 얹습니다.
- 도트 정확도: GPT는 정확한 픽셀 격자를 못 지킵니다. 결과를 약 180 x 180 으로 줄였다가 정수 배로 키우는 후처리를 권합니다 `[확인 필요: 디자인 담당 도구]`.

## 2. 공통 화풍 블록 (모든 프롬프트 앞에 붙임, 창작)

```
Simple cute pixel art in the same style as the attached reference sheet: chunky visible pixels, crisp hard edges, flat colors with very little dithering, dark brown outlines, warm limited palette, soft and cozy mood. Side-on 2D view, no perspective, no 3D, no neon, no oversaturated colors.
```

한국어 참고: 첨부한 시트와 같은 단순하고 귀여운 도트. 굵은 픽셀, 또렷한 가장자리, 디더링 거의 없는 평면 색, 짙은 갈색 윤곽선, 따뜻하고 제한된 팔레트, 아늑한 분위기. 정면에서 본 2D, 원근·3D 없음.

- 색 기준 (창작, 조정 가능): 벽 크림 #fbefdc, 나무 따뜻한 갈색 #b9825a, 윤곽선 짙은 갈색 #5b2a22, 포인트 능금 빨강 #dc3b30, 풀색 연한 세이지 #9fb58a, 하늘 #bfdcec.
  - 포인트 빨강은 장부와 능금 소품에만 씁니다. 하랑이와 시선이 겹치지 않게 하기 위해서입니다.

## 3. P1 · 기본본: 평상시 · 낮 (정사각형 1:1)

```
[공통 화풍 블록]

Subject: the inside of a small cozy room, seen straight from the front, as a game background. Cream plaster wall, warm wooden floor with a thin round rug in the center-left.
Left side: a small wooden door with a round window and a hook beside it (the way out to the alley).
Upper right: a large window showing a sunny Korean alley: tiled roofs, a small tree, a clear blue sky. Soft sunlight makes a window-shaped light patch on the floor.
Right side: a low wooden desk with a big open ledger book (blank pages, no writing) and a small bowl of red apples. A small floor cushion next to the desk. A folded paper fan resting on a shelf.

Layout rules: keep the upper-left corner of the wall calm and low-detail. Keep the center-left floor in front of the door completely empty (a character will be placed there later), with clear empty wall space above it. The most important objects stay inside the central 85% of the image height.

NO text, NO letters, NO numbers, NO logos, NO brand names, NO people, NO animals, NO characters.
```

한국어 참고: 작은 아늑한 방을 정면에서 본 게임 배경. 크림 벽, 따뜻한 나무 바닥, 가운데 왼쪽에 둥근 러그. 왼쪽에 둥근 창이 달린 작은 나무 문(골목으로 나가는 문). 오른쪽 위 큰 창으로 맑은 대구풍 골목(기와지붕, 작은 나무, 파란 하늘), 바닥에 창 모양 햇빛. 오른쪽에 펼친 장부(빈 페이지)와 능금 그릇이 놓인 낮은 책상, 바닥 방석, 선반 위 접부채. 왼쪽 위 모서리는 단순하게, 문 앞 왼쪽 바닥은 하랑이를 얹을 빈 자리. 글자·숫자·로고·사람·동물·캐릭터 없음.

- 넣은 이유 (왜 굳이 / 없으면 깨지는 것):
  - **문과 창**: 문은 외출 연출의 출구이고, 창은 날씨·시간대 변형이 들어갈 자리입니다. 없으면 변형마다 방 전체를 다시 그려야 합니다.
  - **장부와 능금 그릇**: 장부 탭과 하랑이 정체성을 한눈에 이어 줍니다. 장부는 빈 페이지로 둡니다. 안내 정보는 검수된 DB에서만 가져오고 그림은 연출입니다 (brand/worldview.md 5-3절).
  - **빈 자리**: 하랑이 스프라이트와 말풍선이 겹치지 않게 합니다.
  - **부채**: 하랑이의 소품이 방에 놓여 있어 같은 세계로 읽힙니다 (brand/character/profile/harangi_character.md 6절).
  - **상표 금지**: 능금 상표·로고는 쓰지 않습니다 (brand/character/profile/harangi_squirrel.md).

## 4. 변형 지시 (기본본을 첨부하고 아래를 붙임, 창작)

공통 앞머리:

```
Use the attached image as the base. Keep the room, furniture, door, camera framing and empty character area exactly the same. Change only the window view, sky, light color, light patch on the floor, and the small props listed below. Same pixel art style. No text, no people, no animals, no characters.
```

**날씨 (낮)**

| 번호 | 시나리오 | 이어 붙일 문장 |
|---|---|---|
| W1 | 더운 날·그늘 | `Strong bright sunlight, pale yellow-white sky, faint heat shimmer above the rooftops outside, a bamboo blind half-lowered over the window, a small standing fan on the floor near the desk.` |
| W2 | 폭염·실내 | `Very bright hazy white-yellow sky, curtains mostly closed with a thin bright gap, the standing fan on, a glass of water with ice on the desk, a cooler calm color feel inside the room.` |
| W3 | 약한 비 | `Gray-blue sky, light rain streaks and drops on the window, wet rooftops outside, soft cool light with a faint light patch on the floor, an umbrella standing by the door.` |
| W4 | 호우·이동 보류 | `Dark gray-blue sky, heavy rain on the window, a warm cozy lamp lit inside the room, soft lamplight patch on the floor, a closed umbrella by the door. No lightning, nothing scary.` |

**시간대 (맑음)**

| 번호 | 시간대 | 이어 붙일 문장 |
|---|---|---|
| D1 | 아침 | `Early morning: pale blue and pink sky, low sun, long soft light patch on the floor, cool fresh feeling.` |
| D2 | 저녁 | `Evening: orange and pink sunset sky, long warm light patch on the floor, rooftops in warm silhouette.` |
| D3 | 밤 | `Night: deep navy sky with a crescent moon and a few stars, a warm lamp lit on the desk, soft lamplight patch on the floor.` |

- 폭염·호우 변형에는 위험·공포 연출을 쓰지 않습니다 (CLAUDE.md 민감한 소재). 기준 시각과 운영 시간은 이미지가 아니라 앱 문구로 적습니다.
- 시간대 구분 수와 경계 시각이 정해지면 D 번호를 고칩니다 (storyboard/app_home_screen_v1.md 6절).

## 5. 외출 전환 프레임 (기본본을 첨부, 창작)

| 번호 | 프레임 | 지시 |
|---|---|---|
| X1 | 문이 조금 열림 | `Use the attached image as the base. Keep everything the same, but the wooden door is slightly ajar with a thin line of bright warm light coming through. Same pixel art style. No text, no people, no animals, no characters.` |
| X2 | 문이 활짝 열림 | `Same base and framing. The wooden door is fully open and shows a sunny Korean alley outside: tiled roofs, a stone wall, a small tree, blue sky. A bright light patch spreads on the floor from the door. Same pixel art style. No text, no people, no animals, no characters.` |
| X3 | 문 밖 골목 | `A sunny Korean alley seen straight from the front, as the view right after stepping out: stone wall, tiled roofs, small tree, clear blue sky, a narrow pale path leading forward. Empty center-left area for a character. Same pixel art style. No text, no people, no animals, no characters.` |

- 날씨 변형과 함께 쓰려면 X2·X3도 같은 날씨로 다시 만듭니다 `[결정 필요: 변형 범위]`.

## 5-2. 하랑이 옆모습 걷기 스프라이트 (외출 연출용, 창작)

- 왜 굳이: 외출 때 하랑이가 옆을 보고 문 쪽으로 걸어가면 "집을 나선다"가 보입니다. 정면 스프라이트를 좁혀서는 걷는 느낌이 나지 않습니다 (목업은 임시로 흉내만 냄).
- 없으면 깨지는 것: 외출 연출이 페이드 전환뿐이라 컨셉(코스를 고르면 나선다)이 약해집니다.
- 방향: 오른쪽을 보는 한 벌만 만들고, 문이 왼쪽이라 앱에서 좌우 반전해 씁니다.
- 프레임 수 (창작 후보 2개): 후보 1 **2프레임**(다리 번갈아, 위아래 한 칸 흔들림, 만들기 쉬움) / 후보 2 **4프레임**(더 부드럽지만 일관성 확인 필요).
- 배경은 단색으로 받고 이후 배경 제거를 합니다 (GPT가 투명 배경을 안정적으로 못 줌 `[확인 필요]`).

```
[공통 화풍 블록]

Using the attached Harangi pixel reference sheet, draw the SAME character (apple-red squirrel, cream face and belly, small green leaf on the head, cream hood vest, red strap with a small cream pouch) in SIDE VIEW facing right, as a walking cycle sprite sheet: 4 frames in one row, evenly spaced, same size and same ground line in every frame, legs alternating, a gentle one-pixel body bob, the tail swinging slightly. Solid plain light background, nothing else. Keep the vest and pouch in all frames.

NO text, NO letters, NO numbers, NO logos, NO other characters, NO shadows on the ground.
```

한국어 참고: 첨부한 하랑이 도트 시트와 같은 캐릭터를 오른쪽을 보는 옆모습으로 걷기 스프라이트 4프레임(한 줄, 같은 크기·같은 바닥선, 다리 번갈아, 몸 한 칸 흔들림, 꼬리 살짝 흔들림). 조끼와 포쉐트는 모든 프레임에 유지. 단색 배경. 글자·로고·다른 캐릭터·바닥 그림자 없음.

## 6. 생성 뒤 점검

- [ ] 글자, 숫자, 간판 글씨가 없는가
- [ ] 문 앞 왼쪽 바닥과 그 위 벽이 비어 있는가 (하랑이와 말풍선 자리)
- [ ] 왼쪽 위 모서리가 단순한가 (날씨 배지 자리)
- [ ] 장부 페이지에 글씨가 없는가
- [ ] 능금 상표·로고처럼 보이는 것이 없는가
- [ ] 하랑이 시트와 윤곽선 색, 픽셀 굵기가 크게 다르지 않은가
- [ ] 변형에서 방과 가구, 구도가 기본본과 같은가
- [ ] 폭염·호우 변형이 위협적으로 보이지 않는가
- [ ] 3:2 그림을 폭 390에 맞춰 (높이 260) 썼을 때 중요한 물건이 잘리지 않는가
- [x] (옆모습 스프라이트, 팀 제작본 확인 2026-11-17) 프레임 크기와 바닥선이 같은가, 조끼와 포쉐트가 모든 프레임에 있는가, 정면 시트와 색이 같은가

## 7. 시도 기록

| 번호 | 날짜 | 대상 | 프롬프트 요약 | 결과 (채택 / 보류 / 폐기) | 메모 |
|---|---|---|---|---|---|
| 1 | 2026-11-17 | P1 기본본 | 평상시·낮 (1:1 요청) | 채택 후보 | 결과는 3:2(1536x1024)로 나옴, 요청 비율을 따르지 않음. 글자·캐릭터 없음, 하랑이 자리 비어 있음, 장부 빈 페이지. 바닥·벽이 주황 계열이라 하랑이 빨강과 겹칠 수 있어 합성 확인 필요 |
| 2 | 2026-11-17 | 옆모습 걷기 (5-2) | 4프레임 한 줄 시트 | 채택 | 팀 제작본. 프레임 사이 꼬리 조각 제거, 640x660 / 바닥선 y=652로 분할 |

## 8. 결정 필요

- [ ] 도트 후처리(줄였다 키우기) 담당과 도구
- [ ] 변형 조합 범위 (날씨 5 x 시간대 4 전부는 만들지 않음)
- [ ] 색 기준(2절)의 확정
- [ ] 장부 책상을 탭 가능한 요소로 만들지 (지금은 장식)
- [ ] 하랑이 스프라이트 사용 파일

## 출처

- storyboard/app_home_screen_v1.md (구성, 변형, 외출 전환)
- brand/character/images/harangi_fullbody_pixel.webp (화풍 기준)
- brand/character/prompts.md (프롬프트 기록 형식, 영문 원문 + 한국어 참고)
- brand/worldview.md (5-3절 장부는 연출), brand/character/profile/harangi_squirrel.md (상표·로고 금지)
- plan/spec/treagent_tech_spec_v1.md:506-512 (날씨 시나리오)
- CLAUDE.md (민감한 소재, 브랜드·캐릭터 작업)
- 사용자 제공 (대화, 2026-11-17)
