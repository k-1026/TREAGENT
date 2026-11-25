import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createMemoryRunReader, createPgRunReader, createLoggedStore, checkConsistency, RUNS_SQL, RUN_ONE_SQL, STEPS_SQL,
} from '../src/admin/run_reader.js';
import { createRecorder } from '../src/agents/common/recorder.js';
import { createMemoryRunStore, foldEvents } from '../src/agents/common/run_store_memory.js';

async function record(store, agent = 'course') {
  const recorder = createRecorder({ store });
  const run = recorder.startRun({ agent });
  await run.step({ node: 'planner', kind: 'llm', summary: { b: 1, a: 2 }, prompt: { system: 's', user: 'u' }, toRecord: () => ({ output: { y: 1, x: 2 }, inputTokens: 5, outputTokens: 6, totalTokens: 11, llmCalls: 1, model: 'm', promptVersion: 'v1' }) }, () => 1);
  await run.step({ node: 'checker', kind: 'code', attempt: 2, toRecord: () => ({ verdict: 'fail', reasonCode: 'NOT_OPEN' }) }, () => 2);
  await run.finish({ outcome: 'fallback', fallbackReason: 'X' });
  return run.id;
}

// 저장된 이벤트를 pg가 돌려줄 법한 행(Date, 열 이름 그대로)으로 바꿔 주는 가짜 DB
function fakePgFrom(events, { tweak } = {}) {
  const runs = foldEvents(events);
  const calls = [];
  const query = async (text, params) => {
    calls.push({ text, params });
    const toRow = (r) => ({ id: r.id, agent: r.agent, actorKey: r.actorKey, startedAt: new Date(r.startedAt), endedAt: r.endedAt && new Date(r.endedAt), outcome: r.outcome, fallbackReason: r.fallbackReason });
    if (text === RUNS_SQL) return runs.slice(0, params[0]).map(toRow);
    if (text === RUN_ONE_SQL) return runs.filter((r) => r.id === params[0]).map(toRow);
    if (text === STEPS_SQL) {
      let rows = runs.filter((r) => params[0].includes(r.id)).flatMap((r) => r.steps.map((s) => ({ runId: r.id, ...s, startedAt: new Date(s.startedAt) })));
      if (tweak) rows = tweak(rows);
      return rows;
    }
    throw new Error('예상 밖 SQL');
  };
  return { query, calls };
}

test('메모리 reader: 최근 실행이 앞이고 limit과 getRun이 동작한다', async () => {
  const store = createMemoryRunStore();
  const a = await record(store);
  const b = await record(store);
  const reader = createMemoryRunReader(store);
  assert.deepEqual((await reader.listRuns()).map((r) => r.id), [b, a].map((x) => x));
  assert.equal((await reader.listRuns({ limit: 1 })).length, 1);
  assert.equal((await reader.getRun(a)).steps.length, 2);
  assert.equal(await reader.getRun('nope'), null);
});

test('pg reader: 가짜 DB 행을 메모리 reader와 같은 모양으로 합친다 (Date는 ISO 글자로)', async () => {
  const store = createMemoryRunStore();
  const id = await record(store);
  const { query } = fakePgFrom(store.events);
  const run = await createPgRunReader({ query }).getRun(id);
  const expected = foldEvents(store.events)[0];
  assert.deepEqual(run, expected);
  assert.equal(typeof run.startedAt, 'string');
});

test('pg reader: select만 쓰고, 끝 줄이 없으면 running이다', async () => {
  const store = createMemoryRunStore();
  const recorder = createRecorder({ store });
  const open = recorder.startRun({ agent: 'course' });
  await open.flush();
  const { query, calls } = fakePgFrom(store.events);
  const [r] = await createPgRunReader({ query }).listRuns({ limit: 5 });
  assert.equal(r.status, 'running');
  assert.deepEqual(r.steps, []);
  for (const c of calls) assert.ok(/^\s*select/i.test(c.text) && !/\b(insert|update|delete)\b/i.test(c.text));
  assert.equal(calls[0].params[0], 5);
});

test('pg reader: 실행이 없으면 빈 목록이고 단계 조회를 하지 않는다', async () => {
  const { query, calls } = fakePgFrom([]);
  assert.deepEqual(await createPgRunReader({ query }).listRuns(), []);
  assert.equal(calls.length, 1);
  assert.equal(await createPgRunReader({ query }).getRun('00000000-0000-0000-0000-000000000000'), null);
});

