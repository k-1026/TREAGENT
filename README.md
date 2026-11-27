# TREAGENT

팀 TREAGENT의 작업 저장소입니다. 기획·리서치는 거의 마무리됐고, 지금은 **앱 개발과 11/30 빌드 제출을 준비하는 단계**입니다 (2026-11-23 기준).

## 바로 보기

주소 확인일: 2026-11-23

| 결과물 | 열기 |
|---|---|
| 앱 (웹 버전) | [treagent-web.vercel.app](https://treagent-web.vercel.app) |
| html 자료 (발표·기획·리서치 목차) | [k-1026.github.io/TREAGENT](https://k-1026.github.io/TREAGENT/) |
| 워크플로우 현황 | [워크플로우 현황 보드](https://k-1026.github.io/TREAGENT/plan/workflow_status_v1.html) (팀이 함께 고치는 [공유 보드](https://claude.ai/artifact/RYHk7ixzHrzH3vafomNssB)는 초대받은 사람만) |

- 앱은 로그인이 필요하고, 지금은 중구만 다룹니다. 서버 상태는 [treagent-production.up.railway.app/health](https://treagent-production.up.railway.app/health)에서 `{"status":"ok"}`로 확인합니다.
- 앱은 `main` 병합 때 자동 배포되므로 최신 `dev` 작업은 18:00 자동 승격 뒤에 반영됩니다.

## 한눈에 보기

**대프리카 히든 퀘스트 (가칭)**: 날씨·기온·시간대·방문 요일에 맞춰 대구의 스탬프 투어 길(코스)을 안내하는 서비스입니다.

| 항목 | 내용 | 근거 |
|---|---|---|
| 무엇 | 기존 스탬프 투어를 날씨 등에 맞춘 맞춤 프로그램으로 업그레이드합니다. 이용자는 안내하는 길을 따라 걷고 장소마다 방문 인증(스탬프)을 합니다. | `plan/daeprica_hidden_quest_plan.md` "방향 변경" |
| 누구를 위해 | 대구 거주 2030, 대구 방문 2030. 대표 이용자로 1박 2일 대구 방문 혼행객을 골랐습니다 (2026-11-10 팀 결정). | `brand/customer_persona.md` |
| 왜 | 대구·경북 관광이 가을 축제 등에 의존하고, 방문객은 늘었지만 체류 시간은 줄었다는 보도가 있습니다. 여름에는 도심 체감온도가 높아 나갈 이유가 부족합니다. | `plan/daeprica_hidden_quest_plan.md` 0-1장 (`[검증됨: 보도]`) |
| 어떻게 | ① **길**: 날씨·시간대·요일에 맞춰 짠 방문 순서 ② **방문 인증**: 장소별 미션을 마치면 도장 1개 ③ **하랑이**: 능금 모티프 다람쥐 캐릭터가 안내 ④ 폭염·한파특보 시 야외 안내 중단, 위치는 앱 사용 중에만 수집 | `plan/spec/treagent_tech_spec_v1.md` 1-3장, `brand/game_concept.md` 1~2장, `brand/character/profile/harangi_squirrel.md` |
| 게임 요소 | 퍼즐·미션 풀이 같은 고도화된 게임 요소는 최소로 둡니다. | `brand/game_concept.md` 1장 |
| 세계관 | 앱 안에서는 대구를 가상의 도시국가 "대프리카"로 소개합니다. 지형과 장소는 실제 대구와 같고 이름만 다릅니다. | `plan/daeprica_hidden_quest_plan.md` "방향 변경" |
| 트랙 | 장소 인증만 하는 **기본 트랙**, 야외 방탈출 형식의 **미스터리 트랙(가칭)**. 미스터리 트랙의 도입 범위는 팀이 정합니다 `[결정 필요]`. | `plan/daeprica_hidden_quest_plan.md` 방향 변경 |
| 범위 | 1차는 여름 "대프리카" 길이고, 지금 MVP는 **중구만** 다룹니다 (2026-11-17 팀 결정). 가을 이후는 여름 운영 결과를 보고 검토합니다. | `plan/spec/treagent_tech_spec_v1.md` 1-3장 |
| 수익 | 지자체와 함께 코스를 만들고 운영하는 협업만 봅니다. 민간 팀권 판매는 뺐습니다 (2026-11-18 결정). | `plan/feedback/20261118_pitch_followup_eval_v4.md` 5-2장 |

- 과제 트랙: AX 크리에이티브 트랙 (콘텐츠 & 뷰티). 앱 중심 제품이라 데이터·서비스 트랙 산출물과 어떻게 나눌지 팀이 정합니다 `[결정 필요]`.
- 선정 자산 (트랙 가중치 A안): 대구약령시, 대프리카, 이월드·83타워 (역사 테마는 시즌 후반) `[확인 필요: 팀 최종 결정]`.

## 지금 상황 (2026-11-23)

**일정** (강의 자료 `Day01`, `Day26`, `Day30` 기준)

| 날짜 | 평가 | 제출물 |
|---|---|---|
| 11/30 (월) | 빌드 미션 | 웹서비스 v1.5 (기능 1개, 360px 반응형, 오류 화면 4종), 30초 쇼츠, 빌드 로그 |
| 12/4 (금) | 데모데이 | HTML 데모 발표, 포트폴리오 사이트, 30초 하이라이트, 핸드오프 패키지 |

**누가 무엇을** (역할은 `plan/team_roles_v1.md` 2026-11-13 합의, 오른쪽은 지금 하는 일로 팀에서 확인한 내용)

| 팀원 | 역할 | 지금 하는 일 |
|---|---|---|
| 소정 | FE·BE·AI | 앱 개발: 서버, DB 테이블(구조) 만들기, 앱 화면. 테이블에 들어가는 데이터는 직접 조사하지 않음 |
| 소형 | PM·DES·CON·AI(대사)·FE 화면 | 목업·스토리보드, 브랜드·하랑이, 기획·발표 문서 |
| 민지 | RES·DES·PM·FE 화면 | 프론트(앱 화면 구현), 장소·관광 데이터 조사와 입력 |

- DB는 소정이 테이블을 만들고 민지가 데이터를 조사해 넣습니다. 시드 SQL로 적재하는 일을 누가 이어서 할지는 정해지지 않았습니다 `[결정 필요]`.
- 소형·민지가 함께 가진 DES·PM의 주 담당도 미정입니다 `[결정 필요]` (`plan/team_roles_v1.md` 3장).

**개발 현황** (`dev/`, 파일과 코드가 있는지만 확인했고 동작은 확인하지 않았습니다 `[확인 필요]`)

| 구분 | 있는 것 | 아직 없는 것 |
|---|---|---|
| 서버 (`dev/server/`) | 규칙(모드 결정)·기상청 날씨, 장소·코스·추천, AI 길 구성·하랑이 브리핑, 프로필, 팀 후보 길. 테스트 파일 40개 | GPS 방문 인증, 도장·완주 판정, 진행 여행, 운영자 API |
| 앱 (`dev/app/`) | 로그인·가입, 위치와 구·군 선택(중구), 코스 목록·상세, 오늘의 길 후보 3개, 프로필, 팀 모드 | 홈, 여행 지도·진행, 방문 확인, 완주·장부, 운영자 웹 |
| DB (`dev/supabase/`) | 장소(중구 50곳 시드), 장소 적합도, 코스(C01), 프로필, 팀 후보 길 | 방문·도장·여행 테이블 |
| 배포 | 서버 Railway, 웹 Vercel, `dev → main` 자동 승격 | - |

- 열린 PR: 로그인 전 화면을 목업대로 바꾸는 #208 (민지).
- 병합되지 않은 스토리보드 브랜치: `feat/storyboard-travel-flow`, `feat/storyboard-stop-gps-fail` (소형).

**마무리가 안 된 기획** (자세한 목록은 현황 보드)

- 시장 규모(TAM·SAM·SOM): 중구 방문자 36개월 값과 20~30대 비율은 채웠지만 지자체 계약 단가, 연간 계약 건수·외주 비율이 비어 금액은 계산하지 못했습니다 (`research/bm/jung_som_inputs_v1.csv`). 정리 문서 v3(11/18)는 최신 입력과 어긋납니다.
- 페르소나: 브랜드명, 능금 모티프 승인, 금칙어, 핵심 자산 최종 선택이 팀 확정 전입니다 (`brand/persona_sheet.md` 10장).
- 강의 산출물 중 저장소에서 못 찾은 것: 12일차 `ax/`, 13일차 BM 캔버스·레드팀, 19~20일차 `modeling/` 등 `[확인 필요: 다른 이름·위치일 수 있음]`.

**현황 보드**

- [`plan/workflow_status_v1.html`](plan/workflow_status_v1.html): 기획·개발 워크플로우 단계별 task 카드와 산출물 현황 (저장소 고정 사본, 배포 사이트에서 열림).
- [claude.ai 공유 보드](https://claude.ai/artifact/RYHk7ixzHrzH3vafomNssB): 팀이 함께 카드를 추가·수정하고 사람 칸에 배정하는 보드입니다. 공유 설정에서 기여자 이상으로 초대받은 사람만 열고 고칠 수 있습니다.

## 어떻게 보면 되나

| 보고 싶은 것 | 먼저 볼 곳 |
|---|---|
| 지금 어디까지 했고 무엇이 남았는지 | 위 "현황 보드" |
| html 자료를 바로 열어 보기 (발표, 고객 전략, 리서치 등) | 배포 사이트 [k-1026.github.io/TREAGENT](https://k-1026.github.io/TREAGENT/) 의 목차 (`main`에 병합되면 자동 갱신) |
| 5분 안에 전체 흐름 | 발표 최종본 [`presentation/20261113/20261112_plan_pitch_v10.html`](presentation/20261113/20261112_plan_pitch_v10.html) (PDF도 같은 폴더), 11/18 발표는 [`presentation/README.md`](presentation/README.md) |
| 왜 하는지, 사업 검증 | [고객 전략](plan/treagent_customer_strategy_v1.md), [시각화 html](plan/treagent_customer_strategy_visualization_v1.html), 시장 근거 `research/bm/` |
| 서비스 컨셉, 길, 트랙 | [게임·서비스 컨셉](brand/game_concept.md), [기획안](plan/daeprica_hidden_quest_plan.md)의 "방향 변경"과 0장 |
| 세계관, 하랑이 | [세계관](brand/worldview.md), [하랑이 설정](brand/character/profile/harangi_character.md), 이미지는 `brand/images/characters/` |
| 앱 화면 설계 (스토리보드·목업) | [앱 화면 스토리보드](storyboard/app_screen_storyboard_v1.md), 목업 [홈](storyboard/app_home_mockup_v1.html)·[로그인·지역](storyboard/app_login_region_mockup_v1.html) |
| 앱 기능·기술·담당, 만드는 순서 | [기능·기술 명세 v1](plan/spec/treagent_tech_spec_v1.md), 여행 저장·방문·완주 [설계 초안 v1](plan/spec/trip_visit_design_v1.md) |
| 앱·서버 실행과 배포, 새 컴퓨터 세팅 | [dev/README.md](dev/README.md), [세팅 가이드](dev/team_setup_guide_v1.md), 개발 규칙 [dev/CLAUDE.md](dev/CLAUDE.md) |
| 근거 자료 (사용자 문제, 사례, 경쟁·운영 사례) | [리서치 안내](research/README.md), [페인포인트 후보](research/painpoint/candidates.md) |
| 발표에서 받은 피드백 | [11/13 통합 정리](plan/feedback/20261113_presentation_feedback_v1.md), [11/18 평가](plan/feedback/20261118_pitch_followup_eval_v4.md) |
| 역할 분담, 할 일 | [역할 분담](plan/team_roles_v1.md), [할 일 v1](plan/todo_des_con_v1.md) (11/17 기준) |
| 이 저장소 작업 방법 | [CLAUDE.md](CLAUDE.md), [git-convention.md](git-convention.md) |

**배포 사이트**
- 저장소의 `.html` 전체를 GitHub Pages로 배포합니다. 새 html을 만드는 규칙은 [CLAUDE.md](CLAUDE.md)의 "HTML 산출물과 배포 기준"을 따릅니다.
- 배포는 `main`에 병합될 때 일어납니다. 열리지 않으면 Actions 탭의 "HTML 배포" 실행 결과를 확인합니다.
- 배포 사이트는 외부에 공개됩니다. 공개하지 않을 html은 `.github/site/exclude.txt`에 경로를 적습니다.

**읽을 때 주의**
- 표기: `[검증됨]` 공공 자료·보도 확인, `[확인 필요]` 추가 조사나 협의 필요, `[미검증]` 근거 미확보, `[추정]` 기획상 가정, "창작"은 팀이 정하기 전의 후보입니다.
- 결정이 필요한 항목은 각 문서의 `결정 필요`에 모아 둡니다. 확정은 팀이 합니다.
- 기획안의 "퀘스트" 표현은 방향 변경 이후 "길(코스)"로 읽습니다 (기획안 "방향 변경"의 용어 표).
- 구버전 문서: `brand/onepager.md`, `brand/one_page_plan.md`(땡볕 탐정단 후보)는 구버전이고, 발표 초안 v1~v9는 최종본 v10 이전 기록입니다. 대본 v3는 v10 내용과 다릅니다 (`presentation/README.md`).

## 폴더 구조

```
TREAGENT/
├─ README.md, CLAUDE.md, git-convention.md   저장소 안내, 작업 규칙, Git 규칙
├─ research/        리서치
│  ├─ bm/               시장·계약 단가 입력, TAM·SAM·SOM 근거 (v1~v3), 계산 시트
│  ├─ company/          기업·기관 조사 (eventus, kakao_gotgot, kh_promotion, qrstp, questour)
│  ├─ creative/         캠페인 기획, 시나리오, 비주얼 규칙, 평가표
│  ├─ data/reviews/     리뷰 데이터와 분석
│  ├─ painpoint/        페인포인트 후보, 고객 여정, VOC 분류
│  ├─ tourism_data/     중구 관광자료 엑셀 v7 (DB 장소 시드의 원천)
│  ├─ valuechain/       밸류체인, 경쟁·운영 사례 비교
│  └─ *.md              지역·사례 조사 노트 (키워드 맵, 능금, 대구 역사, 벤치마크 등)
├─ plan/            기획
│  ├─ spec/             기능·기술·담당 명세 v1
│  ├─ feedback/         발표 피드백 원문과 통합 정리, 11/18 평가
│  └─ 기획안, 고객 전략, 역할 분담, 할 일, 워크플로우 현황 보드
├─ brand/           브랜드·콘텐츠
│  ├─ character/        하랑이 (images/, pose/, profile/, prompts.md)
│  ├─ cutscene/         컷씬 일러스트 시안
│  ├─ home/             홈 화면 방 배경 이미지
│  ├─ product/          가상 굿즈 시안
│  └─ 페르소나, 세계관, 게임·서비스 컨셉, 아이템, 퀴즈 후보
├─ storyboard/      앱 화면 스토리보드, 목업 html, 디자인 시스템, 쇼츠 샷 리스트
├─ dev/             개발
│  ├─ app/              Expo 앱 (src/app 화면, src/lib, src/components, assets/)
│  ├─ server/           Node 서버 (src/ai, courses, party, places, profile, routes; test/)
│  ├─ supabase/         DB 구조와 시드 SQL (migrations/), 입력 CSV (inputs/)
│  ├─ images/           구조도 svg
│  └─ README.md, CLAUDE.md, team_setup_guide_v1.md
├─ presentation/    발표 (20261113/, 20261118/ 등 발표일 폴더)
├─ archive/         수집물 기록 (metadata.csv, tags.md), inventory/, rejected/, story/
├─ .claude/         스킬 (brand-daeprica, git-task-commit), launch.json
└─ .github/         workflows/ (HTML 배포, dev→main 자동 승격, Slack 알림), 이슈·PR 양식, scripts/, site/
```

| 대분류 | 하는 일 | 폴더 |
|---|---|---|
| 리서치 | 지역·기업 조사, 시장 근거, 사용자 문제와 고객 여정, 리뷰 데이터 | [`research/`](research/README.md) |
| 기획 | 기획서, 고객 전략, 기능·기술 명세, 발표 피드백, 현황 보드 | `plan/` (`spec/`, `feedback/` 포함) |
| 브랜드·콘텐츠 | 페르소나, 세계관, 캐릭터(하랑이)와 이미지, 게임 요소 | `brand/` |
| 스토리보드 | 앱 화면 스토리보드, 목업, 디자인 기준, 훅·전환 | `storyboard/` |
| 개발 | Expo 앱, Node 서버, Supabase DB | [`dev/`](dev/README.md) |
| 발표 | 발표 자료, 대본, 진행 현황 | [`presentation/`](presentation/README.md) |
| 보관 | 수집물·메타데이터, 인벤토리, 탈락·보류 후보 | `archive/` |
| 도구 | 브랜드·Git 스킬, 이슈·PR 양식, 자동화 | `.claude/`, `.github/` |

- `brand/images/characters/`: 하랑이 이미지의 기준 위치입니다. `brand/images/items/`: 여행 아이템, 고정 소품, 도장, 원본 시트입니다. 발표 html은 `../../brand/images/characters/...` 상대경로로 불러옵니다. 앱에 들어가는 에셋은 `dev/app/assets/`에 둡니다.
- `brand/product/`: 가상 굿즈 시안입니다 ([README](brand/product/README.md)). 컷씬 시안은 [`brand/cutscene/`](brand/cutscene/README.md)에 있습니다.
- `archive/rejected/daeprica/`: 폐기·보류한 후보 기록입니다.
- 스킬용 `worldview.md`는 `.claude/skills/brand-daeprica/`에 있고, 설정 원본은 `brand/worldview.md`입니다.
- 새 대분류 폴더는 팀이 정한 뒤에 만듭니다. 강의 자료가 말하는 `modeling/`, `reports/`, `video/`, `quality/`, `automation/`, `demo/`, `handoff/` 같은 폴더를 어디에 둘지는 아직 정하지 않았습니다 `[결정 필요]`.

## 작업 방법

- 장수 브랜치는 `dev`(개발 중인 모든 작업), `main`(최종: 시연·제출·배포), `presentation`(발표 자료만) 3개입니다 ([git-convention.md](git-convention.md)).
- 새 작업은 파일을 고치기 전에 최신 `dev`에서 `<타입>/<영역>-<설명>` 브랜치를 만들고, 작업 하나마다 브랜치와 PR을 하나씩 씁니다. PR은 `dev`로 열고(발표 자료는 `presentation`), 팀원 1명 승인 뒤 사람이 병합합니다.
- `dev → main`은 `.github/workflows/promote-dev-to-main.yml`이 매일 18:00(한국 시간)에 자동으로 올립니다. 이 경로에는 사람의 승인이 없고, 병합되면 Vercel·Railway가 바로 다시 배포됩니다. 멈출 때는 저장소 변수 `AUTO_PROMOTE`를 `false`로 둡니다.
- 공통 규칙(`CLAUDE.md`, `README.md`)도 브랜치와 PR로 고칩니다.
- 커밋과 푸시는 요청이 있을 때만 합니다. 커밋 제목은 `<타입>/<영역>: <내용>` 형식입니다.
- 이슈는 자동으로 만들지 않습니다. 필요할 때 사람이 직접 만듭니다.
- 새 자료 파일명은 `날짜_지역_소스_주제_순번` 형식으로 짓고, `archive/metadata.csv`에 한 줄씩 기록합니다.

## 확인 필요 항목

- 팀 결정 항목(가중치 비율, 훅 테마 비율, 캐릭터 이름, 폴더 위치, 트랙 등)은 각 문서의 `결정 필요`와 현황 보드에 모아 둡니다.
- 근거가 불충분한 내용은 `[미검증]` 또는 `[확인 필요]`로 표시합니다.
- `plan/spec/treagent_tech_spec_v1.md`가 인용하는 `design/user_flow_images/`, `TREAGENT_User_Flow_v1.md`는 저장소에 없습니다 `[확인 필요]`.
- 위 "지금 상황"의 개발 현황은 파일과 코드 기준이며, 앱을 실행해 확인한 것이 아닙니다 `[확인 필요]`.

## 출처

- 일정: `CJ_AX_lecture_note/1. 강의 자료/Day01_1026_온보딩_v3.md`, `Day26`, `Day30` (로컬 강의 자료)
- 역할: `plan/team_roles_v1.md`, 지금 하는 일은 팀 확인 (2026-11-23)
- 개발 현황: `dev/README.md`, `dev/app/src/app/`, `dev/server/src/`, `dev/supabase/migrations/`, GitHub PR 목록 (2026-11-23)
- 시장·페르소나: `research/bm/jung_som_inputs_v1.csv`, `research/bm/jung_summer_tam_sam_som_v3.md`, `brand/persona_sheet.md`
- 수익 결정: `plan/feedback/20261118_pitch_followup_eval_v4.md` 5-2장
