import crypto from 'node:crypto';
import { promisify } from 'node:util';

// 관리자 전용 아이디·비밀번호 로그인. Supabase(앱 이용자) 계정과 따로 쓴다.
//   - 비밀번호는 저장하지 않고 scrypt 해시만 서버 변수(ADMIN_PASSWORD_HASH)에 둔다.
//   - 로그인하면 서명된 세션 값을 쿠키로 준다. 서버는 세션을 따로 기억하지 않는다 (서명과 만료 시각만 확인).
//   - 틀린 시도는 세어서, 너무 많으면 잠시 막는다.
// 아이디·비밀번호·해시·세션 값은 응답과 로그에 남기지 않는다.
const scrypt = promisify(crypto.scrypt);

const SCRYPT = { N: 16384, r: 8, p: 1 }; // scrypt 비용 (메모리 약 16MB). 해시 문자열에 같이 적어 두므로 나중에 올려도 이전 해시는 그대로 확인된다.
const KEY_LENGTH = 64;
export const MIN_PASSWORD_LENGTH = 12;
export const MIN_SECRET_LENGTH = 32;
export const COOKIE_NAME = 'treagent_admin';
const COOKIE_PATH = '/admin';

// [결정 D-19] 임시값: 팀이 정한다
export const ADMIN_LOGIN_LIMITS = Object.freeze({
  sessionMs: 8 * 60 * 60 * 1000, // 로그인 유지 시간
  perClientMax: 5, // 같은 곳에서 이만큼 틀리면 잠근다
  allMax: 20, // 전체에서 이만큼 틀리면 잠근다 (여러 곳에서 돌려 가며 시도하는 경우)
  lockMs: 15 * 60 * 1000, // 잠그는 시간 (틀린 횟수를 기억하는 시간도 같다)
  maxFieldLength: 200,
});

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (text) => crypto.createHash('sha256').update(String(text)).digest();

// 해시 문자열: scrypt:N:r:p:소금:해시  ('$'를 쓰지 않는다. .env를 읽는 도구가 $를 바꿔 버리는 일을 피하려고)
export async function hashPassword(password, { salt = crypto.randomBytes(16) } = {}) {
  const hash = await scrypt(password, salt, KEY_LENGTH, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, b64(salt), b64(hash)].join(':');
}

function parseHash(stored) {
  if (typeof stored !== 'string') return null;
  const [kind, N, r, p, salt, hash, ...rest] = stored.split(':');
  if (kind !== 'scrypt' || rest.length > 0 || !salt || !hash) return null;
  const params = { N: Number(N), r: Number(r), p: Number(p) };
  if (!Object.values(params).every((v) => Number.isInteger(v) && v > 0)) return null;
  return { params, salt: Buffer.from(salt, 'base64url'), hash: Buffer.from(hash, 'base64url') };
}

// 맞으면 true. 해시 모양이 이상하면 false.
export async function verifyPassword(password, stored) {
  const parsed = parseHash(stored);
  if (!parsed || typeof password !== 'string') return false;
  const actual = await scrypt(password, parsed.salt, parsed.hash.length, parsed.params);
  return crypto.timingSafeEqual(actual, parsed.hash);
}

const sameText = (a, b) => crypto.timingSafeEqual(sha256(a), sha256(b)); // 길이가 달라도 같은 시간에 비교한다

