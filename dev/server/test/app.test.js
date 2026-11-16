// [app.test.js] /health 응답과 "좌표가 로그에 남지 않음"을 확인하는 테스트
// 실행: dev/server 에서 npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

// 서버를 임의 포트로 열고 콜백을 실행한 뒤 닫는다. console.log 출력도 모아서 돌려준다.
async function withServer(run) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  const server = createApp();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
    // finish 이벤트 로그가 찍힐 시간을 한 틱 준다
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.log = original;
    await new Promise((resolve) => server.close(resolve));
  }
  return logs;
}

test('GET /health 는 200과 ok를 돌려준다', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

test('없는 경로는 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
  });
});

test('쿼리스트링과 본문의 가짜 좌표는 로그에 남지 않는다', async () => {
  const FAKE = '37.1234567';
  const logs = await withServer(async (base) => {
    await fetch(`${base}/health?lat=${FAKE}&lng=128.7654321`);
    await fetch(`${base}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: FAKE, longitude: '128.7654321' }),
    });
    await fetch(`${base}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: `{"latitude": ${FAKE}, 깨진 JSON`,
    });
  });
  assert.ok(logs.length >= 3, '로그가 한 줄도 없으면 검사가 의미 없다');
  const all = logs.join('\n');
  assert.ok(!all.includes(FAKE), '위도 값이 로그에 있다');
  assert.ok(!all.includes('128.7654321'), '경도 값이 로그에 있다');
});
