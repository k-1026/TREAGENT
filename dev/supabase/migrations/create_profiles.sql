-- 프로필: 닉네임(선택, 한 번 정하면 서버가 바꾸지 못하게 막는다)과 나이대(필수). 서버만 읽고 쓴다.
-- 앱은 DB에 직접 접근하지 않는다. 정확한 나이는 받지 않고 나이대 구간만 저장한다. 계정이 삭제되면 함께 지운다. [확인 필요]
-- 실행 순서: Supabase 로그인(auth 스키마)이 있는 프로젝트에서 실행한다.

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text check (nickname is null or nickname ~ '^[가-힣A-Za-z0-9_]{2,10}$'),
  age_group text not null check (age_group in ('10s', '20s', '30s', '40s', '50s', '60s')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 닉네임은 대소문자를 구분하지 않고 중복을 막는다. 닉네임이 없는(null) 행은 여러 개여도 된다.
create unique index profiles_nickname_key on public.profiles (lower(nickname)) where nickname is not null;

alter table public.profiles enable row level security;

comment on table public.profiles is '사용자 프로필. 서버만 읽고 쓴다. 닉네임 규칙(2~10자, 한글·영문·숫자·밑줄)은 서버 검사와 맞춘다. [확인 필요]';
comment on column public.profiles.nickname is '선택. 비어 있으면(null) 화면에서 "길동무"로 부른다. 대소문자 구분 없이 중복 불가. 한 번 정하면 바꾸지 못한다(서버가 막는다). [확인 필요]';