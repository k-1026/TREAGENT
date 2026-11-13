# Supabase 설정 가이드 (로그인·기본 데이터)

- 작성일: 2026-11-13 · 기준: `spec/treagent_tech_spec_v1.md` 9장, 17-13장 순서 1~3
- 결정: 서버·DB는 Supabase (D-02). 로그인 방식은 이메일·비밀번호로 **임시 구현**했습니다 (D-01 확정 전 `[확인 필요]`).
- 대시보드 메뉴 이름은 바뀔 수 있습니다. 이 세션에서 Supabase 공식 문서를 열지 못했고, 아래 인증 설정 설명은 설치된 `@supabase/auth-js` 주석에서 확인했습니다.

## 1. 프로젝트 만들기

- Supabase 대시보드에서 새 프로젝트를 만듭니다. 리전과 요금제는 팀이 정합니다 `[확인 필요]`.
- 데이터베이스 비밀번호는 팀 비밀번호 관리 도구에 보관하고 저장소에 올리지 않습니다.

## 2. 테이블 만들기

SQL Editor에서 아래 순서로 실행합니다.

- `supabase/migrations/20261113000000_init_core.sql` (테이블·RLS·트리거)
- `supabase/seed.sql` (코스 A 데모 데이터, 좌표·운영시간은 비어 있음)

확인
- Table Editor에서 `places` 4행, `courses` 1행, `course_routes` 2행이 보여야 합니다.
- 새 계정을 가입시키면 `profiles`에 행이 자동으로 생깁니다.

## 3. 인증 설정

- 이메일 로그인(Email provider)이 켜져 있는지 확인합니다.
- **Confirm email** 설정에 따라 가입 흐름이 달라집니다 (`@supabase/auth-js` 주석 기준).
  - 켜짐(기본): 가입 직후 세션이 없고, 메일의 확인 링크를 눌러야 로그인됩니다. 앱은 "가입 메일을 보냈어요"를 보여 줍니다.
  - 꺼짐: 가입 즉시 로그인됩니다. 시연·테스트에서는 이쪽이 편합니다.
- 메일 확인 링크를 쓰면 Site URL·리다이렉트 URL 설정이 필요합니다. 앱 딥링크 스킴은 `treagent` 입니다 `[확인 필요: 동작 시험 전]`.
- 비밀번호 최소 길이는 기본 6자로 알고 있습니다. 바꾸면 `app/src/app/(auth)/login.tsx`의 `MIN_PASSWORD`도 맞춥니다 `[확인 필요]`.

## 4. 앱에 연결하기

1. 대시보드 Project Settings > API 에서 **Project URL**과 **anon(public) key**를 복사합니다.
2. `app/.env.example`을 `app/.env`로 복사해 두 값을 채웁니다.
3. 개발 서버를 다시 시작합니다 (환경 변수는 시작할 때 읽습니다).

```bash
cd app
cp .env.example .env
npx expo start
```

- **`service_role` 키는 앱·저장소 어디에도 넣지 않습니다.** 앱 번들에 포함되면 누구나 꺼내 쓸 수 있고 RLS를 우회합니다.
- `.env`는 `.gitignore`에 들어 있습니다. 실수로 올렸다면 키를 즉시 재발급합니다.

## 5. 운영자 계정 지정

운영자 역할은 앱에서 바꿀 수 없고 SQL로만 부여합니다 (9장). 가입한 계정의 이메일로 지정합니다.

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = '운영자 이메일';
```

## 6. 지금 구현된 범위와 아직 안 된 것

- 된 것: 로그인·가입·로그아웃, 세션 유지, 홈(닉네임 또는 ‘길동무’), 기존 데모 연결, 로그인 오류 문구(임시 창작).
- 안 된 것: 첫 만남·닉네임 입력(F-02), 코스 목록, 방문 인증, 운영자 웹. 방문·스탬프·완주 기록은 앱이 직접 쓰지 않고 서버 함수가 기록할 예정이라 아직 쓰기 경로가 없습니다.
- 보안 구조: 모든 테이블에 RLS를 켰고, 단서 정답(`verification_clues`)·날씨 스냅샷은 앱에서 읽을 수 없습니다.

## 7. 검증 내역과 한계

- SQL: 임시 Postgres(PGlite)에서 `auth.uid()`를 흉내 내 25개 항목을 시험해 통과했습니다 (프로필 본인 한정, 운영자만 상태 변경, 방문 중복 거절, 앱의 방문·스탬프 직접 쓰기 거절 등). **실제 Supabase에서는 아직 실행하지 않았습니다** `[미검증]`.
- 앱: 웹 번들을 만들어 브라우저에서 가짜 인증 서버로 14개 흐름을 시험해 통과했습니다 (오류 안내, 세션 유지, 로그아웃, 보호 화면). **실제 Supabase 연결, iOS·Android 실기기, 보안 저장소(SecureStore) 저장은 아직 시험하지 못했습니다** `[미검증]`.
- `npx expo lint`는 ESLint 설정이 없어 실행하지 못했습니다.

## 출처

- `spec/treagent_tech_spec_v1.md` 4-1(서버 후보 비교), 9장(데이터 모델), 13장(D-01·D-02), 17-13(구현 순서)
- `app/node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts` 의 `signUp` 주석 (Confirm email 동작), `lib/error-codes.d.ts` (오류 코드)
- `app/package.json`, `app/app.json`, `app/AGENTS.md` (Expo 버전·라우팅 규칙)
- 직접 열어 확인하지 못한 자료: Supabase 공식 문서, Expo 공식 문서 (이 세션 네트워크에서 차단)
