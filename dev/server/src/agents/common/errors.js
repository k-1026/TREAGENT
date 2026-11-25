// 에이전트 공통 에러. message에는 고정 문구만 넣는다 (원본 에러 메시지에는 키·좌표가 섞일 수 있어서 버린다).
export const ERROR_CODES = Object.freeze({
  BUDGET_CALLS: 'BUDGET_CALLS',
  BUDGET_TIME: 'BUDGET_TIME',
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_FAILED: 'LLM_FAILED',
});

export class AgentError extends Error {
  constructor(code) {
    super(code);
    this.name = 'AgentError';
    this.code = code;
  }
}
