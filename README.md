# TREAGENT

팀 TREAGENT의 작업 저장소입니다. 현재 **기획 단계**입니다.

## 한눈에 보기

**대프리카 히든 퀘스트 (가칭)**: 날씨·기온·시간대·방문 요일에 맞춰 대구의 스탬프 투어 길(코스)을 안내하는 서비스 기획입니다.

| 항목 | 내용 | 근거 |
|---|---|---|
| 무엇 | 기존 스탬프 투어를 날씨 등에 맞춘 맞춤 프로그램으로 업그레이드합니다. 이용자는 안내하는 길을 따라 걷고 장소마다 방문 인증(스탬프)을 합니다. | `plan/daeprica_hidden_quest_plan.md` "방향 변경" |
| 누구를 위해 | 대구 거주 2030, 대구 방문 2030. 대표 이용자로 1박 2일 대구 방문 혼행객을 골랐습니다 (2026-11-10 팀 결정). | `brand/customer_persona.md` |
| 왜 | 대구·경북 관광이 가을 축제 등에 의존하고, 방문객은 늘었지만 체류 시간은 줄었다는 보도가 있습니다. 여름에는 도심 체감온도가 높아 나갈 이유가 부족합니다. | `plan/daeprica_hidden_quest_plan.md` 0-1장 (`[검증됨: 보도]`) |
| 어떻게 | ① **길**: 날씨·시간대·요일에 맞춰 짠 방문 순서 ② **방문 인증**: 장소별 스탬프 ③ **하랑이**: 능금 모티프 다람쥐 캐릭터가 안내 ④ 폭염·한파특보 시 야외 안내 중단, 위치는 앱 사용 중에만 수집 | `plan/daeprica_hidden_quest_plan.md` "방향 변경", `brand/game_concept.md` 1~2장, `brand/character/harangi_squirrel.md` |
| 게임 요소 | 퍼즐·미션 풀이 같은 고도화된 게임 요소는 최소로 둡니다. | `brand/game_concept.md` 1장 |
| 세계관 | 앱 안에서는 대구를 가상의 도시국가 "대프리카"로 소개합니다. 지형과 장소는 실제 대구와 같고 이름만 다릅니다. | `plan/daeprica_hidden_quest_plan.md` "방향 변경" |
| 트랙 | 장소 인증만 하는 **기본 트랙**, 야외 방탈출 형식의 **미스터리 트랙(가칭)**. 미스터리 트랙의 도입 범위는 팀이 정합니다 `[결정 필요]`. | `plan/daeprica_hidden_quest_plan.md` 방향 변경, 318행 |
| 범위 | 1차는 여름 "대프리카" 길입니다. 가을 이후는 여름 운영 결과를 보고 검토합니다. | `plan/daeprica_hidden_quest_plan.md` 변경 요점 4 |
| 지금 단계 | 기획 단계입니다. 무료 MVP 명세 v1이 있고, Expo 앱 데모(코스 A, 4개 장소, 버튼 완료 방식)가 있습니다. 로그인·서버·GPS 인증·운영자 웹은 아직 없습니다. | `plan/spec/treagent_tech_spec_v1.md` 1-1장 |

- 과제 트랙: AX 크리에이티브 트랙 (콘텐츠 & 뷰티).
- 선정 자산 (트랙 가중치 A안): 대구약령시, 대프리카, 이월드·83타워 (역사 테마는 시즌 후반) `[확인 필요: 팀 최종 결정]`.

## 어떻게 보면 되나

| 보고 싶은 것 | 먼저 볼 곳 |
|---|---|
| 5분 안에 전체 흐름 | 발표 최종본 [`presentation/20261113/20261112_plan_pitch_v10.html`](presentation/20261113/20261112_plan_pitch_v10.html) (PDF도 같은 폴더) |
| 왜 하는지, 사업 검증 | [고객 전략](plan/treagent_customer_strategy_v1.md), [시각화 html](plan/treagent_customer_strategy_visualization_v1.html) |
| 서비스 컨셉, 길, 트랙 | [게임·서비스 컨셉](brand/game_concept.md), [기획안](plan/daeprica_hidden_quest_plan.md)의 "방향 변경"과 0장 |
| 세계관, 하랑이 | [세계관](brand/worldview.md), [하랑이 설정](brand/character/harangi_character.md), 이미지는 `brand/character/images/` |
| 앱 기능·기술·담당, 만드는 순서 | [기능·기술 명세 v1](plan/spec/treagent_tech_spec_v1.md), 앱 데모는 `dev/app/` |
| 근거 자료 (사용자 문제, 사례, 경쟁·운영 사례) | [리서치 안내](research/README.md), [페인포인트 후보](research/painpoint/candidates.md) |
| 발표에서 받은 피드백 | [통합 정리](plan/feedback/20261113_presentation_feedback_v1.md) |
| 이 저장소 작업 방법 | [CLAUDE.md](CLAUDE.md), [git-convention.md](git-convention.md) |

