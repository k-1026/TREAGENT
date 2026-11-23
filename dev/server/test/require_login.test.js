import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createRequireLogin } from '../src/auth/require_login.js';
import { createWeatherService } from '../src/weather/index.js';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const GOOD_TOKEN = 'Bearer good-token';
const COORD = { latitude: 35.8714, longitude: 128.6014 };

// 검증기를 흉내 낸다. "good-token"만 통과시키고, 받은 헤더를 기억해 두었다가 검사한다.
function fakeVerifier() {
  const seen = [];
  return {
    seen,
    verify: async (header) => {
      seen.push(header);
      return header === GOOD_TOKEN ? { ok: true, userId: USER_ID } : { ok: false };
    },
  };
}

async function withServer(tokenVerifier, run) {
  const original = console.log;
  console.log = () => {}; // 요청 로그는 테스트 출력에서 숨긴다
  const server = createApp({
    weatherService: createWeatherService({ source: 'mock' }),
    placeLoader: async () => ({ ok: true, places: [] }),
    courseLoader: async () => ({ ok: true, courses: [] }),
    tokenVerifier,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
  } finally {
    console.log = original;
    await new Promise((resolve) => server.close(resolve));
  }
}

const post = (base, path, body, token) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: token } : {}) },
    body: JSON.stringify(body),
  });

// 로그인이 필요한 네 가지 주소. 비용이 드는 외부 호출(LLM, T맵, 기상청)이 이 뒤에 있다.
const GUARDED = [
  { name: '/weather', call: (base, token) => post(base, '/weather', COORD, token) },
  { name: '/recommend', call: (base, token) => post(base, '/recommend', COORD, token) },
  { name: '/courses', call: (base, token) => fetch(`${base}/courses`, { headers: token ? { Authorization: token } : {} }) },
  { name: '/walk', call: (base, token) => post(base, '/walk', { placeIds: ['J01', 'J02'] }, token) },
];

for (const g of GUARDED) {
  test(`${g.name}: 토큰이 없으면 401 UNAUTHORIZED`, async () => {
    await withServer(fakeVerifier(), async (base) => {
      const res = await g.call(base, undefined);
      assert.equal(res.status, 401);
      assert.deepEqual(await res.json(), { error: 'UNAUTHORIZED' });
    });
  });

  test(`${g.name}: 틀린 토큰도 401`, async () => {
    await withServer(fakeVerifier(), async (base) => {
      const res = await g.call(base, 'Bearer wrong');
      assert.equal(res.status, 401);
    });
  });

  test(`${g.name}: 로그인 설정이 없으면 열어 두지 않고 503 AUTH_NOT_CONFIGURED`, async () => {
    await withServer(null, async (base) => {
      const res = await g.call(base, GOOD_TOKEN);
      assert.equal(res.status, 503);
      assert.deepEqual(await res.json(), { error: 'AUTH_NOT_CONFIGURED' });
    });
  });

  test(`${g.name}: 맞는 토큰이면 로그인 검사를 통과한다 (401·503이 아니다)`, async () => {
    await withServer(fakeVerifier(), async (base) => {
      const res = await g.call(base, GOOD_TOKEN);
      assert.notEqual(res.status, 401);
      assert.notEqual(res.status, 503);
    });
  });
}

test('/health는 로그인 없이 열려 있다', async () => {
  await withServer(fakeVerifier(), async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
  });
});

test('사전 확인(OPTIONS)은 토큰 없이도 204다 (브라우저는 토큰을 붙이지 않는다)', async () => {
  await withServer(fakeVerifier(), async (base) => {
    const res = await fetch(`${base}/weather`, { method: 'OPTIONS' });
    assert.equal(res.status, 204);
  });
});

test('없는 경로는 로그인 검사 없이 404 (기존 동작 유지)', async () => {
  await withServer(fakeVerifier(), async (base) => {
    const res = await fetch(`${base}/nope`);
    assert.equal(res.status, 404);
  });
});

test('검증기에는 Authorization 헤더 값이 그대로 전달된다', async () => {
  const verifier = fakeVerifier();
  await withServer(verifier, async (base) => {
    await post(base, '/weather', COORD, GOOD_TOKEN);
  });
  assert.deepEqual(verifier.seen, [GOOD_TOKEN]);
});

test('통과하면 req.userId에 사용자 id가 들어간다', async () => {
  const mw = createRequireLogin(fakeVerifier());
  const req = { get: () => GOOD_TOKEN };
  let nextCalled = false;
  await mw(req, {}, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.userId, USER_ID);
});

test('실패 응답에는 토큰이나 사용자 id가 들어가지 않는다', async () => {
  await withServer(fakeVerifier(), async (base) => {
    const res = await post(base, '/weather', COORD, 'Bearer secret-token-xyz');
    const text = await res.text();
    assert.ok(!text.includes('secret-token-xyz'));
    assert.ok(!text.includes(USER_ID));
  });
});
