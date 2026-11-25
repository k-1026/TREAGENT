import test from 'node:test';
import assert from 'node:assert/strict';
import { createBudget } from '../src/agents/common/budget.js';

test('maxCalls번까지 차감되고 다음은 BUDGET_CALLS', () => {
  const b = createBudget({ maxCalls: 2, deadlineMs: 1000, now: () => 0 });
  b.take();
  b.take();
  assert.equal(b.remaining(), 0);
  assert.throws(() => b.take(), { code: 'BUDGET_CALLS' });
});

test('마감이 지나면 BUDGET_TIME', () => {
  let t = 0;
  const b = createBudget({ maxCalls: 5, deadlineMs: 1000, now: () => t });
  b.take();
  t = 1000;
  assert.equal(b.expired(), true);
  assert.throws(() => b.take(), { code: 'BUDGET_TIME' });
});

test('snapshot은 남은 호출 수와 시간을 알려 준다', () => {
  let t = 100;
  const b = createBudget({ maxCalls: 3, deadlineMs: 500, now: () => t });
  b.take();
  t = 300;
  assert.deepEqual(b.snapshot(), { used: 1, remaining: 2, timeLeftMs: 300 });
});

test('예산은 요청마다 따로다', () => {
  const a = createBudget({ maxCalls: 1, deadlineMs: 1000 });
  const b = createBudget({ maxCalls: 1, deadlineMs: 1000 });
  a.take();
  assert.doesNotThrow(() => b.take());
});
