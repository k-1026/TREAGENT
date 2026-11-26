import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createFailoverPool, readEntries } from '../src/agents/common/failover.js';
import { createGeminiLlms } from '../src/agents/common/gemini.js';
import { runGolden } from '../src/agents/golden/golden_set.js';
import { createAgents } from '../src/agents/index.js';
import { createAgentsRouter } from '../src/routes/agents.js';
import { createMemoryGameStores } from '../src/agents/stores/game_stores.js';
import { createFakeLlm } from '../src/agents/common/testing/fake_llm.js';
import { createPlaceDbAgent } from '../src/agents/place_db/agent.js';

// ---------- 키·모델 전환 ----------
const ENTRIES = [{ apiKey: 'SECRET-A', model: 'm1', keyNo: 1 }, { apiKey: 'SECRET-A', model: 'm2', keyNo: 1 }, { apiKey: 'SECRET-B', model: 'm1', keyNo: 2 }];

test('failover: 환경 변수의 키×모델을 순서대로 짝짓는다', () => {
  const e = readEntries({ GOOGLE_API_KEYS: 'k1, k2', GEMINI_MODELS: 'a,b' });
  assert.deepEqual(e.map((x) => `${x.keyNo}/${x.model}`), ['1/a', '1/b', '2/a', '2/b']);
  assert.equal(readEntries({ GOOGLE_API_KEY: 'k', GEMINI_MODEL: 'm' }).length, 1);
  assert.equal(readEntries({}).length, 0);
});

test('failover: 실패하면 다음 짝으로 넘어가고, 실패한 짝은 쉬었다가 돌아온다', async () => {
  let t = 1000;
  const pool = createFailoverPool({ entries: ENTRIES, cooldownMs: 500, now: () => t });
  const used = [];
  const out = await pool.run(async (e) => {
    used.push(`${e.keyNo}/${e.model}`);
    if (e.model === 'm1' && e.keyNo === 1) throw Object.assign(new Error('quota'), { status: 429 });
    return 'ok';
  });
  assert.equal(out, 'ok');
  assert.deepEqual(used, ['1/m1', '1/m2']);
  const st = pool.status();
  assert.equal(st[0].state, 'cooling');
  assert.equal(st[0].lastCode, 'HTTP_429');
  assert.equal(st[1].inUse, true);
  used.length = 0;
  await pool.run(async (e) => { used.push(`${e.keyNo}/${e.model}`); return 'ok'; });
  assert.deepEqual(used, ['1/m2']); // 쉬는 동안에는 건너뛴다
  t += 600;
  used.length = 0;
  await pool.run(async (e) => { used.push(`${e.keyNo}/${e.model}`); return 'ok'; });
  assert.deepEqual(used, ['1/m1']); // 쉬는 시간이 지나면 앞 짝으로 돌아온다
});

test('failover: 전부 실패하면 에러를 던지고, 상태에 키 값이 없고, 영원히 막히지 않는다', async () => {
  const pool = createFailoverPool({ entries: ENTRIES });
  await assert.rejects(pool.run(async () => { throw Object.assign(new Error('x'), { status: 500 }); }));
  assert.ok(!JSON.stringify(pool.status()).includes('SECRET'));
  assert.equal(pool.status().every((s) => s.state === 'cooling'), true);
  assert.equal(await pool.run(async () => 'back'), 'back');
});

test('failover: Gemini 호출이 첫 모델에서 실패하면 둘째 모델로 답하고 실제 모델이 남는다', async () => {
  const pool = createFailoverPool({ entries: ENTRIES.slice(0, 2) });
  const makeChat = (e) => ({
    withStructuredOutput: () => ({
      invoke: async () => {
        if (e.model === 'm1') throw Object.assign(new Error('429'), { status: 429 });
        return { parsed: { pass: true, reason: e.model }, raw: { usage_metadata: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } } };
      },
    }),
  });
  const llms = createGeminiLlms({ defs: { judge: {} }, pool, makeChat });
  const r = await llms.judge({ system: 's', user: 'u' });
  assert.equal(r.value.reason, 'm2');
  assert.equal(r.usage.totalTokens, 5);
  assert.equal(llms.judge.model, 'm2');
});

