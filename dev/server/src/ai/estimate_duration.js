import { distanceKm } from './order_places.js';

// 오늘의 길 소요시간을 추정한다. 입력을 바꾸지 않는 순수 함수다. AI가 아니라 코드가 계산하고, AI는 이 값을 읽어 줄 뿐이다.
//   소요시간 = (장소 사이 걷는 시간) + (장소마다 머무는 시간). 내 위치에서 첫 장소까지는 포함하지 않는다.
// [확인 필요] 아래 값은 모두 임시 가정이다. 팀이 근거를 정해야 한다.
export const WALK_KMH = Object.freeze({ default: 4, '60s': 3 }); // 걷는 속도(km/h). 60대 이상은 더 느리게 본다.
export const DETOUR_FACTOR = 1.3; // 직선거리를 실제 걷는 길로 바꾸는 배수 (길이 곧게 나 있지 않으므로)
export const STAY_MIN_PER_PLACE = 20; // 장소 하나에 머무는 시간(분). 장소별 체류 시간 데이터는 아직 없다.
const ROUND_MIN = 5; // 5분 단위로 올림해서 보여 준다 ("약 N분")

const hasCoord = (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng);

// 방문 순서대로 정렬된 장소 배열을 받는다 (lat, lng 필요).
// 결과: { minutes, basis } — 좌표가 하나라도 없으면 { minutes: null, basis: 'none' } (추측하지 않는다)
export function estimateDurationMin(orderedPlaces, { ageGroup } = {}) {
  if (!Array.isArray(orderedPlaces) || orderedPlaces.length === 0 || !orderedPlaces.every(hasCoord)) {
    return { minutes: null, basis: 'none' };
  }
  let km = 0;
  for (let i = 1; i < orderedPlaces.length; i += 1) km += distanceKm(orderedPlaces[i - 1], orderedPlaces[i]);
  const speed = Object.hasOwn(WALK_KMH, ageGroup) ? WALK_KMH[ageGroup] : WALK_KMH.default;
  const walkMin = ((km * DETOUR_FACTOR) / speed) * 60;
  const total = walkMin + orderedPlaces.length * STAY_MIN_PER_PLACE;
  return { minutes: Math.ceil(total / ROUND_MIN) * ROUND_MIN, basis: 'distance' };
}