import test from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage } from '@langchain/core/messages';
import { createHarangiGraph, runHarangiGraph } from '../src/ai/harangi_graph.js';
import { createHarangiTools } from '../src/ai/harangi_tools.js';

const PLACES = [{ id: 'a', name: '약령시박물관', type: 'exhibit', hoursText: '09:00~18:00' }];
const INPUT = { scene: 'arrival', routeTitle: '맑은날 근대골목길', placeId: 'a' };
const tools = () => createHarangiTools({ places: PLACES, mode: 'EXPLORE', hour: 14, temperatureC: 24 });

const say = (text) => new AIMessage({ content: text });
const callTool = (name, args, id = 'call_1') =>
  new AIMessage({ content: '', tool_calls: [{ name, args, id, type: 'tool_call' }] });

// 정해 둔 답을 차례로 돌려주는 가짜 모델. Error를 주면 던진다.
function fakeModel(replies) {
  const calls = [];
  const fn = async (messages, opts) => {
    calls.push({ messages: [...messages], opts });
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (reply instanceof Error) throw reply;
    return reply;
  };
  fn.calls = calls;
  return fn;
}
const run = (model, extra = {}) => runHarangiGraph(createHarangiGraph({ model, tools: tools(), ...extra }), INPUT);

test('도구 없이 바로 대사를 쓰면 통과', async () => {
  const model = fakeModel([say('우와, 도착했어요! 같이 둘러봐요!')]);
  const r = await run(model);
  assert.equal(r.source, 'ai');
  assert.equal(r.line, '우와, 도착했어요! 같이 둘러봐요!');
  assert.equal(r.toolRounds, 0);
});

test('첫 메시지는 페르소나, 둘째는 장면 요청, 중단 신호도 넘긴다', async () => {
  const model = fakeModel([say('도착했어요!')]);
  await run(model);
  const { messages, opts } = model.calls[0];
  assert.ok(String(messages[0].content).includes('하랑이'));
  assert.ok(String(messages[1].content).includes('장소 id: a'));
  assert.ok(opts.signal instanceof AbortSignal);
});

test('도구를 부르면 조회 결과를 받아 대사를 쓴다', async () => {
  const model = fakeModel([
    callTool('get_place_info', { placeId: 'a' }),
    say('엇, 도착했어요! 09:00~18:00에 열려 있어요!'),
  ]);
  const r = await run(model);
  assert.equal(r.source, 'ai');
  assert.equal(r.toolRounds, 1);
  const second = model.calls[1].messages;
  const toolResult = second[second.length - 1];
  assert.ok(String(toolResult.content).includes('약령시박물관'));
});

test('검증에 실패하면 사유를 알려 주고 한 번 더 시도한다', async () => {
  const model = fakeModel([say('여기가 유일한 곳이에요!'), say('우와, 도착했어요!')]);
  const r = await run(model);
  assert.equal(r.source, 'ai');
  assert.equal(r.line, '우와, 도착했어요!');
  const feedback = model.calls[1].messages[model.calls[1].messages.length - 1];
  assert.ok(String(feedback.content).includes('FORBIDDEN'));
});

test('두 번 모두 검증에 실패하면 폴백', async () => {
  const model = fakeModel([say('유일한 곳!'), say('하랑이가 왔어요!')]);
  const r = await run(model);
  assert.equal(r.source, 'rules');
  assert.equal(r.line, null);
  assert.deepEqual(r.errors, ['FORBIDDEN', 'SELF_NAME']);
});

test('모델 호출이 실패하면 바로 폴백하고 에러 내용은 남기지 않는다', async () => {
  const model = fakeModel([new Error('quota secret-key-123')]);
  const r = await run(model);
  assert.equal(r.source, 'rules');
  assert.equal(model.calls.length, 1);
  assert.deepEqual(r.errors, ['LLM_FAILED']);
  assert.ok(!JSON.stringify(r).includes('secret-key-123'));
});

test('도구를 계속 요청해도 상한 뒤에는 멈추고 폴백', async () => {
  const model = fakeModel([callTool('get_today_context', {})]);
  const r = await run(model);
  assert.equal(r.source, 'rules');
  assert.equal(r.toolRounds, 2);
});

test('제한 시간이 지나면 모델이 멈춰 있어도 폴백', async () => {
  const model = () => new Promise(() => {});
  const r = await run(model, { timeoutMs: 30 });
  assert.equal(r.source, 'rules');
  assert.deepEqual(r.errors, ['LLM_FAILED']);
});

test('모델이 조각(parts) 배열로 답해도 글자를 꺼낸다', async () => {
  const model = fakeModel([new AIMessage({ content: [{ type: 'text', text: '우와, 도착했어요!' }] })]);
  const r = await run(model);
  assert.equal(r.source, 'ai');
  assert.equal(r.line, '우와, 도착했어요!');
});