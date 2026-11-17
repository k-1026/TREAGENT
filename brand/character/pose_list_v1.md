# 하랑이 도트 포즈 목록 v1

- 작성일: 2026-11-17
- 상태: 초안. 만들 포즈와 우선순위는 팀이 정합니다. 확정 항목은 `[확정]`, 나머지는 창작 후보입니다.
- 표기: **사실** (근거 파일), **사용자 결정**, **창작**, `[확인 필요]`
- 짝 문서: brand/character/harangi_character.md (외형·예문), brand/home_prompts_v1.md (GPT 도트 프롬프트), storyboard/app_home_screen_v1.md (홈 화면)
- 문서 분담: 이 문서는 앱에 얹는 도트 하랑이의 **포즈 목록과 파일 규칙**만 다룹니다. 외형과 말투는 harangi_character.md가 맡습니다.

---

## 1. 지금 있는 포즈 (도트, 투명 배경, 포즈별 PNG)

- 원본 시트: `brand/character/images/harangi_fullbody_pixel_transparent.png` (2000 x 667, 포즈 3개가 한 장). 원본은 그대로 둡니다.
- 시트를 포즈별로 잘라 같은 크기(640 x 660)로 맞췄습니다. **발바닥 선(아래에서 8px 위)과 머리 중심이 모두 같아서** 포즈를 바꿔 끼워도 위치가 튀지 않습니다.

| 파일 | 포즈 | 쓰는 곳 |
|---|---|---|
| `harangi_pixel_idle_transparent.png` | 정면 서기, 차분한 표정 | 홈 기본, 로그인 안내 (S-01, S-03) |
| `harangi_pixel_wave_transparent.png` | 손을 들고 웃는 인사 | 첫 만남 인사 (S-02), 호칭이 바뀔 때 (예문 12), 도장 받은 직후 |
| `harangi_pixel_fan_transparent.png` | 부채를 든 정면 서기 | 더운 날 홈 (날씨 변형), 쉼터 도착 (예문 5) |

- 부채는 하랑이가 견습 도사가 된 뒤의 소품입니다. 견습생 이전 회상(컷씬 ②)에는 부채·조끼·포쉐트를 쓰지 않습니다 (brand/worldview.md 3-5절).

## 2. 이미 있는 그림 (도트가 아님, 참고용)

- `harangi_6actions.png` (6포즈): 울며 깨진 것 들기, 놀람과 땀, 화내며 달리기, 인장 확인 들기, 지도 보며 갸웃, 만세.
- `harangi_expressions_fullbody.png` (4포즈): 부채와 땀, 우산, 바람 속 달리기, 나무 그늘에서 물 마시기.
- `harangi_expressions.webp`: 얼굴 표정 3종(행복, 차분, 놀람).
- 위 그림은 선화풍이라 앱의 도트 화풍과 다릅니다. **포즈 구성의 참고**로만 쓰고, 도트로 다시 만듭니다.
- `harangi_motion.gif/mp4`, `harangi_items.png`의 내용은 이번에 확인하지 않았습니다 `[확인 필요]`.

## 3. 더 만들어야 하는 포즈

우선순위: **P0** = MVP(중구, 홈~완주) 화면에 바로 필요, **P1** = 있으면 좋음.

