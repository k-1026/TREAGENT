import { isDeepStrictEqual } from 'node:util';
import { foldEvents } from '../agents/common/run_store_memory.js';

// 실행 기록을 읽는 부분. 읽기만 한다 (select만 쓴다).
// 모든 reader는 같은 모양을 돌려준다: foldEvents의 실행 객체
//   { id, agent, actorKey, startedAt, endedAt, outcome, fallbackReason, status, steps: [...] }

// 메모리 저장소(테스트·DB 없이 로컬에서 볼 때)
export function createMemoryRunReader(store) {
  const all = () => foldEvents(store.events).reverse(); // 최근 실행이 앞
  return {
    async listRuns({ limit = 30 } = {}) {
      return all().slice(0, limit);
    },
    async getRun(id) {
      return all().find((r) => r.id === id) ?? null;
    },
    // 통계용: since(ISO) 이후에 시작한 실행
    async listForStats({ since = null, limit = 1000 } = {}) {
      return all().filter((r) => !since || r.startedAt >= since).slice(0, limit);
    },
  };
}

export const RUNS_SQL = `select r.id, r.agent, r.actor_key as "actorKey", r.started_at as "startedAt",
  e.ended_at as "endedAt", e.outcome, e.fallback_reason as "fallbackReason"
from public.agent_runs r
left join public.agent_run_ends e on e.run_id = r.id
order by r.started_at desc
limit $1`;

// 통계용: 기간 안의 실행과, 단계는 통계에 필요한 열만 읽는다 (프롬프트·출력 원문은 읽지 않는다).
export const STATS_RUNS_SQL = `select r.id, r.agent, r.started_at as "startedAt",
  e.ended_at as "endedAt", e.outcome, e.fallback_reason as "fallbackReason"
from public.agent_runs r
left join public.agent_run_ends e on e.run_id = r.id
where ($1::timestamptz is null or r.started_at >= $1)
order by r.started_at desc
limit $2`;

export const STATS_STEPS_SQL = `select run_id as "runId", node, kind, verdict, reason_code as "reasonCode", model,
  duration_ms as "durationMs", llm_calls as "llmCalls", input_tokens as "inputTokens", output_tokens as "outputTokens", total_tokens as "totalTokens"
from public.agent_run_steps
where run_id = any($1::uuid[])`;

export const RUN_ONE_SQL = `select r.id, r.agent, r.actor_key as "actorKey", r.started_at as "startedAt",
  e.ended_at as "endedAt", e.outcome, e.fallback_reason as "fallbackReason"
from public.agent_runs r
left join public.agent_run_ends e on e.run_id = r.id
where r.id = $1`;

export const STEPS_SQL = `select run_id as "runId", seq, node, kind, attempt, started_at as "startedAt",
  duration_ms as "durationMs", input_summary as "inputSummary", prompt, model, prompt_version as "promptVersion",
  output, verdict, reason_code as "reasonCode", llm_calls as "llmCalls",
  input_tokens as "inputTokens", output_tokens as "outputTokens", total_tokens as "totalTokens"
from public.agent_run_steps
where run_id = any($1::uuid[])
order by run_id, seq`;

// pg는 timestamptz를 Date로 돌려준다. 기록기가 쓴 것과 같은 글자(ISO)로 바꾼다.
const iso = (v) => (v instanceof Date ? v.toISOString() : (v ?? null));

function toRun(row, steps) {
  return {
    id: row.id,
    agent: row.agent,
    actorKey: row.actorKey ?? null,
    startedAt: iso(row.startedAt),
    endedAt: iso(row.endedAt),
    outcome: row.outcome ?? null,
    fallbackReason: row.fallbackReason ?? null,
    status: row.endedAt ? 'ended' : 'running',
    steps: steps.map(({ runId, ...s }) => ({ ...s, startedAt: iso(s.startedAt) })),
  };
}

