import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHS } from '../src/admin/agent_graphs.js';
import { describeRun } from '../src/admin/run_view.js';

const g = GRAPHS.course;
const step = (seq, node, verdict = 'pass', reasonCode = null) => ({ seq, node, verdict, reasonCode });
const run = (steps, extra = {}) => ({ status: 'running', startedAt: '2026-11-25T00:00:00.000Z', steps, ...extra });
const NOW = Date.parse('2026-11-25T00:00:10.000Z');

test('아직 끝난 노드가 없으면 첫 노드가 도는 중이다', () => {
  assert.deepEqual(describeRun(run([]), g, { now: NOW }).currentNodes, ['gate']);
});

test('마지막으로 끝난 노드가 통과면 화살표의 다음 노드가 도는 중이다', () => {
  const v = describeRun(run([step(1, 'gate'), step(2, 'researcher')]), g, { now: NOW });
  assert.deepEqual(v.currentNodes, ['merge']);
  assert.equal(v.status, 'running');
});

test('확인자가 실패하면 기획자로 되돌아가는 중이고 되돌이 횟수가 1이다', () => {
  const steps = [step(1, 'gate'), step(2, 'researcher'), step(3, 'merge'), step(4, 'planner'), step(5, 'checker', 'fail', 'NOT_OPEN'), step(6, 'planner')];
  const v = describeRun(run(steps.slice(0, 5)), g, { now: NOW });
  assert.deepEqual(v.currentNodes, ['planner']);
  const full = describeRun(run(steps), g, { now: NOW });
  const hit = full.loopHits.find((l) => l.from === 'checker');
  assert.deepEqual([hit.count, hit.exhausted], [1, false]);
  assert.deepEqual(full.nodeStats.checker, { runs: 1, fails: 1, lastReason: 'NOT_OPEN' });
  assert.equal(full.nodeStats.planner.runs, 2);
});

test('상한을 다 쓰고 대체 코스로 가면 소진으로 표시된다', () => {
  const steps = [step(1, 'planner'), step(2, 'checker', 'fail', 'NOT_OPEN'), step(3, 'planner'), step(4, 'checker', 'fail', 'NOT_OPEN'), step(5, 'substitute')];
  const v = describeRun(run(steps, { status: 'ended' }), g, { now: NOW });
  const hit = v.loopHits.find((l) => l.from === 'checker');
  assert.deepEqual([hit.count, hit.exhausted], [1, true]);
});

test('끝 줄이 있으면 도는 노드가 없다', () => {
  const v = describeRun(run([step(1, 'gate')], { status: 'ended' }), g, { now: NOW });
  assert.deepEqual(v.currentNodes, []);
  assert.equal(v.status, 'ended');
});

test('끝 줄 없이 오래되면 중단됨(stale)이고 도는 노드는 없다', () => {
  const v = describeRun(run([step(1, 'gate')]), g, { now: NOW, staleAfterMs: 5_000 });
  assert.equal(v.status, 'stale');
  assert.deepEqual(v.currentNodes, []);
});

test('마지막 노드가 에러면 도는 노드가 없다 (폴백으로 끝나는 중)', () => {
  const v = describeRun(run([step(1, 'gate'), step(2, 'researcher', 'error', 'LLM_TIMEOUT')]), g, { now: NOW });
  assert.deepEqual(v.currentNodes, []);
  assert.equal(v.nodeStats.researcher.lastReason, 'LLM_TIMEOUT');
});

test('구조도에 없는 노드 이름은 unknownNodes에 모이고 통계에서 빠진다', () => {
  const v = describeRun(run([step(1, 'gate'), step(2, 'mystery')]), g, { now: NOW });
  assert.deepEqual(v.unknownNodes, ['mystery']);
  assert.equal(v.nodeStats.mystery, undefined);
});

test('단계 순서가 섞여 들어와도 seq로 정렬해서 계산한다', () => {
  const v = describeRun(run([step(2, 'researcher'), step(1, 'gate')]), g, { now: NOW });
  assert.deepEqual(v.currentNodes, ['merge']);
});

test('입력 run을 바꾸지 않는다', () => {
  const r = run([step(2, 'researcher'), step(1, 'gate')]);
  describeRun(r, g, { now: NOW });
  assert.deepEqual(r.steps.map((s) => s.seq), [2, 1]);
});
