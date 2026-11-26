import { isAvailable } from '../../places/select_places.js';
import { orderPlaces, distanceKm } from '../../ai/order_places.js';
import { DETOUR_FACTOR, WALK_KMH } from '../../ai/estimate_duration.js';
import { ROUTE_PLACE_COUNT } from '../../ai/ai_config.js';
import { COURSE_LIMITS } from './config.js';

// 확인자(코드): 기획자가 고른 장소를 판정한다. LLM은 이 판정을 뒤집지 못한다 (거부권은 코드).
// 사유 코드: NOT_ARRAY, NO_CANDIDATE, IDS_COUNT, IDS_DUPLICATE, IDS_NOT_CANDIDATE, NOT_OPEN, WALK_TOO_LONG
// walkTime: async (a, b) => 분 | null. null이면 추정식으로 내려가고 durationBasis를 'estimate'로 표시한다 (6-1장 5번).
//   a, b는 { lat, lng }. 좌표는 이 함수 안에서만 쓰고 결과에는 싣지 않는다.
// 결과: { ok, code, badPlaceIds, ordered(방문 순서대로 장소 id), durationBasis, walkMin, legsMin }
export async function checkPlaces({ placeIds, candidates, context = {}, walkTime, ageGroup, count = ROUTE_PLACE_COUNT, limits = COURSE_LIMITS }) {
  const fail = (code, badPlaceIds = []) => ({ ok: false, code, badPlaceIds });

  if (!Array.isArray(placeIds)) return fail('NOT_ARRAY');
  const needed = Math.min(count, candidates.length);
  if (needed === 0) return fail('NO_CANDIDATE');
  if (placeIds.length !== needed) return fail('IDS_COUNT');
  if (new Set(placeIds).size !== placeIds.length) return fail('IDS_DUPLICATE');
  const byId = new Map(candidates.map((p) => [p.id, p]));
  if (!placeIds.every((id) => byId.has(id))) return fail('IDS_NOT_CANDIDATE');

  // 오늘 영업: 모르면 연 것으로 보지 않는다 (isAvailable).
  const closed = placeIds.filter((id) => !isAvailable(byId.get(id), context));
  if (closed.length > 0) return fail('NOT_OPEN', closed);

  // 방문 순서는 코드가 정한다. 시작 위치는 쓰지 않는다 (코스 자체의 이동 시간만 본다).
  const places = orderPlaces(placeIds.map((id) => byId.get(id)), {}).places;
  const hasCoord = places.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  const legsMin = [];
  let basis = hasCoord ? 'tmap' : 'none';
  if (hasCoord) {
    const speed = Object.hasOwn(WALK_KMH, ageGroup) ? WALK_KMH[ageGroup] : WALK_KMH.default;
    for (let i = 1; i < places.length; i += 1) {
      const a = { lat: places[i - 1].lat, lng: places[i - 1].lng };
      const b = { lat: places[i].lat, lng: places[i].lng };
      let min = null;
      try {
        min = await walkTime?.(a, b);
      } catch {
        min = null; // T맵 실패는 코스를 막지 않는다. 에러 내용(좌표가 섞일 수 있음)은 버린다.
      }
      if (!Number.isFinite(min)) {
        min = Math.ceil(((distanceKm(a, b) * DETOUR_FACTOR) / speed) * 60);
        basis = 'estimate';
      }
      legsMin.push(min);
    }
    if (basis === 'tmap' && legsMin.length === 0) basis = 'none';
  }
  const walkMin = legsMin.reduce((s, m) => s + m, 0);
  const tooLong = legsMin.findIndex((m) => m > limits.maxSegmentWalkMin);
  if (tooLong >= 0) return { ...fail('WALK_TOO_LONG', [places[tooLong + 1].id]), durationBasis: basis, walkMin, legsMin };
  if (walkMin > limits.maxTotalWalkMin) {
    // 가장 긴 구간의 도착 장소를 교체 대상으로 알린다.
    const worst = legsMin.indexOf(Math.max(...legsMin));
    return { ...fail('WALK_TOO_LONG', [places[worst + 1].id]), durationBasis: basis, walkMin, legsMin };
  }
  return { ok: true, code: null, badPlaceIds: [], ordered: places.map((p) => p.id), durationBasis: basis, walkMin, legsMin };
}
