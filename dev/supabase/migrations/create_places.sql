create table public.places (
  id text primary key,
  name text not null,
  district text,
  address text,
  place_kind text,
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  type text not null check (type in ('outdoor','shade','indoor','exhibit')),
  indoor boolean,
  mode_allowed text[] check (mode_allowed <@ array['EXPLORE','SHADE','INDOOR','SAFETY','UNKNOWN']),
  open_hour smallint check (open_hour between 0 and 24),
  close_hour smallint check (close_hour between 0 and 24),
  closed_weekdays smallint[] not null default '{}',
  hours_text text,
  closed_text text,
  fee_type text not null default 'unknown' check (fee_type in ('free','paid','unknown','na')),
  fee_detail text,
  contact text,
  status text not null default 'unknown' check (status in ('open','paused','unknown')),
  status_updated_at timestamptz,
  verify_state text not null default 'unverified' check (verify_state in ('confirmed','partial','unverified')),
  verified_at date,
  source text not null,
  caution text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((open_hour is null) = (close_hour is null))
);

alter table public.places enable row level security;

comment on table public.places is '추천 후보 장소. 서버만 읽는다. 앱은 직접 접근하지 않는다. lat/lng는 장소 좌표이며 사용자 좌표는 저장하지 않는다.';
comment on column public.places.type is '서버 필드 type. 모드별 허용 유형(MODE_ALLOWED_TYPES)으로 거른다.';
comment on column public.places.mode_allowed is '서버 필드 modeAllowed. null이면 type 규칙, 값이 있으면 이 장소만 이 모드에 노출. HOLD는 항상 노출 안 함.';
comment on column public.places.open_hour is '서버 필드 openHour. open_hour <= 시 < close_hour 이면 운영 중. 24시간은 0~24. null이면 시간 검사 생략.';
comment on column public.places.closed_weekdays is '서버 필드 closedWeekdays. 0=일 ... 6=토.';
comment on column public.places.status is '서버 필드 status. open인 장소만 추천. 담당자가 확인 후 open으로 바꾼다.';