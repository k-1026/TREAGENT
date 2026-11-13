-- TREAGENT P0 핵심 스키마 (spec/treagent_tech_spec_v1.md 9장 기준)
-- 범위: 로그인·프로필·장소·코스·여행·방문·스탬프·대사·운영 이력.
-- 제외(P1·P2): seasons, ledger_cells, season_results, device_tokens, notification_log, events, quiz_items, place_docs, mascot_packs.
-- 원칙
--  * 참여자 앱은 anon 키 + 로그인 세션으로 접근한다. 모든 테이블은 RLS를 켠다.
--  * 방문(visits)·스탬프(stamps)·완주 기록(journal_entries) 쓰기는 앱이 직접 하지 않는다.
--    서버(Edge Function 등, service_role)가 검증 후 기록한다 (F-09, F-10).
--  * 역할(운영자)은 user_roles에만 있고 앱에서 바꿀 수 없다 (spec 9장: 역할은 서버에서만 부여).
--  * 수치 기준(인증 반경·정확도 등)은 확정 전이므로 이 파일에 적지 않는다 (D-05).

-- ---------------------------------------------------------------------------
-- 1. 계정
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text check (nickname is null or length(btrim(nickname)) > 0), -- 길이·금칙어 규칙은 F-02 확정 후 [확인 필요]
  first_visit_done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin')),
  granted_at timestamptz not null default now()
);

-- 가입 시 profiles 행을 자동 생성한다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- 운영자 여부. RLS 정책에서만 쓴다.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 장소·코스 (운영자가 관리, 참여자는 읽기만)
-- ---------------------------------------------------------------------------

create table public.places (
  id text primary key,
  name text not null,
  address text,
  district text, -- 구·군 (F-23)
  lat double precision, -- 좌표는 현장 확인 후 입력 [확인 필요]
  lng double precision,
  indoor boolean not null,
  place_type text check (place_type in ('indoor', 'shade', 'outdoor', 'exhibit')),
  mode_allowed text[] not null default '{}', -- 노출 허용 날씨 모드. 모드표는 D-06 확정 후
  verified_at date, -- 사실 확인일
  source text, -- 출처 (URL 또는 파일 위치)
  created_at timestamptz not null default now()
);

create table public.place_status (
  place_id text primary key references public.places (id) on delete cascade,
  status text not null default 'unknown' check (status in ('open', 'paused', 'unknown')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- 인증 지점. 앱에 내려보내도 되는 정보만 둔다.
create table public.verification_points (
  place_id text primary key references public.places (id) on delete cascade,
  lat double precision,
  lng double precision,
  description text, -- 인증 지점 설명
  photo_url text,
  measured_error_m numeric, -- 현장 실측 오차 (D-05 근거)
  clue_prompt text -- 현장 단서 질문 (17-4). 정답은 verification_clues에만 둔다
);

-- 현장 단서 정답. 앱(authenticated)에는 정책이 없어 읽을 수 없다. 서버(service_role)만 채점에 사용.
create table public.verification_clues (
  place_id text primary key references public.places (id) on delete cascade,
  answer_hash text not null
);

create table public.courses (
  id text primary key,
  title text not null,
  subtitle text,
  theme text,
  duration_min integer,
  start_place_id text references public.places (id),
  published boolean not null default false
);

create table public.course_routes (
  id text primary key,
  course_id text not null references public.courses (id) on delete cascade,
  route_type text not null check (route_type in ('basic', 'shade', 'indoor', 'safe')),
  ordered_place_ids text[] not null
);

-- ---------------------------------------------------------------------------
-- 3. 여행·방문·스탬프 (참여자 개인 기록)
-- ---------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id text not null references public.courses (id),
  route_id text references public.course_routes (id),
  status text not null default 'active' check (status in ('active', 'paused', 'completed')),
  season_id uuid, -- F-17: P0부터 붙임. seasons 테이블은 P2에서 만들고 그때 FK 추가
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_user_id_idx on public.trips (user_id);

create trigger trips_touch_updated_at
  before update on public.trips
  for each row execute function public.touch_updated_at();

create table public.visits (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id text not null references public.places (id),
  method text not null default 'gps' check (method in ('gps', 'clue', 'skip')),
  lat double precision, -- 검증용. 보관 기간은 팀 결정 전 [결정]
  lng double precision,
  accuracy_m double precision,
  measured_at timestamptz,
  season_id uuid,
  created_at timestamptz not null default now(),
  unique (trip_id, place_id) -- 같은 여행·장소 중복 방지 (F-09)
);

create table public.stamps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  place_id text not null references public.places (id),
  issued_at timestamptz not null default now(),
  unique (trip_id, place_id)
);

create index stamps_user_id_idx on public.stamps (user_id);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  summary jsonb not null default '{}'::jsonb,
  completed_at timestamptz not null default now()
);

