import { COOKIE_NAME, readCookie } from './admin_session.js';

// 관리자 확인 미들웨어. /admin/api 앞에 끼운다. 기본은 닫혀 있다.
//   1) devOpen이 켜져 있고 요청이 이 컴퓨터(loopback)에서 왔으면 통과 (로컬에서 화면을 확인할 때만)
//   2) 관리자 계정 설정(auth.configured)이 없으면 503 ADMIN_NOT_CONFIGURED (열어 두지 않고 닫는다)
//   3) 로그인해서 받은 세션 쿠키가 올바르면 통과, 아니면 401 LOGIN_REQUIRED
// 쿠키 값과 계정 정보는 응답·로그에 남기지 않는다.
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export function createAdminGuard({ auth, devOpen = false }) {
  return function adminGuard(req, res, next) {
    if (devOpen && LOOPBACK.has(req.socket?.remoteAddress)) {
      next();
      return;
    }
    if (!auth?.configured) {
      res.status(503).json({ error: 'ADMIN_NOT_CONFIGURED' });
      return;
    }
    if (auth.verifySession(readCookie(req.headers?.cookie, COOKIE_NAME))) {
      next();
      return;
    }
    res.status(401).json({ error: 'LOGIN_REQUIRED' });
  };
}

// 기록을 만들거나 로그인하는 요청(GET·HEAD가 아닌 것)이 다른 사이트에서 온 것이면 막는다.
// 브라우저가 보낸 Origin의 주소가 이 서버 주소와 같아야 한다. (쿠키의 SameSite=Strict와 함께 쓰는 두 번째 방어선)
export function sameOriginOnly(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    next();
    return;
  }
  const origin = req.headers?.origin;
  if (origin !== undefined) {
    let host = null;
    try { host = new URL(origin).host; } catch { /* 모양이 이상한 Origin은 막는다 */ }
    if (host === null || host !== req.headers.host) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
  }
  next();
}

// 환경변수에서 만든다. ADMIN_DEV_OPEN: 'true'일 때만 로컬 열기. auth는 createAdminAuthFromEnv의 결과.
export function createAdminGuardFromEnv(env, auth) {
  return createAdminGuard({ auth, devOpen: env.ADMIN_DEV_OPEN === 'true' });
}
