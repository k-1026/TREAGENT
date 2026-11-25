import test from 'node:test';
import assert from 'node:assert/strict';
import { callLlm } from '../src/agents/common/llm_call.js';
import { createBudget } from '../src/agents/common/budget.js';
import { createFakeLlm, reply } from '../src/agents/common/testing/fake_llm.js';

const budget = (o = {}) => createBudget({ maxCalls: 3, deadlineMs: 5000, ...o });

test('정상 호출은 값을 돌려주고 예산을 1 차감한다', async () => {
  const b = budget();
  const llm = createFakeLlm([{ ok: true }]);
  const r = await callLlm({ llm, input: 'q', budget: b, timeoutMs: 1000 });
  assert.deepEqual(r.value, { ok: true });
  assert.equal(r.usage, null); // 토큰 수를 모르면 null (0이 아니다)
  assert.equal(b.remaining(), 2);
  assert.ok(llm.calls[0].signal);
});

test('토큰 수(usage)를 그대로 전달한다', async () => {
  const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
  const llm = createFakeLlm([reply('답', usage)]);
  const r = await callLlm({ llm, input: 'q', budget: budget(), timeoutMs: 1000 });
  assert.deepEqual([r.value, r.usage], ['답', usage]);
});

test('{ value } 모양이 아닌 것을 돌려주는 어댑터는 LLM_FAILED', async () => {
  for (const bad of [undefined, null, 'text', { usage: null }]) {
    const llm = async () => bad;
    await assert.rejects(() => callLlm({ llm, input: 'q', budget: budget(), timeoutMs: 1000 }), { code: 'LLM_FAILED' });
  }
});

test('예산이 없으면 LLM을 부르지 않는다', async () => {
  const b = budget({ maxCalls: 0 });
  const llm = createFakeLlm([1]);
  await assert.rejects(() => callLlm({ llm, input: 'q', budget: b, timeoutMs: 1000 }), { code: 'BUDGET_CALLS' });
  assert.equal(llm.calls.length, 0);
});

test('LLM이 멈춰 있어도 제한 시간 뒤 LLM_TIMEOUT', async () => {
  const llm = createFakeLlm(['hang']);
  await assert.rejects(() => callLlm({ llm, input: 'q', budget: budget(), timeoutMs: 20 }), { code: 'LLM_TIMEOUT' });
});

test('제한 시간은 호출 1회 상한과 예산 남은 시간 중 짧은 쪽', async () => {
  const llm = createFakeLlm(['hang']);
  const t0 = Date.now();
  await assert.rejects(
    () => callLlm({ llm, input: 'q', budget: budget({ deadlineMs: 30 }), timeoutMs: 5000 }),
    { code: 'LLM_TIMEOUT' },
  );
  assert.ok(Date.now() - t0 < 1000);
});

test('LLM 에러의 원본 메시지는 버리고 LLM_FAILED만 남긴다', async () => {
  const llm = createFakeLlm([new Error('quota secret-key-123')]);
  const err = await callLlm({ llm, input: 'q', budget: budget(), timeoutMs: 1000 }).catch((e) => e);
  assert.equal(err.code, 'LLM_FAILED');
  assert.ok(!JSON.stringify({ m: err.message, s: err.stack?.split('\n')[0] }).includes('secret-key-123'));
});