// ---------- 골든셋 ----------
test('골든셋(mock): 모든 문제가 통과한다', async () => {
  const r = await runGolden({ mode: 'mock' });
  assert.ok(r.total >= 12);
  assert.deepEqual(r.results.filter((x) => !x.ok).map((x) => `${x.id}: ${x.detail}`), []);
});

test('골든셋(live): LLM을 못 얻으면 그 문제는 오류로 보고된다', async () => {
  const r = await runGolden({ mode: 'live', liveLlm: () => null, only: ['course.normal'] });
  assert.equal(r.failed, 1);
  assert.match(r.results[0].detail, /오류/);
});

// ---------- API 라우트 ----------
const PLACES = [
  { id: 'p1', name: '약령시', district: '중구', type: 'indoor', lat: 35.87, lng: 128.6, hoursText: '09:00~18:00', caution: null },
  { id: 'p2', name: '근대골목', district: '중구', type: 'outdoor', lat: 35.871, lng: 128.601, hoursText: '상시', caution: null },
];
const OK = { pass: true, reason: 'ok' };
const SCRIPT = {
  classify: [{ category: 'place', placeId: 'p1' }], answer: ['우와, 9시에 열어요!'],
  explain: [{ text: '약령시는 09:00~18:00에 열어요.', evidenceKeys: ['hoursText'] }], explain_review: [OK], pick_kind: [{ kind: 'quiz' }],
  generate: [{ task: '약령시는 몇 시에 닫나요?', answer: '18시' }], generate_review: [OK], judge: [OK], hint: ['오후 늦게 닫아요.'],
  write: ['오늘은 약령시를 걸었어요. 도장을 1개 모았어요.'], prompt: [{ imagePrompt: 'x' }], image_review: [OK],
};
const fakeLlmsFor = (defs) => Object.fromEntries(Object.keys(defs).map((k) => [k, createFakeLlm(SCRIPT[k] ?? [{}])]));
const HERE = { latitude: 35.87, longitude: 128.6 };

