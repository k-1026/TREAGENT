import { validateRoute } from './validate_route.js';
import { buildTitle } from './build_title.js';

// AI 응답 { placeIds, keyword, reason }을 검사한다. 이름은 AI가 아니라 코드가 조립한다.
// 조립한 이름도 validateRoute의 이름 규칙(길이, "길" 끝, 금칙어)을 한 번 더 통과해야 한다.
export function validateComposition(raw, candidates, { mode, theme, count } = {}) {
  if (raw === null || typeof raw !== 'object') return { ok: false, error: 'NOT_OBJECT' };
  const title = buildTitle({ mode, theme, keyword: raw.keyword });
  if (title === null) return { ok: false, error: 'KEYWORD_NOT_ALLOWED' };
  return validateRoute({ ...raw, title }, candidates, { count });
}