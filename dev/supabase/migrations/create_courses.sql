create table public.courses (
  id text primary key,
  title text not null,
  theme text,
  district text,
  duration_min smallint not null check (duration_min in (30, 60, 90)),
  start_place_id text,
  published boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_routes (
  id bigint generated always as identity primary key,
  course_id text not null references public.courses (id) on delete cascade,
  type text not null check (type in ('explore', 'shade', 'indoor')),
  ordered_place_ids text[] not null check (cardinality(ordered_place_ids) >= 1),
  note text,
  created_at timestamptz not null default now(),
  unique (course_id, type)
);

alter table public.courses enable row level security;
alter table public.course_routes enable row level security;

comment on table public.courses is '코스. 서버만 읽는다. published=true인 코스만 앱에 보인다.';
comment on column public.courses.start_place_id is '출발 장소. places.id를 가리키지만, 실행 순서 때문에 외래키는 걸지 않았다.';
comment on column public.course_routes.type is '모드와 대응: explore=EXPLORE, shade=SHADE, indoor=INDOOR. 서버 필드 routeType.';
comment on column public.course_routes.ordered_place_ids is '방문 추천 순서의 places.id 배열. 서버가 places와 합쳐 확인한다(없는 id는 PLACE_MISSING).';