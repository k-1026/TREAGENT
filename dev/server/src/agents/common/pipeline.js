import { callLlm } from './llm_call.js';
import { createBudget } from './budget.js';
import { AGENT_LIMITS } from './config.js';

// 파이프라인 실행기: 순서가 정해진 노드 목록에 되돌이(실패 → 앞 노드)와 상한을 두고 돌린다.
// 코스 설계 에이전트는 LangGraph를 직접 쓰지만, 나머지 에이전트(미션·이야기하기·기록 정리·하랑이 카드·장소 DB 갱신)는
// 노드가 직선에 가깝고 분기가 적어서 이 얇은 실행기로 같은 규칙(예산·시간 제한·기록·거부권)을 공유한다.
// LLM이 다음 단계를 정하지 않는다. 다음 노드는 목록 순서와 되돌이 표가 정한다 (plan/spec/agent_architecture_v2.md 1장).
//
// 노드: {
//   id, kind: 'llm' | 'code' | 'human',
//   llm?: llms 안의 이름 (기본은 id)
//   summary?(state): 실행 기록의 입력 요약 (좌표·사진·영수증 금지)
//   prompt?(state, attempt): LLM 노드의 프롬프트 { system, user }
//   run(state, { value, attempt }): 결과 { ok = true, code = null, patch = {}, output = null }
//       LLM 노드는 value에 LLM이 돌려준 값이 들어온다. 형식이 틀리면 ok:false로 돌려주면 된다.
//   next?(state, result): 통과했을 때 다음 노드 id (없으면 목록의 다음). null이면 끝.
// }
// loops: { [노드 id]: { to: 되돌아갈 노드, exhaust: 상한을 다 썼을 때 한 번 돌리는 노드(없으면 null) } }
// 실패했는데 loops에 없으면 status 'failed'. 되돌아갈 노드를 limits.maxLoopAttempts번 돌렸으면 'exhausted'.
// 에러(예산·시간 초과, LLM 실패)는 던진다. 호출하는 쪽이 폴백으로 처리한다.
// 결과: { status: 'done' | 'exhausted' | 'failed' | 'stopped', state, at?, code?, runs }
export async function runPipeline({
  nodes,
  loops = {},
  state = {},
  run,
  llms = {},
  budget = createBudget({ maxCalls: AGENT_LIMITS.maxLlmCalls, deadlineMs: AGENT_LIMITS.deadlineMs }),
  limits = AGENT_LIMITS,
  promptVersion = null,
  from = null,
  until = null,
  runs: initialRuns = {},
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = nodes.map((n) => n.id);
  const runs = { ...initialRuns };
  let current = from ?? order[0];

  const exec = (node, attempt) => {
    const prompt = node.kind === 'llm' ? node.prompt(state, attempt) : null;
    return run.step(
      {
        node: node.id,
        kind: node.kind,
        attempt,
        prompt,
        summary: node.summary?.(state) ?? null,
        toRecord: (r) => ({
          verdict: r.result.ok === false ? 'fail' : 'pass',
          reasonCode: r.result.code ?? null,
          output: r.result.output ?? null,
          ...(node.kind === 'llm'
            ? {
                llmCalls: 1,
                model: llms[node.llm ?? node.id]?.model ?? null,
                promptVersion,
                inputTokens: r.usage?.inputTokens ?? null,
                outputTokens: r.usage?.outputTokens ?? null,
                totalTokens: r.usage?.totalTokens ?? null,
              }
            : {}),
        }),
      },
      async () => {
        if (node.kind === 'llm') {
          const out = await callLlm({ llm: llms[node.llm ?? node.id], input: prompt, budget, timeoutMs: limits.llmTimeoutMs });
          return { result: (await node.run(state, { value: out.value, attempt })) ?? {}, usage: out.usage };
        }
        return { result: (await node.run(state, { attempt })) ?? {}, usage: null };
      },
    );
  };

  while (current) {
    const node = byId.get(current);
    if (!node) throw new TypeError(`알 수 없는 노드: ${current}`);
    if (until && current === until) return { status: 'stopped', at: current, state, runs };
    const attempt = (runs[current] = (runs[current] ?? 0) + 1);
    const { result } = await exec(node, attempt);
    state = { ...state, ...(result.patch ?? {}) };

    if (result.ok !== false) {
      current = node.next ? node.next(state, result) : (order[order.indexOf(current) + 1] ?? null);
      state = { ...state, feedback: null };
      continue;
    }
    const loop = loops[current];
    if (!loop) return { status: 'failed', at: current, code: result.code ?? null, state, runs };
    if ((runs[loop.to] ?? 0) >= limits.maxLoopAttempts) {
      if (loop.exhaust) {
        const ex = byId.get(loop.exhaust);
        state = { ...state, exhaustedAt: current }; // 소진 노드가 어느 되돌이에서 왔는지 알 수 있게 한다
        const { result: exResult } = await exec(ex, (runs[loop.exhaust] = (runs[loop.exhaust] ?? 0) + 1));
        state = { ...state, ...(exResult.patch ?? {}) };
      }
      return { status: 'exhausted', at: current, code: result.code ?? null, exhaust: loop.exhaust ?? null, state, runs };
    }
    state = { ...state, feedback: result.code ?? null };
    current = loop.to;
  }
  return { status: 'done', state, runs };
}

// 기록기가 없을 때 쓰는 빈 실행 (테스트용).
export const NOOP_RUN = { id: null, step: (meta, fn) => fn(), finish: async () => {}, flush: async () => {} };

// 파이프라인 결과를 실행 기록의 끝(outcome)으로 바꾼다.
//   done → normal / exhausted(대체·고정 노드로 내려감) → substitute / failed → fallback
export function finishFor(run, result, { substituteOnExhaust = true } = {}) {
  if (result.status === 'done') return run.finish({ outcome: 'normal' });
  if (result.status === 'exhausted') {
    return run.finish({ outcome: substituteOnExhaust ? 'substitute' : 'fallback', fallbackReason: 'ATTEMPTS_EXHAUSTED' });
  }
  return run.finish({ outcome: 'fallback', fallbackReason: result.code ?? 'FAILED' });
}

// 에러를 실행 기록의 폴백 사유 코드로 바꾼다. 원본 메시지는 버린다.
export const errorCode = (err) => (typeof err?.code === 'string' ? err.code : 'ERROR');
