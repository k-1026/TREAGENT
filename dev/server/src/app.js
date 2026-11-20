import http from 'node:http';
import express from 'express';
import { createWeatherRouter } from './routes/weather.js';
import { createWeatherService } from './weather/index.js';
import { createRecommendRouter } from './routes/recommend.js';
import { createHarangiLine } from './ai/harangi_line.js';
import { createHarangiFactoryFromEnv } from './ai/harangi_gemini.js';
import { createPartiesRouter } from './routes/parties.js';
import { createProfileRouter } from './routes/profile.js';
import { createPgPartyStore } from './party/party_store.js';
import { createPgProfileStore } from './profile/profile_store.js';
import { createTokenVerifierFromEnv } from './auth/verify_token.js';
import { createComposeRoute } from './ai/compose_route.js';
import { createRouteCache } from './ai/route_cache.js';
import { createLlmFromEnv } from './ai/gemini_llm.js';
import { createPlaceLoader, createPgQuery } from './places/load_places.js';
import { createCoursesRouter } from './routes/courses.js';
import { createCourseLoader } from './courses/load_courses.js';
// ① 요청 로그: 요청 한 건이 끝나면 딱 한 줄만 남긴다.
function requestLogger(req, res, next) {
  // 요청이 들어온 시각을 기억한다 (걸린 시간 계산용)
  const startedAt = Date.now();
  // 'finish'는 응답을 다 보낸 뒤 발생한다. 이때는 상태 코드가 정해져 있다.
  res.on('finish', () => {
    // req.path는 ?lat=... 같은 쿼리스트링을 뺀 경로다. 본문(body)은 아예 읽지 않는다.
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  // 다음 단계로 넘긴다. 이걸 빼먹으면 요청이 멈춘다.
  next();
}
// 개발용 CORS: CORS_ORIGIN에 적어 둔 주소(예: 웹 개발 서버)만 허용한다. 비어 있으면 아무것도 열지 않는다.
function devCors(req, res, next) {
  const allowed = process.env.CORS_ORIGIN;
  if (allowed && req.headers.origin === allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
  }
  // 브라우저가 POST 전에 보내는 사전 확인(OPTIONS)에는 바로 답한다.
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}
// ⑤ 에러 처리: 인자가 4개(err, req, res, next)여야 Express가 에러 처리기로 인식한다.
function errorHandler(err, req, res, next) {
  // 깨진 JSON을 보내면 Express가 status 400 또는 type 'entity.parse.failed' 에러를 만든다.
  const isBadRequest = err?.status === 400 || err?.type === 'entity.parse.failed';
  // 에러 "종류"만 기록한다. err.message와 err.body에는 요청 원문(좌표)이 들어 있을 수 있어서 절대 찍지 않는다.
  console.log(`요청 처리 오류: ${isBadRequest ? 'BAD_REQUEST' : 'INTERNAL'}`);
  // 응답에도 입력값을 되돌려 주지 않고 고정된 코드만 보낸다.
  res
    .status(isBadRequest ? 400 : 500)
    .json({ error: isBadRequest ? 'BAD_REQUEST' : 'INTERNAL_ERROR' });
}

export function createApp({
  weatherService = createWeatherService(),
  placeLoader,
  courseLoader,
  composeRoute,
  harangiLine,
  partyStore,
  profileStore,
  tokenVerifier,
  now = () => new Date(),
} = {}) {
  // 두 로더가 DB 연결 하나를 같이 쓴다. 처음 쓸 때 만든다.
  let sharedQuery;
    const query = (text, params) => (sharedQuery ??= createPgQuery())(text, params);
  placeLoader ??= createPlaceLoader({ query });
  courseLoader ??= createCourseLoader({ query });
    // AI 길 구성: GOOGLE_API_KEY와 GEMINI_MODEL이 .env에 없으면 llm이 null이라 규칙 결과만 쓴다.
  composeRoute ??= createComposeRoute({ llm: createLlmFromEnv(), cache: createRouteCache() });
  // 하랑이 대사와 오늘의 길 브리핑: 키와 모델이 없으면 makeModel이 null이라 고정 문장만 쓴다.
  harangiLine ??= createHarangiLine({ makeModel: createHarangiFactoryFromEnv(), cache: createRouteCache() });
  // 일행 저장소와 Supabase 로그인 확인. SUPABASE_URL 등이 .env에 없으면 tokenVerifier가 null이라 일행 API는 503으로 답한다.
  partyStore ??= createPgPartyStore({ query });
  profileStore ??= createPgProfileStore({ query });
  tokenVerifier = tokenVerifier === undefined ? createTokenVerifierFromEnv() : tokenVerifier;

  const app = express();
  // 응답 헤더에서 "Express를 쓴다"는 정보를 숨긴다.
  app.disable('x-powered-by');

  // 순서가 중요하다. 위에서 아래로 차례로 거친다.
  app.use(requestLogger); // ① 가장 먼저: 모든 요청을 기록 대상으로
  app.use(devCors);
  // ② 요청 본문(JSON)을 읽어 req.body에 넣는다. 좌표만 받으니 1KB로 작게 제한한다.
  app.use(express.json({ limit: '1kb' }));

  // ③ 라우트
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/weather', createWeatherRouter(weatherService));
    app.use('/recommend', createRecommendRouter({ weatherService, placeLoader, composeRoute, harangiLine, now }));
  app.use(
    '/parties',
    createPartiesRouter({ store: partyStore, verifier: tokenVerifier, weatherService, placeLoader, composeRoute, harangiLine, now }),
  );
  app.use('/profile', createProfileRouter({ store: profileStore, verifier: tokenVerifier, now }));
  app.use('/courses', createCoursesRouter({ weatherService, placeLoader, courseLoader, now }));

  // ④ 위 라우트에 안 걸린 모든 요청은 404
  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });
  // ⑤ 에러 처리기는 맨 마지막에 등록한다.
  app.use(errorHandler);

  return http.createServer(app);
}