**읽을 때 주의**
- 표기: `[검증됨]` 공공 자료·보도 확인, `[확인 필요]` 추가 조사나 협의 필요, `[미검증]` 근거 미확보, `[추정]` 기획상 가정, "창작"은 팀이 정하기 전의 후보입니다.
- 결정이 필요한 항목은 각 문서의 `결정 필요` 섹션에 모아 둡니다. 확정은 팀이 합니다.
- 기획안의 "퀘스트" 표현은 방향 변경 이후 "길(코스)"로 읽습니다 (기획안 "방향 변경"의 용어 표).
- 구버전 문서: `brand/onepager.md`, `brand/one_page_plan.md`(땡볕 탐정단 후보)는 구버전이고, 발표 초안 v1~v9는 최종본 v10 이전 기록입니다. 대본 v3는 v10 내용과 다릅니다 (`presentation/README.md`).

## 폴더 구성 (대분류)

| 대분류 | 하는 일 | 폴더 |
|---|---|---|
| 리서치 | 지역·기업 조사, 사용자 문제와 고객 여정, 리뷰 데이터 | [`research/`](research/README.md) (`painpoint/` 포함) |
| 기획 | 기획서, 고객 전략, 기능·기술 명세, 발표 피드백 | `plan/` (`spec/`, `feedback/` 포함) |
| 브랜드·콘텐츠 | 페르소나, 세계관, 캐릭터(하랑이)와 이미지, 게임 요소 | `brand/` |
| 스토리보드 | 훅 후보, 전환 문장, 스토리 구조, 등장인물 | `storyboard/` |
| 개발 | Expo 앱 데모 (코스 A) | `dev/` (`dev/app/`) |
| 발표 | 발표 자료, 대본, 진행 현황 | [`presentation/`](presentation/README.md) |
| 보관 | 수집물·메타데이터(`metadata.csv`, `tags.md`), 인벤토리, 탈락·보류 후보 | `archive/` (`inventory/`, `rejected/`) |
| 도구 | 브랜드·Git 스킬, 이슈·PR 양식, 자동화 | `.claude/skills/`, `.github/` |

- `brand/character/images/`: 하랑이 이미지의 기준 위치입니다. 발표 html은 `../../brand/character/images/...` 상대경로로 불러옵니다.
- `brand/product/`: 상품 콜라보 시안(능금에이드, 하랑이 도지마롤)과 비교용 기존 상품 이미지입니다 ([README](brand/product/README.md)). 하랑이 3D 디자인 시안은 `brand/character/images/harangi_3d_turnaround.webp`입니다.
- `archive/rejected/daeprica/`: 폐기·보류한 후보 기록입니다 (옛 `versions/daeprica/`).
- 스킬용 `worldview.md`는 `.claude/skills/brand-daeprica/`에 있고, 설정 원본은 `brand/worldview.md`입니다.

## 작업 방법

- GitHub Flow: 최신 `main`에서 작업 브랜치를 만들고 PR로 병합합니다 ([git-convention.md](git-convention.md)).
- 커밋과 푸시는 요청이 있을 때만 합니다.
- 공통 규칙(`CLAUDE.md`, `README.md`)도 브랜치+PR로 고칩니다.
- 새 자료 파일명은 `날짜_지역_소스_주제_순번` 형식으로 짓고, `archive/metadata.csv`에 한 줄씩 기록합니다.

## 확인 필요 항목

- 팀 결정 항목(가중치 비율, 훅 테마 비율, 캐릭터 이름 등)은 각 문서의 `결정 필요`에 모아 둡니다.
- 근거가 불충분한 내용은 `[미검증]` 또는 `[확인 필요]`로 표시합니다.
- `plan/spec/treagent_tech_spec_v1.md`가 인용하는 `design/user_flow_images/`, `TREAGENT_User_Flow_v1.md`는 저장소에 없습니다 `[확인 필요]`.
