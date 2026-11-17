import { MODE_ALLOWED_TYPES } from '../rules/rule_config.js';

// 그 시각, 그 요일에 열려 있는지. 시간을 모르는 장소(openHour가 null)는 시간 검사를 건너뛴다.
function isOpenAt(place, hour, dayOfWeek) {
  const closed = place.closedWeekdays ?? [];
  if (Number.isInteger(dayOfWeek) && closed.includes(dayOfWeek)) return false;
  if (place.openHour == null || place.closeHour == null) return true;
  // 시간을 아는 장소인데 지금 시각을 모르면 열려 있다고 말하지 않는다.
  if (!Number.isInteger(hour)) return false;
  return place.openHour <= hour && hour < place.closeHour;
}

// 이 장소를 이 모드에서 보여 줄 수 있는지.
// 장소에 modeAllowed(배열)가 있으면 그 목록이 우선이고, 없으면(null) 유형 규칙표를 따른다.
function allowsMode(place, mode, allowed) {
  if (Array.isArray(place.modeAllowed)) return place.modeAllowed.includes(mode);
  return allowed.includes(place.type);
}

// 모드와 장소 목록을 받아 지금 갈 수 있는 장소를 돌려준다. 입력을 바꾸지 않는 순수 함수다.
//   context: { hour, dayOfWeek, district }  (날씨 어댑터의 hour, dayOfWeek을 그대로 쓴다)
// 좌표는 받지 않는다. reason: OK | MODE_NO_PLACES | NO_CANDIDATE
export function selectPlaces(mode, places, context = {}, allowedTypes = MODE_ALLOWED_TYPES) {
  const { hour, dayOfWeek, district } = context;
  const allowed = allowedTypes[mode];
  // 모르는 모드이거나 허용 유형이 없는 모드(HOLD)는 추천하지 않는다.
  if (!allowed || allowed.length === 0) return { places: [], reason: 'MODE_NO_PLACES' };

  const candidates = places.filter(
    (p) => allowsMode(p, mode, allowed) && p.status === 'open' && isOpenAt(p, hour, dayOfWeek),
  );
  if (candidates.length === 0) return { places: [], reason: 'NO_CANDIDATE' };

  // 선택한 구·군과 같은 곳을 앞으로. 복사본을 정렬하고, 나머지 순서는 그대로 유지된다.
  const sorted = [...candidates].sort(
    (a, b) => Number(b.district === district) - Number(a.district === district),
  );
  return { places: sorted, reason: 'OK' };
}