import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createTokenVerifier, createTokenVerifierFromEnv } from '../src/auth/verify_token.js';

const BASE = 'https://abcd.supabase.co';
const ISS = `${BASE}/auth/v1`;
const NOW = Date.UTC(2026, 10, 19, 5, 0, 0);
const NOW_S = Math.floor(NOW / 1000);
const USER = 'AAAAAAAA-2222-4333-8444-555555555555';

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
function sign({ alg = 'ES256', kid = 'k1', payload, privateKey, header = {} }) {
  const data = `${b64({ alg, kid, typ: 'JWT', ...header })}.${b64(payload)}`;
  const sig =
    alg === 'ES256'
      ? crypto.sign('sha256', Buffer.from(data), { key: privateKey, dsaEncoding: 'ieee-p1363' })
      : crypto.sign('sha256', Buffer.from(data), privateKey);
  return `${data}.${sig.toString('base64url')}`;
}
const claims = (over = {}) => ({ sub: USER, role: 'authenticated', iss: ISS, exp: NOW_S + 3600, ...over });

const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ec2 = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwkOf = (pub, kid, alg) => ({ ...pub.export({ format: 'jwk' }), kid, alg, use: 'sig' });
const EC_JWK = jwkOf(ec.publicKey, 'k1', 'ES256');

const jsonRes = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });
function fakeFetch(handler) {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    return handler(url, opts, calls.length);
  };
  fn.calls = calls;
  return fn;
}
function make({ handler, mode = 'jwks', anonKey } = {}) {
  let t = NOW;
  const fetchImpl = fakeFetch(handler ?? (() => jsonRes({ keys: [EC_JWK] })));
  const v = createTokenVerifier({ supabaseUrl: `${BASE}/`, mode, anonKey, fetchImpl, now: () => t });
  return {
    v,
    fetchImpl,
    advance: (ms) => {
      t += ms;
    },
  };
}
const bearer = (token) => `Bearer ${token}`;
const goodToken = (over) => sign({ payload: claims(over), privateKey: ec.privateKey });

test('올바른 ES256 토큰은 통과하고 사용자 id는 소문자로 돌려준다', async () => {
  const { v } = make();
  const r = await v.verify(bearer(goodToken()));
  assert.deepEqual(r, { ok: true, userId: USER.toLowerCase() });
});

test('RS256 토큰도 통과한다', async () => {
  const { v } = make({ handler: () => jsonRes({ keys: [jwkOf(rsa.publicKey, 'r1', 'RS256')] }) });
  const token = sign({ alg: 'RS256', kid: 'r1', payload: claims(), privateKey: rsa.privateKey });
  assert.equal((await v.verify(bearer(token))).ok, true);
});

test('헤더가 없거나 Bearer 형식이 아니면 거부하고 네트워크를 쓰지 않는다', async () => {
  const { v, fetchImpl } = make();
  for (const header of [undefined, '', 'Bearer', 'Basic abc', `Token ${goodToken()}`, 123]) {
    assert.deepEqual(await v.verify(header), { ok: false });
  }
  assert.equal(fetchImpl.calls.length, 0);
});

test('다른 키로 서명한 토큰은 거부', async () => {
  const { v } = make();
  const forged = sign({ payload: claims(), privateKey: ec2.privateKey });
  assert.equal((await v.verify(bearer(forged))).ok, false);
});

test('본문을 바꾼 토큰은 거부 (서명은 그대로)', async () => {
  const { v } = make();
  const [head, , sig] = goodToken().split('.');
  const tampered = `${head}.${b64(claims({ sub: '99999999-2222-4333-8444-555555555555' }))}.${sig}`;
  assert.equal((await v.verify(bearer(tampered))).ok, false);
});

test('만료된 토큰은 거부, 허용 오차(30초) 안이면 통과', async () => {
  const { v } = make();
  assert.equal((await v.verify(bearer(goodToken({ exp: NOW_S - 100 })))).ok, false);
  assert.equal((await v.verify(bearer(goodToken({ exp: NOW_S - 10 })))).ok, true);
  assert.equal((await v.verify(bearer(goodToken({ exp: undefined })))).ok, false);
});

