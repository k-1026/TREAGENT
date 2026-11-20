# dev/supabase

- 팀이 공유하는 Supabase 클라우드 프로젝트의 스키마 기록 폴더입니다 (데모 단계 선택, 정식 결정은 D-02 `[결정 필요]`).
- 테이블·정책 변경은 대시보드에서 직접 고치지 않고 `migrations/`에 SQL 파일로 남깁니다.
- 파일명은 날짜 없이 `동작_대상.sql`(영문 소문자·밑줄)로 짓고, 실행 순서는 아래 "실행 순서"를 따릅니다. 이 규칙은 팀 확정 전입니다 `[결정 필요]`.
- 이미 실행한 파일은 고치지 않고 새 파일로 변경을 추가합니다.
- 앱에는 anon 키만 씁니다. `service_role` 키와 DB 비밀번호는 저장소·채팅에 올리지 않습니다.

## 실행 순서

Supabase SQL Editor에서 위에서부터 하나씩 실행합니다. 날짜가 없는 이름이라 알파벳 순서로 실행하면 안 됩니다. 새 파일을 추가하면 이 목록 맨 아래에 이어서 적습니다.

| 순서 | 파일 | 내용 | 다시 실행해도 안전한가 |
|---|---|---|---|
| 1 | `create_places.sql` | `places` 표 | 아니요 (이미 있으면 오류) |
| 2 | `seed_places.sql` | 중구 장소 7곳 | 확인 필요 `[확인 필요]` |
| 3 | `create_courses.sql` | `courses`, `course_routes` 표 | 아니요 |
| 4 | `seed_courses.sql` | 코스 C01과 경로 2개 | 확인 필요 `[확인 필요]` |
| 5 | `alter_places.sql` | `places`에 열 추가 (`role`, `permission_state` 등) | 예 (`if not exists`) |
| 6 | `create_place_mode_fit.sql` | `place_mode_fit` 표 | 아니요 |
| 7 | `seed_places_jung.sql` | 엑셀 「중구 장소표」의 새 43곳 추가 | 예 (없는 행만 추가) |
| 8 | `seed_place_mode_fit.sql` | 장소×모드 적합도 199행 | 예 (없는 행만 추가) |
| 9 | `create_profiles.sql` | `profiles` 표 (닉네임·나이대) | 아니요 (이미 있으면 오류) |
| 10 | `create_parties.sql` | `parties`, `party_members`, `party_routes` 표 (일행) | 아니요 (이미 있으면 오류) |
| 11 | `create_party_route_candidates.sql` | `party_route_candidates` 표 (일행 후보 길) | 10번 다음에 실행. 아니요 (이미 있으면 오류) |

- 7번은 새 43곳을 모두 `status = open`으로 노출합니다. 허가 확인 전인 민간 시설과 미검증 장소도 포함되어 있어서, 서버가 `permission_state`를 거르기에 쓸지는 서버 PR에서 정합니다 `[결정 필요]`.
- 8번의 `is_estimated = true` 값(엑셀의 "추정:")은 공간 유형만 보고 넣은 값이라 거르는 데 쓰지 않습니다 `[확인 필요]`.

## 출처
- `plan/spec/treagent_tech_spec_v1.md` 4-1장
