import { FORBIDDEN_WORDS } from './ai_config.js';
import { LINE_MAX_LENGTH, MAX_EXCLAMATIONS } from './harangi_config.js';

// AI가 쓴 하랑이 대사를 검사한다. 입력을 바꾸지 않는 순수 함수다.
//   maxLength: 길이 상한. 기본은 일반 대사(100자), 브리핑은 더 길게 넘긴다.
// 결과: { ok: true, text } | { ok: false, error: 코드 }
export function validateLine(raw, { maxLength = LINE_MAX_LENGTH } = {}) {
  if (typeof raw !== 'string') return { ok: false, error: 'NOT_STRING' };
  const text = raw.trim();
  if (text.length === 0) return { ok: false, error: 'EMPTY' };
  if (text.length > maxLength) return { ok: false, error: 'TOO_LONG' };
  if (FORBIDDEN_WORDS.some((word) => text.includes(word))) return { ok: false, error: 'FORBIDDEN' };
  // 말투 규칙 8: 자신을 "하랑이"라고 부르지 않는다.
  if (text.includes('하랑이')) return { ok: false, error: 'SELF_NAME' };
  // 말투 규칙 9: 몸짓은 지문으로 쓰지 않는다. (별표, 괄호)
  if (/[*()（）]/.test(text)) return { ok: false, error: 'STAGE_DIRECTION' };
  // 말투 규칙 3: 느낌표 수 상한, 물결은 줄인다.
  if ((text.match(/!/g) ?? []).length > MAX_EXCLAMATIONS) return { ok: false, error: 'TOO_MANY_EXCLAMATIONS' };
  // 숫자 사이의 물결(09:00~18:00 같은 시간 표기)은 허용하고, 말끝을 늘이는 물결만 막는다.
  if (text.replace(/\d~\d/g, '').includes('~')) return { ok: false, error: 'TILDE' };
  return { ok: true, text };
}