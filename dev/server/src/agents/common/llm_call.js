import { AgentError, ERROR_CODES } from './errors.js';

// LLM 호출 래퍼: 예산 차감 + 제한 시간. LLM이 signal을 무시해도 기다리지 않는다.
//   llm: async (input, { signal }) => ({ value, usage })   usage는 { inputTokens, outputTokens, totalTokens } 또는 null
//   반환: { value, usage, ms }
//   실패하면 AgentError(BUDGET_* | LLM_TIMEOUT | LLM_FAILED). 원본 에러 메시지는 버린다.
//   llm이 { value } 모양이 아닌 것을 돌려주면 LLM_FAILED (어댑터를 잘못 만든 경우).
export async function callLlm({ llm, input, budget, timeoutMs }) {
  budget.take(); // 예산이 없으면 여기서 던지고 LLM은 부르지 않는다
  const ms = Math.max(1, Math.min(timeoutMs, budget.timeLeftMs()));
  const signal = AbortSignal.timeout(ms);
  const startedAt = Date.now();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new AgentError(ERROR_CODES.LLM_TIMEOUT)), ms);
  });
  try {
    const out = await Promise.race([Promise.resolve().then(() => llm(input, { signal })), timeout]);
    if (out === null || typeof out !== 'object' || !('value' in out)) throw new AgentError(ERROR_CODES.LLM_FAILED);
    return { value: out.value, usage: out.usage ?? null, ms: Date.now() - startedAt };
  } catch (err) {
    if (err instanceof AgentError) throw err;
    throw new AgentError(ERROR_CODES.LLM_FAILED);
  } finally {
    clearTimeout(timer);
  }
}
