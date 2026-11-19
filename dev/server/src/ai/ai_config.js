// AI 길 구성 설정표. 숫자와 금칙어를 한곳에 모아 둔다.
// AI에게 보여 줄 후보 장소 수의 상한. 프롬프트가 길어지는 것을 막는다. [확인 필요] 임시 값이다.
export const AI_CANDIDATE_LIMIT = 12;
// 한 길에 들어가는 장소 수. 팀 결정: 코스 3곳, 도장 3개 (#118).
export const ROUTE_PLACE_COUNT = 3;

// 길 이름 조건: "OO길" 형태, 길이 제한. [확인 필요] 12자는 임시 값이다.
export const TITLE_RULES = Object.freeze({
  suffix: '길',
  minLength: 3,
  maxLength: 12,
});

// 이유 문장 길이 제한. [확인 필요] 임시 값이다.
export const REASON_MAX_LENGTH = 120;

// 금칙어 (현재 후보: 유일, 최초, 최고 — brand/persona_sheet.md 7장).
export const FORBIDDEN_WORDS = Object.freeze(['유일', '최초', '최고']);

// AI를 부르는 모드. 안전이 걸린 모드(SAFETY, HOLD, UNKNOWN)는 규칙 결과만 쓴다.
export const AI_MODES = Object.freeze(['EXPLORE', 'SHADE', 'INDOOR']);

// AI 호출 한 번의 제한 시간(ms). [확인 필요] 임시 값이다.
export const LLM_TIMEOUT_MS = 8000;

// 검증에 실패했을 때 AI에게 시도시키는 최대 횟수 (처음 1번 + 다시 1번).
export const MAX_ATTEMPTS = 2;

// 같은 조건이면 같은 코스를 보여 주기 위해 결과를 기억하는 시간(ms)과 최대 개수. [확인 필요] 임시 값이다.
export const ROUTE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ROUTE_CACHE_MAX = 500;

// AI를 쓰지 못할 때 쓰는 고정 이름 단어와 문장. (창작 임시값, 팀 확정 전)
export const FALLBACK_KEYWORD = '산책';
export const FALLBACK_REASON = '오늘 날씨에 맞춰 지금 갈 수 있는 곳을 골랐어요.';