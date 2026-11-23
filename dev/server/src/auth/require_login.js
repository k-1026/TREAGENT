// 로그인 검사 미들웨어. 라우트 앞에 끼워서, 로그인하지 않은 요청이 안쪽 코드에 닿기 전에 막는다.
//   verifier: createTokenVerifier()의 결과 { verify(authorizationHeader) }. 설정이 없으면 null.
// 규칙: 토큰과 사용자 id는 로그에 남기지 않고, 실패하면 이유를 밝히지 않고 고정된 코드만 돌려준다.
//   - verifier가 없으면 (SUPABASE_URL 등이 .env에 없음) 503 AUTH_NOT_CONFIGURED. 열어 두지 않고 닫는다.
//   - 토큰이 없거나 틀리면 401 UNAUTHORIZED.
//   - 통과하면 req.userId에 사용자 id를 넣고 다음으로 넘긴다.
export function createRequireLogin(verifier) {
  return async function requireLogin(req, res, next) {
    if (!verifier) {
      res.status(503).json({ error: 'AUTH_NOT_CONFIGURED' });
      return;
    }
    const result = await verifier.verify(req.get('authorization'));
    if (!result.ok) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    req.userId = result.userId;
    next();
  };
}
