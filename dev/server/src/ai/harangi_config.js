// 하랑이 대사 설정표. 값은 [확인 필요] 임시 값이다. 말투 규칙의 근거: brand/character/profile/harangi_character.md 7절.

// 장면. start: 길 시작, arrival: 장소 도착, briefing: 오늘의 길 브리핑, safety: 안전 안내(AI를 쓰지 않고 고정 문장만 쓴다)
export const HARANGI_SCENES = Object.freeze(['start', 'arrival', 'briefing', 'safety']);

// 대사 길이와 느낌표 수 상한. 말투 규칙 3: 느낌표 기본 1~2개, 강한 감정에는 !!
export const LINE_MAX_LENGTH = 100;
export const MAX_EXCLAMATIONS = 4;

// 오늘의 길 브리핑은 테마, 소요시간, 장소 이름을 모두 말해야 해서 대사보다 길게 허용한다.
export const BRIEFING_MAX_LENGTH = 220;

// 도구를 부르는 최대 횟수, 대사 검증에 실패했을 때 시도 횟수, AI 호출 제한 시간(ms)
export const MAX_TOOL_ROUNDS = 2;
export const MAX_LINE_ATTEMPTS = 2;
export const HARANGI_TIMEOUT_MS = 8000;

// 승인 대사(고정). AI를 쓰지 못하거나 검증에 실패했을 때 쓴다. 창작 임시값이며 팀이 확정한다.
// 오늘의 길 브리핑의 고정 문장은 코드가 사실(길 이름, 테마, 소요시간, 장소)을 끼워 만든다 (harangi_briefing.js).
export const FIXED_LINES = Object.freeze({
  start: '출발해요! 오늘 길은 제가 같이 걸을게요.',
  arrival: '도착했어요! 이곳을 둘러보고 도장을 받아 가요.',
});

// 안전 안내(고정). 판정은 규칙이 하고 문장도 AI가 쓰지 않는다. [확인 필요] 기준(시각, 운영 시간, AWS 여부)은 팀 확정 전.
export const SAFETY_LINES = Object.freeze({
  SAFETY: '지금은 더위가 심해서 야외 이동은 쉬어 가요.',
  HOLD: '지금은 위험 상황이라 길 안내를 잠시 멈춰요.',
  UNKNOWN: '날씨를 확인하지 못해서 지금은 안내를 쉬어 가요.',
});