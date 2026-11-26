// TMAP 대중교통 경로: 출발 → 도착 한 구간의 버스·지하철·도보 경로를 줄여서 돌려준다.
// 규칙 1: 좌표는 body로만 보내고, 에러 메시지·로그에 좌표를 넣지 않는다.
// 공식 응답 모양(2026-11-25에 실제 호출로 확인): metaData.plan.itineraries[] 안에
//   totalTime(초), totalDistance(m), totalWalkTime, transferCount, fare.regular.totalFare(원), pathType, legs[]
//   leg: mode('WALK'|'BUS'|'SUBWAY'…), sectionTime(초), distance(m), start/end { name, lon, lat },
//        WALK는 steps[{ description, distance, linestring }], 대중교통은 route(노선 이름), passStopList.stations[], passShape.linestring
//   linestring은 "경도,위도 경도,위도 …" 글자다.
// 이 API는 TMAP의 대중교통 상품 신청이 있어야 한다 [확인 필요: 신청 여부는 키마다 다르다]. 안 되면 403이 오고 호출하는 쪽이 도보로 내려간다.

const URL = 'https://apis.openapi.sk.com/transit/routes';

// "경도,위도 경도,위도" → [{ lat, lng }]
export function parseLineString(text) {
  if (typeof text !== 'string') return [];
  const out = [];
  for (const pair of text.trim().split(/\s+/)) {
    const [lng, lat] = pair.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
  }
  return out;
}

const MODE_TEXT = { WALK: '도보', BUS: '버스', SUBWAY: '지하철', EXPRESSBUS: '고속버스', TRAIN: '기차', AIRPLANE: '비행기', FERRY: '배' };

// TMAP 응답의 한 경로(itinerary)를 앱이 쓰는 모양으로 바꾼다. 순수 함수 (테스트용으로 따로 둔다).
//   반환: { path, distance, time, fare, transfers, legs: [{ mode, route, time, distance, from, to, stops }], steps }
export function normalizeItinerary(it) {
  const path = [];
  const legs = [];
  const steps = [];
  const push = (pts) => {
    for (const p of pts) {
      const last = path[path.length - 1];
      if (!last || last.lat !== p.lat || last.lng !== p.lng) path.push(p);
    }
  };
  for (const leg of it.legs ?? []) {
    const mode = leg.mode ?? 'WALK';
    const before = path.length;
    let pts = [];
    if (mode === 'WALK') {
      for (const s of leg.steps ?? []) {
        const sp = parseLineString(s.linestring);
        if (sp.length > 0 && s.description) steps.push({ lat: sp[0].lat, lng: sp[0].lng, pathIndex: 0, text: String(s.description), turn: null, type: 'GP', _off: pts.length });
        pts = pts.concat(sp);
      }
    } else {
      pts = parseLineString(leg.passShape?.linestring);
    }
    // 선이 없으면 출발·도착 점이라도 이어 붙인다
    if (pts.length === 0) {
      if (leg.start && Number.isFinite(leg.start.lat)) pts.push({ lat: leg.start.lat, lng: leg.start.lon });
      if (leg.end && Number.isFinite(leg.end.lat)) pts.push({ lat: leg.end.lat, lng: leg.end.lon });
    }
    push(pts);
    const stations = leg.passStopList?.stations ?? [];
    const route = leg.route ? String(leg.route).replace(/^[^:]*:/, '') : null; // "급행:급행2" → "급행2"
    legs.push({
      mode,
      route,
      time: leg.sectionTime ?? 0,
      distance: leg.distance ?? 0,
      from: leg.start?.name ?? null,
      to: leg.end?.name ?? null,
      stops: mode === 'WALK' ? null : Math.max(0, stations.length - 1),
    });
    // 걷기 안내 지점의 pathIndex를 path 안의 위치로 맞춘다 (같은 leg 안에서의 순서)
    for (const s of steps) if (s._off !== undefined) { s.pathIndex = Math.min(path.length - 1, Math.max(0, before + s._off)); delete s._off; }
    if (mode !== 'WALK') {
      const p0 = pts[0];
      const p1 = pts[pts.length - 1];
      const label = `${MODE_TEXT[mode] ?? '대중교통'}${route ? ` ${route}` : ''}`;
      if (p0) steps.push({ lat: p0.lat, lng: p0.lng, pathIndex: Math.min(path.length - 1, before), text: `${leg.start?.name ?? '정류장'}에서 ${label} 탑승 (${legs[legs.length - 1].stops}개 정거장)`, turn: null, type: 'BOARD' });
      if (p1) steps.push({ lat: p1.lat, lng: p1.lng, pathIndex: Math.max(0, path.length - 1), text: `${leg.end?.name ?? '정류장'}에서 하차`, turn: null, type: 'ALIGHT' });
    }
  }
  return {
    path,
    distance: it.totalDistance ?? 0,
    time: it.totalTime ?? 0,
    fare: it.fare?.regular?.totalFare ?? null,
    transfers: it.transferCount ?? 0,
    legs,
    steps,
  };
}

// from, to: { lat, lng }. 가장 빠른 경로 하나를 돌려준다. 실패하면 던진다 (에러 원문은 버린다).
export async function getTransitRoute(from, to) {
  const key = process.env.TMAP_APP_KEY;
  if (!key) throw new Error('TMAP_NOT_CONFIGURED');
  let res;
  try {
    res = await fetch(URL, {
      method: 'POST',
      headers: { appKey: key, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ startX: String(from.lng), startY: String(from.lat), endX: String(to.lng), endY: String(to.lat), count: 1, lang: 0, format: 'json' }),
      signal: AbortSignal.timeout(6000),
    });
  } catch {
    throw new Error('TMAP_UNREACHABLE');
  }
  if (!res.ok) throw new Error(`TMAP_HTTP_${res.status}`);
  const it = (await res.json())?.metaData?.plan?.itineraries?.[0];
  if (!it || !Array.isArray(it.legs)) throw new Error('TMAP_NO_TRANSIT'); // 대중교통 경로가 없는 구간
  return normalizeItinerary(it);
}
