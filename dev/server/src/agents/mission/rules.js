import { distanceKm } from '../../ai/order_places.js';
import { FORBIDDEN_WORDS } from '../../ai/ai_config.js';

// 미션의 코드 문(규칙). 도착·제출·판정 확인은 LLM이 아니라 코드가 한다. LLM이 통과라고 해도 코드 실패는 뒤집지 못한다 (거부권).
// 사용자 좌표(position)는 여기서 거리 계산에만 쓰고 저장·기록하지 않는다 (절대 규칙 1).

export const MISSION_KINDS = Object.freeze(['quiz', 'photo', 'receipt']);

// 미션 설정표. 숫자는 임시값이다. [결정 필요]
export const MISSION_LIMITS = Object.freeze({
  arriveRadiusM: 100, // 도착으로 보는 반경(m)
  maxSubmits: 3, // 제출 횟수 상한 (다 쓰면 도장을 보류한다)
  imageMaxChars: 6_000_000, // base64 문자열 길이 상한 (약 4.5MB)
  answerMaxChars: 100,
  explainMaxChars: 200,
  taskMaxChars: 150,
  hintMaxChars: 100,
  ticketTtlMs: 30 * 60 * 1000,
  ticketMax: 500,
});

const hasPos = (p) => Number.isFinite(p?.latitude) && Number.isFinite(p?.longitude);
const hasCoord = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);

// 도착 확인: 서버가 GPS 반경 안인지 계산한다. 위치를 모르면 도착으로 보지 않는다.
export function checkArrival({ position, place, radiusM = MISSION_LIMITS.arriveRadiusM }) {
  if (!hasPos(position) || !hasCoord(place)) return { ok: false, code: 'NO_POSITION' };
  const m = distanceKm({ lat: position.latitude, lng: position.longitude }, place) * 1000;
  return m <= radiusM ? { ok: true } : { ok: false, code: 'GPS_OUT' };
}

const hasForbidden = (t) => FORBIDDEN_WORDS.some((w) => t.includes(w));

// 설명 코드 검증: 근거 키·금칙어·길이. 근거 키는 장소가 실제로 가진 항목이어야 한다.
export function checkExplanation(draft, factKeys, max = MISSION_LIMITS.explainMaxChars) {
  if (draft === null || typeof draft !== 'object' || typeof draft.text !== 'string') return { ok: false, code: 'NOT_OBJECT' };
  const text = draft.text.trim();
  if (text.length === 0 || text.length > max) return { ok: false, code: 'LENGTH' };
  if (hasForbidden(text)) return { ok: false, code: 'FORBIDDEN' };
  const keys = draft.evidenceKeys;
  if (!Array.isArray(keys) || keys.length === 0 || !keys.every((k) => factKeys.includes(k))) return { ok: false, code: 'NO_EVIDENCE' };
  return { ok: true, text };
}

// 출제 코드 검증: 길이·금칙어. 퀴즈는 정답이 있어야 하고 문제 글에 정답이 그대로 나오면 안 된다.
export function checkTask(kind, draft, max = MISSION_LIMITS.taskMaxChars) {
  if (draft === null || typeof draft !== 'object' || typeof draft.task !== 'string') return { ok: false, code: 'NOT_OBJECT' };
  const task = draft.task.trim();
  if (task.length === 0 || task.length > max) return { ok: false, code: 'LENGTH' };
  if (hasForbidden(task)) return { ok: false, code: 'FORBIDDEN' };
  if (kind === 'quiz') {
    const answer = typeof draft.answer === 'string' ? draft.answer.trim() : '';
    if (answer.length === 0 || answer.length > 40) return { ok: false, code: 'NO_ANSWER' };
    if (task.includes(answer)) return { ok: false, code: 'ANSWER_EXPOSED' };
    return { ok: true, task, answer };
  }
  return { ok: true, task, answer: null };
}

// 제출 점검(코드): 형식과 횟수. 이미지는 prepareImage가 EXIF 제거·결제 정보 가림을 한 뒤의 값이어야 한다.
export async function checkSubmission({ kind, submission, prepareImage, limits = MISSION_LIMITS }) {
  if (submission === null || typeof submission !== 'object') return { ok: false, code: 'NOT_OBJECT' };
  if (kind === 'quiz') {
    const a = typeof submission.answer === 'string' ? submission.answer.trim() : '';
    if (a.length === 0 || a.length > limits.answerMaxChars) return { ok: false, code: 'ANSWER_FORMAT' };
    return { ok: true, answer: a };
  }
  const raw = submission.imageBase64;
  if (typeof raw !== 'string' || raw.length === 0) return { ok: false, code: 'NO_IMAGE' };
  if (raw.length > limits.imageMaxChars) return { ok: false, code: 'IMAGE_TOO_LARGE' };
  const prepared = await prepareImage(raw, { kind });
  if (!prepared?.ok) return { ok: false, code: prepared?.code ?? 'IMAGE_PREP_FAILED' };
  return { ok: true, imageBase64: prepared.base64, imageHash: prepared.hash };
}

// 판정 확인(코드, 거부권): LLM(Gemini)이 통과라고 해도 아래를 코드가 다시 확인한다.
//   GPS 반경, 같은 사진 중복 제출, 한 장소 한 번만 도장, 판정 형식. 모르면 통과시키지 않는다.
//   store: { hasStamp(userKey, placeId), hasDuplicate(userKey, placeId, hash) }
export async function confirmJudgement({ verdict, kind, position, place, userKey, imageHash, store, radiusM = MISSION_LIMITS.arriveRadiusM }) {
  if (verdict === null || typeof verdict !== 'object' || typeof verdict.pass !== 'boolean') return { ok: false, code: 'BAD_VERDICT' };
  if (verdict.pass !== true) return { ok: false, code: 'JUDGE_REJECTED' };
  const gps = checkArrival({ position, place, radiusM });
  if (!gps.ok) return gps;
  if (await store.hasStamp(userKey, place.id)) return { ok: false, code: 'ALREADY_STAMPED' };
  if (kind !== 'quiz' && imageHash && (await store.hasDuplicate(userKey, place.id, imageHash))) return { ok: false, code: 'DUPLICATE' };
  return { ok: true };
}

// 힌트 코드 검증: 길이·금칙어, 정답이 그대로 나오면 거부한다 (정답은 서버만 안다).
export function checkHint(text, answer, max = MISSION_LIMITS.hintMaxChars) {
  if (typeof text !== 'string') return { ok: false, code: 'NOT_STRING' };
  const t = text.trim();
  if (t.length === 0 || t.length > max) return { ok: false, code: 'LENGTH' };
  if (hasForbidden(t)) return { ok: false, code: 'FORBIDDEN' };
  if (answer && t.includes(answer)) return { ok: false, code: 'ANSWER_EXPOSED' };
  return { ok: true, text: t };
}
