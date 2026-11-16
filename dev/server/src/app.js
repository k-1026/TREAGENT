/*
 * [app.js] 서버 요청 처리 (PR 0: /health 하나만)
 *
 * 역할
 *  - 들어온 요청을 보고 알맞은 응답을 돌려준다. 아직 프레임워크 없이 Node 기본 http만 쓴다.
 *
 * 로그 규칙 (F-23, 좌표 미저장)
 *  - 한 줄에 "메서드 경로 상태코드 걸린시간"만 남긴다.
 *  - 쿼리스트링(?뒤)과 요청 본문(body)은 절대 기록하지 않는다.
 *  - 이후 PR에서 에러를 출력할 때도 요청 내용을 같이 찍지 않는다.
 */
import http from 'node:http';

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

// 요청 한 건을 처리한다. 경로만 쓰고 쿼리스트링은 읽지 않는다.
function handleRequest(req, res) {
  const startedAt = Date.now();
  const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;

  // 응답이 끝난 뒤 로그 한 줄 (본문·쿼리는 포함하지 않음)
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    console.log(`${req.method} ${pathname} ${res.statusCode} ${ms}ms`);
  });

  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, { status: 'ok' });
    return;
  }

  sendJson(res, 404, { error: 'NOT_FOUND' });
}

export function createApp() {
  return http.createServer(handleRequest);
}