async function serve(agentsOpts = { llmsFor: fakeLlmsFor }) {
  const stores = createMemoryGameStores();
  const agents = createAgents({ pool: null, stores, recorder: null, ...agentsOpts });
  const app = express();
  app.use((req, res, next) => { req.userId = 'user-1'; next(); });
  app.use('/agents', createAgentsRouter({ agents, stores, placeLoader: async () => ({ ok: true, places: PLACES }) }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/agents`;
  const call = async (path, body, method = 'POST') => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined });
    return { status: res.status, body: await res.json() };
  };
  return { call, stores, close: () => server.close() };
}

test('API: 미션 시작 → 힌트 → 제출 → 도장 → 도장 목록 (정답·좌표는 응답에 없다)', async () => {
  const s = await serve();
  try {
    const st = await s.call('/mission/start', { placeId: 'p1', position: HERE });
    assert.equal(st.status, 200);
    assert.equal(st.body.mission.kind, 'quiz');
    assert.ok(!JSON.stringify(st.body).includes('18시'));
    assert.ok(!JSON.stringify(st.body).includes('35.87'));
    const hint = await s.call('/mission/hint', { ticketId: st.body.mission.ticketId });
    assert.equal(hint.body.hint, '오후 늦게 닫아요.');
    const sub = await s.call('/mission/submit', { ticketId: st.body.mission.ticketId, answer: '18시' });
    assert.equal(sub.body.status, 'stamped');
    const list = await s.call('/stamps', null, 'GET');
    assert.deepEqual(list.body.stamps, [{ placeId: 'p1', kind: 'quiz' }]);
  } finally { s.close(); }
});

test('API: 도착하지 않았거나 입력이 이상하면 거부한다', async () => {
  const s = await serve();
  try {
    assert.equal((await s.call('/mission/start', { placeId: 'p1', position: { latitude: 36.1, longitude: 128.9 } })).status, 409);
    assert.equal((await s.call('/mission/start', { placeId: 'p1' })).status, 400);
    assert.equal((await s.call('/mission/start', { placeId: 'zzz', position: HERE })).status, 404);
    assert.equal((await s.call('/mission/submit', { ticketId: 'nope-ticket' })).status, 404);
    assert.equal((await s.call('/chat', { question: '' })).status, 400);
  } finally { s.close(); }
});

test('API: 이야기하기, 일기(도장 장부로 사실을 정함), 카드(이미지 생성 전이라 고정 틀)', async () => {
  const s = await serve();
  try {
    const chat = await s.call('/chat', { question: '여기 몇 시에 열어요?', placeIds: ['p1'] });
    assert.equal(chat.body.reply, '우와, 9시에 열어요!');
    const st = await s.call('/mission/start', { placeId: 'p1', position: HERE });
    await s.call('/mission/submit', { ticketId: st.body.mission.ticketId, answer: '18시' });
    const diary = await s.call('/diary', { courseTitle: '근대골목길', date: '2026-11-25', placeIds: ['p1'] });
    assert.equal(diary.status, 200);
    assert.equal(diary.body.source, 'llm');
    assert.equal((await s.stores.diary.list('user-1')).length, 1);
    const card = await s.call('/card', { courseTheme: 'history', date: '2026-11-25', placeId: 'p1' });
    assert.equal(card.body.card.source, 'fixed');
    assert.equal(card.body.card.stamp, true);
  } finally { s.close(); }
});

test('API: 키가 없어 에이전트가 꺼져 있으면 503', async () => {
  const s = await serve({});
  try {
    assert.equal((await s.call('/chat', { question: '안녕' })).status, 503);
    assert.equal((await s.call('/mission/start', { placeId: 'p1', position: HERE })).status, 503);
  } finally { s.close(); }
});

// ---------- 장소 DB 수동 등록 ----------
test('장소 DB: 수동 등록은 확인자를 거쳐 승인 대기가 되고, 승인해야 places에 반영된다', async () => {
  const stores = createMemoryGameStores();
  const agent = createPlaceDbAgent({ llms: {}, candidateStore: stores.candidates, applyToPlaces: stores.applyToPlaces });
  const cand = { name: '새 장소', type: 'indoor', district: '중구', sourceUrl: 'https://example.go.kr/a', lat: 35.87, lng: 128.6, openHour: 9, closeHour: 18, caution: null };
  const bad = await agent.discover({ area: 'manual', manual: { ...cand, lat: 37.5, lng: 127 } });
  assert.equal(bad.status, 'discarded');
  assert.equal((await stores.candidates.list()).length, 0);
  const d = await agent.discover({ area: 'manual', manual: cand });
  assert.equal(d.status, 'waiting_approval');
  assert.equal(stores.placesApplied.length, 0);
  assert.equal(agent.pendingList().length, 1);
  assert.equal((await agent.decide({ approvalId: d.approvalId, decision: 'approve' })).status, 'applied');
  assert.equal(stores.placesApplied.length, 1);
});

test('저장소: 같은 장소의 두 번째 도장은 막고, 사진은 해시 중복을 알려 준다', async () => {
  const { stamp } = createMemoryGameStores();
  await stamp.addStamp({ userKey: 'u', placeId: 'p1', kind: 'quiz' });
  await assert.rejects(stamp.addStamp({ userKey: 'u', placeId: 'p1', kind: 'photo' }));
  await stamp.recordSubmission({ userKey: 'u', placeId: 'p2', kind: 'photo', imageHash: 'h', passed: false });
  assert.equal(await stamp.hasDuplicate('u', 'p2', 'h'), true);
  assert.equal(await stamp.hasDuplicate('x', 'p2', 'h'), false);
});

test('failover: 모델을 화면 이름("Gemini 3.1 Flash Lite")으로 적어도 API 이름으로 바꿔 읽는다', () => {
  const e = readEntries({ GOOGLE_API_KEY: 'k', GEMINI_MODEL: 'Gemini 3.1 Flash Lite, gemini-3.6-flash' });
  assert.deepEqual(e.map((x) => x.model), ['gemini-3.1-flash-lite', 'gemini-3.6-flash']);
});
