import { Router } from 'express';
import { isValidCoordinate } from './weather.js';
import { decideMode } from '../rules/decide_mode.js';
import { MODES } from '../rules/rule_config.js';
import { selectPlaces } from '../places/select_places.js';
import { readRouteOptions } from '../ai/read_route_options.js';
import { createRateLimiter } from '../auth/rate_limiter.js';

const MODE_VALUES = Object.values(MODES);
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 이 중 하나라도 보내면 AI 길 구성(route)을 함께 돌려준다. 하나도 없으면 예전 응답 그대로다.
const ROUTE_OPTION_KEYS = ['ageGroup', 'theme', 'companion', 'zone', 'variant', 'refresh', 'briefing', 'excludePlaceIds'];
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_EXCLUDE = 12; // 새로고침 때 "이미 본 장소"로 보낼 수 있는 최대 개수
// 새로고침은 AI를 다시 부르므로 무료 한도를 아끼려고 같은 주소(IP)에서 횟수를 제한한다. [확인 필요] 임시 값
const REFRESH_LIMIT = Object.freeze({ max: 10, windowMs: 10 * 60 * 1000 });

// 한국 시간의 시(0~23)와 요일(0=일요일)을 구한다. 서버 시계가 UTC여도 같은 값이 나온다.
export function koreaClock(date) {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return { hour: k.getUTCHours(), dayOfWeek: k.getUTCDay() };
}

// 선택 입력(district, previousMode)을 검사한다. 이상하면 null.
export function readOptions(body) {
  const { district, previousMode } = body;
  if (district !== undefined && (typeof district !== 'string' || district.length === 0 || district.length > 20)) {
    return null;
  }
  if (previousMode !== undefined && !MODE_VALUES.includes(previousMode)) return null;
  return { district, previousMode };
}

// 새로고침과 브리핑 입력을 검사한다. 이상하면 null.
//   refresh: true면 새로고침, excludePlaceIds: 이미 본 장소 id들(이 장소를 뺀 새 조합을 받는다), briefing: true면 하랑이 브리핑도 받는다
export function readRefreshOptions(body) {
  const { refresh, excludePlaceIds, briefing } = body;
  if (refresh !== undefined && typeof refresh !== 'boolean') return null;
  if (briefing !== undefined && typeof briefing !== 'boolean') return null;
  if (excludePlaceIds !== undefined) {
    if (!Array.isArray(excludePlaceIds) || excludePlaceIds.length > MAX_EXCLUDE) return null;
    if (!excludePlaceIds.every((id) => typeof id === 'string' && ID_PATTERN.test(id))) return null;
  }
  return { refresh: refresh === true, exclude: excludePlaceIds ?? [], briefing: briefing === true };
}

// 길 구성을 부른다. 어떤 이유로든 실패해도 추천 응답 전체가 깨지지 않게 { ok: false }로 바꾼다. (에러 내용은 숨긴다)
export async function composeSafely(composeRoute, args) {
  try {
    return await composeRoute(args);
  } catch {
    return { ok: false, reason: 'COMPOSE_FAILED' };
  }
}

// 하랑이 "오늘의 길" 브리핑을 받는다. 실패해도 길 응답은 그대로 나가도록 null로 바꾼다. (에러 내용은 숨긴다)
//   route: { title, durationMin, places(방문 순서대로, 이름 포함) }
export async function briefingFor(harangiLine, { mode, hour, temperatureC, theme, route }) {
  try {
    const r = await harangiLine({
      event: 'briefing',
      mode,
      hour,
      temperatureC,
      routeTitle: route.title,
      theme,
      durationMin: route.durationMin,
      places: route.places,
    });
    return r.ok ? { text: r.text, picker: r.picker } : null;
  } catch {
    return null;
  }
}

export function createRecommendRouter({
  weatherService,
  placeLoader,
  composeRoute = null,
  harangiLine = null,
  now = () => new Date(),
  refreshLimiter = createRateLimiter({ ...REFRESH_LIMIT, now: () => now().getTime() }),
}) {
  const router = Router();

  // POST /recommend
  //   본문: { latitude, longitude, district?, previousMode?, ageGroup?, theme?, companion?, zone?, variant?,
  //          refresh?, excludePlaceIds?, briefing? }
  router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const options = readOptions(body);
    const routeOptions = readRouteOptions(body);
    const refreshOptions = readRefreshOptions(body);
    if (!isValidCoordinate(body.latitude, body.longitude) || !options || !routeOptions || !refreshOptions) {
      res.status(400).json({ error: 'INVALID_INPUT' }); // 입력값은 되돌려 주지 않는다
      return;
    }
    if (refreshOptions.refresh && !refreshLimiter.allow(req.ip ?? 'unknown')) {
      res.status(429).json({ error: 'TOO_MANY_REFRESHES' });
      return;
    }

    const weather = await weatherService.getWeather({
      latitude: body.latitude,
      longitude: body.longitude,
    });
    const decision = decideMode(weather, { previousMode: options.previousMode });

    const loaded = await placeLoader();
    if (!loaded.ok) {
      res.status(503).json({ error: loaded.reason, mode: decision.mode });
      return;
    }

    const context = { ...koreaClock(now()), district: options.district };
    const selection = selectPlaces(decision.mode, loaded.places, context);

    const response = {
      mode: decision.mode,
      reason: decision.reason,
      weather:
        weather.status === 'ok'
          ? { status: 'ok', temperatureC: weather.temperatureC, apparentTemperatureC: weather.apparentTemperatureC }
          : { status: 'unavailable' },
      // 필요한 필드만 내보낸다 (DB의 다른 값은 응답에 싣지 않는다).
      places: selection.places.map(({ id, name, district, type }) => ({ id, name, district, type })),
      selection: selection.reason,
    };

    // 선택 입력이 있으면 AI 길 구성을 덧붙인다. 사용자 좌표는 방문 순서 계산에만 쓰고 저장·기록하지 않는다.
    const wantsRoute = ROUTE_OPTION_KEYS.some((key) => body[key] !== undefined);
    if (wantsRoute && composeRoute) {
      const temperatureC = weather.status === 'ok' ? (weather.apparentTemperatureC ?? weather.temperatureC) : undefined;
      const composed = await composeSafely(composeRoute, {
        mode: decision.mode,
        places: loaded.places,
        context,
        prefs: routeOptions,
        start: { latitude: body.latitude, longitude: body.longitude },
        temperatureC,
        refresh: refreshOptions.refresh,
        exclude: refreshOptions.exclude,
      });
      if (!composed.ok) {
        response.route = null;
        response.routeReason = composed.reason;
      } else {
        response.route = {
          picker: composed.picker,
          title: composed.title,
          reason: composed.reason,
          places: composed.places,
          orderBasis: composed.orderBasis,
          durationMin: composed.durationMin,
          durationBasis: composed.durationBasis,
          isNew: composed.isNew,
        };
        if (refreshOptions.briefing && harangiLine) {
          response.route.briefing = await briefingFor(harangiLine, {
            mode: decision.mode,
            hour: context.hour,
            temperatureC,
            theme: routeOptions.theme,
            route: composed,
          });
        }
      }
    }

    res.json(response);
  });

  return router;
}