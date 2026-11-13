# dev/supabase

- 팀이 공유하는 Supabase 클라우드 프로젝트의 스키마 기록 폴더입니다 (데모 단계 선택, 정식 결정은 D-02 `[결정 필요]`).
- 테이블·정책 변경은 대시보드에서 직접 고치지 않고 `migrations/`에 SQL 파일로 남깁니다. 파일명은 `YYYYMMDD_설명.sql`(영문 소문자·밑줄).
- 앱에는 anon 키만 씁니다. `service_role` 키와 DB 비밀번호는 저장소·채팅에 올리지 않습니다.

## 출처
- `plan/spec/treagent_tech_spec_v1.md` 4-1장
