import { Router } from 'express';
import { isValidCoordinate } from './weather.js';
import { getWalkingRoute } from '../tmap/pedestrian.js';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_PLACES = 6; // 내 위치에서 출발하면 경유지가 최대 5개(TMAP 한도)

// POST /walk  본문: { placeIds: ['J05','J11',…] (순서대로), latitude?, longitude? }
//  - latitude/longitude(내 위치)가 있으면 내 위치 → 첫 장소부터, 없으면 첫 장소부터 경로를 잡는다.
//  - 규칙: 내 위치는 본문으로만 받고, 저장·로그하지 않는다. TMAP에는 경로 계산 때만 넘긴다.
export function createWalkRouter({ placeLoader, poiFinder, getRoute = getWalkingRoute }) {
  const router = Router();

  router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const ids = body.placeIds;
    const hasStart = body.latitude !== undefined || body.longitude !== undefined;
    const minPlaces = hasStart ? 1 : 2;
    const valid =
      Array.isArray(ids) &&
      ids.length >= minPlaces &&
      ids.length <= MAX_PLACES &&
      ids.every((id) => typeof id === 'string' && ID_PATTERN.test(id)) &&
      new Set(ids).size === ids.length &&
      (!hasStart || isValidCoordinate(body.latitude, body.longitude));
    if (!valid) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }

    const loaded = await placeLoader();
    if (!loaded.ok) {
      res.status(503).json({ error: loaded.reason });
      return;
    }
    const byId = new Map(loaded.places.map((p) => [p.id, p]));
    const picked = ids.map((id) => byId.get(id));
    if (picked.some((p) => !p)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    // 좌표: DB에 있으면 그대로, 없으면 TMAP 장소 검색
    const resolved = await Promise.all(
      picked.map(async (p) => {
        if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
          return { id: p.id, name: p.name, lat: p.lat, lng: p.lng, coordSource: 'db' };
        }
        const found = await poiFinder(p);
        return found ? { id: p.id, name: p.name, lat: found.lat, lng: found.lng, coordSource: 'tmap_poi' } : null;
      }),
    );
    const missing = ids.filter((id, i) => !resolved[i]);
    if (missing.length > 0) {
      res.status(422).json({ error: 'COORD_NOT_FOUND', placeIds: missing }); // 장소 id만 알려 준다
      return;
    }

    const points = resolved.map(({ lat, lng }) => ({ lat, lng }));
    const from = hasStart ? { lat: body.latitude, lng: body.longitude } : points[0];
    const rest = hasStart ? points : points.slice(1);
    let route;
    try {
      route = await getRoute(from, rest[rest.length - 1], rest.slice(0, -1));
    } catch {
      res.status(502).json({ error: 'TMAP_UNAVAILABLE' }); // 에러 원문은 버린다 (좌표가 섞일 수 있음)
      return;
    }

    res.json({
      places: resolved,
      path: route.path,
      distance: route.distance, // m
      time: route.time, // 초
      // legs: 구간별 거리·시간. 내 위치를 보냈으면 legs[0]이 "내 위치 → 첫 장소"
      legs: route.legs,
    legEnds: route.legEnds, // 각 구간이 끝나는 path 위치
      steps: route.steps, // 길 안내 지점
      startIncluded: hasStart,
    });
  });

  return router;
}