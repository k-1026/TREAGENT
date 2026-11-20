-- 일행의 후보 길: 방장이 받은 후보 길 묶음(최대 3개)을 서버가 저장해 둔다.
-- 방장은 장소 목록을 보내지 않고, 저장된 후보의 번호만 골라서 보낸다(서버가 저장한 후보만 고를 수 있다).
-- 서버만 읽고 쓴다. 앱은 DB에 직접 접근하지 않는다. 사용자 좌표는 어디에도 저장하지 않는다.
-- 길은 추가만 한다(insert-only). 새 묶음을 받으면 set_no가 올라간 새 행이 생기고 옛 묶음은 남는다.
-- 실행 순서: create_parties.sql 다음에 실행한다.

create table public.party_route_candidates (
  id bigint generated always as identity primary key,
  party_id uuid not null references public.parties (id) on delete cascade,
  mode text not null check (mode in ('EXPLORE', 'SHADE', 'INDOOR', 'SAFETY', 'HOLD', 'UNKNOWN')),
  set_no integer not null check (set_no >= 1),
  idx integer not null check (idx between 0 and 2),
  title text not null,
  reason text,
  picker text not null check (picker in ('ai', 'rules')),
  place_ids text[] not null check (cardinality(place_ids) >= 1),
  created_at timestamptz not null default now(),
  unique (party_id, mode, set_no, idx)
);

alter table public.party_route_candidates enable row level security;

comment on table public.party_route_candidates is '일행의 후보 길. 서버만 읽고 쓴다. (일행, 모드, 묶음 번호, 순번)마다 한 행. 방장이 하나를 고르면 party_routes에 새 버전으로 저장된다.';
comment on column public.party_route_candidates.set_no is '후보 묶음 번호. "다른 길 새로 받기"를 누를 때마다 1씩 올라간다. 횟수 상한은 서버 PARTY_REFRESH_LIMIT과 맞춘다. [확인 필요]';