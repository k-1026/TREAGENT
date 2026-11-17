create table public.place_mode_fit (
  place_id text not null references public.places (id) on delete cascade,
  mode text not null check (mode in ('EXPLORE', 'SHADE', 'INDOOR', 'RAIN')),
  fit text not null check (fit in ('good', 'mostly', 'conditional', 'bad')),
  is_estimated boolean not null default false,
  usage_role text,
  usage_text text,
  note text,
  created_at timestamptz not null default now(),
  primary key (place_id, mode)
);

alter table public.place_mode_fit enable row level security;

comment on table public.place_mode_fit is '장소×모드 적합도. 서버만 읽는다. 엑셀 「중구 장소표」의 탐험·그늘·실내·호우 열과 「모드별 추천」 시트.';
comment on column public.place_mode_fit.fit is 'good=적합, mostly=대체로 적합, conditional=조건부, bad=부적합.';
comment on column public.place_mode_fit.is_estimated is '엑셀의 "추정:" 값이면 true. 거르는 데에는 쓰지 않는다.';
comment on column public.place_mode_fit.usage_role is '활용 구분 (예: 탐험 장소, 실내 휴식·관람 거점).';
comment on column public.place_mode_fit.usage_text is '추천 이용 방식 (예: 실내 영역만 이용).';