create index journal_entries_user_id_idx on public.journal_entries (user_id);

-- ---------------------------------------------------------------------------
-- 4. 대사·규칙·운영 이력
-- ---------------------------------------------------------------------------

create table public.approved_lines (
  id uuid primary key default gen_random_uuid(),
  pack_id text not null default 'harangi', -- 마스코트 팩 교체 대비 (17-8)
  scene text not null, -- 장면 코드 (7-3)
  situation text not null default 'default',
  line_text text not null,
  expression text, -- 표정
  approved_by text,
  approved_at timestamptz
);

create index approved_lines_scene_idx on public.approved_lines (pack_id, scene, situation);

create table public.rule_config (
  key text primary key,
  value jsonb not null,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- 날씨 조회 결과 (기준 시각 표기용). 서버만 읽고 쓴다.
create table public.weather_snapshots (
  id bigint generated always as identity primary key,
  fetched_at timestamptz not null default now(),
  source text not null,
  payload jsonb not null
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  target text,
  detail jsonb,
  at timestamptz not null default now()
);

-- 장소 운영 상태가 바뀌면 변경자·시각을 기록한다 (F-18).
create function public.log_place_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := (select auth.uid());
  insert into public.audit_log (actor, action, target, detail)
  values (
    (select auth.uid()),
    'place_status_change',
    new.place_id,
    jsonb_build_object(
      'old', case when tg_op = 'UPDATE' then old.status end,
      'new', new.status
    )
  );
  return new;
end;
$$;

create trigger place_status_audit
  before insert or update on public.place_status
  for each row execute function public.log_place_status_change();

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.places enable row level security;
alter table public.place_status enable row level security;
alter table public.verification_points enable row level security;
alter table public.verification_clues enable row level security;
alter table public.courses enable row level security;
alter table public.course_routes enable row level security;
alter table public.trips enable row level security;
alter table public.visits enable row level security;
alter table public.stamps enable row level security;
alter table public.journal_entries enable row level security;
alter table public.approved_lines enable row level security;
alter table public.rule_config enable row level security;
alter table public.weather_snapshots enable row level security;
alter table public.audit_log enable row level security;

-- 프로필: 본인만 읽고 고친다. 생성은 트리거가 한다.
create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- 역할: 본인 것만 읽는다. 쓰기 정책 없음.
create policy user_roles_select_own on public.user_roles
  for select to authenticated using (user_id = (select auth.uid()));

-- 장소·코스·대사·규칙: 로그인한 사용자는 읽고, 운영자만 쓴다.
create policy places_select on public.places
  for select to authenticated using (true);
create policy places_admin_write on public.places
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy place_status_select on public.place_status
  for select to authenticated using (true);
create policy place_status_admin_write on public.place_status
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy verification_points_select on public.verification_points
  for select to authenticated using (true);
create policy verification_points_admin_write on public.verification_points
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- 단서 정답: 운영자만. 참여자·앱은 읽을 수 없다 (17-4).
create policy verification_clues_admin_all on public.verification_clues
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy courses_select on public.courses
  for select to authenticated using (published or (select public.is_admin()));
create policy courses_admin_write on public.courses
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy course_routes_select on public.course_routes
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.courses c
      where c.id = course_routes.course_id and c.published
    )
  );
create policy course_routes_admin_write on public.course_routes
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy approved_lines_select on public.approved_lines
  for select to authenticated using (true);
create policy approved_lines_admin_write on public.approved_lines
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy rule_config_select on public.rule_config
  for select to authenticated using (true);
create policy rule_config_admin_write on public.rule_config
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- 여행: 본인 것만. 완주(completed) 전환은 서버가 하므로 앱은 active·paused만 쓸 수 있다.
create policy trips_select_own on public.trips
  for select to authenticated using (user_id = (select auth.uid()));
create policy trips_insert_own on public.trips
  for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'active');
create policy trips_update_own on public.trips
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and status in ('active', 'paused'));

-- 방문·스탬프·완주 기록: 본인 것만 읽는다. 쓰기 정책 없음(서버 전용).
create policy visits_select_own on public.visits
  for select to authenticated
  using (
    exists (
      select 1 from public.trips t
      where t.id = visits.trip_id and t.user_id = (select auth.uid())
    )
  );
create policy stamps_select_own on public.stamps
  for select to authenticated using (user_id = (select auth.uid()));
create policy journal_entries_select_own on public.journal_entries
  for select to authenticated using (user_id = (select auth.uid()));

-- 날씨 스냅샷: 정책 없음(서버 전용). 운영 이력: 운영자만 읽는다.
create policy audit_log_admin_select on public.audit_log
  for select to authenticated using ((select public.is_admin()));
