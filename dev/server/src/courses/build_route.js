import { MODES } from '../rules/rule_config.js';
import { isAvailable } from '../places/select_places.js';

// 모드별로 쓸 경로 type 후보. 앞에서부터 찾는다. (SHADE는 shade 경로가 없으면 indoor로 대신)
const ROUTE_TYPES_BY_MODE = Object.freeze({
  [MODES.EXPLORE]: ['explore'],
  [MODES.SHADE]: ['shade', 'indoor'],
  [MODES.INDOOR]: ['indoor'],
});

// 경로를 줄 수 없는 모드의 사유. 날씨 확인 불가는 추측하지 않는다.
const NO_ROUTE_REASON = Object.freeze({
  [MODES.SAFETY]: 'SAFETY',
  [MODES.HOLD]: 'HOLD',
  [MODES.UNKNOWN]: 'WEATHER_UNAVAILABLE',
});

// 코스, 모드, 장소 목록으로 "오늘의 길"을 만든다. 순수 함수이고 입력을 바꾸지 않는다.
//   context: { hour, dayOfWeek }
// reason: OK | PLACE_CLOSED | PLACE_MISSING | NO_ROUTE | SAFETY | HOLD | WEATHER_UNAVAILABLE | MODE_NO_ROUTE
export function buildRoute(course, mode, places, context = {}) {
  const base = {
    courseId: course.id,
    title: course.title,
    durationMin: course.durationMin,
    mode,
    routeType: null,
    available: false,
    reason: 'NO_ROUTE',
    stations: [],
    closedPlaceIds: [],
  };

  const wanted = ROUTE_TYPES_BY_MODE[mode];
  if (!wanted) return { ...base, reason: NO_ROUTE_REASON[mode] ?? 'MODE_NO_ROUTE' };

  const routeType = wanted.find((t) => course.routes?.[t]);
  if (!routeType) return base;

  const byId = new Map(places.map((p) => [p.id, p]));
  const ids = course.routes[routeType];
  // 순서는 "추천 순서"일 뿐 강제하지 않는다 (D-07). 없는 id는 건너뛰고 사유로 알린다.
  const stations = ids
    .map((id, i) => ({ id, order: i + 1, place: byId.get(id) }))
    .filter((s) => s.place)
    .map(({ id, order, place }) => ({
      order,
      id,
      name: place.name,
      district: place.district ?? null,
      type: place.type,
      open: isAvailable(place, context),
      hoursText: place.hoursText ?? null,
      closedText: place.closedText ?? null,
      caution: place.caution ?? null,
    }));

  const closedPlaceIds = stations.filter((s) => !s.open).map((s) => s.id);
  const missing = stations.length < ids.length;
  const reason = missing ? 'PLACE_MISSING' : closedPlaceIds.length > 0 ? 'PLACE_CLOSED' : 'OK';

  return { ...base, routeType, available: reason === 'OK', reason, stations, closedPlaceIds };
}