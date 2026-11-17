import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createWeatherService } from '../src/weather/index.js';

const NOW = () => new Date('2026-11-16T05:30:00Z'); // 한국 14:30, 월요일
const fast = { sleep: () => Promise.resolve(), random: () => 0 };

const place = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'outdoor', openHour: null, closeHour: null,
  closedWeekdays: [], modeAllowed: null, status: 'open', ...o,
});
const PLACES = [
  place({ id: 'a', name: '야외', type: 'outdoor' }),
  place({ id: 'b', name: '전시', district: '수성구', type: 'exhibit', openHour: 9, closeHour: 18 }),
  place({ id: 'c', name: '월요휴관', type: 'exhibit', closedWeekdays: [1] }),
];
const okLoader = async () => ({ ok: true, places: PLACES });

async function withServer(scenario, placeLoader, run) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  const server = createApp({
    weatherService: createWeatherService({ source: 'mock', scenario, now: NOW, clientDeps: fast }),
    placeLoader,
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

const call = (base, body) =>
  fetch(`${base}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const COORD = { latitude: 35.8714, longitude: 128.6014 };
const ids = (json) => json.places.map((p) => p.id);

test('20℃는 EXPLORE: 야외·전시, 월요 휴관은 제외', async () => {
  await withServer('ok', okLoader, async (base) => {
    const json = await (await call(base, COORD)).json();
    assert.equal(json.mode, 'EXPLORE');
    assert.deepEqual(ids(json), ['a', 'b']);
    assert.equal(json.selection, 'OK');
  });
});

test('30℃는 SHADE: 야외 제외', async () => {
  await withServer('hot', okLoader, async (base) => {
    const json = await (await call(base, COORD)).json();
    assert.equal(json.mode, 'SHADE');
    assert.deepEqual(ids(json), ['b']);
  });
});

test('35℃는 INDOOR', async () => {
  await withServer('very_hot', okLoader, async (base) => {
    const json = await (await call(base, COORD)).json();
    assert.equal(json.mode, 'INDOOR');
    assert.deepEqual(ids(json), ['b']);
  });
});

test('district를 보내면 그 구·군이 앞에 온다', async () => {
  await withServer('ok', okLoader, async (base) => {
    const json = await (await call(base, { ...COORD, district: '수성구' })).json();
    assert.deepEqual(ids(json), ['b', 'a']);
  });
});

test('날씨를 못 얻으면 200과 UNKNOWN 모드', async () => {
  await withServer('http_error', okLoader, async (base) => {
    const res = await call(base, COORD);
    const json = await res.json();
    assert.equal(res.status, 200);
    assert.equal(json.mode, 'UNKNOWN');
    assert.deepEqual(json.weather, { status: 'unavailable' });
    assert.deepEqual(ids(json), ['b']);
  });
});

test('장소 DB를 못 읽으면 503 PLACES_UNAVAILABLE', async () => {
  const failing = async () => ({ ok: false, reason: 'PLACES_UNAVAILABLE' });
  await withServer('ok', failing, async (base) => {
    const res = await call(base, COORD);
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error, 'PLACES_UNAVAILABLE');
  });
});

test('잘못된 입력은 400 INVALID_INPUT', async () => {
  await withServer('ok', okLoader, async (base) => {
    for (const body of [
      {},
      { latitude: '35.8', longitude: 128.6 },
      { ...COORD, previousMode: 'NOPE' },
      { ...COORD, district: 123 },
      { ...COORD, district: '' },
    ]) {
      const res = await call(base, body);
      assert.equal(res.status, 400);
      assert.deepEqual(await res.json(), { error: 'INVALID_INPUT' });
    }
  });
});

test('응답과 로그에 좌표가 없다', async () => {
  let text = '';
  const logs = await withServer('ok', okLoader, async (base) => {
    text = await (await call(base, COORD)).text();
  });
  assert.ok(!text.includes('35.87') && !text.includes('128.60'));
  assert.ok(!logs.join('\n').includes('35.87') && !logs.join('\n').includes('128.60'));
});