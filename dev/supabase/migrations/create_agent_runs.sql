-- 에이전트 실행 기록: 모든 에이전트의 모든 노드(LLM·코드·사람)의 결과와 판정을 추가만 한다 (insert-only).
-- 쓰는 시점은 세 번이다: 실행 시작(agent_runs), 노드 결과가 나올 때마다(agent_run_steps), 실행 끝(agent_run_ends).
-- 시작은 있고 끝이 없으면 "진행 중"(오래되면 "중단됨")이다. "지금 도는 노드"는 DB에 없고 관리자 화면이 구조도로 계산한다.
-- 서버만 읽고 쓴다. 앱·관리자 웹은 DB에 직접 접근하지 않고 서버 API를 거친다 (RLS를 켜고 정책은 만들지 않는다).
-- 좌표, 원본 계정 식별자, 사진·영수증 원본, 결제 정보를 넣는 열은 만들지 않는다 (절대 규칙 1).
-- 이미지 사본 경로 표와 관리자 쓰기 기록 표는 해당 기능을 만들 때 새 SQL 파일로 추가한다.
-- 실행 순서: 12번. 다른 표와 무관하다. 한 번만 실행한다 (이미 있으면 오류).
-- actor_key: 서버 비밀값으로 만든 이용자 해시 키 (원본 id 아님). 비밀값이 없으면 null. [결정 필요] 해시 키의 개인정보 여부.
-- 보관 기간은 [결정 필요]다. 지금은 지우지 않는다.

-- 실행 시작
create table public.agent_runs (
  id uuid primary key,
  agent text not null,
  started_at timestamptz not null,
  actor_key text,
  created_at timestamptz not null default now()
);

-- 실행 끝 (실행당 한 줄. primary key라서 두 번 쓰지 못한다)
create table public.agent_run_ends (
  run_id uuid primary key references public.agent_runs (id),
  ended_at timestamptz not null,
  outcome text not null check (outcome in ('normal', 'substitute', 'fallback')),
  fallback_reason text,
  created_at timestamptz not null default now()
);

-- 노드 결과 (노드 실행당 한 줄)
create table public.agent_run_steps (
  id bigint generated always as identity primary key,
  run_id uuid not null references public.agent_runs (id),
  seq integer not null check (seq >= 1),
  node text not null,
  kind text not null check (kind in ('llm', 'code', 'human')),
  attempt integer not null default 1 check (attempt >= 1),
  started_at timestamptz not null,
  duration_ms integer not null check (duration_ms >= 0),
  input_summary jsonb,
  prompt jsonb, -- LLM에 보낸 프롬프트 { system, user } (개인정보를 거른 뒤 저장, LLM 단계만)
  model text,
  prompt_version text,
  output jsonb,
  verdict text not null check (verdict in ('pass', 'fail', 'error', 'skipped')),
  reason_code text,
  llm_calls integer check (llm_calls is null or llm_calls >= 0),
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  total_tokens integer check (total_tokens is null or total_tokens >= 0),
  created_at timestamptz not null default now(),
  unique (run_id, seq)
);

create index agent_runs_agent_started_idx on public.agent_runs (agent, started_at desc);
create index agent_runs_actor_started_idx on public.agent_runs (actor_key, started_at desc) where actor_key is not null;

alter table public.agent_runs enable row level security;
alter table public.agent_run_ends enable row level security;
alter table public.agent_run_steps enable row level security;

-- 추가만 하는 장부: service role이어도 고치거나 지우지 못하게 DB가 막는다 (절대 규칙 3).
create function public.agent_runs_forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception 'agent run records are insert-only';
end;
$$;

create trigger agent_runs_insert_only
  before update or delete on public.agent_runs
  for each row execute function public.agent_runs_forbid_change();
create trigger agent_runs_no_truncate
  before truncate on public.agent_runs
  for each statement execute function public.agent_runs_forbid_change();

create trigger agent_run_ends_insert_only
  before update or delete on public.agent_run_ends
  for each row execute function public.agent_runs_forbid_change();
create trigger agent_run_ends_no_truncate
  before truncate on public.agent_run_ends
  for each statement execute function public.agent_runs_forbid_change();

create trigger agent_run_steps_insert_only
  before update or delete on public.agent_run_steps
  for each row execute function public.agent_runs_forbid_change();
create trigger agent_run_steps_no_truncate
  before truncate on public.agent_run_steps
  for each statement execute function public.agent_runs_forbid_change();

revoke all on public.agent_runs, public.agent_run_ends, public.agent_run_steps from anon, authenticated;
