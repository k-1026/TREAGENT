import express from 'express';
import { fileURLToPath } from 'node:url';
import { GRAPHS } from './agent_graphs.js';
import { describeRun } from './run_view.js';
import { SCENARIOS, runScenario, DEMO_DELAY_MS } from './scenarios.js';
import { checkConsistency } from './run_reader.js';
import { describeUsers, restoreUsersFromRuns, DEMO_PREFIX } from './user_status.js';
import { sameOriginOnly } from './admin_guard.js';
import { sessionCookie, clearedCookie } from './admin_session.js';

// 관리자 화면(/admin)의 정적 페이지와 JSON API. 읽기 전용이다 (시나리오 실행만 기록을 만든다).
//   화면 파일(html·js·css)은 로그인 없이 내려 준다 (안에 비밀 값이 없다). /api/* 는 guard를 통과해야 한다.
//   로그인(/api/login)과 로그아웃(/api/logout)만 guard 앞에 있다.
//   guard: createAdminGuard의 결과    auth: createAdminAuth의 결과 (아이디·비밀번호 확인과 세션 쿠키)
//   reader: listRuns / getRun        recorder: createRecorder의 결과        loggedStore: createLoggedStore의 결과
//   storeKind: 'memory' | 'db' (화면에 "DB 확인이 아님"을 알리기 위해)    limits: AGENT_LIMITS
//   presence: createPresence의 결과 (접속 현황)    presenceConfig: PRESENCE (접속 중·최근 사용으로 보는 시간)
// 응답에는 계정 식별자(actorKey 포함)와 토큰을 넣지 않는다.
const PUBLIC_DIR = fileURLToPath(new URL('./public/', import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ACTIVE = 5; // 동시에 돌릴 수 있는 시나리오 수
const STALE_MARGIN_MS = 10_000; // 호출 예산의 전체 시간 상한 + 이만큼 지나도 끝 줄이 없으면 "중단됨"으로 본다

const DEMO_USERS = ['A', 'B', 'C']; // 시나리오를 돌릴 때 번갈아 쓰는 시연 유저 (가짜)

export function createAdminRouter({ guard, auth, reader, recorder, loggedStore, storeKind, limits, presence, presenceConfig, delayMs = DEMO_DELAY_MS, now = Date.now }) {
  const router = express.Router();
  const active = new Map(); // runId → run (아직 안 끝난 시나리오)
  let demoSeq = 0;
  const staleAfterMs = limits.deadlineMs + STALE_MARGIN_MS;

  const viewOf = (run) => (GRAPHS[run.agent] ? describeRun(run, GRAPHS[run.agent], { now: now(), staleAfterMs }) : null);
  // actorKey(해시 키)는 응답에 넣지 않는다. 시연 실행인지만 알려 준다.
  const present = ({ actorKey, ...run }) => ({ ...run, demo: Boolean(actorKey?.startsWith(DEMO_PREFIX)), view: viewOf(run) });
  // 실행 목록용 요약: 단계 내용은 빼고, 단계 수와 LLM 호출 수·토큰 합만 계산해서 보낸다 (토큰을 모르면 null)
  const brief = (run) => {
    const { steps, ...rest } = present(run);
    const sum = (field) => steps.reduce((acc, s) => acc + (s[field] ?? 0), 0);
    const hasTokens = steps.some((s) => s.totalTokens != null);
    return { ...rest, stepCount: steps.length, totals: { llmCalls: sum('llmCalls'), totalTokens: hasTokens ? sum('totalTokens') : null } };
  };

  // 보안 헤더: 같은 곳의 스크립트·스타일만 허용한다 (LLM 출력 같은 글이 스크립트로 실행되지 않게 하는 두 번째 방어선).
  router.use((req, res, next) => {
    res.set({
      'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
    });
    next();
  });

  // 화면 파일은 공개한다. 로그인 화면도 이 파일이 그린다.
  router.use(express.static(PUBLIC_DIR, { index: 'index.html' }));
  router.use(sameOriginOnly);

  // 로그인: 맞으면 세션 쿠키를 주고, 틀린 이유(아이디/비밀번호)는 알려 주지 않는다. 너무 많이 틀리면 잠시 막는다.
  // 접속 위치는 앞단 프록시가 붙인 X-Forwarded-For의 마지막 값을 우선 쓴다 (없으면 연결 주소). [확인 필요] Railway에서 실제 값을 확인한다.
  const clientOf = (req) => String(req.headers['x-forwarded-for'] ?? '').split(',').pop().trim() || req.socket?.remoteAddress || 'unknown';
  router.post('/api/login', express.json({ limit: '1kb' }), async (req, res) => {
    if (!auth?.configured) {
      res.status(503).json({ error: 'ADMIN_NOT_CONFIGURED' });
      return;
    }
    const { username, password } = req.body ?? {};
    const result = await auth.login({ username, password, client: clientOf(req) });
    if (result.ok) {
      res.set('Set-Cookie', sessionCookie(result.token, { maxAgeS: auth.maxAgeS, secure: auth.secure }));
      res.json({ ok: true });
    } else if (result.reason === 'LOCKED') {
      res.set('Retry-After', String(result.retryAfterS));
      res.status(429).json({ error: 'TOO_MANY_ATTEMPTS', retryAfterS: result.retryAfterS });
    } else {
      res.status(401).json({ error: 'INVALID_CREDENTIALS' });
    }
  });
  router.post('/api/logout', (req, res) => {
    res.set('Set-Cookie', clearedCookie({ secure: Boolean(auth?.secure) }));
    res.json({ ok: true });
  });

  // 여기부터는 관리자만
  router.use('/api', guard);
  router.get('/api/session', (req, res) => {
    res.json({ ok: true });
  });

  router.get('/api/graphs', (req, res) => {
    res.json({ graphs: GRAPHS, limits: { maxLoopAttempts: limits.maxLoopAttempts, maxLlmCalls: limits.maxLlmCalls } });
  });

  router.get('/api/scenarios', (req, res) => {
    res.json({ scenarios: Object.entries(SCENARIOS).map(([name, s]) => ({ name, ...s })) });
  });

  router.get('/api/health', (req, res) => {
    res.json({ store: storeKind, recorderFailures: recorder.failures, activeRuns: active.size });
  });

  // 접속 현황: 최근에 서버를 쓴 사람과, 그중 지금 에이전트를 쓰는 사람. 해시 키의 앞부분만 내보낸다.
  // 서버를 다시 켜서 메모리가 비었어도, 최근에 에이전트를 쓴 사람은 실행 기록(DB)에서 다시 채운다 (restored: true).
  router.get('/api/presence', async (req, res) => {
    const runs = (await reader.listRuns({ limit: 100 })).map((r) => ({
      agent: r.agent,
      actorKey: r.actorKey,
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      status: viewOf(r)?.status ?? r.status,
    }));
    const users = restoreUsersFromRuns({ users: presence.snapshot(), runs, now: now(), windowMs: presenceConfig.windowMs, stable: presence.stable });
    const result = describeUsers({ users, runs, now: now(), recentMs: presenceConfig.recentMs });
    res.json({ stable: presence.stable, windowMs: presenceConfig.windowMs, recentMs: presenceConfig.recentMs, ...result });
  });

  router.get('/api/runs', async (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 30, 1), 100);
    const runs = await reader.listRuns({ limit });
    res.json({ runs: runs.map(brief) });
  });

  router.get('/api/runs/:id', async (req, res) => {
    const run = UUID.test(req.params.id) ? await reader.getRun(req.params.id) : null;
    if (!run) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    res.json({ run: present(run) });
  });

  // 시나리오 실행: 실행 id를 바로 돌려주고 끝까지 기다리지 않는다. 화면이 진행 상황을 계속 물어서 본다.
  router.post('/api/scenarios/:name/run', (req, res) => {
    const { name } = req.params;
    if (!Object.hasOwn(SCENARIOS, name)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (active.size >= MAX_ACTIVE) {
      res.status(429).json({ error: 'TOO_MANY_RUNNING' });
      return;
    }
    // 시연 유저(가짜)가 에이전트를 쓰는 것으로 기록한다. 실제 사용자와 섞이지 않게 키가 'demo:'로 시작한다.
    const demoKey = `${DEMO_PREFIX}${DEMO_USERS[demoSeq % DEMO_USERS.length]}`;
    demoSeq += 1;
    presence.touchDemo(demoKey);
    const run = recorder.startRun({ agent: SCENARIOS[name].agent, actorKey: demoKey });
    active.set(run.id, run);
    runScenario(name, { run, limits, delayMs })
      .catch(() => {}) // runScenario는 안에서 에러를 폴백으로 바꾼다. 여기까지 오는 것은 예상 밖이라 조용히 끝낸다.
      .finally(() => active.delete(run.id));
    res.status(202).json({ runId: run.id });
  });

  // 저장 일치 검사: "보내려던 기록"과 "저장소에서 읽어 온 기록"을 맞춰 본다.
  router.post('/api/runs/:id/check', async (req, res) => {
    const { id } = req.params;
    const events = UUID.test(id) ? loggedStore.eventsFor(id) : [];
    if (events.length === 0 && !active.has(id)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (!events.some((e) => e.type === 'run_end')) {
      res.status(409).json({ error: 'RUN_NOT_FINISHED' });
      return;
    }
    await active.get(id)?.flush(); // 밀린 쓰기가 끝나길 기다린다 (에이전트 요청이 아니라 관리자 확인 요청이라 기다려도 된다)
    const result = await checkConsistency({ expectedEvents: events, reader, runId: id });
    res.json({ ...result, store: storeKind, recorderFailures: recorder.failures });
  });

  return router;
}
