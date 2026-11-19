# Git 협업 규칙

장수 브랜치 3개(`dev`, `main`, `presentation`)와 작업 브랜치로 나눕니다. 작업은 항상 `dev`(또는 `presentation`)로 모읍니다.

## 장수 브랜치 3개

| 브랜치 | 역할 | 들어오는 길 |
| --- | --- | --- |
| `dev` | 지금 개발 중인 것. 앱(`dev/app/`)과 기획·리서치·브랜드 등 모든 작업이 모이는 곳 | 작업 브랜치 → `dev` PR |
| `main` | 최종. 시연·제출·배포에 쓰는 확인된 상태. html은 `main` 병합 때 GitHub Pages로 배포 | `dev → main` PR, `presentation → main` PR |
| `presentation` | 발표 자료(`presentation/`의 html, pdf, 대본)만 다루는 곳 | 발표 작업 브랜치 → `presentation` PR |

- 폴더 `dev/`와 브랜치 `dev`는 다릅니다. 말할 때 "dev 브랜치", "dev/ 폴더"로 구분합니다.
- `main`은 자동으로 바뀌지 않습니다. 사람이 PR을 열고 승인한 뒤 사람이 병합합니다.

## 흐름

1. 새 작업은 파일을 고치기 전에 반드시 최신 `dev`에서 작업 브랜치를 만듭니다 (`git fetch origin` → `git switch -c <브랜치> origin/dev`). 발표 자료 작업은 `origin/presentation`에서 만듭니다.
2. 작업 브랜치에서 커밋하고 푸시합니다.
3. `dev`로 PR을 엽니다 (발표 자료는 `presentation`으로). 작업 중 공유가 필요하면 Draft PR을 씁니다.
4. 팀원 1명이 리뷰하고 승인하면 사람이 병합합니다.
5. 병합이 끝나면 작업 브랜치를 반드시 삭제합니다 (원격은 `--delete-branch` 또는 `git push origin --delete <브랜치>`, 로컬은 `git branch -d <브랜치>`).

## `dev` → `main` 올리기

- 시연 직전이나 한 단계가 끝났을 때 `dev → main` PR을 하나 엽니다. 자동으로 올리지 않습니다.
- PR 본문에 아래 확인 결과를 적습니다. 실행하지 않은 것은 `미확인`으로 적습니다.
  - 앱이 켜지고(`dev/app/`에서 `npx expo start`) 시연 흐름이 끝까지 되는지
  - 개인정보, 사진 위치 정보(EXIF), 허가받지 않은 실존 인물·가게 이름이 없는지
  - html이 있으면 `python3 .github/scripts/build_site.py`에 경고가 없는지
- 팀원 1명이 승인하면 사람이 병합합니다. 병합 방식은 **`Create a merge commit`** 입니다. Squash로 하면 `dev`와 `main` 이력이 어긋나 다음 PR에 충돌이 납니다.
- 병합 직후 `main`을 `dev`에 합쳐 맞춥니다 (`git switch dev && git pull && git merge origin/main && git push`).
- `dev` 전체가 아니라 일부만 올려야 하면 `main`에서 새 브랜치를 따고 필요한 커밋만 `git cherry-pick` 해서 `main`으로 PR을 엽니다. 이 경우 이력이 어긋나므로 되도록 자주 올려서 차이를 작게 둡니다.
- 시연 직전 `main`의 오류는 `main`에서 `hotfix/...` 브랜치를 따서 `main`으로 PR을 열고, 병합 직후 `dev`에도 합칩니다.

## `presentation` 올리기

- 발표 자료는 `presentation`에서 다룹니다. 확정되면 `presentation → main` PR을 엽니다 (병합 방식은 `Create a merge commit`).
- 발표 자료가 앱·기획 변경을 반영해야 하면 `dev`를 `presentation`에 합친 뒤 PR을 엽니다.

## 브랜치

- 형식: `<타입>/<영역>-<짧은-설명>` (영문 소문자, 단어는 `-`로 잇기)
- 예: `fix/pitch-asset-path`, `feat/weather-quest`, `docs/stamp-tour-valuechain`
- 타입은 아래 커밋 타입과 같습니다.
- 브랜치 하나 = 작업 하나 = PR 하나.
- `main`, `dev`, `presentation`에 직접 푸시하지 않습니다.
- 이슈는 자동으로 만들지 않습니다. 브랜치를 만들거나 푸시해도 이슈가 생기지 않습니다.

## 커밋 메시지

- 형식: `<타입>/<영역>: <변경 내용>`
- 예:
  - `fix/개발부분: 발표 자료 이미지 경로 수정`
  - `docs/기획: 랜딩 시작 버튼 수용 기준 정리`
  - `feat/개발부분: 날씨 퀘스트 경로 계산 추가`
