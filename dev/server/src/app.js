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
import { createRequireLogin } from './auth/require_login.js';
import { createComposeRoute } from './ai/compose_route.js';
import { createRouteCache } from './ai/route_cache.js';
import { createLlmFromEnv } from './ai/gemini_llm.js';
import { createPlaceLoader, createPgQuery } from './places/load_places.js';
import { createCoursesRouter } from './routes/courses.js';
import { createCourseLoader } from './courses/load_courses.js';
import { createWalkRouter } from './routes/walk.js';
import { createPoiFinder } from './tmap/poi_search.js';
import { createAdminGuardFromEnv } from './admin/admin_guard.js';
import { createAdminAuthFromEnv } from './admin/admin_session.js';
import { createAdminRouter } from './admin/admin_router.js';
import { createLoggedStore, createMemoryRunReader, createPgRunReader } from './admin/run_reader.js';
import { createRecorder } from './agents/common/recorder.js';
import { createMemoryRunStore } from './agents/common/run_store_memory.js';
import { createPgRunStore } from './agents/common/run_store_pg.js';
import { AGENT_LIMITS, PRESENCE } from './agents/common/config.js';
import { createPresence } from './admin/presence.js';
import { isCourseAgentOn } from './agents/course/config.js';
import { createAgents } from './agents/index.js';
import { prepareImage } from './agents/mission/prepare_image.js';
import { createPoolFromEnv } from './agents/common/failover.js';
import { createImageGenFromEnv } from './agents/card/image_gen.js';
import { createGeminiLlmsWithPool } from './agents/common/gemini.js';
import { createMemoryGameStores, createPgGameStores } from './agents/stores/game_stores.js';
import { createDailyLimit } from './agents/common/daily_limit.js';
import { createAgentsRouter } from './routes/agents.js';
import { runGolden } from './agents/golden/golden_set.js';
import { createTryAgent } from './admin/try_agent.js';
import { COURSE_SCHEMAS } from './agents/course/gemini.js';
import { CHAT_SCHEMAS } from './agents/chat/agent.js';
import { DIARY_SCHEMAS } from './agents/diary/agent.js';
import { MISSION_SCHEMAS } from './agents/mission/agent.js';
import { CARD_SCHEMAS } from './agents/card/agent.js';
import { PLACE_DB_SCHEMAS } from './agents/place_db/agent.js';

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
  // 실행 기록: DATABASE_URL이 있으면 DB(agent_runs 등)에, 없으면 서버 메모리에 쓴다. 에이전트와 관리자 화면이 같은 저장소를 본다.
  const useDb = Boolean(process.env.DATABASE_URL);
  const memoryStore = createMemoryRunStore();
  const loggedStore = createLoggedStore(useDb ? createPgRunStore({ query }) : memoryStore);
  // 에이전트: 키·모델 전환 풀 하나를 모두가 같이 쓴다. GOOGLE_API_KEYS와 GEMINI_MODELS(쉼표로 여러 개)가 없으면 LLM 에이전트는 꺼진다.
  // 코스 설계 에이전트는 COURSE_AGENT=on일 때만 /recommend에 끼운다 (기본 꺼짐). 꺼져 있으면 예전과 똑같이 동작한다.
  const gameStores = useDb ? createPgGameStores({ query }) : createMemoryGameStores();
  const aiPool = createPoolFromEnv();
  const agents = createAgents({ pool: aiPool, stores: gameStores, recorder: createRecorder({ store: loggedStore }), courseOn: isCourseAgentOn(), prepareImage, imageGen: createImageGenFromEnv() });
  composeRoute ??= createComposeRoute({ llm: createLlmFromEnv(), cache: createRouteCache(), courseAgent: agents.course });
  // 하랑이 대사와 오늘의 길 브리핑: 키와 모델이 없으면 makeModel이 null이라 고정 문장만 쓴다.
  harangiLine ??= createHarangiLine({ makeModel: createHarangiFactoryFromEnv(), cache: createRouteCache() });
  // 일행 저장소와 Supabase 로그인 확인. SUPABASE_URL 등이 .env에 없으면 tokenVerifier가 null이라 일행 API는 503으로 답한다.
  partyStore ??= createPgPartyStore({ query });
  profileStore ??= createPgProfileStore({ query });
  tokenVerifier = tokenVerifier === undefined ? createTokenVerifierFromEnv() : tokenVerifier;
  // 접속 현황: 로그인 확인을 통과한 요청마다 "이 사람이 방금 서버를 썼다"고 기억한다 (관리자 화면의 접속자 목록용).
  // 모든 라우트가 같은 확인기를 쓰므로 한 번 감싸면 전부 기록된다. 관리자 화면은 앱 로그인(Supabase)과 따로라서 관리자 본인은 세지 않는다.
  const presence = createPresence({ secret: process.env.RUN_KEY_SECRET, config: PRESENCE });
  const rawVerifier = tokenVerifier;
  if (rawVerifier) {
    tokenVerifier = {
      async verify(header) {
        const result = await rawVerifier.verify(header);
        if (result.ok) presence.touch(result.userId);
        return result;
      },
    };
  }

  const app = express();
  // 응답 헤더에서 "Express를 쓴다"는 정보를 숨긴다.
  app.disable('x-powered-by');

  // 순서가 중요하다. 위에서 아래로 차례로 거친다.
  app.use(requestLogger); // ① 가장 먼저: 모든 요청을 기록 대상으로
  app.use(devCors);
  // ② 요청 본문(JSON)을 읽어 req.body에 넣는다. 좌표만 받으니 1KB로 작게 제한한다.
  // /agents는 사진·긴 입력이 있어서 라우터 안에서 따로 읽는다.
  const smallJson = express.json({ limit: '1kb' });
  app.use((req, res, next) => (req.path.startsWith('/agents') ? next() : smallJson(req, res, next)));

  // ③ 라우트
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  // /health 말고는 모두 로그인이 있어야 들어온다. LLM·T맵·기상청 호출 비용을 아무나 쓰지 못하게 하는 첫 방어선이다.
  // /parties와 /profile은 라우터 안에서 같은 검사를 이미 하므로 여기서 또 하지 않는다 (Supabase에 두 번 묻지 않기 위해).
  const requireLogin = createRequireLogin(tokenVerifier);
  app.use('/weather', requireLogin, createWeatherRouter(weatherService));
    app.use('/recommend', requireLogin, createRecommendRouter({ weatherService, placeLoader, composeRoute, harangiLine, now }));
  app.use(
    '/parties',
    createPartiesRouter({ store: partyStore, verifier: tokenVerifier, weatherService, placeLoader, composeRoute, harangiLine, profileStore, now }),
  );
  app.use('/profile', createProfileRouter({ store: profileStore, verifier: tokenVerifier, now }));
  app.use('/courses', requireLogin, createCoursesRouter({ weatherService, placeLoader, courseLoader, now }));
  app.use('/agents', requireLogin, createDailyLimit({ max: AGENT_LIMITS.dailyMax }), createAgentsRouter({ agents, stores: gameStores, placeLoader }));
  app.use('/walk', requireLogin, createWalkRouter({ placeLoader, poiFinder: createPoiFinder() }));
  // 관리자 확인 화면: 관리자 전용 아이디·비밀번호(ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET)로 로그인한다.
  // 설정(또는 로컬 전용 ADMIN_DEV_OPEN)이 없으면 /admin/api는 닫혀 있다 (503).
  // DATABASE_URL이 있으면 실행 기록을 DB(agent_runs 등)에 쓰고, 없으면 서버 메모리에만 쓴다.
  const adminAuth = createAdminAuthFromEnv(process.env);
  app.use(
    '/admin',
    createAdminRouter({
      guard: createAdminGuardFromEnv(process.env, adminAuth),
      auth: adminAuth,
      reader: useDb ? createPgRunReader({ query }) : createMemoryRunReader(memoryStore),
      recorder: createRecorder({ store: loggedStore }),
      loggedStore,
      storeKind: useDb ? 'db' : 'memory',
      limits: AGENT_LIMITS,
      presence,
      presenceConfig: PRESENCE,
      ai: {
        pool: aiPool,
        placeDb: agents.placeDb,
        agentsOn: Object.fromEntries(Object.entries(agents).filter(([k]) => k !== 'pool').map(([k, v]) => [k, Boolean(v)])),
        candidates: gameStores.candidates,
        storeKind: gameStores.kind,
        // 에이전트 시험 실행: 실제 에이전트를 샘플 입력으로 한 번 돌려 결과와 실행 기록을 만든다 (관리자 화면)
        tryAgent: createTryAgent({ agents, placeLoader, now }),
        // 골든셋: mock은 가짜 LLM(비용 0원), live는 진짜 LLM(호출 비용이 든다)
        runGolden: (opts) => {
          const schemas = { course: COURSE_SCHEMAS, chat: CHAT_SCHEMAS, diary: DIARY_SCHEMAS, mission: MISSION_SCHEMAS, card: CARD_SCHEMAS, place_db: PLACE_DB_SCHEMAS };
          const cache = {};
          const liveLlm = (agent, name) => (cache[agent] ??= createGeminiLlmsWithPool(schemas[agent], aiPool))?.[name];
          return runGolden({ ...opts, liveLlm });
        },
      },
    }),
  );
  
  // ④ 위 라우트에 안 걸린 모든 요청은 404
  app.use((req, res) => {
    res.status(404).json({ error: 'NOT_FOUND' });
  });
  // ⑤ 에러 처리기는 맨 마지막에 등록한다.
  app.use(errorHandler);

  return http.createServer(app);
}