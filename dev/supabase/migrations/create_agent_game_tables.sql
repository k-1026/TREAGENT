-- 에이전트가 쓰는 게임 장부와 결과 표 (plan/spec/agent_architecture_v2.md 6장).
-- 도장·제출 결과·일기·카드는 추가만 한다 (insert-only, 절대 규칙 3). 장소 후보만 검수 상태가 바뀐다.
-- 서버만 읽고 쓴다. 앱·관리자 웹은 DB에 직접 접근하지 않는다 (RLS를 켜고 정책은 만들지 않는다).
-- 좌표, 사진·영수증 원본, 결제 정보를 넣는 열은 만들지 않는다 (절대 규칙 1). 장소 후보의 lat/lng는 "장소 좌표"다.
-- user_id: 도장 장부의 주인이다. LLM 입력과 실행 기록(agent_runs)에는 넣지 않는다.
-- 실행 순서: 13번. 12번(create_agent_runs.sql)의 함수 agent_runs_forbid_change()를 다시 쓴다. 한 번만 실행한다.

-- 도장 장부: 한 이용자가 한 장소에서 도장은 한 번만 (절대 규칙 4)
create table public.agent_stamps (
  id bigint generated always as identity primary key,
  user_id text not null,
  place_id text not null,
  kind text not null check (kind in ('quiz', 'photo', 'receipt')),
  ticket_id text,
  created_at timestamptz not null default now(),
  unique (user_id, place_id)
);

-- 미션 제출 결과: 판정(LLM)과 확인(코드) 결과. 사진·영수증은 해시만 남긴다 (같은 사진 중복 제출 검사용).
create table public.agent_submissions (
  id bigint generated always as identity primary key,
  user_id text not null,
  place_id text not null,
  kind text not null check (kind in ('quiz', 'photo', 'receipt')),
  image_hash text,
  passed boolean not null,
  reason_code text,
  created_at timestamptz not null default now()
);
create index agent_submissions_dup_idx on public.agent_submissions (user_id, place_id, image_hash) where image_hash is not null;

-- 일기 (기록 정리)
create table public.agent_diaries (
  id bigint generated always as identity primary key,
  user_id text not null,
  trip_ref text,
  body text not null,
  source text not null check (source in ('llm', 'template')),
  created_at timestamptz not null default now()
);

-- 하랑이 카드. 이미지는 base64 글자로 둔다. [확인 필요] 이미지가 많아지면 Storage로 옮긴다.
create table public.agent_cards (
  id bigint generated always as identity primary key,
  user_id text not null,
  trip_ref text,
  place_id text,
  caption text not null,
  stamped boolean not null default false,
  image_mime text,
  image_data text,
  source text not null check (source in ('generated', 'fixed')),
  created_at timestamptz not null default now()
);

-- 장소 후보 (장소 DB 갱신): LLM이 쓰는 곳. places와 분리한다. 사람이 승인한 것만 코드가 places에 반영한다.
create table public.place_candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  district text,
  source_url text not null,
  lat double precision,
  lng double precision,
  open_hour smallint,
  close_hour smallint,
  caution text,
  status text not null default 'pending' check (status in ('pending', 'held', 'applied')),
  status_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agent_stamps enable row level security;
alter table public.agent_submissions enable row level security;
alter table public.agent_diaries enable row level security;
alter table public.agent_cards enable row level security;
alter table public.place_candidates enable row level security;

-- 추가만 하는 장부: service role이어도 고치거나 지우지 못하게 DB가 막는다.
create trigger agent_stamps_insert_only before update or delete on public.agent_stamps
  for each row execute function public.agent_runs_forbid_change();
create trigger agent_submissions_insert_only before update or delete on public.agent_submissions
  for each row execute function public.agent_runs_forbid_change();
create trigger agent_diaries_insert_only before update or delete on public.agent_diaries
  for each row execute function public.agent_runs_forbid_change();
create trigger agent_cards_insert_only before update or delete on public.agent_cards
  for each row execute function public.agent_runs_forbid_change();

revoke all on public.agent_stamps, public.agent_submissions, public.agent_diaries, public.agent_cards, public.place_candidates from anon, authenticated;
