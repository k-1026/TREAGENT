import { rankCandidates, pickByRules } from './pick_by_rules.js';
import { orderPlaces } from './order_places.js';
import { estimateDurationMin } from './estimate_duration.js';
import { buildFallbackRoute } from './fallback_route.js';
import { createComposeGraph, runComposeGraph } from './compose_graph.js';
import { makeCacheKey } from './route_cache.js';
import { AI_CANDIDATE_LIMIT, AI_MODES, ROUTE_PLACE_COUNT } from './ai_config.js';
import { KEYWORDS } from './route_options.js';

// 응답에 내보낼 장소 정보. 필요한 항목만 담고 좌표는 내보내지 않는다.
export function toPublicPlace(place) {
  return {
    id: place.id,
    name: place.name,
    district: place.district ?? null,
    type: place.type,
    zone: place.zone ?? null,
    hoursText: place.hoursText ?? null,
    caution: place.caution ?? null,
  };
}

// 길 구성 서비스를 만든다. llm이 없으면(키 없음) 항상 규칙 결과만 쓴다. 그래프는 한 번만 만든다.
//   llm: async (프롬프트, { signal }) => AI 응답 객체 | null,  cache: createRouteCache() | null
export function createComposeRoute({ llm = null, cache = null, maxAttempts, timeoutMs } = {}) {
  const graph = llm ? createComposeGraph({ llm, maxAttempts, timeoutMs }) : null;

  // places: 장소 전체, context: { hour, dayOfWeek, district }, prefs: { ageGroup, theme, companion, zone, variant }
  // start: 사용자 위치 { latitude, longitude } (순서 계산에만 쓰고 저장하지 않는다)
  // refresh: true면 "새로고침". 기억해 둔 길을 건너뛰고 새로 구성한다. exclude: 이미 보여 준 장소 id들 (이 장소를 뺀 새 조합을 찾는다)
  return async function composeRoute({ mode, places, context = {}, prefs = {}, start, temperatureC, refresh = false, exclude = [] }) {
    // 0) 새로고침: 이미 보여 준 장소를 뺀 후보로 구성한다. 빼고 나면 후보가 모자라면 빼지 않고 전체에서 고른다.
    const excluded = new Set(exclude);
    let usable = places;
    if (excluded.size > 0) {
      const all = rankCandidates(mode, places, context, prefs);
      if (all.reason === 'OK') {
        const need = Math.min(ROUTE_PLACE_COUNT, all.places.length);
        const rest = places.filter((p) => !excluded.has(p.id));
        const restRanked = rankCandidates(mode, rest, context, prefs);
        if (restRanked.reason === 'OK' && restRanked.places.length >= need) usable = rest;
      }
    }

    // 1) 규칙: 지금 갈 수 있는 후보를 정렬한다. 후보가 없으면 여기서 끝.
    const ranked = rankCandidates(mode, usable, context, prefs);
    if (ranked.reason !== 'OK') return { ok: false, reason: ranked.reason };
    const candidates = ranked.places.slice(0, AI_CANDIDATE_LIMIT);

    // 2) 폴백으로 쓸 규칙 선택 (AI를 쓰지 못할 때 이 결과를 쓴다)
    const rulePick = pickByRules(mode, usable, context, prefs);
    const fallbackRoute = buildFallbackRoute({ mode, theme: prefs.theme, places: rulePick.places });

    // 3) AI를 쓸 수 있는 경우: 키가 있고, AI 모드이고, 허용된 테마가 있을 때
    let route = fallbackRoute;
    let picker = 'rules';
    let attempts = 0;
    if (graph && AI_MODES.includes(mode) && Object.hasOwn(KEYWORDS, prefs.theme ?? '')) {
      const key = makeCacheKey({ mode, ...prefs, district: context.district });
      const ids = new Set(candidates.map((p) => p.id));
      const cached = refresh ? undefined : cache?.get(key);
      // 기억해 둔 길은 지금도 갈 수 있는 장소일 때만 다시 쓴다. (닫힌 곳이 생기면 새로 만든다)
      if (cached && cached.placeIds.every((id) => ids.has(id))) {
        route = cached;
        picker = 'ai';
      } else {
        const result = await runComposeGraph(graph, {
          mode,
          temperatureC,
          hour: context.hour,
          ageGroup: prefs.ageGroup,
          theme: prefs.theme,
          companion: prefs.companion,
          candidates,
        });
        attempts = result.attempts;
        if (result.source === 'ai') {
          route = result.route;
          picker = 'ai';
          cache?.set(key, route); // 새로고침한 결과가 이후 같은 조건의 기본 길이 된다
        }
      }
    }

    // 4) 방문 순서는 코드가 정한다. AI가 준 순서는 쓰지 않는다.
    const byId = new Map(places.map((p) => [p.id, p]));
    const ordered = orderPlaces(route.placeIds.map((id) => byId.get(id)), { start });
    const duration = estimateDurationMin(ordered.places, { ageGroup: prefs.ageGroup });

    return {
      ok: true,
      picker,
      title: route.title,
      reason: route.reason,
      places: ordered.places.map(toPublicPlace),
      orderBasis: ordered.basis,
      durationMin: duration.minutes,
      durationBasis: duration.basis,
      // 새로고침인데 이미 보여 준 장소로만 이뤄졌다면(새 조합이 없다면) false
      isNew: !(excluded.size > 0 && route.placeIds.every((id) => excluded.has(id))),
      attempts,
    };
  };
}