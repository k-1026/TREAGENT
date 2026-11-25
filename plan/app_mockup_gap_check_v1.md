# 목업과 앱의 차이 점검 v1

- 작성일: 2026-11-23
- 기준: `origin/dev` (앱 코드), `storyboard/app_home_mockup_v1.html` 및 `storyboard/app_login_region_mockup_v1.html` (목업)
- 목적: 민지 조원의 앱 이식 전에 목업과 앱이 어긋나는 곳을 한 곳에 모읍니다.
- 범위: 읽기만 했습니다. 앱 코드는 고치지 않았습니다.
- 상태: 점검 결과입니다. 어느 쪽을 따를지는 팀이 정합니다.

## 1. 차이가 있는 곳

| 항목 | 목업 (기준) | 앱 (현재) | 근거 | 결정 필요 |
|---|---|---|---|---|
| 닉네임 | 필수, 기본값 없음 | 건너뛰기 가능, 비우면 "길동무"로 부름 | 목업: `storyboard/design_system_v1.md` 18절 / 앱: `dev/app/src/app/welcome.tsx`, `dev/app/src/lib/profile.ts` (`DEFAULT_NICKNAME`) | 예 (앱 파일에도 결정 필요로 적힘) |
| 첫 만남 안내 문구 | "걷는 시간, 경사, 계단 등 길을 고르는 데 써요" | "걷는 시간을 맞추는 데 써요. 한 번만 받아요." | 목업: `storyboard/app_home_mockup_v1.html` 내 정보 나이대 설명 / 앱: `welcome.tsx` | 아니오 (문구 수정) |
| 로그아웃 | 확인 박스(로그아웃/취소)를 거친 뒤 로그인 화면으로 | 누르면 바로 로그아웃 | 목업: 내 정보 `logoutBox` / 앱: `dev/app/src/app/me.tsx` (`supabase.auth.signOut()` 직접 호출) | 아니오 (확인 박스 추가 권장) |
| 지역 변경 진입 | 내 정보에 지역 줄과 [변경], 지역 변경 화면 | 내 정보에 지역 항목 없음. 구·군 선택은 위치 확인 화면의 [구·군 선택하기]에서만 | 목업: `regionScreen`, 내 정보 지역 줄 / 앱: `dev/app/src/app/index.tsx`, `/district` | 예 (지역 변경 화면을 남길지, F-23) |
| 첫 화면 순서 | 가입 → 첫 만남 → 위치 → 홈 | 로그인 → 위치 확인 → 홈 (첫 만남 화면은 프로필이 없을 때 따로 뜸) | 명세: `storyboard/game_flow_story_v1.md` 4절 / 앱: `index.tsx` 주석 | 예 (이미 `[확인 필요: 개발 담당]`으로 적힘) |

## 2. 맞는 곳

- **나이대**: 필수이고, 여섯 구간(10대~60대)이 목업과 같은 순서입니다. 앱 `welcome.tsx`에서 선택하지 않으면 "시작하기"가 막힙니다.
- **내 정보 닉네임 잠김**: 이미 정한 닉네임은 바꿀 수 없고, 잠김 안내 문구가 같습니다 (`dev/app/src/app/me.tsx`).
- **구·군 준비 중 안내**: "지금은 중구만 갈 수 있어요" 문구가 목업과 같은 뜻입니다 (`index.tsx`, `/district`).
- **위치 안내**: 위치는 앱을 쓰는 동안만 쓰고 좌표는 저장하지 않는다는 문구가 목업과 같습니다.

## 3. 이번에 확인하지 않은 곳

- **홈 화면** (`dev/app/src/app/` 홈 경로): 날씨 배지와 지역 표시, 하랑이 말풍선(무작위 승인 대사), 창문 연결 제거가 앱에 반영되었는지 확인하지 않았습니다.
- **S-06 방문 인증 실패 카드**: 권한 꺼짐, 측위 실패, 거리 문제, 응답 누락의 사유별 카드가 앱에 있는지 확인하지 않았습니다.
- **색 토큰**: `dev/app/src/theme.ts` 경로를 찾지 못했습니다. 앱의 색 값은 디자인 기준 문서와 비교하지 않았습니다.
- **컷씬과 앨범**: 앱에 앨범 화면이 있는지 확인하지 않았습니다.

## 4. 이식 인계 메모 (민지 조원용)

- 목업 기준 브랜치: PR #198(병합 완료, `dev`의 `593f8e1`)에 모든 목업 변경이 들어 있습니다.
- 이식 절차: `storyboard/design_system_v1.md` 16절.
- 먼저 정할 것: 위 1번 표의 "결정 필요" 항목 (닉네임 기본값, 지역 변경 화면, 첫 화면 순서).
- 이미지: 앱에 옮길 스프라이트는 `brand/images/characters/`에 있습니다. 사용 허가는 확인 필요입니다 (`archive/metadata.csv`).

## 출처

- `storyboard/app_home_mockup_v1.html`
- `storyboard/app_login_region_mockup_v1.html`
- `storyboard/design_system_v1.md` 16절, 18절
- `storyboard/game_flow_story_v1.md` 4절
- `dev/app/src/app/welcome.tsx`
- `dev/app/src/lib/profile.ts`
- `dev/app/src/app/me.tsx`
- `dev/app/src/app/index.tsx`
- `archive/metadata.csv`
- git 기준: `origin/dev` (확인 시점 기준)
