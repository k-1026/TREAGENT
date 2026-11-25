import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, createAdminAuth, createAdminAuthFromEnv,
  readCookie, sessionCookie, clearedCookie, COOKIE_NAME, ADMIN_LOGIN_LIMITS,
} from '../src/admin/admin_session.js';

const PASSWORD = 'correct horse battery';
const SECRET = 'x'.repeat(40);
const hash = await hashPassword(PASSWORD);

function makeAuth(over = {}) {
  const clock = { t: 1_700_000_000_000 };
  const auth = createAdminAuth({ username: 'admin', passwordHash: hash, secret: SECRET, now: () => clock.t, ...over });
  return { auth, clock };
}

test('해시: 같은 비밀번호도 매번 다른 해시가 나오고, 맞는 비밀번호만 통과한다', async () => {
  const other = await hashPassword(PASSWORD);
  assert.notEqual(other, hash);
  assert.equal(await verifyPassword(PASSWORD, hash), true);
  assert.equal(await verifyPassword(PASSWORD, other), true);
  assert.equal(await verifyPassword('wrong password!!', hash), false);
  assert.equal(await verifyPassword('', hash), false);
});

test('해시 문자열에는 $가 없고 비밀번호 원문이 들어 있지 않다 (.env 도구가 $를 바꾸는 일을 피함)', () => {
  assert.ok(!hash.includes('$'));
  assert.ok(!hash.includes(PASSWORD));
  assert.match(hash, /^scrypt:\d+:\d+:\d+:[\w-]+:[\w-]+$/);
});

test('모양이 이상한 해시나 비밀번호는 false (에러를 던지지 않음)', async () => {
  for (const bad of [undefined, null, '', 'abc', 'scrypt:1:2', 'bcrypt:1:1:1:aa:bb', 'scrypt:x:8:1:aa:bb']) {
    assert.equal(await verifyPassword(PASSWORD, bad), false, String(bad));
  }
  assert.equal(await verifyPassword(undefined, hash), false);
  assert.equal(await verifyPassword({ a: 1 }, hash), false);
});

test('아이디·해시·서명 키가 모두 있어야 configured, 키는 32자 이상', () => {
  assert.equal(makeAuth().auth.configured, true);
  assert.equal(makeAuth({ username: '' }).auth.configured, false);
  assert.equal(makeAuth({ username: undefined }).auth.configured, false);
  assert.equal(makeAuth({ passwordHash: 'nope' }).auth.configured, false);
  assert.equal(makeAuth({ secret: 'short' }).auth.configured, false);
  assert.equal(createAdminAuthFromEnv({}).configured, false);
});

test('환경변수로 만들고, 운영(production)에서만 쿠키에 Secure를 붙인다', () => {
  const env = { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: hash, ADMIN_SESSION_SECRET: SECRET };
  assert.equal(createAdminAuthFromEnv(env).configured, true);
  assert.equal(createAdminAuthFromEnv(env).secure, false);
  assert.equal(createAdminAuthFromEnv({ ...env, NODE_ENV: 'production' }).secure, true);
});

test('설정이 없으면 로그인은 늘 실패한다', async () => {
  const r = await createAdminAuthFromEnv({}).login({ username: 'admin', password: PASSWORD, client: 'a' });
  assert.deepEqual(r, { ok: false, reason: 'INVALID' });
});

test('로그인 성공: 세션 값을 주고, 그 값은 확인을 통과한다', async () => {
  const { auth } = makeAuth();
  const r = await auth.login({ username: 'admin', password: PASSWORD, client: 'a' });
  assert.equal(r.ok, true);
  assert.equal(auth.verifySession(r.token), true);
  assert.ok(!r.token.includes(PASSWORD));
});

test('아이디가 틀려도 비밀번호가 틀려도 같은 모양의 실패다 (어느 쪽이 틀렸는지 알려 주지 않음)', async () => {
  const { auth } = makeAuth();
  const a = await auth.login({ username: 'nobody', password: PASSWORD, client: 'a' });
  const b = await auth.login({ username: 'admin', password: 'wrong password!!', client: 'a' });
  const c = await auth.login({ username: 'nobody', password: 'wrong password!!', client: 'a' });
  assert.deepEqual(a, { ok: false, reason: 'INVALID' });
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});

test('모양이 이상하거나 너무 긴 입력은 실패 (에러를 던지지 않음)', async () => {
  const { auth } = makeAuth();
  const long = 'a'.repeat(ADMIN_LOGIN_LIMITS.maxFieldLength + 1);
  const inputs = [{}, { username: 'admin' }, { username: 1, password: 2 }, { username: long, password: PASSWORD }, { username: 'admin', password: long }, { username: ['admin'], password: [PASSWORD] }];
  for (const [i, input] of inputs.entries()) {
    assert.deepEqual(await auth.login({ ...input, client: `z${i}` }), { ok: false, reason: 'INVALID' }); // 접속 위치를 달리해서 잠금에 걸리지 않게 한다
  }
  assert.deepEqual(await auth.login(), { ok: false, reason: 'INVALID' });
});