test('아직 유효하지 않은 토큰(nbf)은 거부', async () => {
  const { v } = make();
  assert.equal((await v.verify(bearer(goodToken({ nbf: NOW_S + 600 })))).ok, false);
});

test('발급자(iss)가 다르면 거부', async () => {
  const { v } = make();
  assert.equal((await v.verify(bearer(goodToken({ iss: 'https://evil.example/auth/v1' })))).ok, false);
});

test('role이 authenticated가 아니면(익명 키 토큰) 거부', async () => {
  const { v } = make();
  assert.equal((await v.verify(bearer(goodToken({ role: 'anon' })))).ok, false);
});

test('사용자 id(sub)가 UUID 모양이 아니면 거부', async () => {
  const { v } = make();
  assert.equal((await v.verify(bearer(goodToken({ sub: 'not-a-uuid' })))).ok, false);
  assert.equal((await v.verify(bearer(goodToken({ sub: undefined })))).ok, false);
});

test('알고리즘 혼동 공격 방어: none, HS256 토큰은 거부', async () => {
  const { v } = make();
  const noneHead = b64({ alg: 'none', kid: 'k1' });
  assert.equal((await v.verify(bearer(`${noneHead}.${b64(claims())}.`))).ok, false);
  assert.equal((await v.verify(bearer(`${noneHead}.${b64(claims())}`))).ok, false);
  const data = `${b64({ alg: 'HS256', kid: 'k1' })}.${b64(claims())}`;
  const hmac = crypto.createHmac('sha256', JSON.stringify(EC_JWK)).update(data).digest('base64url');
  assert.equal((await v.verify(bearer(`${data}.${hmac}`))).ok, false);
});

test('키 종류와 알고리즘이 맞지 않으면 거부 (RS256으로 적고 EC 키를 가리킴)', async () => {
  const { v } = make();
  const confused = sign({ alg: 'RS256', kid: 'k1', payload: claims(), privateKey: rsa.privateKey });
  assert.equal((await v.verify(bearer(confused))).ok, false);
});

test('kid가 없거나 모르는 kid면 거부, 방금 가져왔다면 다시 가져오지 않는다', async () => {
  const { v, fetchImpl } = make();
  const noKid = sign({ payload: claims(), privateKey: ec.privateKey, header: { kid: undefined } });
  assert.equal((await v.verify(bearer(noKid))).ok, false);
  const unknown = sign({ kid: 'zzz', payload: claims(), privateKey: ec2.privateKey });
  assert.equal((await v.verify(bearer(unknown))).ok, false);
  assert.equal(fetchImpl.calls.length, 1);
});

test('키가 새로 바뀌면(모르는 kid) 일정 시간 뒤 한 번 다시 가져와 통과시킨다', async () => {
  const handler = (_url, _opts, n) =>
    jsonRes({ keys: n === 1 ? [EC_JWK] : [EC_JWK, jwkOf(ec2.publicKey, 'k2', 'ES256')] });
  const { v, fetchImpl, advance } = make({ handler });
  assert.equal((await v.verify(bearer(goodToken()))).ok, true);
  const rotated = sign({ kid: 'k2', payload: claims(), privateKey: ec2.privateKey });
  advance(61 * 1000);
  assert.equal((await v.verify(bearer(rotated))).ok, true);
  assert.equal(fetchImpl.calls.length, 2);
});

test('공개 키 목록은 10분 동안 기억하고, 지나면 다시 가져온다', async () => {
  const { v, fetchImpl, advance } = make();
  await v.verify(bearer(goodToken()));
  await v.verify(bearer(goodToken()));
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].url, `${BASE}/auth/v1/.well-known/jwks.json`);
  advance(10 * 60 * 1000 + 1);
  await v.verify(bearer(goodToken()));
  assert.equal(fetchImpl.calls.length, 2);
});

test('동시에 여러 요청이 와도 공개 키는 한 번만 가져온다', async () => {
  const { v, fetchImpl } = make();
  const results = await Promise.all(Array.from({ length: 5 }, () => v.verify(bearer(goodToken()))));
  assert.ok(results.every((r) => r.ok));
  assert.equal(fetchImpl.calls.length, 1);
});

