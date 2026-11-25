import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeLlm, reply } from '../src/agents/common/testing/fake_llm.js';

test('정해 둔 답을 { value, usage } 모양으로 차례로 돌려주고 마지막 답을 반복한다', async () => {
  const llm = createFakeLlm([{ a: 1 }, { a: 2 }]);
  assert.deepEqual(await llm('x'), { value: { a: 1 }, usage: null });
  assert.deepEqual(await llm('y'), { value: { a: 2 }, usage: null });
  assert.deepEqual(await llm('z'), { value: { a: 2 }, usage: null });
  assert.equal(llm.calls.length, 3);
  assert.equal(llm.calls[1].input, 'y');
});

test('reply(값, 토큰)은 토큰 수까지 돌려준다', async () => {
  const usage = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
  const llm = createFakeLlm([reply({ ok: true }, usage)]);
  assert.deepEqual(await llm('x'), { value: { ok: true }, usage });
});

test('Error를 주면 던진다', async () => {
  const llm = createFakeLlm([new Error('boom')]);
  await assert.rejects(() => llm('x'), /boom/);
});

test("'hang'을 주면 끝나지 않는다", async () => {
  const llm = createFakeLlm(['hang']);
  const r = await Promise.race([llm('x').then(() => 'done'), new Promise((res) => setTimeout(() => res('pending'), 20))]);
  assert.equal(r, 'pending');
});
