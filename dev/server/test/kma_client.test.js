import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchForecast, KmaError } from '../src/weather/kma_client.js';

const params = { nx: 89, ny: 90, baseDate: '20261116', baseTime: '1400' };

// 응답 만들기 도우미
const okRes = (items) =>
  new Response(
    JSON.stringify({
      response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { items: { item: items } } },
    }),
  );
const codeRes = (code) =>
  new Response(JSON.stringify({ response: { header: { resultCode: code, resultMsg: 'x' } } }));

// 가짜 fetch: 호출될 때마다 steps의 다음 항목을 실행한다. 마지막 항목은 계속 반복한다.
function fakeFetch(steps) {
  const f = async () => {
    const step = steps[Math.min(f.calls, steps.length - 1)];
    f.calls += 1;
    return step();
  };
  f.calls = 0;
  return f;
}

// 기다리지 않는 가짜 sleep, 무작위를 없앤 random. 테스트가 빨라진다.
const fast = { sleep: () => Promise.resolve(), random: () => 0, serviceKey: 'TEST_KEY' };

const timeoutError = () => new DOMException('timeout', 'TimeoutError');
const itemsSample = [{ category: 'TMP', fcstDate: '20261116', fcstTime: '1500', fcstValue: '20' }];

async function expectKind(promise, kind) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof KmaError);
    assert.equal(err.kind, kind);
    return true;
  });
}

test('정상 응답은 items를 돌려주고 1번만 호출한다', async () => {
  const f = fakeFetch([() => okRes(itemsSample)]);
  const items = await fetchForecast(params, { ...fast, fetchImpl: f });
  assert.deepEqual(items, itemsSample);
  assert.equal(f.calls, 1);
});

test('500이 두 번 나와도 세 번째에 성공하면 성공', async () => {
  const f = fakeFetch([() => new Response('', { status: 500 }), () => new Response('', { status: 500 }), () => okRes(itemsSample)]);
  const items = await fetchForecast(params, { ...fast, fetchImpl: f });
  assert.equal(items.length, 1);
  assert.equal(f.calls, 3);
});

test('계속 500이면 3번 시도 후 HTTP_ERROR', async () => {
  const f = fakeFetch([() => new Response('', { status: 500 })]);
  await expectKind(fetchForecast(params, { ...fast, fetchImpl: f }), 'HTTP_ERROR');
  assert.equal(f.calls, 3);
});

test('결과 코드 22는 재시도하고 이후 성공하면 성공', async () => {
  const f = fakeFetch([() => codeRes('22'), () => okRes(itemsSample)]);
  await fetchForecast(params, { ...fast, fetchImpl: f });
  assert.equal(f.calls, 2);
});

test('결과 코드 03은 재시도 없이 NO_DATA', async () => {
  const f = fakeFetch([() => codeRes('03')]);
  await expectKind(fetchForecast(params, { ...fast, fetchImpl: f }), 'NO_DATA');
  assert.equal(f.calls, 1);
});

test('모르는 결과 코드는 재시도 없이 UPSTREAM_ERROR', async () => {
  const f = fakeFetch([() => codeRes('99')]);
  await expectKind(fetchForecast(params, { ...fast, fetchImpl: f }), 'UPSTREAM_ERROR');
  assert.equal(f.calls, 1);
});

test('시간 초과는 3번 시도 후 TIMEOUT', async () => {
  const f = fakeFetch([() => { throw timeoutError(); }]);
  await expectKind(fetchForecast(params, { ...fast, fetchImpl: f }), 'TIMEOUT');
  assert.equal(f.calls, 3);
});

test('깨진 JSON은 재시도 없이 BAD_RESPONSE', async () => {
  const f = fakeFetch([() => new Response('깨진 응답')]);
  await expectKind(fetchForecast(params, { ...fast, fetchImpl: f }), 'BAD_RESPONSE');
  assert.equal(f.calls, 1);
});

test('인증키가 없으면 호출하지 않고 MISSING_KEY', async () => {
  const f = fakeFetch([() => okRes(itemsSample)]);
  await expectKind(fetchForecast(params, { ...fast, serviceKey: '', fetchImpl: f }), 'MISSING_KEY');
  assert.equal(f.calls, 0);
});

test('에러 메시지에 인증키나 주소가 들어 있지 않다', async () => {
  const f = fakeFetch([() => new Response('', { status: 500 })]);
  await assert.rejects(fetchForecast(params, { ...fast, serviceKey: 'SECRET_KEY_123', fetchImpl: f }), (err) => {
    const text = `${err.message} ${err.stack}`;
    assert.ok(!text.includes('SECRET_KEY_123'), '인증키가 에러에 있다');
    assert.ok(!text.includes('apis.data.go.kr'), '주소가 에러에 있다');
    return true;
  });
});