// 쿠키 헤더에서 이름으로 값을 꺼낸다
export function readCookie(header, name) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function sessionCookie(token, { maxAgeS, secure }) {
  return `${COOKIE_NAME}=${token}; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=${maxAgeS}${secure ? '; Secure' : ''}`;
}
export function clearedCookie({ secure }) {
  return `${COOKIE_NAME}=; Path=${COOKIE_PATH}; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

// username, passwordHash, secret이 모두 있어야 configured. 하나라도 없으면 /admin은 닫힌다.
export function createAdminAuth({ username, passwordHash, secret, secure = false, limits = ADMIN_LOGIN_LIMITS, now = Date.now } = {}) {
  const configured =
    typeof username === 'string' && username.length > 0 &&
    parseHash(passwordHash) !== null &&
    typeof secret === 'string' && secret.length >= MIN_SECRET_LENGTH;

  // 틀린 시도 기록: 키 → { count, last, lockedUntil }
  const fails = new Map();
  const ALL = 'all';
  const MAX_KEYS = 5000;
  const live = (e, t) => e && (e.lockedUntil > t || t - e.last < limits.lockMs);
  function lockedFor(key, t) {
    const e = fails.get(key);
    return e && e.lockedUntil > t ? e.lockedUntil - t : 0;
  }
  function bump(key, max, t) {
    let e = fails.get(key);
    if (!live(e, t)) e = { count: 0, last: t, lockedUntil: 0 };
    if (!fails.has(key) && fails.size >= MAX_KEYS) {
      for (const [k, v] of fails) if (!live(v, t)) fails.delete(k);
      if (fails.size >= MAX_KEYS) return; // 가득 차면 새 곳은 기억하지 않는다 (전체 제한이 막아 준다)
    }
    e.count += 1;
    e.last = t;
    if (e.count >= max) e.lockedUntil = t + limits.lockMs;
    fails.set(key, e);
  }
  function relieve(key) {
    const e = fails.get(key);
    if (e) e.count = Math.max(0, e.count - 1);
  }

  const sign = (payload) => b64(crypto.createHmac('sha256', secret).update(payload).digest());

  return {
    configured,
    secure,
    maxAgeS: Math.floor(limits.sessionMs / 1000),

    // 성공: { ok: true, token }, 실패: { ok: false, reason: 'INVALID' | 'LOCKED', retryAfterS? }
    // 시도는 확인하기 전에 먼저 센다. 동시에 많이 보내도 제한을 넘기지 못하게 하려는 것이다.
    async login({ username: u, password, client = 'unknown' } = {}) {
      if (!configured) return { ok: false, reason: 'INVALID' };
      const t = now();
      const wait = Math.max(lockedFor(client, t), lockedFor(ALL, t));
      if (wait > 0) return { ok: false, reason: 'LOCKED', retryAfterS: Math.ceil(wait / 1000) };
      bump(client, limits.perClientMax, t);
      bump(ALL, limits.allMax, t);

      const tooLong = [u, password].some((v) => typeof v !== 'string' || v.length > limits.maxFieldLength);
      // 아이디가 틀려도 비밀번호 계산을 똑같이 해서, 응답 시간으로 어느 쪽이 틀렸는지 알 수 없게 한다.
      const passOk = await verifyPassword(tooLong ? '' : password, passwordHash);
      const userOk = !tooLong && sameText(u, username);
      if (!(userOk && passOk)) return { ok: false, reason: 'INVALID' };

      fails.delete(client);
      relieve(ALL);
      const exp = Math.floor((t + limits.sessionMs) / 1000);
      const payload = `${exp}.${crypto.randomBytes(12).toString('hex')}`;
      return { ok: true, token: `${payload}.${sign(payload)}` };
    },

    verifySession(token) {
      if (!configured || typeof token !== 'string') return false;
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const [exp, nonce, sig] = parts;
      const expected = sign(`${exp}.${nonce}`);
      if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
      return Number(exp) > Math.floor(now() / 1000);
    },
  };
}

// 서버 변수에서 만든다. ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET. 운영(NODE_ENV=production)에서는 쿠키에 Secure를 붙인다.
export function createAdminAuthFromEnv(env = process.env, options = {}) {
  return createAdminAuth({
    username: env.ADMIN_USERNAME,
    passwordHash: env.ADMIN_PASSWORD_HASH,
    secret: env.ADMIN_SESSION_SECRET,
    secure: env.NODE_ENV === 'production',
    ...options,
  });
}
