import {
  ROUTE_PLACE_COUNT,
  TITLE_RULES,
  REASON_MAX_LENGTH,
  FORBIDDEN_WORDS,
} from './ai_config.js';

function hasForbiddenWord(text) {
  return FORBIDDEN_WORDS.some((word) => text.includes(word));
}

// AI가 돌려준 길 구성을 검사한다. 입력을 바꾸지 않는 순수 함수다.
//   raw: AI 응답을 JSON으로 읽은 값 { title, placeIds, reason }
//   candidates: 규칙이 거른 후보 장소 배열 (id가 있는 객체)
//   count: 길에 들어갈 장소 수. 후보가 적으면 후보 수까지만 요구한다.
// 결과: { ok: true, route: { title, placeIds, reason } } | { ok: false, error: 코드 }
export function validateRoute(raw, candidates, { count = ROUTE_PLACE_COUNT } = {}) {
  if (raw === null || typeof raw !== 'object') return { ok: false, error: 'NOT_OBJECT' };

  // 1) 장소 목록: 배열이고, 개수가 맞고, 중복이 없고, 모두 후보 안에 있어야 한다.
  const { placeIds } = raw;
  if (!Array.isArray(placeIds)) return { ok: false, error: 'IDS_NOT_ARRAY' };
  const needed = Math.min(count, candidates.length);
  if (needed === 0) return { ok: false, error: 'NO_CANDIDATE' };
  if (placeIds.length !== needed) return { ok: false, error: 'IDS_COUNT' };
  if (new Set(placeIds).size !== placeIds.length) return { ok: false, error: 'IDS_DUPLICATE' };
  const allowed = new Set(candidates.map((p) => p.id));
  if (!placeIds.every((id) => allowed.has(id))) return { ok: false, error: 'IDS_NOT_CANDIDATE' };

  // 2) 길 이름: 문자열, 길이 범위, "길"로 끝남, 금칙어 없음.
  if (typeof raw.title !== 'string') return { ok: false, error: 'TITLE_NOT_STRING' };
  const title = raw.title.trim();
  if (title.length < TITLE_RULES.minLength || title.length > TITLE_RULES.maxLength) {
    return { ok: false, error: 'TITLE_LENGTH' };
  }
  if (!title.endsWith(TITLE_RULES.suffix)) return { ok: false, error: 'TITLE_SUFFIX' };
  if (hasForbiddenWord(title)) return { ok: false, error: 'TITLE_FORBIDDEN' };

  // 3) 이유 문장: 문자열, 비어 있지 않음, 길이 제한, 금칙어 없음.
  if (typeof raw.reason !== 'string') return { ok: false, error: 'REASON_NOT_STRING' };
  const reason = raw.reason.trim();
  if (reason.length === 0 || reason.length > REASON_MAX_LENGTH) {
    return { ok: false, error: 'REASON_LENGTH' };
  }
  if (hasForbiddenWord(reason)) return { ok: false, error: 'REASON_FORBIDDEN' };

  return { ok: true, route: { title, placeIds: [...placeIds], reason } };
}