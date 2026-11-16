import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createWeatherService } from '../src/weather/index.js';

const NOW = () => new Date('2026-11-16T05:30:00Z'); // 한국 시간 14:30 (월)
const fast = { sleep: () => Promise.resolve(), random: () => 0 };

// 서버를 켜고 콜백을 실행한 뒤 닫는다. 서버가 찍은 로그도 모아서 돌려준다.
async function withServer(appOptions, run) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  const server = createApp(appOptions);
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

const mockApp = (scenario = 'ok') => ({
  weatherService: createWeatherService({ source: 'mock', scenario, now: NOW, clientDeps: fast }),
});

const post = (base, body, raw = false) =>
  fetch(`${base}/weather`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });

const LAT = 35.1234567; // 가짜 테스트 좌표 (눈에 띄는 자릿수)
const LNG = 128.7654321;

test('정상 좌표는 200과 날씨 값', async () => {
  await withServer(mockApp(), async (base) => {
    const res = await post(base, { latitude: LAT, longitude: LNG });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.temperatureC, 20);
    assert.equal(body.source, 'mock');
  });
});

test('숫자가 아닌 좌표는 400 INVALID_INPUT이고 입력값을 되돌려 주지 않는다', async () => {
  await withServer(mockApp(), async (base) => {
    const res = await post(base, { latitude: '35.1234567', longitude: LNG });
    assert.equal(res.status, 400);
    const text = await res.text();
    assert.deepEqual(JSON.parse(text), { error: 'INVALID_INPUT' });
    assert.ok(!text.includes('35.1234567'));
  });
});

test('한국 범위 밖 좌표는 400', async () => {
  await withServer(mockApp(), async (base) => {
    const res = await post(base, { latitude: 51.5, longitude: -0.12 }); // 런던 근처
    assert.equal(res.status, 400);
  });
});

test('본문이 없으면 400', async () => {
  await withServer(mockApp(), async (base) => {
    const res = await fetch(`${base}/weather`, { method: 'POST' });
    assert.equal(res.status, 400);
  });
});

test('깨진 JSON은 400 BAD_REQUEST', async () => {
  await withServer(mockApp(), async (base) => {
    const res = await post(base, `{"latitude": ${LAT}, 깨진`, true);
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'BAD_REQUEST' });
  });
});

test('날씨를 못 얻어도 200과 status unavailable', async () => {
  await withServer(mockApp('http_error'), async (base) => {
    const res = await post(base, { latitude: LAT, longitude: LNG });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'unavailable', reason: 'HTTP_ERROR' });
  });
});

test('어떤 경우에도 좌표는 로그에 남지 않는다 (예외 메시지에 좌표가 있어도)', async () => {
  // 일부러 좌표가 들어간 메시지로 예외를 던지는 서비스
  const throwing = { getWeather: async ({ latitude }) => { throw new Error(`boom ${latitude}`); } };
  const logs = [];
  logs.push(...(await withServer(mockApp(), async (base) => {
    await post(base, { latitude: LAT, longitude: LNG }); // 정상
    await post(base, { latitude: String(LAT), longitude: LNG }); // 잘못된 입력
    await post(base, { latitude: 60, longitude: LNG }); // 범위 밖
    await post(base, `{"latitude": ${LAT}, 깨진`, true); // 깨진 JSON
    await fetch(`${base}/weather?lat=${LAT}&lng=${LNG}`, { method: 'POST' }); // 쿼리에 좌표
  })));
  let status;
  logs.push(...(await withServer({ weatherService: throwing }, async (base) => {
    const res = await post(base, { latitude: LAT, longitude: LNG });
    status = res.status;
  })));
  assert.equal(status, 500); // 예외는 500으로 처리되고
  assert.ok(logs.length >= 6, '로그가 있어야 검사가 의미 있다');
  const all = logs.join('\n');
  assert.ok(!all.includes('35.1234567'), '위도가 로그에 있다');
  assert.ok(!all.includes('128.7654321'), '경도가 로그에 있다');
});