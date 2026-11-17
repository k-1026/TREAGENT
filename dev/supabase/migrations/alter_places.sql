alter table public.places
  add column if not exists role text not null default 'visit'
    check (role in ('visit', 'hub', 'shelter')),
  add column if not exists permission_state text not null default 'unknown'
    check (permission_state in ('not_needed', 'unknown', 'granted', 'denied')),
  add column if not exists website text,
  add column if not exists fee_estimated boolean not null default false,
  add column if not exists source_ref text,
  add column if not exists coord_source text,
  add column if not exists coord_checked_at date;

-- 지금 추천에 나오는 기존 7곳은 계속 보여야 하므로 허가 상태를 "해당 없음"으로 지정한다.
update public.places
set permission_state = 'not_needed'
where id in ('J01', 'J03', 'J04', 'J06', 'J09', 'J21', 'J28');

comment on column public.places.role is '장소의 역할. visit=방문 장소, hub=이동 허브, shelter=쉼터.';
comment on column public.places.permission_state is '실존 가게·민간 시설 노출 허가. not_needed=공공시설 등, unknown=확인 전, granted=허가, denied=거부.';
comment on column public.places.fee_estimated is '요금이 추정값이면 true (엑셀의 "(추정)" 표기).';
comment on column public.places.source_ref is '근거 위치(엑셀의 근거 열 등).';
comment on column public.places.coord_source is '좌표를 확인한 곳.';
comment on column public.places.coord_checked_at is '좌표를 확인한 날짜.';