import { selectPlaces } from '../places/select_places.js';
import { ZONE_ORDER_BY_AGE } from './route_options.js';
import { ROUTE_PLACE_COUNT } from './ai_config.js';

// 규칙만으로 후보를 정렬하고 길 3곳을 고른다. AI가 실패했을 때의 폴백이자, AI에게 줄 후보 목록의 기준이다.
//   prefs: { ageGroup, companion, zone, variant, count }
// 입력을 바꾸지 않는 순수 함수다. 좌표는 받지 않는다.

// 접근성 불리 점수(낮을수록 좋음). 값이 있는 위험만 센다. 모름(null)은 0이다. [임시] 가중치는 팀 확정 전.
function accessPenalty(place) {
  let score = 0;
  if (place.stairs === 'many') score += 2;
  else if (place.stairs === 'few') score += 1;
  if (place.slope === 'steep') score += 2;
  if (place.restSpots === 'none') score += 1;
  return score;
}

// 아이 동반 교육 점수(낮을수록 좋음). 모름(null)은 0이다. [임시]
const EDU_SCORE = Object.freeze({ good: -2, ok: -1, no: 1 });

// 권역 순위(낮을수록 먼저). 사용자가 권역을 골랐으면 그 권역이 맨 앞이다.
// 고르지 않았으면 variant B만 나이대별 기본 순서를 쓰고, C는 권역으로 정렬하지 않는다.
function zoneRank(place, { zone, ageGroup, variant }) {
  if (zone) return place.zone === zone ? 0 : 1;
  if (variant !== 'C') {
    const order = ZONE_ORDER_BY_AGE[ageGroup] ?? [];
    const i = order.indexOf(place.zone);
    return i === -1 ? order.length : i;
  }
  return 0;
}

// 지금 갈 수 있는 후보를 선택 기준에 따라 정렬해서 모두 돌려준다.
//   정렬: ① 권역 순위 ② 점수(60대 이상은 접근성, 아이 동반은 교육) ③ selectPlaces가 준 순서
export function rankCandidates(mode, places, context = {}, prefs = {}) {
  const selection = selectPlaces(mode, places, context);
  if (selection.reason !== 'OK') return selection;

  const strictAccess = prefs.ageGroup === '60s';
  const wantEdu = prefs.companion === 'kids';
  const scored = selection.places.map((place, index) => ({
    place,
    index,
    rank: zoneRank(place, prefs),
    score: (strictAccess ? accessPenalty(place) : 0) + (wantEdu ? (EDU_SCORE[place.eduFit] ?? 0) : 0),
  }));
  scored.sort((a, b) => a.rank - b.rank || a.score - b.score || a.index - b.index);
  return { places: scored.map((s) => s.place), reason: 'OK' };
}

// 정렬 1순위 장소의 권역에서 count곳을 고른다. 그 권역에 모자라면 나머지 후보에서 순서대로 채운다.
// [확인 필요] "인접 권역"은 아직 데이터가 없어서 정렬 순서로 대신한다.
export function pickByRules(mode, places, context = {}, prefs = {}) {
  const count = prefs.count ?? ROUTE_PLACE_COUNT;
  const ranked = rankCandidates(mode, places, context, prefs);
  if (ranked.reason !== 'OK') return ranked;

  const list = ranked.places;
  const topZone = list[0].zone ?? null;
  const sameZone = topZone === null ? list : list.filter((p) => p.zone === topZone);
  const chosen = sameZone.slice(0, count);
  for (const place of list) {
    if (chosen.length >= count) break;
    if (!chosen.includes(place)) chosen.push(place);
  }
  return { places: chosen, reason: 'OK', zone: topZone };
}