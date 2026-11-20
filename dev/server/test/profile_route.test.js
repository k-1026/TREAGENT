import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createWeatherService } from '../src/weather/index.js';
import { createComposeRoute } from '../src/ai/compose_route.js';
import { createMemoryProfileStore } from '../src/profile/memory_profile_store.js';

const fast = { sleep: () => Promise.resolve(), random: () => 0 };
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// 가짜 로그인 확인: "Bearer tok-숫자" 이면 그 숫자의 사용자로 본다.
const verifier = {
  verify: async (header) => {
    const m = /^Bearer tok-(\d+)$/.exec(header ?? '');
    return m ? { ok: true, userId: uid(Number(m[1])) } : { ok: false };
  },
};

// 서버를 띄우고 run(api)을 실행한다. api(n, method, body)는 tok-n 사용자로 /profile을 부른다.
async function withServer({ verifierOverride } = {}, run) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  const server = createApp({
    weatherService: createWeatherService({ source: 'mock', scenario: 'ok', clientDeps: fast }),
    placeLoader: async () => ({ ok: true, places: [] }),
    composeRoute: createComposeRoute({ llm: null }),
    profileStore: createMemoryProfileStore(),
    tokenVerifier: verifierOverride === undefined ? verifier : verifierOverride,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(n, method, body, path = '') {
    const res = await fetch(`${base}/profile${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(n === null ? {} : { Authorization: `Bearer tok-${n}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }
  try {
    await run(api);
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.log = original;
    await new Promise((resolve) => server.close(resolve));
  }
  return logs;
}

test('로그인이 없거나 틀리면 401, 확인 설정이 없으면 503', async () => {
  await withServer({}, async (api) => {
    assert.equal((await api(null, 'GET')).status, 401);
    assert.equal((await api(null, 'PUT', { ageGroup: '20s' })).status, 401);
  });
  await withServer({ verifierOverride: null }, async (api) => {
    const res = await api(1, 'GET');
    assert.equal(res.status, 503);
    assert.deepEqual(res.json, { error: 'AUTH_NOT_CONFIGURED' });
  });
});

test('프로필이 없으면 GET은 404 PROFILE_NOT_FOUND', async () => {
  await withServer({}, async (api) => {
    const res = await api(1, 'GET');
    assert.equal(res.status, 404);
    assert.deepEqual(res.json, { error: 'PROFILE_NOT_FOUND' });
  });
});

test('저장하면 그대로 읽힌다', async () => {
  await withServer({}, async (api) => {
    const saved = await api(1, 'PUT', { nickname: 'Mina_1', ageGroup: '30s' });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.json, { nickname: 'Mina_1', ageGroup: '30s' });
    assert.deepEqual((await api(1, 'GET')).json, { nickname: 'Mina_1', ageGroup: '30s' });
    assert.equal((await api(2, 'GET')).status, 404); // 다른 사람은 영향이 없다
  });
});

test('닉네임을 건너뛰면 null로 저장된다 (빈칸만 보내도 같다)', async () => {
  await withServer({}, async (api) => {
    assert.deepEqual((await api(1, 'PUT', { ageGroup: '20s' })).json, { nickname: null, ageGroup: '20s' });
    assert.deepEqual((await api(2, 'PUT', { nickname: '   ', ageGroup: '20s' })).json, { nickname: null, ageGroup: '20s' });
  });
});

test('이상한 입력은 400 INVALID_INPUT이고 입력값을 되돌려 주지 않는다', async () => {
  await withServer({}, async (api) => {
    for (const body of [
      {},
      { nickname: 'Mina' },
      { nickname: 'Mina', ageGroup: '70s' },
      { nickname: 'a', ageGroup: '20s' },
      { nickname: 'abcdefghijk', ageGroup: '20s' },
      { nickname: 'a b c', ageGroup: '20s' },
      { nickname: '미나😀', ageGroup: '20s' },
      { nickname: 'ㅋㅋㅋ', ageGroup: '20s' },
      { nickname: 7, ageGroup: '20s' },
    ]) {
      const res = await api(1, 'PUT', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(res.json, { error: 'INVALID_INPUT' });
    }
  });
});

test('다른 사람이 쓰는 닉네임은 409 NICKNAME_TAKEN (대소문자 무시)', async () => {
  await withServer({}, async (api) => {
    assert.equal((await api(1, 'PUT', { nickname: 'Mina', ageGroup: '20s' })).status, 200);
    const res = await api(2, 'PUT', { nickname: 'mina', ageGroup: '30s' });
    assert.equal(res.status, 409);
    assert.deepEqual(res.json, { error: 'NICKNAME_TAKEN' });
    assert.equal((await api(2, 'GET')).status, 404); // 실패하면 저장되지 않는다
  });
});

test('내 닉네임을 그대로 보내면서 나이대만 고칠 수 있다', async () => {
  await withServer({}, async (api) => {
    await api(1, 'PUT', { nickname: 'Mina', ageGroup: '20s' });
    assert.deepEqual((await api(1, 'PUT', { nickname: 'Mina', ageGroup: '40s' })).json, { nickname: 'Mina', ageGroup: '40s' });
    assert.deepEqual((await api(1, 'PUT', { ageGroup: '50s' })).json, { nickname: 'Mina', ageGroup: '50s' }); // 생략하면 유지
  });
});

test('닉네임을 한 번 정하면 바꿀 수 없다 (409 NICKNAME_LOCKED)', async () => {
  await withServer({}, async (api) => {
    await api(1, 'PUT', { nickname: 'Mina', ageGroup: '20s' });
    const res = await api(1, 'PUT', { nickname: 'Dana', ageGroup: '20s' });
    assert.equal(res.status, 409);
    assert.deepEqual(res.json, { error: 'NICKNAME_LOCKED' });
    assert.equal((await api(1, 'GET')).json.nickname, 'Mina');
  });
});

test('건너뛴 사람은 나중에 한 번 정할 수 있고, 그다음부터는 바꿀 수 없다', async () => {
  await withServer({}, async (api) => {
    await api(1, 'PUT', { ageGroup: '20s' });
    assert.equal((await api(1, 'PUT', { nickname: 'Dana', ageGroup: '20s' })).status, 200);
    assert.equal((await api(1, 'PUT', { nickname: 'Eve', ageGroup: '20s' })).status, 409);
  });
});

test('로그에 닉네임이 남지 않는다', async () => {
  const logs = await withServer({}, async (api) => {
    await api(1, 'PUT', { nickname: 'SecretName', ageGroup: '20s' });
    await api(2, 'PUT', { nickname: 'secretname', ageGroup: '20s' });
  });
  assert.ok(!logs.join('\n').includes('SecretName'));
  assert.ok(!logs.join('\n').toLowerCase().includes('secretname'));
});

// ---- 닉네임 중복 확인 ----
test('닉네임 확인: 남이 쓰면 false(대소문자 무시), 비어 있으면 true, 내 이름이면 true', async () => {
  await withServer({}, async (api) => {
    await api(1, 'PUT', { nickname: 'Mina', ageGroup: '20s' });
    assert.deepEqual((await api(2, 'POST', { nickname: 'mina' }, '/check')).json, { available: false });
    assert.deepEqual((await api(2, 'POST', { nickname: 'Dana' }, '/check')).json, { available: true });
    assert.deepEqual((await api(1, 'POST', { nickname: 'Mina' }, '/check')).json, { available: true });
  });
});

test('닉네임 확인: 규칙에 맞지 않으면 400, 로그인이 없으면 401', async () => {
  await withServer({}, async (api) => {
    for (const body of [{}, { nickname: 7 }, { nickname: 'a' }, { nickname: 'a b c' }, { nickname: '미나😀' }]) {
      const res = await api(1, 'POST', body, '/check');
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.deepEqual(res.json, { error: 'INVALID_INPUT' });
    }
    assert.equal((await api(null, 'POST', { nickname: 'Mina' }, '/check')).status, 401);
  });
});

test('닉네임 확인: 너무 자주 하면 429 (이름 알아내기 방지)', async () => {
  await withServer({}, async (api) => {
    for (let i = 0; i < 30; i += 1) {
      assert.equal((await api(1, 'POST', { nickname: 'Mina' }, '/check')).status, 200);
    }
    const over = await api(1, 'POST', { nickname: 'Mina' }, '/check');
    assert.equal(over.status, 429);
    assert.deepEqual(over.json, { error: 'TOO_MANY_ATTEMPTS' });
    assert.equal((await api(2, 'POST', { nickname: 'Mina' }, '/check')).status, 200); // 다른 사용자는 영향이 없다
  });
});

test('닉네임 확인 요청도 로그에 닉네임이 남지 않는다', async () => {
  const logs = await withServer({}, async (api) => {
    await api(1, 'POST', { nickname: 'SecretName' }, '/check');
  });
  assert.ok(!logs.join('\n').toLowerCase().includes('secretname'));
});