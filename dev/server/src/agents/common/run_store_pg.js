// 실제 DB(Supabase PostgreSQL)에 실행 기록 이벤트를 추가하는 저장소. insert만 쓴다 (update·delete 없음).
//   query: async (text, params) => rows (createPgQuery()의 결과). 테스트에서는 가짜 함수를 넣는다.
// 테이블: dev/supabase/migrations/create_agent_runs.sql

// jsonb 열에는 글자로 바꿔서 보낸다. (배열을 그대로 보내면 pg 드라이버가 PostgreSQL 배열로 착각한다)
const json = (v) => (v == null ? null : JSON.stringify(v));

export const SQL = Object.freeze({
  run_start: `insert into public.agent_runs (id, agent, actor_key, started_at)
values ($1, $2, $3, $4)`,
  step: `insert into public.agent_run_steps
  (run_id, seq, node, kind, attempt, started_at, duration_ms, input_summary, prompt, model, prompt_version,
   output, verdict, reason_code, llm_calls, input_tokens, output_tokens, total_tokens)
values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12::jsonb, $13, $14, $15, $16, $17, $18)`,
  run_end: `insert into public.agent_run_ends (run_id, ended_at, outcome, fallback_reason)
values ($1, $2, $3, $4)`,
});

const PARAMS = {
  run_start: (e) => [e.runId, e.agent, e.actorKey, e.startedAt],
  step: (e) => [
    e.runId, e.seq, e.node, e.kind, e.attempt, e.startedAt, e.durationMs, json(e.inputSummary), json(e.prompt),
    e.model, e.promptVersion, json(e.output), e.verdict, e.reasonCode, e.llmCalls,
    e.inputTokens, e.outputTokens, e.totalTokens,
  ],
  run_end: (e) => [e.runId, e.endedAt, e.outcome, e.fallbackReason],
};

export function createPgRunStore({ query }) {
  return {
    async append(event) {
      const params = PARAMS[event.type];
      if (!params) throw new TypeError('알 수 없는 이벤트 종류');
      await query(SQL[event.type], params(event));
    },
  };
}
