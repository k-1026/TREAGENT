import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createPgRunStore, SQL } from '../src/agents/common/run_store_pg.js';

function fakeDb() {
  const calls = [];
  return { calls, query: async (text, params) => { calls.push({ text, params }); return []; } };
}

const STEP = {
  type: 'step', runId: 'r1', seq: 1, node: 'planner', kind: 'llm', attempt: 1, startedAt: 't1', durationMs: 50,
  inputSummary: { n: 3 }, prompt: { system: 's', user: 'u' }, model: 'm', promptVersion: 'v1', output: [1, 2], verdict: 'pass', reasonCode: null,
  llmCalls: 1, inputTokens: 120, outputTokens: 30, totalTokens: 150,
};

test('이벤트 한 건은 insert 한 번으로 저장된다', async () => {
  const db = fakeDb();
  const store = createPgRunStore({ query: db.query });
  await store.append({ type: 'run_start', runId: 'r1', agent: 'course', actorKey: 'h', startedAt: 't0' });
  await store.append(STEP);
  await store.append({ type: 'run_end', runId: 'r1', endedAt: 't2', outcome: 'normal', fallbackReason: null });
  assert.deepEqual(db.calls.map((c) => c.text), [SQL.run_start, SQL.step, SQL.run_end]);
  assert.deepEqual(db.calls[0].params, ['r1', 'course', 'h', 't0']);
  assert.deepEqual(db.calls[2].params, ['r1', 't2', 'normal', null]);
  for (const c of db.calls) assert.ok(!/\b(update|delete)\b/i.test(c.text));
});

test('단계 줄: 토큰이 들어가고 jsonb는 글자로 보낸다', async () => {
  const db = fakeDb();
  await createPgRunStore({ query: db.query }).append(STEP);
  const p = db.calls[0].params;
  assert.equal(p.length, 18); // SQL의 $1~$18과 개수가 같다
  assert.equal(p[7], '{"n":3}'); // input_summary
  assert.equal(p[8], '{"system":"s","user":"u"}'); // prompt
  assert.equal(p[11], '[1,2]'); // output: 배열도 글자로 (PostgreSQL 배열로 오해받지 않게)
  assert.deepEqual(p.slice(15), [120, 30, 150]); // 입력·출력·합계 토큰
});

test('값이 없는 jsonb는 SQL NULL로 보낸다', async () => {
  const db = fakeDb();
  await createPgRunStore({ query: db.query }).append({ ...STEP, inputSummary: null, prompt: null, output: null });
  assert.equal(db.calls[0].params[7], null);
  assert.equal(db.calls[0].params[8], null);
  assert.equal(db.calls[0].params[11], null);
});

test('알 수 없는 이벤트는 TypeError, DB 오류는 그대로 던진다', async () => {
  const store = createPgRunStore({ query: async () => { throw new Error('db down'); } });
  await assert.rejects(() => store.append({ type: 'step_start' }), TypeError);
  await assert.rejects(() => store.append({ type: 'run_end', runId: 'r', endedAt: 't', outcome: 'normal', fallbackReason: null }), /db down/);
});

test('SQL 파일: 표 3개 모두 RLS와 insert-only 트리거, 좌표·원본 계정·이미지 열 없음', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/create_agent_runs.sql', import.meta.url), 'utf8');
  const code = sql.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  for (const table of ['agent_runs', 'agent_run_ends', 'agent_run_steps']) {
    assert.match(code, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(code, new RegExp(`before update or delete on public\\.${table}`));
    assert.match(code, new RegExp(`before truncate on public\\.${table}`));
  }
  for (const bad of ['lat', 'lng', 'latitude', 'longitude', 'user_id', 'email', 'image', 'photo', 'receipt', 'payment']) {
    assert.ok(!new RegExp(`^\\s+${bad}\\s`, 'm').test(code), `${bad} 열이 있으면 안 된다`);
  }
  assert.match(code, /input_tokens integer/);
  assert.match(code, /total_tokens integer/);
});

test('SQL 파일의 단계 열 18개가 insert 열과 일치한다', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/create_agent_runs.sql', import.meta.url), 'utf8');
  const insertCols = SQL.step.match(/\(([^)]*)\)\s*values/s)[1].split(',').map((s) => s.trim());
  assert.equal(insertCols.length, 18);
  for (const col of insertCols) assert.match(sql, new RegExp(`^\\s+${col}\\s`, 'm'), `${col} 열이 SQL에 없다`);
});
