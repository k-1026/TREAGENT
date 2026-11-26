// 에이전트 공통 상한 설정표. 숫자를 한곳에 모아 둔다.
// 아래 숫자는 모두 임시값이다. [결정 D-19] 팀이 정하면 이 파일만 고친다. 테스트는 값을 직접 넣으므로 이 숫자에 의존하지 않는다.
export const AGENT_LIMITS = Object.freeze({
  maxLlmCalls: 8, // 한 요청에서 쓸 수 있는 LLM 호출 수
  deadlineMs: 90000, // 한 요청 전체 시간 상한 (키·모델 전환으로 여러 번 부를 수 있어 넉넉히 둔다)
  llmTimeoutMs: 30000, // LLM 호출 1회 시간 상한 (전환 시도까지 포함)
  dailyMax: 30, // 이용자 1명의 하루 요청 수 상한 (에이전트 요청 기준)
  maxLoopAttempts: 2, // 되돌이 한 곳에서 시도할 수 있는 최대 횟수 (다 쓰면 대체 코스·폴백으로 간다)
});

// 실행 기록에 넣는 문자열의 최대 길이. [결정 D-19] 임시값.
export const RECORD_MAX_CHARS = 2000;

// 실행 기록에 넣는 LLM 프롬프트 원문(시스템 + 사용자 메시지)의 최대 길이. 요약보다 크게 둔다. [결정 D-19] 임시값.
export const RECORD_PROMPT_MAX_CHARS = 8000;

// 관리자 화면의 접속 현황. [결정 D-19] 모두 임시값이다.
//   windowMs: 마지막 요청이 이 시간 안이면 "접속 중"으로 본다 (앱이 서버를 부를 때만 기록되므로 "최근에 서버를 쓴 사람"이다)
//   recentMs: 에이전트 실행이 이 시간 안에 끝났으면 "최근 사용"으로 본다
//   maxUsers: 서버 메모리에 기억하는 접속자 수의 상한
export const PRESENCE = Object.freeze({ windowMs: 5 * 60 * 1000, recentMs: 10 * 60 * 1000, maxUsers: 500 });

// 일일 한도의 날짜 기준: 한국 시간(UTC+9).
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
