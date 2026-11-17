import { Router } from 'express';
import { isValidCoordinate } from './weather.js';
import { koreaClock, readOptions } from './recommend.js';
import { decideMode } from '../rules/decide_mode.js';
import { buildRoute } from '../courses/build_route.js';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

export function createCoursesRouter({ weatherService, placeLoader, courseLoader, now = () => new Date() }) {
  const router = Router();

  // GET /courses : 게시된 코스 목록 (코스 카드용). types는 코스에 포함된 장소 유형.
  router.get('/', async (req, res) => {
    const [courses, places] = await Promise.all([courseLoader(), placeLoader()]);
    if (!courses.ok || !places.ok) {
      res.status(503).json({ error: courses.ok ? places.reason : courses.reason });
      return;
    }
    const typeById = new Map(places.places.map((p) => [p.id, p.type]));
    res.json({
      courses: courses.courses.map((c) => {
        const ids = Object.values(c.routes).flat();
        const types = [...new Set(ids.map((id) => typeById.get(id)).filter(Boolean))].sort();
        return { id: c.id, title: c.title, theme: c.theme, district: c.district, durationMin: c.durationMin, types };
      }),
    });
  });

  // POST /courses/:id/route  본문: { latitude, longitude, previousMode? }  (오늘의 길 확인)
  router.post('/:id/route', async (req, res) => {
    const body = req.body ?? {};
    const options = readOptions(body);
    if (!isValidCoordinate(body.latitude, body.longitude) || !options) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    if (!ID_PATTERN.test(req.params.id)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const weather = await weatherService.getWeather({
      latitude: body.latitude,
      longitude: body.longitude,
    });
    const decision = decideMode(weather, { previousMode: options.previousMode });

    const [courses, places] = await Promise.all([courseLoader(), placeLoader()]);
    if (!courses.ok || !places.ok) {
      res.status(503).json({ error: courses.ok ? places.reason : courses.reason, mode: decision.mode });
      return;
    }
    const course = courses.courses.find((c) => c.id === req.params.id);
    if (!course) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const clock = koreaClock(now());
    const route = buildRoute(course, decision.mode, places.places, clock);
    res.json({
      ...route,
      modeReason: decision.reason,
      // 기준 시각: 서버 시계의 시(한국)와 날씨 발표 시각
      asOf: { hour: clock.hour, baseTime: weather.status === 'ok' ? weather.baseTime ?? null : null },
      weather:
        weather.status === 'ok'
          ? { status: 'ok', temperatureC: weather.temperatureC, apparentTemperatureC: weather.apparentTemperatureC }
          : { status: 'unavailable' },
    });
  });

  return router;
}