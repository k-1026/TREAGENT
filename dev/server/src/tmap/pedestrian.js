// TMAP 도보 경로: 출발 → (경유지 최대 5개) → 도착 경로를 줄여서 돌려준다.
// 규칙 1: 좌표는 body로만 보내고, 에러 메시지·로그에 좌표를 넣지 않는다.

const URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1';

// via: 경유지 [{lat, lng}, ...] (최대 5개)
// 반환: { path, distance, time, legs: [{distance, time}, ...] }  (legs 개수 = via 개수 + 1)
export async function getWalkingRoute(from, to, via = []) {
  const key = process.env.TMAP_APP_KEY;
  if (!key) throw new Error('TMAP_NOT_CONFIGURED');
  if (via.length > 5) throw new Error('TMAP_TOO_MANY_WAYPOINTS');

  const body = {
    startX: from.lng, startY: from.lat,
    endX: to.lng, endY: to.lat,
    startName: 'start', endName: 'end', // 고정 영문 문자열 (명세상 한글이면 URL 인코딩 필요)
    reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
  };
  if (via.length > 0) body.passList = via.map((p) => `${p.lng},${p.lat}`).join('_');

  let res;
  try {
    res = await fetch(URL, {
      method: 'POST',
      headers: { appKey: key, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error('TMAP_UNREACHABLE'); // 원본 에러는 버린다 (좌표가 섞일 수 있음)
  }
  if (!res.ok) throw new Error(`TMAP_HTTP_${res.status}`);

  const features = (await res.json()).features ?? [];
  const start = features.find((f) => f.properties?.pointType === 'SP'); // 총거리·총시간은 SP에만 있다
  if (!start) throw new Error('TMAP_BAD_RESPONSE');

  const path = [];
  const legs = [{ distance: 0, time: 0 }];
  for (const f of features) {
    const p = f.properties;
    if (f.geometry?.type === 'LineString') {
      const leg = legs[legs.length - 1];
      leg.distance += p.distance;
      leg.time += p.time;
      for (const [lng, lat] of f.geometry.coordinates) {
        const last = path[path.length - 1];
        if (!last || last.lat !== lat || last.lng !== lng) path.push({ lat, lng });
      }
    } else if (/^PP/.test(p.pointType ?? '')) {
      legs.push({ distance: 0, time: 0 }); // 경유지를 지나면 다음 구간으로
    }
  }
  return { path, distance: start.properties.totalDistance, time: start.properties.totalTime, legs };
}