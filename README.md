# TREAGENT

팀 TREAGENT의 작업 저장소입니다.

## 현재 프로젝트

**대프리카 히든 퀘스트** (기획 단계)
- 날씨·기온·시간대·요일에 맞는 길(코스)을 안내하는 스탬프 투어 업그레이드. 하랑이와 함께 걷고, 게임 요소는 최소로 둡니다.
- 대상: 대구 거주 2030, 대구 방문 2030. 1차 범위는 여름 "대프리카" 퀘스트. 가을 이후는 여름 운영 결과를 보고 검토합니다.
- 선정 자산 (트랙 가중치, A안): 대구약령시, 대프리카, 이월드·83타워 (역사 테마는 시즌 후반).
- 트랙: AX 크리에이티브 트랙 (콘텐츠 & 뷰티).

## 어디부터 읽나

1. 작업 규칙: [CLAUDE.md](CLAUDE.md), [git-convention.md](git-convention.md)
2. 기획안: [plan/daeprica_hidden_quest_plan.md](plan/daeprica_hidden_quest_plan.md)
3. 고객 전략: [plan/treagent_customer_strategy_v1.md](plan/treagent_customer_strategy_v1.md)
4. 세계관·캐릭터: [brand/worldview.md](brand/worldview.md), [brand/character/harangi_character.md](brand/character/harangi_character.md)
5. 기능·기술 명세: [plan/spec/treagent_tech_spec_v1.md](plan/spec/treagent_tech_spec_v1.md)
6. 최신 발표: [presentation/README.md](presentation/README.md)

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
