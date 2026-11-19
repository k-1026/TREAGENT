// 방문 순서를 코드가 정한다. AI가 준 순서는 쓰지 않는다. 입력을 바꾸지 않는 순수 함수다.
//   places: 장소 배열 (lat, lng, zone, routeOrder를 쓴다)
//   start: 사용자 위치 { latitude, longitude } (선택). 계산에만 쓰고 저장·기록하지 않는다.
// 결과: { places: 순서대로 정렬된 배열, basis: 'distance' | 'route_order' | 'none' }
//   distance: 좌표가 모두 있어서 총 이동 거리(직선)가 가장 짧은 순서로 정함
//   route_order: 같은 권역이고 임시 순번이 모두 있어서 순번순으로 정함 [임시]
//   none: 정할 근거가 없어서 받은 순서 그대로 (순서 미검증)
const EARTH_KM = 6371;
const MAX_PLACES = 7; // 순서 경우의 수가 폭발하지 않게 하는 상한 (7! = 5040)

const toRad = (deg) => (deg * Math.PI) / 180;
const hasCoord = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng);

// 두 지점의 직선거리(km). 하버사인 공식.
export function distanceKm(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

// 가능한 모든 순서(순열). 항상 같은 순서로 만들어서 결과가 매번 같다.
function permutations(items) {
  if (items.length <= 1) return [items];
  const out = [];
  items.forEach((item, i) => {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) out.push([item, ...tail]);
  });
  return out;
}

function pathLength(order, startPoint) {
  let total = 0;
  let prev = startPoint;
  for (const p of order) {
    if (prev) total += distanceKm(prev, p);
    prev = p;
  }
  return total;
}

export function orderPlaces(places, { start } = {}) {
  if (places.length === 0) return { places: [], basis: 'none' };

  // 1) 좌표가 모두 있으면 총 이동 거리가 가장 짧은 순서.
  if (places.length <= MAX_PLACES && places.every(hasCoord)) {
    const startPoint =
      start && Number.isFinite(start.latitude) && Number.isFinite(start.longitude)
        ? { lat: start.latitude, lng: start.longitude }
        : null;
    let best = null;
    let bestLength = Infinity;
    for (const order of permutations(places)) {
      const length = pathLength(order, startPoint);
      if (length < bestLength) {
        best = order;
        bestLength = length;
      }
    }
    return { places: [...best], basis: 'distance' };
  }

  // 2) 같은 권역이고 임시 순번이 모두 있으면 순번순. [임시]
  const zone = places[0].zone;
  const sameZone = zone != null && places.every((p) => p.zone === zone);
  if (sameZone && places.every((p) => Number.isInteger(p.routeOrder))) {
    const sorted = [...places].sort((a, b) => a.routeOrder - b.routeOrder || String(a.id).localeCompare(String(b.id)));
    return { places: sorted, basis: 'route_order' };
  }

  // 3) 근거가 없으면 받은 순서 그대로.
  return { places: [...places], basis: 'none' };
}