| # | 포즈 | 쓰는 곳 | 근거 | 우선 | 참고 그림 |
|---|---|---|---|---|---|
| 1 | **옆모습 걷기** (오른쪽을 봄, 2 또는 4프레임) | 코스를 고르면 문으로 나가는 외출 연출 | storyboard/app_home_screen_v1.md 5절, brand/home_prompts_v1.md 5-2절 | P0 | 없음 |
| 2 | 놀람 (땀방울, 손 올림) | 경로 변경 알림 (S-07), 특보 안내 (S-14) | storyboard/app_screen_storyboard_v1.md S-07, S-14 | P0 | 6actions 2번 |
| 3 | 차분 (조용히 서 있음) | 이동 보류, 로그인 (S-01, S-07) | 같은 문서 S-01, S-07 | P0 | expressions 차분 표정 |
| 4 | 갸웃, 지도 보기 | 코스 없음, 코스 상세·길 안내 (S-04, S-05) | 같은 문서 S-04, S-05 | P0 | 6actions 5번 |
| 5 | 낮잠에서 깸 (졸린 눈, 하품) | 앱에 다시 들어왔을 때 | harangi_character.md 8절 예문 17 | P0 | 없음 |
| 6 | 앉아서 숨 고르기, 물 마시기 | 쉼터 도착, 폭염 쉼터 안내 | 예문 5, storyboard/app_screen_storyboard_v1.md S-14 | P0 | expressions 4번 |
| 7 | 도장 확인 (인장을 들고 웃음) | 미션 완료, 도장 찍힘 (S-18) | 예문 6, S-18 | P0 | 6actions 4번 |
| 8 | 만세 | 완주, 내 여행 한 장 (S-08), 호칭 변경 | 예문 10, 12, S-08 | P0 | 6actions 6번 |
| 9 | 땀 흘리며 부채질 | 폭염 홈 상태 | storyboard/app_home_screen_v1.md 4절 | P1 | expressions 1번 |
| 10 | 이파리 처짐, 지침 | 쉬어야 한다는 신호 | 예문 18 | P1 | 없음 |
| 11 | 발끈, 삐침 (가볍게) | 능금·대프리카·납작만두를 깎아내렸을 때 | 예문 14~16 | P1 | 6actions 3번 (화내며 달리기) |
| 12 | 우산 쓰기 | 비·호우 날씨 변형 | brand/home_prompts_v1.md 4절 W3, W4 | P1 | expressions 2번 |
| 13 | 열쇠 보기 | 주머니의 열쇠 눌러 보기 | storyboard/game_flow_story_v1.md 9-2절 7-13 | P1 | 없음 |
| 14 | 장부에 한 줄 적기 | 도장이 찍힌 직후 연출 | storyboard/game_flow_story_v1.md 8-1절 6-3 | P1 | 없음 |
| 15 | 울음 (으아앙) | 사용 여부 미정 | 예문 설명(울음 소리만 있음) | `[확인 필요]` | 6actions 1번 |

- 15번은 발끈 규칙이 "울지 않는다"라서(harangi_character.md 7절 6번) 쓰지 않을 수도 있습니다. 쓰임이 정해지면 만듭니다.
- 11번 발끈과 컷씬·말풍선의 얼굴 표정 3종(행복·차분·놀람)을 작은 얼굴 아이콘으로 따로 둘지 `[결정 필요]`.

## 4. 만들 때 규칙 (창작)

- 캔버스: 640 x 660, 투명 배경(RGBA), 팔레트 PNG로 용량을 줄입니다 (포즈 한 장 약 70~80KB).
- 같은 바닥선: 발바닥이 아래에서 8px 위(y = 652). 머리 중심은 가로 중앙(x = 320).
- 파일명: `harangi_pixel_<포즈>_transparent.png` (영문 소문자와 밑줄). 걷기는 `harangi_pixel_walk_side_01_transparent.png`처럼 번호를 붙입니다.
- 외형 고정: 능금 빨강 몸, 크림색 얼굴·배·꼬리 끝, 파란 눈, 머리 이파리, 크림색 후드 조끼와 붉은 끈, 납작만두 포쉐트 (harangi_character.md 6절). 포즈마다 조끼와 포쉐트를 유지합니다.
- 만드는 순서: ① GPT에 `harangi_fullbody_pixel_transparent.png`를 참고로 붙여 단색 배경으로 생성 ② 배경 제거 ③ 위 규칙으로 크기와 바닥선 맞춤 ④ `archive/metadata.csv` 등록.
- 한 번에 같은 시트에서 여러 포즈를 뽑는 편이 외형이 덜 흔들립니다. 시트로 뽑은 뒤 포즈별로 자릅니다.
- 옆모습 걷기의 프레임 수는 2프레임(만들기 쉬움)과 4프레임(부드러움) 중에서 정합니다 `[결정 필요]`.

## 결정 필요

- [ ] P0 포즈 8개(1~8번)를 한꺼번에 만들지, 외출 연출(1번)부터 만들지
- [ ] 옆모습 걷기 프레임 수 (2 / 4)
- [ ] 울음 포즈(15번) 사용 여부
- [ ] 얼굴 표정 아이콘의 필요 여부

## 출처

- brand/character/images/harangi_fullbody_pixel_transparent.png (분할 원본)
- brand/character/images/harangi_6actions.png, harangi_expressions_fullbody.png, harangi_expressions.webp (참고 그림)
- brand/character/harangi_character.md (6절 외형, 7절 말투 규칙, 8절 예문 5·6·10·12·14~18)
- storyboard/app_screen_storyboard_v1.md (S-01, S-02, S-04, S-05, S-07, S-14, S-18)
- storyboard/game_flow_story_v1.md (8-1절, 9-2절)
- storyboard/app_home_screen_v1.md, brand/home_prompts_v1.md
- brand/worldview.md (3-5절)
- 사용자 제공 (대화, 2026-11-17)
