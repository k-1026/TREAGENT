import crypto from 'node:crypto';

// Supabase 로그인(access token)을 서버에서 확인한다. Supabase 공식 문서(Auth > JWTs, Signing keys) 기준으로 두 방식을 지원한다.
//   jwks: 새 방식(비대칭 서명 키) 프로젝트. 공개 키 목록(JWKS)으로 서명을 직접 확인한다.
//   user: 이전 방식(HS256) 프로젝트. Supabase 인증 서버(/auth/v1/user)에 토큰이 유효한지 물어본다.
// 공유 비밀(HS256)로 직접 검증하지 않는다. 공식 문서가 강하게 비권장한다.
// 토큰과 에러 내용은 로그에 남기지 않고, 실패하면 이유를 밝히지 않고 { ok: false }만 돌려준다.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PART_PATTERN = /^[A-Za-z0-9_-]+$/;
const ALGS = Object.freeze({ ES256: true, RS256: true }); // 이 둘만 허용. none, HS256 등은 거부한다.

const JWKS_TTL_MS = 10 * 60 * 1000; // 공식 문서: 앱에서 공개 키를 10분보다 오래 기억하지 않는다.
const JWKS_REFETCH_MIN_MS = 60 * 1000; // 모르는 키 id(kid)가 올 때 다시 가져오는 최소 간격
const CLOCK_TOLERANCE_S = 30; // 서버 시계 오차 허용(초)
const USER_CACHE_TTL_MS = 60 * 1000; // user 방식에서 성공 결과를 기억하는 시간
const USER_CACHE_MAX = 1000;
const FETCH_TIMEOUT_MS = 5000;
const MAX_TOKEN_LENGTH = 4096;

// "Bearer 토큰" 헤더에서 토큰만 꺼낸다.
function bearerToken(header) {
  if (typeof header !== 'string') return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return m ? m[1] : null;
}

// 토큰을 머리·본문·서명으로 나눈다. 모양이 이상하면 null.
function parseJwt(token) {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 3 || !parts.every((p) => PART_PATTERN.test(p))) return null; // 서명이 빈 토큰(alg none)도 여기서 거부
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (header === null || typeof header !== 'object' || payload === null || typeof payload !== 'object') return null;
    return {
      header,
      payload,
      signingInput: `${parts[0]}.${parts[1]}`,
      signature: Buffer.from(parts[2], 'base64url'),
    };
  } catch {
    return null;
  }
}

// 공개 키(JWK)로 서명을 확인한다. 알고리즘은 토큰 머리의 값을 믿지 않고 허용 목록과 키 종류로 한 번 더 맞춘다.
function verifySignature({ header, signingInput, signature }, jwk) {
  const alg = header.alg;
  if (!Object.hasOwn(ALGS, alg)) return false;
  if (jwk.alg && jwk.alg !== alg) return false;
  if (alg === 'ES256' && !(jwk.kty === 'EC' && jwk.crv === 'P-256')) return false;
  if (alg === 'RS256' && jwk.kty !== 'RSA') return false;
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const data = Buffer.from(signingInput);
    // ES256 서명은 r||s 고정 길이(ieee-p1363) 형식이다.
    return alg === 'ES256'
      ? crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, signature)
      : crypto.verify('sha256', data, key, signature);
  } catch {
    return false;
  }
}

// 만료, 발급자, 역할, 사용자 id를 확인한다. role이 authenticated인 로그인 사용자 토큰만 통과한다 (익명 키 토큰 거부).
function claimsOk(payload, { issuer, nowMs }) {
  const nowS = Math.floor(nowMs / 1000);
  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_TOLERANCE_S < nowS) return false;
  if (payload.nbf !== undefined && (typeof payload.nbf !== 'number' || payload.nbf - CLOCK_TOLERANCE_S > nowS)) return false;
  if (payload.iss !== issuer) return false;
  if (payload.role !== 'authenticated') return false;
  return typeof payload.sub === 'string' && UUID_PATTERN.test(payload.sub);
}

const FAIL = Object.freeze({ ok: false });

