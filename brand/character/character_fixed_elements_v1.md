# 하랑이 고정 요소 표 v1

- 작성일: 2026-11-23
- 목적: 그림을 새로 그리거나 생성할 때 바뀌면 안 되는 항목을 한 표에 모읍니다. 캐릭터 시트 작업(DA, 마감 11/24)의 기준 문서입니다.
- 상태: 초안. `[확정]`은 사용자 결정, `[창작 후보]`는 팀이 정할 항목입니다.
- 참고 시트: `brand/images/characters/base/harangi_sheet.webp` (정면, 측면, 표정 3종, 설명 문구 포함).

## 1. 몸과 얼굴

| 항목 | 고정 값 | 근거 | 상태 |
|---|---|---|---|
| 종 | 다람쥐, SD(큰 머리 작은 몸) | `harangi_character.md` 6절 | `[확정]` |
| 몸 색 | 능금 빨강 (#d03a2f 계열) | `brand/character/prompts.md` 공통 조건 | `[확정]` |
| 얼굴·배 색 | 크림색 (#fbefdc 계열) | `prompts.md` 공통 조건 | `[확정]` |
| 눈 | 파란 눈 | `harangi_sheet.webp`, `harangi_character.md` 6절 | `[확정]` |
| 눈 안의 빛 | 양쪽 눈 모두 오른쪽 상단에 흰 빛 | 사용자 확인 (2026-11-23) | `[확정]` |
| 외곽선 | 진한 갈색 (#5b2a22 계열), 굵게 | `prompts.md`, 목업 공통 스타일 | `[확정]` |
| 머리 위 | 능금 이파리 1장 (세이지 초록) | `harangi_character.md` 6절 | `[확정]` |
| 이파리 위치 | 머리 위 튀어나온 부분의 오른쪽, 중심에서 약간 오른쪽 (오른쪽 귀 바로 왼편) | 사용자 확인 (2026-11-23) | `[확정]` |
| 눈 모양 | 세로로 긴 눈 | 사용자 확인 (2026-11-23) | `[확정]` |
| 귀 안쪽 | 크림색 | 사용자 확인 (2026-11-23) | `[확정]` |
| 코 | 작고 진한 갈색 (외곽선과 같은 색) | 사용자 확인 (2026-11-23) | `[확정]` |

## 2. 꼬리

| 항목 | 고정 값 | 근거 | 상태 |
|---|---|---|---|
| 전체 색 | 몸과 같은 능금 빨강 | `prompts.md` 공통 조건 (2026-11-23 결정) | `[확정]` |
| 끝 부분 | 끝 3분의 1만 크림색 | 같은 자리 (2026-11-23 결정) | `[확정]` |
| 모양 | 풍성한 물방울형 꼬리, 흔들림 3프레임 | `harangi_tail_sprite_v1.webp` 채택본 | `[확정]` |

## 3. 소품

| 항목 | 고정 값 | 근거 | 상태 |
|---|---|---|---|
| 부채 | 흰색과 빨간색 접부채, 빨간 바람 무늬 (구름 무늬 아님) | `harangi_sheet.webp`, `fan_sprite_v1.png` | `[확정]` |
| 조끼 | 짧은 크림색 후드 조끼 | `harangi_sheet.webp`, `harangi_character.md` 6절 | `[확정]` |
| 포쉐트 | 가방 모양 자체가 납작만두인 작은 가방 (문양이 아님) | 사용자 확인 (2026-11-23), `harangi_character.md` 6절 | `[확정]` |
| 포쉐트 속 | 능금 몇 개 (캐릭터 소품, 플레이어 주머니와 별개) | `harangi_personality_v1.md` 3-1절, `game_concept.md` 10절 | `[확정]` |
| 견습생 이전 회상 | 부채, 조끼, 포쉐트 없음 | `brand/worldview.md` 3-5절, `brand/cutscene/README.md` | `[확정]` |
| 열쇠 | 구리빛, 바람 무늬 원형 고리 (스토리의 "바람결 문양") | `brand/images/items/key_sprite_v1.png`, `game_flow_story_v1.md` 2-6절 | `[확정]` |
| 장부 (펼침) | 크림색 종이 페이지, 빨간 책갈피 끈 | `brand/images/items/ledger_sprite_v1.webp` | `[확정]` |
| 장부 (덮임) | 빨간 표지에 바람 무늬, 가죽 테두리 | `brand/images/items/ledger_closed_sprite_v1.png` | `[확정]` |
| 능금 | 작고 둥근 한 알, 빨간 껍질, 초록 잎 (사과보다 작게) | `brand/images/items/nunggeum_sprite_v1.png`, `brand/decision_nunggeum_motif_v1.md` | `[확정]` |
| 손수건 | 스토리 2-4의 소품, 그림 기준 없음 | `game_flow_story_v1.md` 2-4절 | `[확인 필요]` |

## 4. 표정과 포즈

| 항목 | 고정 값 | 근거 | 상태 |
|---|---|---|---|
| 기본 표정 3종 | 행복, 차분, 놀람 | `harangi_sheet.webp`, `brand/character/pose/pose_list_v1.md` 55행 | `[확정]` |
| 이파리 신호 | 기본은 위로 선 이파리, 지치면 이파리가 처짐 | `storyboard/game_flow_story_v1.md` 2-3절, 4-7절 | `[확정]`, 처짐 각도는 `[확인 필요]` |
| 몸 방향 | 정면, 측면(옆모습 걷기) | `harangi_sheet.webp`, `harangi_pixel_walk_side_*` | `[확정]` |
| 표정 세부 | 행복: 눈을 감고 활짝 웃음 / 차분: 눈을 뜨고 작게 웃음 / 놀람: 눈을 크게 뜨고 입을 연 얼굴 | 사용자 확인 필요, `harangi_sheet.webp` | `[확인 필요]` |
| 이동 방향 | 외출 연출에서 문 쪽(화면 왼쪽)으로 걸어 나감 | `storyboard/app_home_mockup_v1.html` 외출 연출 | `[확정]` |

## 5. 크기와 이동 (팀 결정 전)

| 항목 | 후보 | 근거 | 상태 |
|---|---|---|---|
| 크기 | A 작은 고양이만 한 크기 (추천) / B 손바닥 크기 | `harangi_character.md` 6-4절 | `[창작 후보]` |
| 이동 | A 옆에서 함께 걷기 (추천) / B 어깨나 가방에 탑승 | `harangi_character.md` 6-4절 | `[창작 후보]` |
| 시각 방향 | 1 한지 질감 + 능금 빨강 포인트 / 2 골목 간판 타이포 + 크림 바탕 | `harangi_character.md` 6-3절 | `[창작 후보]` |

## 6. 설정으로만 두는 것 (그림에 쓰지 않음)

| 항목 | 설정 | 근거 | 상태 |
|---|---|---|---|
| 성별, 나이 | 표기하지 않음 | `harangi_character.md` 6-1절 | `[확정]` |
| 몸무게 | 설정하지 않음 | `harangi_character.md` 6-1절 | `[확정]` |
| 가족 | 언급하지 않음 | `harangi_character.md` 6-1절 | `[확정]` |
| 사투리 | 쓰지 않음 | `harangi_character.md` 6-1절 | `[확정]` |
| 생일 | 보류 (후보: 6월 21일, 8월 23일, 9월 23일) | `harangi_character.md` 6-1절 | `[보류]` |

## 7. 그리지 않는 것

- 눈 속눈썹 (사용자 결정 2026-11-23)
- 청설모의 귀털이나 털색 (다람쥐 종으로 확정, `harangi_character.md` 6-2절)
- 네온 같은 과포화 색 (`harangi_character.md` 6-3절)
- 능금 상표나 로고 (`brand/character/profile/harangi_squirrel.md`)
- 정령의 모습 (`brand/worldview.md` 2-3절: 정령은 보이지 않음)
- 가게 주인의 얼굴 (실루엣과 팔만, 범위는 `[확인 필요]`)
- 글자, 말풍선, 간판 글씨 (시트의 설명 문구는 제작 참고용이고, 그림 자체에는 넣지 않음)

## 8. 확인할 것

- 새로 만든 그림마다 1~4절 항목이 시트와 같은지 봅니다.
- 꼬리는 몸과 같은 빨강이고 끝 3분의 1만 크림색인지 봅니다.
- 소품은 장면에 맞는지 봅니다 (견습생 이전 회상에서는 빠져야 함).

## 9. 시트에서 확인할 세부 색과 모양

설명 시트에 있지만 아직 문서에 적지 않은 항목입니다. 추측으로 적지 않고 시트를 보고 채웁니다.

- 입의 색과 모양
- 머리 위 이파리의 크기
- 몸 비율 (6-4절 크기 후보와 함께 정함)
- 이파리 처짐 각도

## 출처

- `brand/images/characters/base/harangi_sheet.webp`
- `brand/images/characters/sprites/harangi_tail_sprite_v1.webp`, `fan_sprite_v1.png` (채택본)
- `brand/character/profile/harangi_character.md` 6절, 6-1절 ~ 6-4절
- `brand/character/profile/harangi_personality_v1.md` 3-1절
- `brand/character/profile/harangi_squirrel.md`
- `brand/character/pose/pose_list_v1.md` 55행
- `brand/character/prompts.md` 공통 조건
- `brand/worldview.md` 2-3절, 3-5절
- `brand/game_concept.md` 9절, 10절
- `brand/cutscene/README.md`
- `storyboard/game_flow_story_v1.md` 2-3절, 4-7절
