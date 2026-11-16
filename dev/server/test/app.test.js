// Node 내장 테스트 도구. test()로 테스트를 등록한다.
import test from 'node:test';
// 값이 기대와 같은지 검사하는 도구. strict는 엄격한 비교(===)를 쓴다.
import assert from 'node:assert/strict';
// 테스트할 대상: 서버를 만드는 함수
import { createApp } from '../src/app.js';

// 도우미 함수: 서버를 켜고, 받은 함수(run)를 실행하고, 서버를 끈다.
// 서버가 찍은 로그(console.log 출력)를 모아서 돌려준다.
async function withServer(run) {
  const logs = [];
  const original = console.log;
  // console.log를 가로채서 출력 대신 logs 배열에 담는다 (서버 로그를 검사하기 위해)
  console.log = (...args) => logs.push(args.join(' '));

  const server = createApp();
  // 포트 0은 "비어 있는 포트를 아무거나 골라 달라"는 뜻이다. 실행 중인 서버와 충돌하지 않는다.
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await run(base);
    // 응답 직후 로그가 찍히는 시간을 한 박자 기다려 준다.
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    // 오류가 나도 반드시 원래대로 되돌리고 서버를 닫는다.
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
  const FAKE_LAT = '37.1234567';
  const FAKE_LNG = '128.7654321';

  const logs = await withServer(async (base) => {
    // ① 쿼리스트링에 좌표
    await fetch(`${base}/health?lat=${FAKE_LAT}&lng=${FAKE_LNG}`);
    // ② 정상 JSON 본문에 좌표
    await fetch(`${base}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: FAKE_LAT, longitude: FAKE_LNG }),
    });
    // ③ 깨진 JSON 본문에 좌표 (에러 처리 경로)
    await fetch(`${base}/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: `{"latitude": ${FAKE_LAT}, 깨진 JSON`,
    });
  });

  // 로그가 하나도 없으면 "없다"는 검사가 의미 없으니 먼저 확인한다.
  assert.ok(logs.length >= 3, '로그가 한 줄도 없으면 검사가 의미 없다');
  const all = logs.join('\n');
  // 좌표 문자열이 로그 어디에도 없어야 한다.
  assert.ok(!all.includes(FAKE_LAT), '위도 값이 로그에 있다');
  assert.ok(!all.includes(FAKE_LNG), '경도 값이 로그에 있다');
});