import { validateRoute } from '../../ai/validate_route.js';
import { buildTitle } from '../../ai/build_title.js';

// 검증(코드): 작성자의 문장을 판정한다 (6-2장). 기존 validateRoute의 형식·길이·금칙어 검사를 그대로 쓴다.
//   draft: { keyword, reason, evidenceIds }, placeIds: 확인자를 통과한 장소 id들
// 사유 코드: NOT_OBJECT, KEYWORD_NOT_ALLOWED, REASON_*, NO_EVIDENCE (근거 id가 없거나 실제 근거가 아님)
// 근거 검사는 evidenceIds가 실제 근거인지만 본다. 문장 내용과의 일치는 평가자가 본다 [확인 필요].
export function checkDraft({ draft, placeIds, candidates, evidence, mode, theme }) {
  if (draft === null || typeof draft !== 'object') return { ok: false, code: 'NOT_OBJECT' };
  const title = buildTitle({ mode, theme, keyword: draft.keyword });
  if (title === null) return { ok: false, code: 'KEYWORD_NOT_ALLOWED' };

  const checked = validateRoute({ title, placeIds, reason: draft.reason }, candidates);
  if (!checked.ok) return { ok: false, code: checked.error };

  const ids = draft.evidenceIds;
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, code: 'NO_EVIDENCE' };
  const known = new Set(evidence.map((e) => e.id));
  if (!ids.every((id) => known.has(id))) return { ok: false, code: 'NO_EVIDENCE' };

  return { ok: true, code: null, route: checked.route };
}
