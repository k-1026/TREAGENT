import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminGuard, createAdminGuardFromEnv, sameOriginOnly } from '../src/admin/admin_guard.js';

// 가짜 요청·응답: 결과를 { passed, status, body }로 돌려준다
async function run(guard, { addr = '203.0.113.5', cookie } = {}) {
  const out = { passed: false, status: null, body: null };
  const req = { socket: { remoteAddress: addr }, headers: cookie === undefined ? {} : { cookie } };
  const res = {
    status(code) { out.status = code; return this; },
    json(body) { out.body = body; return this; },
  };
  await guard(req, res, () => { out.passed = true; });
  return out;
}
// 가짜 auth: 'treagent_admin=good' 쿠키만 통과
const auth = { configured: true, verifySession: (token) => token === 'good' };
const GOOD = 'treagent_admin=good';

test('관리자 계정 설정이 없으면 503으로 닫힌다', async () => {
  for (const a of [undefined, null, { configured: false, verifySession: () => true }]) {
    const r = await run(createAdminGuard({ auth: a }), { cookie: GOOD });
    assert.deepEqual([r.passed, r.status, r.body], [false, 503, { error: 'ADMIN_NOT_CONFIGURED' }]);
  }
});

test('devOpen이어도 이 컴퓨터가 아닌 주소에서는 열리지 않는다', async () => {
  const r = await run(createAdminGuard({ auth: undefined, devOpen: true }), { addr: '203.0.113.5' });
  assert.deepEqual([r.passed, r.status], [false, 503]);
});

test('devOpen이고 loopback 주소면 로그인 없이 통과한다', async () => {
  for (const addr of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    assert.equal((await run(createAdminGuard({ auth: undefined, devOpen: true }), { addr })).passed, true, addr);
  }
});

test('loopback이어도 devOpen이 꺼져 있으면 열리지 않는다', async () => {
  const r = await run(createAdminGuard({ auth: undefined }), { addr: '127.0.0.1' });
  assert.deepEqual([r.passed, r.status], [false, 503]);
});

test('올바른 세션 쿠키가 있으면 통과한다', async () => {
  assert.equal((await run(createAdminGuard({ auth }), { cookie: `a=1; ${GOOD}; b=2` })).passed, true);
});

test('쿠키가 없거나 틀리면 401 LOGIN_REQUIRED', async () => {
  const guard = createAdminGuard({ auth });
  for (const cookie of [undefined, '', 'treagent_admin=bad', 'other=good']) {
    const r = await run(guard, { cookie });
    assert.deepEqual([r.passed, r.status, r.body], [false, 401, { error: 'LOGIN_REQUIRED' }], String(cookie));
  }
});

test('응답 본문에 쿠키 값이 나오지 않는다', async () => {
  const r = await run(createAdminGuard({ auth }), { cookie: 'treagent_admin=bad-secret-value' });
  assert.ok(!JSON.stringify(r.body).includes('bad-secret-value'));
});

test('환경변수 ADMIN_DEV_OPEN=true일 때만 로컬 열기가 켜진다', async () => {
  const on = createAdminGuardFromEnv({ ADMIN_DEV_OPEN: 'true' }, undefined);
  const off = createAdminGuardFromEnv({ ADMIN_DEV_OPEN: 'yes' }, undefined);
  assert.equal((await run(on, { addr: '127.0.0.1' })).passed, true);
  assert.equal((await run(off, { addr: '127.0.0.1' })).passed, false);
});

// sameOriginOnly: 다른 사이트에서 온 쓰기 요청을 막는다
function originRun({ method = 'POST', origin, host = 'admin.example.com' }) {
  const out = { passed: false, status: null };
  const req = { method, headers: { host, ...(origin === undefined ? {} : { origin }) } };
  const res = { status(code) { out.status = code; return this; }, json() { return this; } };
  sameOriginOnly(req, res, () => { out.passed = true; });
  return out;
}

test('쓰기 요청: Origin이 이 서버 주소와 같으면 통과, 다르면 403', () => {
  assert.equal(originRun({ origin: 'https://admin.example.com' }).passed, true);
  assert.equal(originRun({ origin: 'https://evil.example.net' }).status, 403);
  assert.equal(originRun({ origin: 'https://admin.example.com.evil.net' }).status, 403);
  assert.equal(originRun({ origin: 'null' }).status, 403);
  assert.equal(originRun({ origin: 'not a url' }).status, 403);
});

test('GET·HEAD와 Origin이 없는 요청(curl 등)은 그대로 통과한다', () => {
  assert.equal(originRun({ method: 'GET', origin: 'https://evil.example.net' }).passed, true);
  assert.equal(originRun({ method: 'HEAD', origin: 'https://evil.example.net' }).passed, true);
  assert.equal(originRun({ origin: undefined }).passed, true);
});
