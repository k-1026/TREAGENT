import test from 'node:test';
import assert from 'node:assert/strict';
import { createWeatherService } from '../src/weather/index.js';
import { createMockFetch } from '../src/weather/mock_source.js';

// 한국 시간 2026-11-16 14:30 (월요일) 에 고정한다. 한국 시간 = UTC + 9시간.
const NOW = () => new Date('2026-11-16T05:30:00Z');
const fast = { sleep: () => Promise.resolve(), random: () => 0 };
const DAEGU = { latitude: 35.8714, longitude: 128.6014 }; // 가짜 테스트 좌표

function mockService(scenario) {
  return createWeatherService({ source: 'mock', scenario, now: NOW, clientDeps: fast });
}

// 시나리오별 기대 결과. 값이 정상인 시나리오는 기온을, 실패인 시나리오는 이유 코드를 확인한다.
const cases = [
  { scenario: 'ok', expect: { status: 'ok', temperatureC: 20 } },
  { scenario: 'hot', expect: { status: 'ok', temperatureC: 30 } },
  { scenario: 'very_hot', expect: { status: 'ok', temperatureC: 35 } },
  { scenario: 'missing_value', expect: { status: 'unavailable', reason: 'MISSING_VALUE' } },
  { scenario: 'rate_limited', expect: { status: 'unavailable', reason: 'RATE_LIMITED' } },
  { scenario: 'no_data', expect: { status: 'unavailable', reason: 'NO_DATA' } },
  { scenario: 'http_error', expect: { status: 'unavailable', reason: 'HTTP_ERROR' } },
  { scenario: 'timeout', expect: { status: 'unavailable', reason: 'TIMEOUT' } },
  { scenario: 'bad_json', expect: { status: 'unavailable', reason: 'BAD_RESPONSE' } },
];

for (const { scenario, expect } of cases) {
  test(`mock 시나리오 ${scenario}`, async () => {
    const r = await mockService(scenario).getWeather(DAEGU);
    for (const [k, v] of Object.entries(expect)) assert.equal(r[k], v);
  });
}

test('정상 결과의 모양: 시각·요일·출처·체감온도', async () => {
  const r = await mockService('ok').getWeather(DAEGU);
  assert.equal(r.hour, 15); // 14:30 이후 첫 예보는 15시
  assert.equal(r.dayOfWeek, 1); // 월요일
  assert.equal(r.baseTime, '2026-11-16T14:00:00+09:00');
  assert.equal(r.source, 'mock');
  assert.equal(r.apparentTemperatureC, null);
});

// source가 kma일 때는 fetch를 직접 넣을 수 있다. 호출 횟수를 세기 위한 가짜 fetch.
function countingService(scenario) {
  const inner = createMockFetch(scenario);
  const spy = (...args) => { spy.calls += 1; return inner(...args); };
  spy.calls = 0;
  const service = createWeatherService({
    source: 'kma', fetchImpl: spy, now: NOW, clientDeps: { ...fast, serviceKey: 'TEST_KEY' },
  });
  return { service, spy };
}

test('같은 격자·같은 발표분은 기상청을 한 번만 호출한다', async () => {
  const { service, spy } = countingService('ok');
  await service.getWeather(DAEGU);
  await service.getWeather(DAEGU);
  assert.equal(spy.calls, 1);
});

test('같은 격자 안의 다른 좌표도 캐시를 같이 쓴다', async () => {
  const { service, spy } = countingService('ok');
  await service.getWeather({ latitude: 35.8714, longitude: 128.6014 });
  await service.getWeather({ latitude: 35.8715, longitude: 128.6015 });
  assert.equal(spy.calls, 1);
});

test('실패도 잠깐 기억해서 연속 요청이 기상청을 또 부르지 않는다', async () => {
  const { service, spy } = countingService('http_error');
  await service.getWeather(DAEGU);
  await service.getWeather(DAEGU);
  assert.equal(spy.calls, 3); // 첫 요청의 시도 3번(처음 + 재시도 2번)뿐, 두 번째 요청은 호출 없음
});

test('kma 모드에서 인증키가 없으면 MISSING_KEY', async () => {
  const service = createWeatherService({
    source: 'kma', fetchImpl: createMockFetch('ok'), now: NOW, clientDeps: { ...fast, serviceKey: '' },
  });
  const r = await service.getWeather(DAEGU);
  assert.deepEqual(r, { status: 'unavailable', reason: 'MISSING_KEY' });
});

test('WEATHER_SOURCE가 잘못되면 시작할 때 오류', () => {
  assert.throws(() => createWeatherService({ source: 'typo' }));
});