test('같은 곳에서 5번 틀리면 잠기고, 잠긴 동안은 맞는 비밀번호도 거부한다', async () => {
  const { auth } = makeAuth();
  for (let i = 0; i < 5; i += 1) assert.equal((await auth.login({ username: 'admin', password: 'wrong password!!', client: 'a' })).reason, 'INVALID');
  const locked = await auth.login({ username: 'admin', password: PASSWORD, client: 'a' });
  assert.equal(locked.ok, false);
  assert.equal(locked.reason, 'LOCKED');
  assert.ok(locked.retryAfterS > 0 && locked.retryAfterS <= ADMIN_LOGIN_LIMITS.lockMs / 1000);
});

test('잠금 시간이 지나면 다시 로그인할 수 있다', async () => {
  const { auth, clock } = makeAuth();
  for (let i = 0; i < 5; i += 1) await auth.login({ username: 'admin', password: 'wrong password!!', client: 'a' });
  clock.t += ADMIN_LOGIN_LIMITS.lockMs + 1;
  assert.equal((await auth.login({ username: 'admin', password: PASSWORD, client: 'a' })).ok, true);
});

test('동시에 여러 번 보내도 확인은 제한 횟수까지만 한다', async () => {
  const { auth } = makeAuth();
  const results = await Promise.all(Array.from({ length: 12 }, () => auth.login({ username: 'admin', password: 'wrong password!!', client: 'a' })));
  assert.equal(results.filter((r) => r.reason === 'INVALID').length, 5);
  assert.equal(results.filter((r) => r.reason === 'LOCKED').length, 7);
});

test('한 곳이 잠겨도 다른 곳은 로그인할 수 있다', async () => {
  const { auth } = makeAuth();
  for (let i = 0; i < 5; i += 1) await auth.login({ username: 'admin', password: 'wrong password!!', client: 'attacker' });
  assert.equal((await auth.login({ username: 'admin', password: PASSWORD, client: 'me' })).ok, true);
});

test('여러 곳에서 돌려 가며 틀리면 전체가 잠긴다 (20번)', async () => {
  const { auth } = makeAuth();
  for (let i = 0; i < ADMIN_LOGIN_LIMITS.allMax; i += 1) await auth.login({ username: 'admin', password: 'wrong password!!', client: `c${i}` });
  const r = await auth.login({ username: 'admin', password: PASSWORD, client: 'new-client' });
  assert.equal(r.reason, 'LOCKED');
});

test('로그인에 성공하면 그곳의 틀린 횟수가 지워진다', async () => {
  const { auth } = makeAuth();
  for (let i = 0; i < 4; i += 1) await auth.login({ username: 'admin', password: 'wrong password!!', client: 'a' });
  assert.equal((await auth.login({ username: 'admin', password: PASSWORD, client: 'a' })).ok, true);
  for (let i = 0; i < 4; i += 1) assert.equal((await auth.login({ username: 'admin', password: 'wrong password!!', client: 'a' })).reason, 'INVALID');
});

test('세션: 만료되면 거부하고, 고치거나 다른 키로 만든 값과 이상한 값은 거부한다', async () => {
  const { auth, clock } = makeAuth();
  const { token } = await auth.login({ username: 'admin', password: PASSWORD, client: 'a' });
  const [exp, nonce, sig] = token.split('.');
  assert.equal(auth.verifySession(token), true);
  assert.equal(auth.verifySession(`${Number(exp) + 99999}.${nonce}.${sig}`), false); // 만료 시각을 늘림
  assert.equal(auth.verifySession(`${exp}.${nonce}x.${sig}`), false);
  assert.equal(auth.verifySession(`${exp}.${nonce}.${sig.slice(0, -2)}AA`), false);
  for (const bad of [undefined, null, '', 'a.b', 'a.b.c.d', 123, {}]) assert.equal(auth.verifySession(bad), false, String(bad));
  const stranger = makeAuth({ secret: 'y'.repeat(40) }).auth;
  assert.equal(stranger.verifySession(token), false);
  clock.t += ADMIN_LOGIN_LIMITS.sessionMs + 1000;
  assert.equal(auth.verifySession(token), false);
});

test('서버를 다시 켜도(같은 키) 이전 세션이 유지된다', async () => {
  const first = makeAuth();
  const { token } = await first.auth.login({ username: 'admin', password: PASSWORD, client: 'a' });
  assert.equal(makeAuth().auth.verifySession(token), true);
});

test('쿠키: 이름으로 값을 읽고, 속성은 HttpOnly·SameSite=Strict·/admin이며 Secure는 옵션', () => {
  assert.equal(readCookie('a=1; treagent_admin=tok.en.sig; b=2', COOKIE_NAME), 'tok.en.sig');
  assert.equal(readCookie('a=1', COOKIE_NAME), null);
  assert.equal(readCookie(undefined, COOKIE_NAME), null);
  assert.equal(readCookie('xtreagent_admin=1', COOKIE_NAME), null);
  const plain = sessionCookie('tok', { maxAgeS: 60, secure: false });
  assert.match(plain, /HttpOnly/);
  assert.match(plain, /SameSite=Strict/);
  assert.match(plain, /Path=\/admin/);
  assert.match(plain, /Max-Age=60/);
  assert.doesNotMatch(plain, /Secure/);
  assert.match(sessionCookie('tok', { maxAgeS: 60, secure: true }), /; Secure/);
  assert.match(clearedCookie({ secure: false }), /Max-Age=0/);
});