test('저장 일치: 같으면 ok (jsonb 키 순서가 달라도 값이 같으면 일치)', async () => {
  const log = createLoggedStore(createMemoryRunStore());
  const id = await record(log);
  const reordered = (rows) => rows.map((r) => ({ ...r, inputSummary: r.inputSummary && Object.fromEntries(Object.entries(r.inputSummary).reverse()) }));
  const { query } = fakePgFrom(log.eventsFor(id), { tweak: reordered });
  const r = await checkConsistency({ expectedEvents: log.eventsFor(id), reader: createPgRunReader({ query }), runId: id });
  assert.deepEqual(r, { ok: true, diffs: [] });
});

test('저장 일치: 값이 다르면 필드와 함께 알려 준다 (토큰·판정)', async () => {
  const log = createLoggedStore(createMemoryRunStore());
  const id = await record(log);
  const tweak = (rows) => rows.map((r) => (r.seq === 1 ? { ...r, totalTokens: 99 } : r.seq === 2 ? { ...r, verdict: 'pass' } : r));
  const { query } = fakePgFrom(log.eventsFor(id), { tweak });
  const r = await checkConsistency({ expectedEvents: log.eventsFor(id), reader: createPgRunReader({ query }), runId: id });
  assert.equal(r.ok, false);
  assert.deepEqual(r.diffs.map((d) => d.field).sort(), ['step[1].totalTokens', 'step[2].verdict']);
  assert.deepEqual(r.diffs.find((d) => d.field === 'step[1].totalTokens'), { field: 'step[1].totalTokens', expected: 11, actual: 99 });
});

test('저장 일치: 프롬프트가 저장되지 않았거나 다르면 알려 준다', async () => {
  const log = createLoggedStore(createMemoryRunStore());
  const id = await record(log);
  const { query } = fakePgFrom(log.eventsFor(id), { tweak: (rows) => rows.map((r) => (r.seq === 1 ? { ...r, prompt: null } : r)) });
  const r = await checkConsistency({ expectedEvents: log.eventsFor(id), reader: createPgRunReader({ query }), runId: id });
  assert.equal(r.ok, false);
  assert.deepEqual(r.diffs.map((d) => d.field), ['step[1].prompt']);
  assert.deepEqual(r.diffs[0].expected, { system: 's', user: 'u' });
});

test('저장 일치: 단계가 빠지면 알려 준다', async () => {
  const log = createLoggedStore(createMemoryRunStore());
  const id = await record(log);
  const { query } = fakePgFrom(log.eventsFor(id), { tweak: (rows) => rows.filter((r) => r.seq !== 2) });
  const r = await checkConsistency({ expectedEvents: log.eventsFor(id), reader: createPgRunReader({ query }), runId: id });
  assert.equal(r.ok, false);
  assert.ok(r.diffs.some((d) => d.field === 'steps.length'));
  assert.ok(r.diffs.some((d) => d.field === 'step[2]'));
});

test('저장 일치: 저장소에 실행이 없거나 기억이 없으면 ok가 아니다', async () => {
  const log = createLoggedStore(createMemoryRunStore());
  const id = await record(log);
  const empty = createPgRunReader({ query: fakePgFrom([]).query });
  assert.deepEqual((await checkConsistency({ expectedEvents: log.eventsFor(id), reader: empty, runId: id })).diffs[0].actual, '저장소에 없음');
  assert.equal((await checkConsistency({ expectedEvents: [], reader: empty, runId: id })).ok, false);
});

test('저장소가 일부 이벤트를 실패시키면 보내려던 것과 달라서 불일치로 잡힌다', async () => {
  const inner = createMemoryRunStore();
  const failing = { append: async (e) => { if (e.type === 'step' && e.seq === 2) throw new Error('db down'); await inner.append(e); } };
  const log = createLoggedStore(failing);
  const recorder = createRecorder({ store: log });
  const run = recorder.startRun({ agent: 'course' });
  await run.step({ node: 'a', kind: 'code' }, () => 1);
  await run.step({ node: 'b', kind: 'code' }, () => 1);
  await run.finish({ outcome: 'normal' });
  assert.equal(recorder.failures, 1);
  const r = await checkConsistency({ expectedEvents: log.eventsFor(run.id), reader: createMemoryRunReader(inner), runId: run.id });
  assert.equal(r.ok, false);
});

test('기억하는 실행 수는 maxRuns로 제한되고 가장 오래된 것부터 잊는다', async () => {
  const log = createLoggedStore(createMemoryRunStore(), { maxRuns: 2 });
  const ids = [await record(log), await record(log), await record(log)];
  assert.equal(log.eventsFor(ids[0]).length, 0);
  assert.ok(log.eventsFor(ids[2]).length > 0);
});