- 타입 목록:

| 타입 | 용도 |
| --- | --- |
| `feat` | 새 기능·새 산출물 |
| `fix` | 오류 수정 |
| `docs` | 기획·리서치·문서 |
| `refactor` | 동작은 같고 구조만 정리 |
| `style` | 서식·표현만 변경 |
| `rename` | 파일·폴더 이동, 이름 변경 |
| `chore` | 설정·빌드·기타 잡무 |
| `hotfix` | 긴급 수정 (`main`에서 따고, 반영 뒤 `dev`에도 합침) |

- 영역 목록: `개발부분`, `기획`, `리서치`, `발표`, `브랜드`, `스토리보드`, `아카이브` 등 폴더 기준으로 짓습니다. 필요하면 팀이 추가합니다.
- 제목은 한 줄, 50자 안쪽으로 씁니다. 끝에 마침표를 붙이지 않습니다.
- 커밋 하나에는 의미 있는 변경 하나만 담습니다.
- `git add -A`보다 파일을 지정해 커밋합니다.

## PR (Pull Request)

- 제목: 커밋 제목과 같은 형식을 씁니다. 예: `fix/개발부분: 발표 자료 이미지 경로 수정`
- 대상 브랜치: 작업 PR은 `dev`(발표 자료는 `presentation`), 올리는 PR은 `main`입니다.
- 본문은 [PR 템플릿](.github/pull_request_template.md)을 따릅니다.
  - 변경 내용: 문제와 바뀐 동작
  - 먼저 볼 파일: 핵심 경로와 확인할 부분
  - 수용 기준 검증: 기준별 확인 방법과 결과. 실행하지 않은 검증은 `미확인`으로 적음
  - 리뷰 요청: 판단을 부탁할 부분
- 이슈 연결: 이슈를 따로 만든 작업에만 씁니다. 수용 기준이 모두 끝나면 `Closes #번호`, 일부만 끝나면 `관련 이슈 #번호`를 씁니다. 이슈가 없으면 "해당 없음"으로 적습니다. (`Closes`는 기본 브랜치로 병합될 때만 자동으로 닫힙니다. 기본 브랜치가 `main`이면 `dev` 병합 때는 직접 닫습니다.)
- 리뷰어는 팀원 1명 이상 지정합니다. 승인 후 사람이 병합합니다.
- 병합 방식: 작업 브랜치 → `dev`·`presentation`은 `Squash and merge`(제목은 PR 제목 그대로), `dev`·`presentation` → `main`은 `Create a merge commit`입니다.
- 병합 후 작업 브랜치를 삭제합니다. 장수 브랜치 3개는 삭제하지 않습니다.

## Slack 알림

- PR을 열면 Slack에 리뷰 요청이, `dev`·`main`·`presentation`에 병합되면 "받아 가세요" 안내가 자동으로 갑니다 ([.github/workflows/slack-notify.yml](.github/workflows/slack-notify.yml)).
- Draft PR은 알리지 않고, Ready for review로 바꿀 때 알립니다.
- 설정: 저장소 시크릿 `SLACK_WEBHOOK_URL` (Slack Incoming Webhook 주소). 없으면 알림을 보내지 않습니다.
- 안내를 받으면 작업 전에 `git switch dev && git pull`(발표 자료는 `presentation`)로 최신 브랜치를 받습니다.

## 이슈

- 이슈는 자동으로 만들지 않습니다. 필요할 때만 사람이 [이슈 템플릿](.github/ISSUE_TEMPLATE/task.md)으로 직접 만듭니다.
- 이슈 없이 작업 브랜치와 PR만으로 진행해도 됩니다. 이때 PR 본문에 작업 내용과 수용 기준을 직접 적습니다.

## 금지 사항

- `main`, `dev`, `presentation`에 직접 푸시, 강제 푸시(`git push --force`) 금지
- `dev → main`을 자동화하거나 승인 없이 병합하지 않음
- 다른 사람의 미커밋 변경을 덮어쓰거나 지우지 않음
- 민감 정보(개인정보, 키, 토큰)를 커밋하지 않음

## 결정 필요

- [ ] 병합 방식: 작업 → `dev`는 `Squash and merge`, `dev → main`은 `Create a merge commit` (권장)
- [ ] Pages 배포: `main` 병합 때만 (현재) / `presentation` 푸시 때도 배포
- [ ] GitHub 설정(저장소 관리자가 직접): 기본 브랜치를 `dev`로 바꿀지, 세 브랜치에 보호 규칙(직접 푸시 금지, 승인 1명)을 걸지
- [ ] 승인 인원: 1명 (권장) / 2명