// 실제 DB. query: async (text, params) => rows
export function createPgRunReader({ query }) {
  const stepsOf = async (ids) => {
    const rows = ids.length ? await query(STEPS_SQL, [ids]) : [];
    const byRun = new Map();
    for (const row of rows) (byRun.get(row.runId) ?? byRun.set(row.runId, []).get(row.runId)).push(row);
    return byRun;
  };
  return {
    async listRuns({ limit = 30 } = {}) {
      const runs = await query(RUNS_SQL, [limit]);
      const byRun = await stepsOf(runs.map((r) => r.id));
      return runs.map((r) => toRun(r, byRun.get(r.id) ?? []));
    },
    async listForStats({ since = null, limit = 1000 } = {}) {
      const runs = await query(STATS_RUNS_SQL, [since, limit]);
      const rows = runs.length ? await query(STATS_STEPS_SQL, [runs.map((r) => r.id)]) : [];
      const byRun = new Map();
      for (const row of rows) (byRun.get(row.runId) ?? byRun.set(row.runId, []).get(row.runId)).push(row);
      return runs.map((r) => toRun(r, byRun.get(r.id) ?? []));
    },
    async getRun(id) {
      const [row] = await query(RUN_ONE_SQL, [id]);
      if (!row) return null;
      const byRun = await stepsOf([id]);
      return toRun(row, byRun.get(id) ?? []);
    },
  };
}

// 보내려던 이벤트를 기억해 두는 저장소 껍데기. "저장 일치" 검사에서 "보내려던 것"과 "읽어 온 것"을 맞춰 본다.
//   저장이 실패해도 보내려던 이벤트는 기억한다 (그래야 빠진 것을 찾을 수 있다). 실패는 그대로 던져서 기록기가 센다.
export function createLoggedStore(store, { maxRuns = 200 } = {}) {
  const log = new Map(); // runId → events
  return {
    async append(event) {
      if (!log.has(event.runId) && log.size >= maxRuns) log.delete(log.keys().next().value);
      (log.get(event.runId) ?? log.set(event.runId, []).get(event.runId)).push(structuredClone(event));
      await store.append(event);
    },
    eventsFor: (runId) => structuredClone(log.get(runId) ?? []),
  };
}

const RUN_FIELDS = ['agent', 'actorKey', 'startedAt', 'endedAt', 'outcome', 'fallbackReason'];
const STEP_FIELDS = [
  'node', 'kind', 'attempt', 'startedAt', 'durationMs', 'inputSummary', 'prompt', 'model', 'promptVersion', 'output',
  'verdict', 'reasonCode', 'llmCalls', 'inputTokens', 'outputTokens', 'totalTokens',
];

// 저장 일치 검사: 보내려던 이벤트를 합친 것과 reader가 읽어 온 것을 필드별로 비교한다.
//   jsonb는 키 순서가 바뀔 수 있어서 순서와 상관없이 값만 비교한다 (isDeepStrictEqual).
export async function checkConsistency({ expectedEvents, reader, runId }) {
  const expected = foldEvents(expectedEvents).find((r) => r.id === runId);
  if (!expected) return { ok: false, diffs: [{ field: 'run', expected: '보내려던 기록', actual: '기억 없음' }] };
  const actual = await reader.getRun(runId);
  if (!actual) return { ok: false, diffs: [{ field: 'run', expected: '저장됨', actual: '저장소에 없음' }] };

  const diffs = [];
  const cmp = (field, e, a) => {
    if (!isDeepStrictEqual(e ?? null, a ?? null)) diffs.push({ field, expected: e ?? null, actual: a ?? null });
  };
  for (const f of RUN_FIELDS) cmp(`run.${f}`, expected[f], actual[f]);
  cmp('steps.length', expected.steps.length, actual.steps.length);
  for (const es of expected.steps) {
    const as = actual.steps.find((s) => s.seq === es.seq);
    if (!as) {
      diffs.push({ field: `step[${es.seq}]`, expected: '저장됨', actual: '없음' });
      continue;
    }
    for (const f of STEP_FIELDS) cmp(`step[${es.seq}].${f}`, es[f], as[f]);
  }
  return { ok: diffs.length === 0, diffs };
}
