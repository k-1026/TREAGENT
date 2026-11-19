import test from 'node:test';
import assert from 'node:assert/strict';
import { createComposeGraph, runComposeGraph } from '../src/ai/compose_graph.js';

const CANDS = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), type: 'outdoor' }));
const INPUT = { mode: 'SHADE', theme: 'history', ageGroup: '20s', candidates: CANDS };
const GOOD = { placeIds: ['a', 'b', 'c'], keyword: '근대골목', reason: '그늘이 많아 걷기 좋아요.' };
const BAD_IDS = { ...GOOD, placeIds: ['a', 'b', 'zzz'] };

// 정해 둔 답을 차례로 돌려주는 가짜 AI. Error를 주면 던진다.
function fakeLlm(replies) {
  const calls = [];
  const fn = async (prompt, opts) => {
    calls.push({ prompt, opts });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    return reply;
  };
  fn.calls = calls;
  return fn;
}

test('첫 시도에서 통과하면 AI 결과를 쓴다', async () => {
  const llm = fakeLlm([GOOD]);
  const r = await runComposeGraph(createComposeGraph({ llm }), INPUT);
  assert.equal(r.source, 'ai');
  assert.equal(r.route.title, '그늘 근대골목길');
  assert.equal(r.attempts, 1);
  assert.equal(llm.calls.length, 1);
});

test('검증에 실패하면 사유를 알려 주고 한 번 더 시도한다', async () => {
  const llm = fakeLlm([BAD_IDS, GOOD]);
  const r = await runComposeGraph(createComposeGraph({ llm }), INPUT);
  assert.equal(r.source, 'ai');
  assert.equal(r.attempts, 2);
  assert.ok(llm.calls[1].prompt.user.includes('IDS_NOT_CANDIDATE'));
  assert.ok(!llm.calls[0].prompt.user.includes('[안내]'));
});

test('두 번 모두 검증에 실패하면 규칙 폴백', async () => {
  const llm = fakeLlm([BAD_IDS, { ...GOOD, keyword: '아무말' }]);
  const r = await runComposeGraph(createComposeGraph({ llm }), INPUT);
  assert.equal(r.source, 'rules');
  assert.equal(r.route, null);
  assert.equal(r.attempts, 2);
  assert.deepEqual(r.errors, ['IDS_NOT_CANDIDATE', 'KEYWORD_NOT_ALLOWED']);
});

test('AI 호출이 실패하면 다시 시도하지 않고 바로 폴백', async () => {
  const llm = fakeLlm([new Error('quota secret-key-123')]);
  const r = await runComposeGraph(createComposeGraph({ llm }), INPUT);
  assert.equal(r.source, 'rules');
  assert.equal(llm.calls.length, 1);
  assert.deepEqual(r.errors, ['LLM_FAILED']);
  assert.ok(!JSON.stringify(r).includes('secret-key-123'));
});

test('제한 시간이 지나면 AI 함수가 멈춰 있어도 폴백', async () => {
  const llm = () => new Promise(() => {});
  const graph = createComposeGraph({ llm, timeoutMs: 30 });
  const r = await runComposeGraph(graph, INPUT);
  assert.equal(r.source, 'rules');
  assert.deepEqual(r.errors, ['LLM_FAILED']);
});

test('프롬프트에 후보가 들어가고 중단 신호를 넘긴다', async () => {
  const llm = fakeLlm([GOOD]);
  await runComposeGraph(createComposeGraph({ llm }), INPUT);
  assert.ok(llm.calls[0].prompt.user.includes('id=a'));
  assert.ok(llm.calls[0].opts.signal instanceof AbortSignal);
});

test('시도 횟수 상한을 바꿀 수 있다', async () => {
  const llm = fakeLlm([BAD_IDS]);
  const r = await runComposeGraph(createComposeGraph({ llm, maxAttempts: 3 }), INPUT);
  assert.equal(r.source, 'rules');
  assert.equal(llm.calls.length, 3);
});