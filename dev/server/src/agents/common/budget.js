import { AgentError, ERROR_CODES } from './errors.js';

// 호출 예산: 한 요청에서 쓸 LLM 호출 수와 전체 시간의 상한. 요청마다 새로 만든다.
//   take(): 호출 1회를 차감한다. 호출 수나 시간이 다 되었으면 AgentError를 던진다.
export function createBudget({ maxCalls, deadlineMs, now = Date.now }) {
  const deadline = now() + deadlineMs;
  let used = 0;
  return {
    take() {
      if (now() >= deadline) throw new AgentError(ERROR_CODES.BUDGET_TIME);
      if (used >= maxCalls) throw new AgentError(ERROR_CODES.BUDGET_CALLS);
      used += 1;
    },
    remaining: () => Math.max(0, maxCalls - used),
    timeLeftMs: () => Math.max(0, deadline - now()),
    expired: () => now() >= deadline || used >= maxCalls,
    snapshot: () => ({ used, remaining: Math.max(0, maxCalls - used), timeLeftMs: Math.max(0, deadline - now()) }),
  };
}
