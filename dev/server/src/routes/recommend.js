import { Router } from 'express';
import { isValidCoordinate } from './weather.js';
import { decideMode } from '../rules/decide_mode.js';
import { MODES } from '../rules/rule_config.js';
import { selectPlaces } from '../places/select_places.js';

const MODE_VALUES = Object.values(MODES);
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 한국 시간의 시(0~23)와 요일(0=일요일)을 구한다. 서버 시계가 UTC여도 같은 값이 나온다.
function koreaClock(date) {
  const k = new Date(date.getTime() + KST_OFFSET_MS);
  return { hour: k.getUTCHours(), dayOfWeek: k.getUTCDay() };
}

// 선택 입력(district, previousMode)을 검사한다. 이상하면 null.
function readOptions(body) {
  const { district, previousMode } = body;
  if (district !== undefined && (typeof district !== 'string' || district.length === 0 || district.length > 20)) {
    return null;
  }
  if (previousMode !== undefined && !MODE_VALUES.includes(previousMode)) return null;
  return { district, previousMode };
}

export function createRecommendRouter({ weatherService, placeLoader, now = () => new Date() }) {
  const router = Router();

  // POST /recommend  본문: { latitude, longitude, district?, previousMode? }
  router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const options = readOptions(body);
    if (!isValidCoordinate(body.latitude, body.longitude) || !options) {
      res.status(400).json({ error: 'INVALID_INPUT' }); // 입력값은 되돌려 주지 않는다
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

    const selection = selectPlaces(decision.mode, loaded.places, {
      ...koreaClock(now()),
      district: options.district,
    });

    res.json({
      mode: decision.mode,
      reason: decision.reason,
      weather:
        weather.status === 'ok'
          ? { status: 'ok', temperatureC: weather.temperatureC, apparentTemperatureC: weather.apparentTemperatureC }
          : { status: 'unavailable' },
      // 필요한 필드만 내보낸다 (DB의 다른 값은 응답에 싣지 않는다).
      places: selection.places.map(({ id, name, district, type }) => ({ id, name, district, type })),
      selection: selection.reason,
    });
  });

  return router;
}