test('공개 키를 못 가져오면(네트워크 오류, HTTP 오류) 거부하고 에러 내용은 숨긴다', async () => {
  const boom = make({
    handler: () => {
      throw new Error('boom secret-detail');
    },
  });
  const r1 = await boom.v.verify(bearer(goodToken()));
  assert.deepEqual(r1, { ok: false });
  const http = make({ handler: () => jsonRes({}, false, 500) });
  assert.deepEqual(await http.v.verify(bearer(goodToken())), { ok: false });
});

test('공개 키 목록이 비어 있으면(이전 방식 프로젝트) 거부', async () => {
  const { v } = make({ handler: () => jsonRes({ keys: [] }) });
  assert.equal((await v.verify(bearer(goodToken()))).ok, false);
});

test('모양이 이상하거나 너무 긴 토큰은 거부', async () => {
  const { v } = make();
  for (const t of ['a.b', 'a.b.c.d', '..', 'a.b.c!', `${'a'.repeat(5000)}.b.c`]) {
    assert.equal((await v.verify(bearer(t))).ok, false);
  }
});

// ---- user 방식 (이전 방식 HS256 프로젝트) ----
const USER_BODY = { id: USER, role: 'authenticated' };

test('user 방식: 인증 서버가 200과 id를 돌려주면 통과하고 헤더를 올바르게 보낸다', async () => {
  const { v, fetchImpl } = make({ mode: 'user', anonKey: 'anon-key', handler: () => jsonRes(USER_BODY) });
  const r = await v.verify(bearer('some.opaque.token'));
  assert.deepEqual(r, { ok: true, userId: USER.toLowerCase() });
  const { url, opts } = fetchImpl.calls[0];
  assert.equal(url, `${BASE}/auth/v1/user`);
  assert.equal(opts.headers.apikey, 'anon-key');
  assert.equal(opts.headers.Authorization, 'Bearer some.opaque.token');
});

test('user 방식: 성공한 결과는 1분 동안 기억하고(토큰 원문은 저장하지 않음), 지나면 다시 묻는다', async () => {
  const { v, fetchImpl, advance } = make({ mode: 'user', anonKey: 'k', handler: () => jsonRes(USER_BODY) });
  await v.verify(bearer('tok-1'));
  await v.verify(bearer('tok-1'));
  assert.equal(fetchImpl.calls.length, 1);
  advance(60 * 1000);
  await v.verify(bearer('tok-1'));
  assert.equal(fetchImpl.calls.length, 2);
});

test('user 방식: 401, 이상한 응답, 네트워크 오류는 거부', async () => {
  const unauthorized = make({ mode: 'user', anonKey: 'k', handler: () => jsonRes({}, false, 401) });
  assert.deepEqual(await unauthorized.v.verify(bearer('t')), { ok: false });
  const odd = make({ mode: 'user', anonKey: 'k', handler: () => jsonRes({ id: 'nope' }) });
  assert.deepEqual(await odd.v.verify(bearer('t')), { ok: false });
  const down = make({
    mode: 'user',
    anonKey: 'k',
    handler: () => {
      throw new Error('network');
    },
  });
  assert.deepEqual(await down.v.verify(bearer('t')), { ok: false });
});

// ---- 환경 변수 ----
test('환경 변수: 없거나 예시 값이면 null', () => {
  assert.equal(createTokenVerifierFromEnv({}), null);
  assert.equal(createTokenVerifierFromEnv({ SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co' }), null);
  assert.equal(createTokenVerifierFromEnv({ SUPABASE_URL: 'http://insecure.example' }), null);
});

test('환경 변수: user 방식은 공개(anon) 키가 있어야 만든다', () => {
  assert.equal(createTokenVerifierFromEnv({ SUPABASE_URL: BASE, SUPABASE_AUTH_MODE: 'user' }), null);
  assert.ok(createTokenVerifierFromEnv({ SUPABASE_URL: BASE, SUPABASE_AUTH_MODE: 'user', SUPABASE_ANON_KEY: 'k' }));
  assert.ok(createTokenVerifierFromEnv({ SUPABASE_URL: BASE }));
});