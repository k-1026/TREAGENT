import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { normalizeItinerary, parseLineString } from '../src/tmap/transit.js';
import { createWalkRouter } from '../src/routes/walk.js';

// 2026-11-25에 TMAP 대중교통 API를 실제로 불러서 확인한 응답 모양을 줄여 만든 표본
const ITINERARY = {
  totalTime: 1078, totalDistance: 2812, totalWalkTime: 506, transferCount: 0, pathType: 2, fare: { regular: { totalFare: 1950 } },
  legs: [
    { mode: 'WALK', sectionTime: 217, distance: 265, start: { name: '출발지', lon: 128.5939, lat: 35.8714 }, end: { name: '약령시 정류장', lon: 128.5936, lat: 35.8690 },
      steps: [{ streetName: '길', distance: 100, description: '직진', linestring: '128.5939,35.8714 128.5937,35.8700' }, { streetName: '길', distance: 165, description: '좌회전', linestring: '128.5937,35.8700 128.5936,35.8690' }] },
    { mode: 'BUS', sectionTime: 572, distance: 2284, route: '급행:급행2', start: { name: '약령시 정류장', lon: 128.5936, lat: 35.8690 }, end: { name: '도착 정류장', lon: 128.6100, lat: 35.8600 },
      passStopList: { stations: [{}, {}, {}, {}] }, passShape: { linestring: '128.5936,35.8690 128.6000,35.8650 128.6100,35.8600' } },
    { mode: 'WALK', sectionTime: 289, distance: 363, start: { name: '도착 정류장' }, end: { name: '도착지' }, steps: [{ description: '직진', linestring: '128.6100,35.8600 128.6141,35.8576' }] },
  ],
};

test('parseLineString: "경도,위도 경도,위도"를 점 목록으로 바꾸고 깨진 값은 건너뛴다', () => {
  assert.deepEqual(parseLineString('128.5,35.8 x,y 128.6,35.9'), [{ lat: 35.8, lng: 128.5 }, { lat: 35.9, lng: 128.6 }]);
  assert.deepEqual(parseLineString(null), []);
});

test('normalizeItinerary: 도보·버스 구간을 이어 붙이고 탑승·하차 안내를 만든다', () => {
  const r = normalizeItinerary(ITINERARY);
  assert.equal(r.time, 1078);
  assert.equal(r.fare, 1950);
  assert.deepEqual(r.legs.map((l) => l.mode), ['WALK', 'BUS', 'WALK']);
  assert.equal(r.legs[1].route, '급행2'); // "급행:" 접두어를 뗀다
  assert.equal(r.legs[1].stops, 3); // 정류장 4개 = 정거장 3개
  assert.equal(r.path[0].lat, 35.8714);
  assert.equal(r.path.at(-1).lat, 35.8576);
  const board = r.steps.find((s) => s.type === 'BOARD');
  assert.match(board.text, /약령시 정류장에서 버스 급행2 탑승 \(3개 정거장\)/);
  assert.ok(r.steps.find((s) => s.type === 'ALIGHT'));
  for (const s of r.steps) assert.ok(s.pathIndex >= 0 && s.pathIndex < r.path.length);
  // 경로 점의 중복은 없다 (이어지는 지점)
  for (let i = 1; i < r.path.length; i += 1) assert.ok(r.path[i].lat !== r.path[i - 1].lat || r.path[i].lng !== r.path[i - 1].lng);
});

const PLACES = [
  { id: 'a', name: 'A', lat: 35.8700, lng: 128.5900 },
  { id: 'b', name: 'B', lat: 35.8710, lng: 128.5905 }, // A에서 약 120m: 가까워서 걷는다
  { id: 'c', name: 'C', lat: 35.8576, lng: 128.6141 }, // 멀다: 대중교통
];
const WALK_ROUTE = (from, to) => ({ path: [{ lat: from.lat, lng: from.lng }, { lat: to.lat, lng: to.lng }], distance: 100, time: 90, legs: [{ distance: 100, time: 90 }], legEnds: [1], steps: [{ lat: from.lat, lng: from.lng, pathIndex: 0, text: '걷기', turn: null, type: 'GP' }] });

async function serve(opts = {}) {
  const calls = { walk: [], transit: [] };
  const router = createWalkRouter({
    placeLoader: async () => ({ ok: true, places: PLACES }),
    poiFinder: async () => null,
    getRoute: async (from, to) => { calls.walk.push([from, to]); return WALK_ROUTE(from, to); },
    getTransit: opts.getTransit ?? (async (from, to) => { calls.transit.push([from, to]); return normalizeItinerary(ITINERARY); }),
  });
  const app = express();
  app.use(express.json());
  app.use('/walk', router);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const post = async (body) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/walk`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  return { post, calls, close: () => server.close() };
}

test('POST /walk mode=transit: 먼 구간은 대중교통, 가까운 구간은 도보로 이어 붙인다', async () => {
  const s = await serve();
  try {
    const r = await s.post({ placeIds: ['a', 'b', 'c'], mode: 'transit' });
    assert.equal(r.status, 200);
    assert.equal(r.body.mode, 'transit');
    assert.equal(r.body.segments.length, 2);
    assert.deepEqual(r.body.segments.map((x) => x.type), ['walk', 'transit']); // A→B 도보, B→C 대중교통
    assert.equal(r.body.fare, 1950);
    assert.equal(r.body.legs.length, 2);
    assert.equal(r.body.legEnds.length, 2);
    assert.ok(r.body.legEnds[0] < r.body.legEnds[1]);
    assert.equal(r.body.legEnds[1], r.body.path.length - 1);
    assert.equal(r.body.time, 90 + 1078);
    assert.ok(r.body.steps.some((x) => x.type === 'BOARD'));
  } finally { s.close(); }
});

test('POST /walk mode=transit: 대중교통 호출이 실패하면 그 구간만 걷는다', async () => {
  const s = await serve({ getTransit: async () => { throw new Error('TMAP_HTTP_403 35.8, 128.6'); } });
  try {
    const r = await s.post({ placeIds: ['a', 'c'], mode: 'transit' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.segments.map((x) => x.type), ['walk']);
    assert.ok(!JSON.stringify(r.body).includes('403'));
  } finally { s.close(); }
});

test('POST /walk: mode를 안 주면 예전처럼 도보 한 번 호출, 이상한 mode는 400', async () => {
  const s = await serve();
  try {
    const r = await s.post({ placeIds: ['a', 'c'] });
    assert.equal(r.status, 200);
    assert.equal(r.body.mode, 'walk');
    assert.equal(r.body.segments, undefined);
    assert.equal(s.calls.transit.length, 0);
    assert.equal((await s.post({ placeIds: ['a', 'c'], mode: 'taxi' })).status, 400);
  } finally { s.close(); }
});

test('POST /walk mode=transit: 내 위치에서 출발하면 첫 구간이 내 위치 → 첫 장소다', async () => {
  const s = await serve();
  try {
    const r = await s.post({ placeIds: ['c'], mode: 'transit', latitude: 35.8714, longitude: 128.5939 });
    assert.equal(r.body.startIncluded, true);
    assert.equal(r.body.segments[0].type, 'transit');
    assert.equal(s.calls.transit.length, 1);
  } finally { s.close(); }
});
