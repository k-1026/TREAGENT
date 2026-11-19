-- 일행(party): 같이 다니는 사람들이 같은 길을 보게 한다.
-- 서버만 읽고 쓴다. 앱은 DB에 직접 접근하지 않는다. 사용자 좌표는 어디에도 저장하지 않는다.
-- 실행 순서: alter_places_access.sql과 무관하다. Supabase 로그인(auth 스키마)이 있는 프로젝트에서 실행한다.

create table public.parties (
  id uuid primary key default gen_random_uuid(),
  host_user_id uuid not null references auth.users (id) on delete cascade,
  invite_code text not null unique check (invite_code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  companion text,
  theme text,
  zone text,
  variant text not null default 'B',
  started_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  age_group text not null check (age_group in ('10s', '20s', '30s', '40s', '50s', '60s')),
  role text not null check (role in ('host', 'member')),
  joined_at timestamptz not null default now(),
  primary key (party_id, user_id)
);

create index party_members_user_id_idx on public.party_members (user_id);

-- 길은 추가만 한다(insert-only). 장소를 바꾸면 version이 올라간 새 행이 생기고 옛 버전은 남는다.
create table public.party_routes (
  id bigint generated always as identity primary key,
  party_id uuid not null references public.parties (id) on delete cascade,
  mode text not null check (mode in ('EXPLORE', 'SHADE', 'INDOOR', 'SAFETY', 'HOLD', 'UNKNOWN')),
  version integer not null check (version >= 1),
  title text not null,
  reason text,
  picker text not null check (picker in ('ai', 'rules')),
  place_ids text[] not null check (cardinality(place_ids) >= 1),
  created_at timestamptz not null default now(),
  unique (party_id, mode, version)
);

alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.party_routes enable row level security;

comment on table public.parties is '일행. 서버만 읽고 쓴다. invite_code는 헷갈리는 글자(0,O,1,I)를 뺀 8글자.';
comment on column public.parties.companion is '동행 코드(예: kids). 값 목록은 서버 route_options.js의 COMPANIONS와 맞춘다. 팀 확정 전이라 check를 걸지 않았다.';
comment on column public.parties.started_at is '시작 처리한 시각. 이후에는 장소를 바꿀 수 없다.';
comment on column public.parties.expires_at is '일행과 초대 코드가 유효한 기한. [확인 필요] 기본 24시간.';
comment on table public.party_members is '일행 구성원. 정확한 나이는 받지 않고 나이대 구간만 저장한다. 계정이 삭제되면 함께 지운다. [확인 필요]';
comment on table public.party_routes is '일행의 모드별 길. (일행, 모드, 버전)마다 한 행. 같은 일행이 같은 모드로 다시 요청하면 가장 큰 version의 길을 그대로 보여 준다.';
comment on column public.party_routes.place_ids is '장소 id 목록. 방문 순서는 서버가 요청 때마다 다시 계산한다.';