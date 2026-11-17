import { FIT_MODE_KEY, MODE_ALLOWED_TYPES, PLACE_RULES } from '../rules/rule_config.js';

// 그 시각, 그 요일에 열려 있는지. 시간을 모르는 장소(openHour가 null)는 시간 검사를 건너뛴다.
function isOpenAt(place, hour, dayOfWeek) {
  const closed = place.closedWeekdays ?? [];
  if (Number.isInteger(dayOfWeek) && closed.includes(dayOfWeek)) return false;
  if (place.openHour == null || place.closeHour == null) return true;
  // 시간을 아는 장소인데 지금 시각을 모르면 열려 있다고 말하지 않는다.
  if (!Number.isInteger(hour)) return false;
  return place.openHour <= hour && hour < place.closeHour;
}

// 지금 갈 수 있는 장소인가: 운영 중 상태이고, 휴관 요일·운영시간에 걸리지 않는다.
export function isAvailable(place, { hour, dayOfWeek } = {}) {
  return place.status === 'open' && isOpenAt(place, hour, dayOfWeek);
}

// 이 장소를 이 모드에서 어떻게 다룰지 판단한다. 'show'(보여 줌) | 'later'(보여 주되 뒤로) | 'hide'(숨김)
// 우선순위: ① 장소에 운영자가 직접 지정한 modeAllowed ② 확인된(추정 아님) 모드별 적합도 ③ 유형 규칙
function judge(place, mode, allowedTypes) {
  // ① modeAllowed(배열)가 있으면 그 목록만 본다.
  if (Array.isArray(place.modeAllowed)) return place.modeAllowed.includes(mode) ? 'show' : 'hide';

  // ② 확인된 적합도가 있으면 그것으로 판단한다. "추정" 값은 믿지 않고 건너뛴다.
  const key = FIT_MODE_KEY[mode];
  const cell = key ? place.fit?.[key] : undefined;
  if (cell && !cell.estimated) {
    if (cell.fit === 'bad') return 'hide';
    if (cell.fit === 'conditional') return 'later';
    if (cell.fit === 'good' || cell.fit === 'mostly') return 'show';
  }

  // ③ 적합도가 없거나 추정이면 장소 유형(type)으로 판단한다.
  return allowedTypes.includes(place.type) ? 'show' : 'hide';
}

const PERMITTED = ['not_needed', 'granted'];

// 모드와 장소 목록을 받아 지금 갈 수 있는 장소를 돌려준다. 입력을 바꾸지 않는 순수 함수다.
//   context: { hour, dayOfWeek, district }  (날씨 어댑터의 hour, dayOfWeek을 그대로 쓴다)
// 좌표는 받지 않는다. reason: OK | MODE_NO_PLACES | NO_CANDIDATE
export function selectPlaces(
  mode,
  places,
  context = {},
  allowedTypes = MODE_ALLOWED_TYPES,
  rules = PLACE_RULES,
) {
  const { hour, dayOfWeek, district } = context;
  const allowed = allowedTypes[mode];
  // 모르는 모드이거나 허용 유형이 없는 모드(HOLD)는 추천하지 않는다.
  if (!allowed || allowed.length === 0) return { places: [], reason: 'MODE_NO_PLACES' };

  const ranked = [];
  for (const place of places) {
    // 1) 방문 장소만. 이동 허브와 쉼터는 일반 추천에서 뺀다. (role이 없는 옛 데이터는 방문 장소로 본다)
    if ((place.role ?? 'visit') !== 'visit') continue;
    // 2) 허가 상태로 거르는 것은 설정이 켜졌을 때만.
    if (rules.requirePermission && !PERMITTED.includes(place.permissionState)) continue;
    // 3) 운영 중이고 지금 열려 있어야 한다.
    if (!isAvailable(place, { hour, dayOfWeek })) continue;
    // 4) 모드 적합도.
    const verdict = judge(place, mode, allowed);
    if (verdict === 'hide') continue;
    ranked.push({ place, later: verdict === 'later' });
  }
  if (ranked.length === 0) return { places: [], reason: 'NO_CANDIDATE' };

  // 정렬: 조건부는 뒤로, 그 안에서 선택한 구·군을 앞으로. 나머지 순서는 그대로 유지된다.
  const sorted = [...ranked].sort(
    (a, b) =>
      Number(a.later) - Number(b.later) ||
      Number(b.place.district === district) - Number(a.place.district === district),
  );
  return { places: sorted.map((r) => r.place), reason: 'OK' };
}