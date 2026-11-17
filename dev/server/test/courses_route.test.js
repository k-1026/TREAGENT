import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createWeatherService } from '../src/weather/index.js';

const NOW = () => new Date('2026-11-16T05:30:00Z'); // 한국 14:30, 월요일
const fast = { sleep: () => Promise.resolve(), random: () => 0 };

const P = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'outdoor', openHour: null, closeHour: null,
  closedWeekdays: [], status: 'open', hoursText: null, closedText: null, caution: null, ...o,
});
const PLACES = [
  P({ id: 'J03', name: '동성로' }),
  P({ id: 'J04', name: '근대골목' }),
  P({ id: 'J01', name: '약령시', type: 'exhibit', openHour: 9, closeHour: 18 }),
  P({ id: 'J21', name: '향토역사관', type: 'exhibit', openHour: 9, closeHour: 18 }),
  P({ id: 'J09', name: '기념관', type: 'exhibit', openHour: 9, closeHour: 17 }),
];
const COURSE = {
  id: 'C01', title: '제목', theme: null, district: '중구', durationMin: 60,
  routes: { explore: ['J03', 'J04', 'J01'], indoor: ['J01', 'J21', 'J09'] },
};
const places = (list = PLACES) => async () => ({ ok: true, places: list });
const courses = async () => ({ ok: true, courses: [COURSE] });

async function withServer(scenario, loaders, run) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  const server = createApp({
    weatherService: createWeatherService({ source: 'mock', scenario, now: NOW, clientDeps: fast }),
    placeLoader: loaders.placeLoader ?? places(),
    courseLoader: loaders.courseLoader ?? courses,
    now: NOW,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.log = original;
    await new Promise((resolve) => server.close(resolve));
  }
  return logs;
}

const route = (base, id, body) =>
  fetch(`${base}/courses/${id}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const COORD = { latitude: 35.8714, longitude: 128.6014 };
const ids = (json) => json.stations.map((s) => s.id);

test('20℃는 EXPLORE: explore 경로 3곳과 기준 시각', async () => {
  await withServer('ok', {}, async (base) => {
    const json = await (await route(base, 'C01', COORD)).json();
    assert.equal(json.mode, 'EXPLORE');
    assert.equal(json.routeType, 'explore');
    assert.deepEqual(ids(json), ['J03', 'J04', 'J01']);
    assert.equal(json.available, true);
    assert.equal(json.asOf.hour, 14);
  });
});

test('35℃는 INDOOR: indoor 경로', async () => {
  await withServer('very_hot', {}, async (base) => {
    const json = await (await route(base, 'C01', COORD)).json();
    assert.equal(json.mode, 'INDOOR');
    assert.deepEqual(ids(json), ['J01', 'J21', 'J09']);
  });
});

test('30℃는 SHADE: shade 경로가 없어 indoor로 대신', async () => {
  await withServer('hot', {}, async (base) => {
    const json = await (await route(base, 'C01', COORD)).json();
    assert.equal(json.mode, 'SHADE');
    assert.equal(json.routeType, 'indoor');
  });
});

test('날씨를 못 얻으면 200, 경로 없음, WEATHER_UNAVAILABLE', async () => {
  await withServer('http_error', {}, async (base) => {
    const res = await route(base, 'C01', COORD);
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.mode, 'UNKNOWN');
    assert.equal(json.available, false);
    assert.equal(json.reason, 'WEATHER_UNAVAILABLE');
    assert.deepEqual(json.stations, []);
  });
});

test('경로의 장소가 쉬는 날이면 PLACE_CLOSED', async () => {
  const closedMonday = PLACES.map((p) => (p.id === 'J01' ? { ...p, closedWeekdays: [1] } : p));
  await withServer('ok', { placeLoader: places(closedMonday) }, async (base) => {
    const json = await (await route(base, 'C01', COORD)).json();
    assert.equal(json.available, false);
    assert.equal(json.reason, 'PLACE_CLOSED');
    assert.deepEqual(json.closedPlaceIds, ['J01']);
  });
});

test('없는 코스는 404', async () => {
  await withServer('ok', {}, async (base) => {
    const res = await route(base, 'NOPE', COORD);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'NOT_FOUND' });
  });
});

test('잘못된 입력은 400 INVALID_INPUT', async () => {
  await withServer('ok', {}, async (base) => {
    for (const body of [{}, { latitude: '35.8', longitude: 128.6 }, { ...COORD, previousMode: 'NOPE' }]) {
      const res = await route(base, 'C01', body);
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'INVALID_INPUT' });
    }
  });
});

test('코스나 장소 DB를 못 읽으면 503', async () => {
  const bad = async () => ({ ok: false, reason: 'COURSES_UNAVAILABLE' });
  await withServer('ok', { courseLoader: bad }, async (base) => {
    const res = await route(base, 'C01', COORD);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'COURSES_UNAVAILABLE');
  });
});

test('GET /courses는 코스 카드 정보와 장소 유형을 준다', async () => {
  await withServer('ok', {}, async (base) => {
    const json = await (await fetch(`${base}/courses`)).json();
    assert.deepEqual(json.courses, [
      { id: 'C01', title: '제목', theme: null, district: '중구', durationMin: 60, types: ['exhibit', 'outdoor'] },
    ]);
  });
});

test('응답과 로그에 좌표가 없다', async () => {
  let text = '';
  const logs = await withServer('ok', {}, async (base) => {
    text = await (await route(base, 'C01', COORD)).text();
  });
  assert.ok(!text.includes('35.87') && !text.includes('128.60'));
  assert.ok(!logs.join('\n').includes('35.87') && !logs.join('\n').includes('128.60'));
});