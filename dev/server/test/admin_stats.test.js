import test from 'node:test';
import assert from 'node:assert/strict';
import { computeStats, parseRange, sinceOf } from '../src/admin/stats.js';

const NOW = Date.parse('2026-11-25T03:00:00Z');
const iso = (ms) => new Date(ms).toISOString();
const run = (o) => ({ agent: 'course', startedAt: iso(NOW - 60_000), endedAt: iso(NOW - 58_000), outcome: 'normal', fallbackReason: null, status: 'ended', steps: [], ...o });
const llm = (o) => ({ node: 'planner', kind: 'llm', verdict: 'pass', model: 'm1', durationMs: 800, llmCalls: 1, inputTokens: 10, outputTokens: 5, totalTokens: 15, reasonCode: null, ...o });

test('통과율·폴백 비율은 끝난 실행만 분모로 쓰고, 진행 중·중단됨은 따로 센다', () => {
  const runs = [
    run({}), run({}), run({ outcome: 'substitute', fallbackReason: 'ATTEMPTS_EXHAUSTED' }), run({ outcome: 'fallback', fallbackReason: 'LLM_TIMEOUT' }),
    run({ endedAt: null, outcome: null, status: 'running', startedAt: iso(NOW - 5_000) }),
    run({ endedAt: null, outcome: null, status: 'running', startedAt: iso(NOW - 600_000) }),
  ];
  const s = computeStats(runs, { now: NOW, limits: { maxLlmCalls: 8, dailyMax: 30 } });
  assert.equal(s.totals.runs, 6);
  assert.equal(s.totals.ended, 4);
  assert.equal(s.totals.running, 1);
  assert.equal(s.totals.stale, 1);
  assert.equal(s.totals.passRate, 0.5);
  assert.equal(s.totals.fallbackRate, 0.25);
  assert.equal(s.totals.avgDurationMs, 2000);
  assert.deepEqual(s.fallbackReasons.map((f) => f.reason).sort(), ['ATTEMPTS_EXHAUSTED', 'LLM_TIMEOUT']);
});

test('LLM 호출·토큰: 모르는 토큰은 0으로 세지 않고 따로 알린다, 모델별로 묶는다', () => {
  const runs = [run({ steps: [llm({}), llm({ model: 'm2', totalTokens: null, inputTokens: null, outputTokens: null }), llm({ model: 'm2', verdict: 'error', reasonCode: 'LLM_FAILED', totalTokens: null })] })];
  const s = computeStats(runs, { now: NOW, limits: { maxLlmCalls: 4 } });
  assert.equal(s.totals.llmCalls, 3);
  assert.equal(s.totals.tokens.total, 15);
  assert.equal(s.totals.tokens.unknownCalls, 2);
  const m2 = s.byModel.find((m) => m.model === 'm2');
  assert.deepEqual([m2.calls, m2.errors], [2, 1]);
  assert.equal(s.budget.maxCallsInRun, 3);
  assert.equal(s.budget.runsOverHalfBudget, 1); // 3회 > 상한 4의 절반
});

test('많이 막힌 이유는 에이전트·노드·사유 코드별로 센다 (통과한 단계는 세지 않는다)', () => {
  const fail = (code) => ({ node: 'checker', kind: 'code', verdict: 'fail', reasonCode: code });
  const runs = [run({ steps: [fail('NOT_OPEN'), fail('NOT_OPEN'), fail('WALK_TOO_LONG'), { node: 'gate', kind: 'code', verdict: 'pass' }] })];
  const s = computeStats(runs, { now: NOW });
  assert.deepEqual(s.topReasons.map((r) => [r.reasonCode, r.count]), [['NOT_OPEN', 2], ['WALK_TOO_LONG', 1]]);
});

test('에이전트별 표와 최근 7일: 빈 날도 0으로 채운다 (한국 시간)', () => {
  const s = computeStats([run({}), run({ agent: 'chat', outcome: 'fallback' })], { now: NOW });
  assert.equal(s.daily.length, 7);
  assert.equal(s.daily.at(-1).runs, 2);
  assert.equal(s.daily.at(-1).notNormal, 1);
  assert.equal(s.daily[0].runs, 0);
  assert.deepEqual(s.byAgent.map((a) => a.agent).sort(), ['chat', 'course']);
});

test('실행이 없으면 비율은 null이다 (0%로 속이지 않는다)', () => {
  const s = computeStats([], { now: NOW });
  assert.equal(s.totals.passRate, null);
  assert.equal(s.totals.avgDurationMs, null);
  assert.equal(s.budget.avgCallsPerRun, null);
});

test('기간 값: 모르는 값은 day, since 계산', () => {
  assert.equal(parseRange('week'), 'week');
  assert.equal(parseRange('xx'), 'day');
  assert.equal(sinceOf('day', NOW), iso(NOW - 86400_000));
  assert.equal(sinceOf('all', NOW), null);
});
