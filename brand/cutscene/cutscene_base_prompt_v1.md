# 컷씬 기본 프롬프트 v1 (표준 양식)

- 상태: **초안 (팀 확인 전)**. 스타일과 규격은 2026-11-23 사용자 결정, 장면 내용은 장면마다 따로 씁니다.
- 용도: 앨범 컷씬 일러스트를 만들 때 공통으로 붙이는 기본 프롬프트입니다. 장면마다 `{SCENE}` 자리만 바꿉니다.
- 적용 대상: 컷씬 A(두 번째 여행 중반, 첫 만남 쉼터 회상), 컷씬 ②(첫 완주 직후 또는 팀 결정 시점) 외 이후 고정 컷씬. 근거는 `storyboard/game_flow_story_v1.md` 9-1절.

## 1. 규격

| 항목 | 기준 |
|---|---|
| 화면 | 스마트폰 세로 전체 화면 (9:16 원본, 앱에서는 화면 비율에 맞춰 위아래를 잘라 꽉 채움) |
| 원본 크기 | 1080 × 1920 px |
| 안전 영역 | 위 12%, 아래 14%에는 핵심 피사체를 두지 않습니다 (상태 표시줄, 건너뛰기 버튼 가림 방지) |
| 캐릭터 크기 | 화면 높이의 약 50%, 가운데 또는 오른쪽 3분의 1 |
| 배경 | 장면 배경으로 화면 끝까지 채웁니다. 흰 여백 금지 |
| 텍스트 | 넣지 않습니다. 말풍선, 제목, 간판 글자도 앱 화면이 올립니다 |
| 컷 수 | 기본 1컷. 움직임을 살리는 경우 같은 장면 안에서 최대 3컷 (카메라 이동이나 작은 동작만) |

## 2. 스타일 (사용자 결정 2026-11-23)

- 깔끔하고 귀여운 2D 일러스트, 캐릭터 설명 시트(하랑이 정면·측면·표정 3종) 톤.
- 라인아트 스킬을 쓰지 않습니다. 얇은 선화가 아니라 **진한 갈색 외곽선 + 평면 색 + 2단계 부드러운 음영**입니다.
- 외곽선 색: 진한 갈색 (#5b2a22 계열). 둥근 실루엣, 큰 머리·작은 몸 비율.
- 팔레트: 능금 빨강 (#d03a2f 계열), 크림 (#fbefdc 계열), 따뜻한 갈색, 세이지 초록 (이파리), 연한 파란 눈.
- 배경은 캐릭터보다 채도를 낮춰 캐릭터가 먼저 보이게 합니다.

## 3. 하랑이 고정 조건 (참고 시트 기준)

- 다람쥐 몸, 능금 빨강 몸, 크림색 얼굴과 배, 크림색 꼬리 끝, 머리 위 능금 이파리 1장, 파란 눈.
- 소품: 흰·빨간 접부채 (견습생 이후의 소품, 컷씬 ②처럼 견습생 이전 회상에서는 쓰지 않음), 짧은 크림색 후드 조끼, 납작만두 문양이 있는 작은 크림색 천 주머니 (포쉐트).
- 표정 기준: 행복, 차분, 놀람 3종 (`brand/character/pose/pose_list_v1.md` 참고).
- 장면의 나이와 체형은 시트를 따르고, 장면마다 바꾸지 않습니다.

## 4. 금지

- 텍스트, 글자, 말풍선, 로고, 실제 가게 이름이 보이는 간판
- 공포, 참사, 피, 쓰러짐, 위험 장면 (CLAUDE.md 민감한 소재)
- 정령의 등장 (`brand/worldview.md` 2-3절: 정령은 보이지 않음)
- 가게 주인의 얼굴 (실루엣과 팔만 허용. 범위는 팀 결정 전 `[확인 필요]`, `brand/cutscene/README.md`)
- 실존 인물, 실존 가게

## 5. 기본 프롬프트 (영문, 복사해서 사용)

```
Full-screen vertical 2D illustration for a mobile cutscene, 9:16, 1080x1920 px. Clean, cute character-sheet style: flat color fills, two-tone soft shading, smooth rounded shapes, thick dark brown outline (#5b2a22) around the character, big head and small body. Warm, calm, cozy mood.

Palette: apple red (#d03a2f family), cream (#fbefdc family), warm brown, sage green leaf, soft blue eyes. The background is slightly less saturated than the character so the character reads first.

Character: harangi, a chubby cute red squirrel mascot. Red body, cream face and belly, cream tail tip, bright blue eyes, one small green leaf on top of the head. Props only as the scene requires: {PROPS}.

Scene: {SCENE}

Composition: the scene fills the entire frame edge to edge, no white margins. Keep the character at about half the frame height, in the middle or right third. Keep the top 12% and bottom 14% free of important detail. No text, no speech bubbles, no logos, no readable signs, no spirits, no blood, no danger, no falling. Any shop owner appears only as a silhouette and arm. Do not add people other than harangi unless the scene says so.
```

## 6. 장면 입력 예 (컷씬 A, 두 번째 여행 중반)

- `{PROPS}`: 접부채, 납작만두 천 주머니(포쉐트)
- `{SCENE}`: 낮은 골목 쉼터 앞 그늘, 하랑이가 이용자와 처음 만난 날을 떠올리는 장면. 의자와 물 한 컵이 있고, 하랑이는 부채를 든 채 가볍게 웃습니다. 지친 일의 이유는 그리지 않습니다. 이 장면의 실제 내용은 팀 확인 후 확정합니다 `[확인 필요]`.

## 7. 확인할 것

- 원본 9:16을 기기별 비율(예: 9:19.5)에 맞춰 잘랐을 때 얼굴과 소품이 잘리지 않는지 봅니다.
- 생성 결과마다 캐릭터의 빨강·크림·이파리·파란 눈이 시트와 같은지 봅니다.
- 안전 영역(위 12%, 아래 14%)에 핵심 요소가 없는지 봅니다.

## 출처

- `brand/cutscene/README.md` (컷씬 시안 방식, 금지 기준)
- `brand/worldview.md` 2-3절 (정령), 3-5절 (컷씬 규칙)
- `storyboard/game_flow_story_v1.md` 9-1절 (컷씬 재생 시점, 컷씬 A 결정 2026-11-23)
- `brand/character/pose/pose_list_v1.md` (표정·포즈 기준)
- 사용자 제공 캐릭터 설명 시트 (2D 스타일 기준, 2026-11-23)
- `CLAUDE.md` (민감한 소재, 이미지 프롬프트 기록 위치)
