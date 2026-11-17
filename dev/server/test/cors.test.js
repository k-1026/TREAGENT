import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createWeatherService } from '../src/weather/index.js';

const WEB = 'http://localhost:8081';

// 서버를 켜고 콜백을 실행한 뒤 닫는다. CORS_ORIGIN을 임시로 바꾸고 끝나면 되돌린다.
async function withServer(corsOrigin, run) {
  const before = process.env.CORS_ORIGIN;
  if (corsOrigin === undefined) delete process.env.CORS_ORIGIN;
  else process.env.CORS_ORIGIN = corsOrigin;
  const original = console.log;
  console.log = () => {}; // 요청 로그는 테스트 출력에서 숨긴다
  const server = createApp({
    weatherService: createWeatherService({ source: 'mock' }),
    placeLoader: async () => ({ ok: true, places: [] }),
    courseLoader: async () => ({ ok: true, courses: [] }),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
  } finally {
    console.log = original;
    await new Promise((resolve) => server.close(resolve));
    if (before === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = before;
  }
}

test('CORS_ORIGIN과 같은 주소의 요청에는 허용 헤더를 준다', async () => {
  await withServer(WEB, async (base) => {
    const res = await fetch(`${base}/health`, { headers: { Origin: WEB } });
    assert.equal(res.headers.get('access-control-allow-origin'), WEB);
  });
});

test('다른 주소의 요청에는 허용 헤더를 주지 않는다', async () => {
  await withServer(WEB, async (base) => {
    const res = await fetch(`${base}/health`, { headers: { Origin: 'http://evil.example' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});

test('CORS_ORIGIN이 없으면 아무 곳도 허용하지 않는다', async () => {
  await withServer(undefined, async (base) => {
    const res = await fetch(`${base}/health`, { headers: { Origin: WEB } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });
});

test('사전 확인(OPTIONS)은 204로 답하고 허용 메서드·헤더를 알려 준다', async () => {
  await withServer(WEB, async (base) => {
    const res = await fetch(`${base}/weather`, {
      method: 'OPTIONS',
      headers: { Origin: WEB, 'Access-Control-Request-Method': 'POST' },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('access-control-allow-origin'), WEB);
    assert.match(res.headers.get('access-control-allow-methods'), /POST/);
    assert.match(res.headers.get('access-control-allow-headers'), /Content-Type/);
  });
});