export function createTokenVerifier({ supabaseUrl, mode = 'jwks', anonKey, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  const base = supabaseUrl.replace(/\/+$/, '');
  const issuer = `${base}/auth/v1`;

  // ---- jwks 방식 ----
  let jwks = null; // { at, keys }
  let loading = null;
  async function fetchJwks() {
    const res = await fetchImpl(`${base}/auth/v1/.well-known/jwks.json`, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error('JWKS_HTTP');
    const body = await res.json();
    jwks = { at: now(), keys: Array.isArray(body?.keys) ? body.keys : [] };
  }
  function loadJwks() {
    loading ??= fetchJwks().finally(() => {
      loading = null;
    });
    return loading;
  }
  async function findKey(kid) {
    if (!jwks || now() - jwks.at >= JWKS_TTL_MS) await loadJwks();
    let key = jwks.keys.find((k) => k.kid === kid);
    // 모르는 kid: 키가 새로 바뀌었을 수 있으니, 일정 시간이 지났다면 한 번 다시 가져온다.
    if (!key && now() - jwks.at >= JWKS_REFETCH_MIN_MS) {
      await loadJwks();
      key = jwks.keys.find((k) => k.kid === kid);
    }
    return key;
  }
  async function verifyWithJwks(token) {
    const jwt = parseJwt(token);
    if (!jwt || typeof jwt.header.kid !== 'string' || !Object.hasOwn(ALGS, jwt.header.alg)) return FAIL;
    const jwk = await findKey(jwt.header.kid);
    if (!jwk || !verifySignature(jwt, jwk)) return FAIL;
    if (!claimsOk(jwt.payload, { issuer, nowMs: now() })) return FAIL;
    return { ok: true, userId: jwt.payload.sub.toLowerCase() };
  }

  // ---- user 방식 ----
  const userCache = new Map(); // 토큰의 sha256 → { at, userId }. 토큰 원문은 저장하지 않는다.
  async function verifyWithUserEndpoint(token) {
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const hit = userCache.get(hash);
    if (hit && now() - hit.at < USER_CACHE_TTL_MS) return { ok: true, userId: hit.userId };
    const res = await fetchImpl(`${base}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return FAIL;
    const body = await res.json();
    if (typeof body?.id !== 'string' || !UUID_PATTERN.test(body.id)) return FAIL;
    const userId = body.id.toLowerCase();
    if (userCache.size >= USER_CACHE_MAX) userCache.delete(userCache.keys().next().value);
    userCache.set(hash, { at: now(), userId });
    return { ok: true, userId };
  }

  return {
    // Authorization 헤더 값("Bearer ...")을 받아 { ok: true, userId } | { ok: false }를 돌려준다.
    async verify(authorizationHeader) {
      const token = bearerToken(authorizationHeader);
      if (!token) return FAIL;
      try {
        return mode === 'user' ? await verifyWithUserEndpoint(token) : await verifyWithJwks(token);
      } catch {
        return FAIL; // 네트워크 오류 등. 내용은 숨기고 로그인 실패로 본다.
      }
    },
  };
}

// 환경 변수에서 만든다. 설정이 없으면 null (그러면 일행 API는 503 AUTH_NOT_CONFIGURED).
//   SUPABASE_URL: Supabase 프로젝트 주소.
//   SUPABASE_AUTH_MODE: jwks(기본) 또는 user. 프로젝트가 이전 방식(HS256)이면 user.
//   SUPABASE_ANON_KEY: user 방식에서만 필요한 공개(anon, publishable) 키. service role 키를 넣지 않는다.
export function createTokenVerifierFromEnv(env = process.env) {
  const url = env.SUPABASE_URL;
  if (!url || /YOUR_PROJECT_REF/.test(url) || !/^https:\/\//.test(url)) return null;
  const mode = env.SUPABASE_AUTH_MODE === 'user' ? 'user' : 'jwks';
  if (mode === 'user' && !env.SUPABASE_ANON_KEY) return null;
  return createTokenVerifier({ supabaseUrl: url, mode, anonKey: env.SUPABASE_ANON_KEY });
}