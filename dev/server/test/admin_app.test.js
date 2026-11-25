import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/admin/admin_session.js';

// createApp이 읽는 환경변수를 잠깐 바꿔서 서버를 켜고, 끝나면 되돌린다.
async function withEnv(env, run, { verifier = null } = {}) {
  const keys = ['ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'ADMIN_DEV_OPEN', 'DATABASE_URL', 'RUN_KEY_SECRET'];
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, env);
  const server = createApp({ tokenVerifier: verifier });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((r) => server.close(r));
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}

test('관리자 설정이 없으면 /admin/api는 503이고 다른 경로는 그대로다', async () => {
  await withEnv({}, async (base) => {
    assert.equal((await fetch(`${base}/admin/api/runs`)).status, 503);
    assert.equal((await fetch(`${base}/admin/api/session`)).status, 503);
    assert.equal((await fetch(`${base}/health`)).status, 200);
  });
});

test('서버 변수로 관리자 계정을 넣으면 그 아이디·비밀번호로 로그인해서 /admin/api를 쓴다', async () => {
  const password = 'correct horse battery';
  const env = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: await hashPassword(password), ADMIN_SESSION_SECRET: 's'.repeat(40) };
  await withEnv(env, async (base) => {
    assert.equal((await fetch(`${base}/admin/api/runs`)).status, 401);
    const bad = await fetch(`${base}/admin/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'wrong password!!' }) });
    assert.equal(bad.status, 401);
    const ok = await fetch(`${base}/admin/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password }) });
    assert.equal(ok.status, 200);
    const cookie = ok.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(`${base}/admin/api/runs`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await fetch(`${base}/health`)).status, 200);
  });
});

test('앱 이용자의 로그인 토큰(Bearer)으로는 /admin/api에 들어갈 수 없다', async () => {
  const env = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: await hashPassword('correct horse battery'), ADMIN_SESSION_SECRET: 's'.repeat(40) };
  await withEnv(env, async (base) => {
    assert.equal((await fetch(`${base}/admin/api/runs`, { headers: { Authorization: 'Bearer good' } })).status, 401);
  }, { verifier: { verify: async () => ({ ok: true, userId: 'user-1' }) } });
});

test('ADMIN_DEV_OPEN=true이면 이 컴퓨터에서 /admin이 열리고, DB 없이 메모리 저장소로 돈다', async () => {
  await withEnv({ ADMIN_DEV_OPEN: 'true' }, async (base) => {
    assert.equal((await fetch(`${base}/admin/`)).status, 200);
    const health = await (await fetch(`${base}/admin/api/health`)).json();
    assert.deepEqual(health, { store: 'memory', recorderFailures: 0, activeRuns: 0 });
  });
});

// 로그인 확인을 통과한 요청이 접속 현황에 잡히는지: 'good' 토큰은 user-1, 'other'는 user-2
const VERIFIER = {
  verify: async (header) => (header === 'Bearer good' ? { ok: true, userId: 'user-1' } : header === 'Bearer other' ? { ok: true, userId: 'user-2' } : { ok: false }),
};

test('앱 요청이 로그인 확인을 통과하면 접속 현황에 해시 키로만 잡힌다 (원본 id 없음, 실패한 로그인은 안 잡힘)', async () => {
  await withEnv({ ADMIN_DEV_OPEN: 'true', RUN_KEY_SECRET: 'secret-xyz' }, async (base) => {
    await fetch(`${base}/walk/anything`, { headers: { Authorization: 'Bearer good' } });
    await fetch(`${base}/walk/anything`, { headers: { Authorization: 'Bearer good' } });
    await fetch(`${base}/walk/anything`, { headers: { Authorization: 'Bearer other' } });
    await fetch(`${base}/walk/anything`, { headers: { Authorization: 'Bearer nope' } });
    await fetch(`${base}/walk/anything`);
    const body = await (await fetch(`${base}/admin/api/presence`)).json();
    assert.equal(body.stable, true);
    assert.deepEqual(body.counts, { connected: 2, using: 0, recent: 0, idle: 2 });
    const text = JSON.stringify(body);
    assert.ok(!text.includes('user-1') && !text.includes('user-2'));
  }, { verifier: VERIFIER });
});

test('관리자 화면 요청은 접속 현황에 잡히지 않는다 (관리자 본인은 세지 않음)', async () => {
  await withEnv({ ADMIN_DEV_OPEN: 'true' }, async (base) => {
    // 관리자 화면을 여러 번 불러도 접속자가 늘지 않는다 (앱 로그인 확인을 거치지 않는다)
    for (let i = 0; i < 3; i += 1) await fetch(`${base}/admin/api/health`, { headers: { Authorization: 'Bearer good' } });
    const res = await fetch(`${base}/admin/api/presence`, { headers: { Authorization: 'Bearer good' } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).counts.connected, 0);
  }, { verifier: VERIFIER });
});

test('RUN_KEY_SECRET이 없으면 임시 키(stable=false)로 동작한다', async () => {
  await withEnv({ ADMIN_DEV_OPEN: 'true' }, async (base) => {
    assert.equal((await (await fetch(`${base}/admin/api/presence`)).json()).stable, false);
  });
});
