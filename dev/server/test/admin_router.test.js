import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import express from 'express';
import { createAdminRouter } from '../src/admin/admin_router.js';
import { createAdminGuard } from '../src/admin/admin_guard.js';
import { createAdminAuth, hashPassword } from '../src/admin/admin_session.js';
import { createLoggedStore, createMemoryRunReader } from '../src/admin/run_reader.js';
import { createRecorder } from '../src/agents/common/recorder.js';
import { createMemoryRunStore } from '../src/agents/common/run_store_memory.js';
import { createPresence } from '../src/admin/presence.js';

const LIMITS = { maxLlmCalls: 8, deadlineMs: 5000, llmTimeoutMs: 30, maxLoopAttempts: 2, dailyMax: 30 };
const PRESENCE_CFG = { windowMs: 60_000, recentMs: 600_000, maxUsers: 50 };

async function start({ auth = createAdminAuth({}), guard = createAdminGuard({ auth, devOpen: true }), delayMs = 0, innerStore, presence = createPresence({ secret: 'test-secret', config: PRESENCE_CFG }) } = {}) {
  const inner = innerStore ?? createMemoryRunStore();
  const loggedStore = createLoggedStore(inner);
  const recorder = createRecorder({ store: loggedStore });
  const app = express();
  app.use('/admin', createAdminRouter({ guard, auth, reader: createMemoryRunReader(inner), recorder, loggedStore, storeKind: 'memory', limits: LIMITS, presence, presenceConfig: PRESENCE_CFG, delayMs }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/admin`;
  const get = async (path, init) => {
    const res = await fetch(`${base}${path}`, init);
    const text = await res.text();
    let body = null;
    try { body = JSON.parse(text); } catch { /* json이 아닌 응답 */ }
    return { status: res.status, headers: res.headers, text, body };
  };
  const post = (path) => get(path, { method: 'POST' });
  const settle = async () => { for (let i = 0; i < 200; i += 1) { if ((await get('/api/health')).body.activeRuns === 0) return; await new Promise((r) => setTimeout(r, 10)); } };
  return { get, post, settle, recorder, close: async () => { await settle(); await new Promise((r) => server.close(r)); } };
}

test('관리자 설정이 없으면 /admin/api는 모두 503으로 닫히고 화면 파일만 열린다 (로그인 화면이 안내를 보여 줌)', async () => {
  const auth = createAdminAuth({});
  const s = await start({ auth, guard: createAdminGuard({ auth }) });
  try {
    for (const path of ['/api/runs', '/api/graphs', '/api/session']) assert.equal((await s.get(path)).status, 503, path);
    assert.equal((await s.post('/api/scenarios/pass/run')).status, 503);
    assert.equal((await s.post('/api/login')).status, 503);
    assert.equal((await s.get('/')).status, 200);
    assert.equal((await s.get('/admin.js')).status, 200);
  } finally { await s.close(); }
});

// 관리자 로그인: 실제 해시와 세션 쿠키로 처음부터 끝까지 확인한다
const ADMIN_PASSWORD = 'correct horse battery';
async function startWithLogin() {
  const auth = createAdminAuth({ username: 'admin', passwordHash: await hashPassword(ADMIN_PASSWORD), secret: 'k'.repeat(40) });
  const s = await start({ auth, guard: createAdminGuard({ auth }) });
  const login = (body, extra = {}) => s.get('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body) });
  const cookieOf = (res) => res.headers.get('set-cookie').split(';')[0];
  return { ...s, login, cookieOf };
}

test('로그인 전에는 /admin/api가 401, 화면 파일은 열린다', async () => {
  const s = await startWithLogin();
  try {
    for (const path of ['/api/runs', '/api/graphs', '/api/presence', '/api/session']) assert.equal((await s.get(path)).status, 401, path);
    assert.equal((await s.post('/api/scenarios/pass/run')).status, 401);
    assert.equal((await s.get('/')).status, 200);
    assert.equal((await s.get('/admin.css')).status, 200);
  } finally { await s.close(); }
});

test('틀린 아이디·비밀번호는 같은 401이고 이유를 알려 주지 않는다', async () => {
  const s = await startWithLogin();
  try {
    const a = await s.login({ username: 'admin', password: 'wrong password!!' });
    const b = await s.login({ username: 'nobody', password: ADMIN_PASSWORD });
    assert.deepEqual([a.status, a.body], [401, { error: 'INVALID_CREDENTIALS' }]);
    assert.deepEqual([b.status, b.body], [401, { error: 'INVALID_CREDENTIALS' }]);
    assert.equal(a.headers.get('set-cookie'), null);
    assert.equal((await s.login({})).status, 401);
    assert.equal((await s.get('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json' })).status >= 400, true);
  } finally { await s.close(); }
});

test('로그인하면 HttpOnly 쿠키를 받고, 그 쿠키로 /admin/api를 쓸 수 있다. 응답에 비밀번호가 없다', async () => {
  const s = await startWithLogin();
  try {
    const res = await s.login({ username: 'admin', password: ADMIN_PASSWORD });
    assert.deepEqual([res.status, res.body], [200, { ok: true }]);
    const setCookie = res.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    assert.match(setCookie, /Path=\/admin/);
    assert.ok(!res.text.includes(ADMIN_PASSWORD) && !setCookie.includes(ADMIN_PASSWORD));
    const headers = { Cookie: s.cookieOf(res) };
    assert.equal((await s.get('/api/session', { headers })).status, 200);
    assert.equal((await s.get('/api/runs', { headers })).status, 200);
    assert.equal((await s.get('/api/runs', { headers: { Cookie: 'treagent_admin=forged.value.here' } })).status, 401);
  } finally { await s.close(); }
});

test('로그아웃은 쿠키를 지운다', async () => {
  const s = await startWithLogin();
  try {
    const res = await s.post('/api/logout');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
  } finally { await s.close(); }
});

test('다른 사이트에서 보낸 로그인·실행 요청(Origin이 다름)은 403이다', async () => {
  const s = await startWithLogin();
  try {
    const evil = { Origin: 'https://evil.example.net' };
    assert.equal((await s.login({ username: 'admin', password: ADMIN_PASSWORD }, evil)).status, 403);
    const ok = await s.login({ username: 'admin', password: ADMIN_PASSWORD });
    const cookie = s.cookieOf(ok);
    assert.equal((await s.get('/api/scenarios/pass/run', { method: 'POST', headers: { Cookie: cookie, ...evil } })).status, 403);
  } finally { await s.close(); }
});

test('너무 많이 틀리면 429와 Retry-After로 막고, 그동안은 맞는 비밀번호도 거부한다', async () => {
  const s = await startWithLogin();
  try {
    for (let i = 0; i < 5; i += 1) assert.equal((await s.login({ username: 'admin', password: 'wrong password!!' })).status, 401);
    const locked = await s.login({ username: 'admin', password: ADMIN_PASSWORD });
    assert.equal(locked.status, 429);
    assert.equal(locked.body.error, 'TOO_MANY_ATTEMPTS');
    assert.ok(Number(locked.headers.get('retry-after')) > 0);
    // 프록시가 알려 준 다른 접속 위치는 잠기지 않았다
    assert.equal((await s.login({ username: 'admin', password: ADMIN_PASSWORD }, { 'X-Forwarded-For': '198.51.100.7' })).status, 200);
  } finally { await s.close(); }
});

test('구조도·시나리오 목록·상태를 돌려준다', async () => {
  const s = await start();
  try {
    const g = await s.get('/api/graphs');
    assert.equal(Object.keys(g.body.graphs).length, 8);
    assert.equal(g.body.graphs.mission_photo.group, '미션');
    assert.equal(g.body.limits.maxLoopAttempts, 2);
    const sc = await s.get('/api/scenarios');
    assert.deepEqual(sc.body.scenarios.map((x) => x.name), [
      'pass', 'swap_place', 'rewrite', 'exhaust', 'llm_timeout', 'budget',
      'quiz_pass', 'photo_resubmit', 'photo_exhaust', 'receipt_pass', 'receipt_resubmit',
    ]);
    assert.equal(sc.body.scenarios.find((x) => x.name === 'photo_resubmit').agent, 'mission_photo');
    assert.deepEqual((await s.get('/api/health')).body, { store: 'memory', recorderFailures: 0, activeRuns: 0 });
  } finally { await s.close(); }
});

test('시나리오를 돌리면 202와 실행 id가 오고, 목록과 상세에 나타난다', async () => {
  const s = await start();
  try {
    const r = await s.post('/api/scenarios/swap_place/run');
    assert.equal(r.status, 202);
    await s.settle();
    const list = (await s.get('/api/runs')).body.runs;
    assert.equal(list.length, 1);
    assert.equal(list[0].id, r.body.runId);
    assert.deepEqual([list[0].agent, list[0].outcome, list[0].view.status], ['course', 'normal', 'ended']);
    assert.equal(list[0].stepCount, 10);
    assert.deepEqual(list[0].totals, { llmCalls: 5, totalTokens: 800 }); // 목록에서 LLM 호출 수와 토큰 합을 볼 수 있다 (LLM 단계 5개 × 160)
    assert.equal(list[0].steps, undefined); // 목록에는 단계 내용을 넣지 않는다
    const detail = (await s.get(`/api/runs/${r.body.runId}`)).body.run;
    assert.equal(detail.steps.length, 10);
    assert.ok(detail.steps.filter((s) => s.kind === 'llm').every((s) => s.prompt?.user)); // 상세에는 프롬프트가 들어 있다
    assert.equal(list[0].steps, undefined);
    assert.equal(detail.view.loopHits.find((l) => l.from === 'checker').count, 1);
  } finally { await s.close(); }
});

test('시나리오는 그 에이전트 이름으로 기록되고, 시연 유저가 번갈아 쓴 것으로 표시된다 (해시 키는 응답에 없음)', async () => {
  const s = await start();
  try {
    const a = await s.post('/api/scenarios/photo_resubmit/run');
    const b = await s.post('/api/scenarios/quiz_pass/run');
    await s.settle();
    const runs = (await s.get('/api/runs')).body.runs;
    assert.deepEqual(runs.map((r) => r.agent).sort(), ['mission_photo', 'mission_quiz']);
    assert.ok(runs.every((r) => r.demo === true));
    assert.ok(!/demo:|actorKey/.test(JSON.stringify(runs)));
    assert.notEqual(a.body.runId, b.body.runId);
  } finally { await s.close(); }
});

test('접속 현황: 시연 유저가 에이전트를 쓰는 중이면 using, 끝나면 recent로 보인다', async () => {
  const s = await start({ delayMs: 40 });
  try {
    await s.post('/api/scenarios/pass/run');
    await new Promise((r) => setTimeout(r, 80));
    const during = (await s.get('/api/presence')).body;
    assert.deepEqual(during.counts, { connected: 1, using: 1, recent: 0, idle: 0 });
    assert.deepEqual(during.perAgent, { course: 1 });
    assert.deepEqual([during.users[0].label, during.users[0].demo, during.users[0].state], ['시연 유저 A', true, 'using']);
    await s.settle();
    const after = (await s.get('/api/presence')).body;
    assert.deepEqual(after.counts, { connected: 1, using: 0, recent: 1, idle: 0 });
    assert.deepEqual(after.users[0].agents, ['course']);
    assert.deepEqual([after.stable, after.windowMs, after.recentMs], [true, 60_000, 600_000]);
  } finally { await s.close(); }
});

test('접속 현황: 로그인만 하고 에이전트는 안 쓴 사람은 idle이고, 응답에 원본 id와 전체 키가 없다', async () => {
  const presence = createPresence({ secret: 'test-secret', config: PRESENCE_CFG });
  const s = await start({ presence });
  try {
    presence.touch('real-user-123');
    const body = (await s.get('/api/presence')).body;
    assert.deepEqual(body.counts, { connected: 1, using: 0, recent: 0, idle: 1 });
    assert.equal(body.users[0].state, 'idle');
    assert.equal(body.users[0].demo, false);
    const text = JSON.stringify(body);
    assert.ok(!text.includes('real-user-123') && !text.includes(presence.keyOf('real-user-123')));
  } finally { await s.close(); }
});

test('서버를 다시 켜서 접속 목록이 비어도, 저장된 실행 기록에서 최근 사용자를 복원한다 (restored)', async () => {
  const stored = createMemoryRunStore(); // 서버를 껐다 켜도 남는 저장소(DB를 흉내 낸 것)
  const first = await start({ innerStore: stored });
  try {
    await first.post('/api/scenarios/pass/run');
    await first.settle();
    assert.equal((await first.get('/api/presence')).body.users[0].restored, false); // 켜져 있는 동안에는 접속 기록에서
  } finally { await first.close(); }

  // 서버를 다시 켠다: 접속 목록(메모리)은 새로 시작하지만 저장소는 그대로다
  const second = await start({ innerStore: stored });
  try {
    const body = (await second.get('/api/presence')).body;
    assert.deepEqual(body.counts, { connected: 1, using: 0, recent: 1, idle: 0 });
    assert.deepEqual([body.users[0].label, body.users[0].restored, body.users[0].state], ['시연 유저 A', true, 'recent']);
    assert.deepEqual(body.users[0].agents, ['course']);
  } finally { await second.close(); }
});

test('서버를 다시 켠 뒤 실제 사용자가 다시 요청하면 복원된 항목이 아니라 접속 기록으로 바뀐다', async () => {
  const stored = createMemoryRunStore();
  const presence = createPresence({ secret: 'test-secret', config: PRESENCE_CFG });
  const s = await start({ innerStore: stored, presence });
  try {
    // 같은 사람(고정 키)이 에이전트를 쓴 기록이 저장소에 있다고 하자
    const rec = createRecorder({ store: stored });
    const run = rec.startRun({ agent: 'chat', actorKey: presence.keyOf('real-user-1') });
    await run.finish({ outcome: 'normal' });
    let body = (await s.get('/api/presence')).body;
    assert.deepEqual([body.users[0].restored, body.users[0].agents], [true, ['chat']]);
    presence.touch('real-user-1'); // 사람이 다시 요청을 보냈다
    body = (await s.get('/api/presence')).body;
    assert.equal(body.users.length, 1);
    assert.equal(body.users[0].restored, false);
  } finally { await s.close(); }
});

test('임시 키(비밀값 없음)이면 실제 사용자는 복원하지 않는다', async () => {
  const stored = createMemoryRunStore();
  const presence = createPresence({ secret: undefined, config: PRESENCE_CFG }); // stable=false
  const s = await start({ innerStore: stored, presence });
  try {
    const run = createRecorder({ store: stored }).startRun({ agent: 'chat', actorKey: 'f'.repeat(64) });
    await run.finish({ outcome: 'normal' });
    const body = (await s.get('/api/presence')).body;
    assert.equal(body.stable, false);
    assert.equal(body.users.length, 0);
  } finally { await s.close(); }
});

test('접속 현황: 시연 유저가 3명을 돌려 쓴다 (A, B, C)', async () => {
  const s = await start();
  try {
    for (let i = 0; i < 4; i += 1) await s.post('/api/scenarios/pass/run');
    await s.settle();
    const labels = (await s.get('/api/presence')).body.users.map((u) => u.label).sort();
    assert.deepEqual(labels, ['시연 유저 A', '시연 유저 B', '시연 유저 C']);
  } finally { await s.close(); }
});

test('진행 중인 실행은 running이고 지금 도는 노드가 계산된다', async () => {
  const s = await start({ delayMs: 40 });
  try {
    const { body } = await s.post('/api/scenarios/pass/run');
    await new Promise((r) => setTimeout(r, 90));
    const run = (await s.get(`/api/runs/${body.runId}`)).body.run;
    assert.equal(run.view.status, 'running');
    assert.ok(run.view.currentNodes.length > 0);
    assert.equal((await s.get('/api/health')).body.activeRuns, 1);
  } finally { await s.close(); }
});

test('없는 시나리오, 이상한 id, 모르는 실행은 404', async () => {
  const s = await start();
  try {
    assert.equal((await s.post('/api/scenarios/nope/run')).status, 404);
    assert.equal((await s.post('/api/scenarios/__proto__/run')).status, 404);
    assert.equal((await s.get('/api/runs/not-a-uuid')).status, 404);
    assert.equal((await s.get('/api/runs/00000000-0000-4000-8000-000000000000')).status, 404);
    assert.equal((await s.post('/api/runs/00000000-0000-4000-8000-000000000000/check')).status, 404);
  } finally { await s.close(); }
});

test('동시에 너무 많이 돌리면 429', async () => {
  const s = await start({ delayMs: 50 });
  try {
    const codes = [];
    for (let i = 0; i < 6; i += 1) codes.push((await s.post('/api/scenarios/pass/run')).status);
    assert.deepEqual(codes, [202, 202, 202, 202, 202, 429]);
  } finally { await s.close(); }
});

test('저장 일치 검사: 끝난 실행은 ok, 진행 중이면 409', async () => {
  const s = await start({ delayMs: 40 });
  try {
    const { body } = await s.post('/api/scenarios/pass/run');
    await new Promise((r) => setTimeout(r, 60));
    assert.equal((await s.post(`/api/runs/${body.runId}/check`)).status, 409);
    await s.settle();
    const ok = await s.post(`/api/runs/${body.runId}/check`);
    assert.equal(ok.status, 200);
    assert.deepEqual([ok.body.ok, ok.body.diffs, ok.body.store, ok.body.recorderFailures], [true, [], 'memory', 0]);
  } finally { await s.close(); }
});

test('저장이 일부 실패하면 저장 일치 검사가 불일치와 기록 실패 수를 알려 준다', async () => {
  const inner = createMemoryRunStore();
  const flaky = { events: inner.events, append: async (e) => { if (e.type === 'step' && e.seq === 3) throw new Error('db down'); await inner.append(e); } };
  const s = await start({ innerStore: flaky });
  try {
    const { body } = await s.post('/api/scenarios/pass/run');
    await s.settle();
    const r = (await s.post(`/api/runs/${body.runId}/check`)).body;
    assert.equal(r.ok, false);
    assert.equal(r.recorderFailures, 1);
    assert.ok(r.diffs.some((d) => d.field === 'step[3]'));
    assert.equal((await s.get('/api/health')).body.recorderFailures, 1);
  } finally { await s.close(); }
});

test('응답 어디에도 계정 식별자(actorKey, userId)가 없다', async () => {
  const s = await start();
  try {
    const { body } = await s.post('/api/scenarios/pass/run');
    await s.settle();
    for (const path of ['/api/runs', `/api/runs/${body.runId}`, '/api/health']) {
      assert.ok(!/actorKey|userId|actor_key/i.test((await s.get(path)).text), path);
    }
  } finally { await s.close(); }
});

test('보안 헤더: 같은 곳의 스크립트만 허용하고 캐시하지 않는다', async () => {
  const s = await start();
  try {
    const r = await s.get('/api/graphs');
    assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
    assert.match(r.headers.get('content-security-policy'), /default-src 'none'/);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('cache-control'), 'no-store');
  } finally { await s.close(); }
});

test('정적 페이지: /admin/은 html, admin.js와 admin.css도 내려간다', async () => {
  const s = await start();
  try {
    const page = await s.get('/');
    assert.equal(page.status, 200);
    assert.match(page.text, /<title>TREAGENT 관리<\/title>/);
    assert.match(page.headers.get('content-type'), /html/);
    assert.match((await s.get('/admin.js')).headers.get('content-type'), /javascript/);
    assert.match((await s.get('/admin.css')).headers.get('content-type'), /css/);
  } finally { await s.close(); }
});

test('화면 코드는 서버 글을 HTML로 해석하는 방법을 쓰지 않는다 (정적 검사)', () => {
  const js = readFileSync(new URL('../src/admin/public/admin.js', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../src/admin/public/index.html', import.meta.url), 'utf8');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/.test(js));
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), '인라인 스크립트가 있으면 안 된다');
  assert.ok(!/\bstyle=/.test(html), '인라인 스타일이 있으면 안 된다');
  assert.match(html, /<meta charset="utf-8">/);
  assert.match(html, /name="viewport"/);
});
