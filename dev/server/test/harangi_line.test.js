import test from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage } from '@langchain/core/messages';
import { classifyScene, createHarangiLine } from '../src/ai/harangi_line.js';
import { createHarangiFactoryFromEnv } from '../src/ai/harangi_gemini.js';
import { createHarangiTools } from '../src/ai/harangi_tools.js';
import { FIXED_LINES } from '../src/ai/harangi_config.js';

const PLACES = [{ id: 'a', name: '약령시박물관', type: 'exhibit', hoursText: '09:00~18:00' }];
const BASE = { event: 'arrive', mode: 'EXPLORE', hour: 14, routeTitle: '맑은날 근대골목길', placeId: 'a', places: PLACES };

function makeModelReturning(text) {
  const state = { toolNames: null, calls: 0 };
  const make = (tools) => {
    state.toolNames = tools.map((t) => t.name).sort();
    return async () => {
      state.calls += 1;
      if (text instanceof Error) throw text;
      return new AIMessage({ content: text });
    };
  };
  make.state = state;
  return make;
}

test('장면 분류: 행동과 모드로 코드가 정한다', () => {
  assert.equal(classifyScene({ event: 'start', mode: 'EXPLORE' }), 'start');
  assert.equal(classifyScene({ event: 'arrive', mode: 'SHADE' }), 'arrival');
  assert.equal(classifyScene({ event: 'arrive', mode: 'SAFETY' }), 'safety');
  assert.equal(classifyScene({ event: 'start', mode: 'HOLD' }), 'safety');
  assert.equal(classifyScene({ event: 'start', mode: 'UNKNOWN' }), 'safety');
  assert.equal(classifyScene({ event: 'dance', mode: 'EXPLORE' }), null);
});

test('모르는 행동은 UNKNOWN_EVENT', async () => {
  const r = await createHarangiLine()({ ...BASE, event: 'dance' });
  assert.deepEqual([r.ok, r.reason], [false, 'UNKNOWN_EVENT']);
});

test('안전 모드는 AI를 부르지 않고 고정 문장을 쓴다', async () => {
  const make = makeModelReturning('우와!');
  const r = await createHarangiLine({ makeModel: make })({ ...BASE, mode: 'SAFETY' });
  assert.equal(r.scene, 'safety');
  assert.equal(r.picker, 'rules');
  assert.ok(r.text.includes('14시'));
  assert.equal(make.state.calls, 0);
});

test('모델이 없으면(키 없음) 고정 대사', async () => {
  const r = await createHarangiLine()(BASE);
  assert.equal(r.picker, 'rules');
  assert.equal(r.text, FIXED_LINES.arrival);
});

test('AI가 쓴 대사를 쓰고, 도구는 조회 전용 2개만 묶는다', async () => {
  const make = makeModelReturning('우와, 도착했어요! 같이 둘러봐요!');
  const r = await createHarangiLine({ makeModel: make })(BASE);
  assert.equal(r.picker, 'ai');
  assert.equal(r.text, '우와, 도착했어요! 같이 둘러봐요!');
  assert.deepEqual(make.state.toolNames, ['get_place_info', 'get_today_context']);
});

test('AI가 실패하거나 규칙을 어기면 고정 대사', async () => {
  const failed = await createHarangiLine({ makeModel: makeModelReturning(new Error('boom')) })(BASE);
  assert.equal(failed.picker, 'rules');
  assert.equal(failed.text, FIXED_LINES.arrival);
  const bad = await createHarangiLine({ makeModel: makeModelReturning('하랑이가 왔어요!') })(BASE);
  assert.equal(bad.picker, 'rules');
});

test('시작 장면은 시작 고정 대사', async () => {
  const r = await createHarangiLine()({ ...BASE, event: 'start' });
  assert.equal(r.text, FIXED_LINES.start);
});

test('Gemini 연결: 키나 모델이 없으면 null', () => {
  assert.equal(createHarangiFactoryFromEnv({}), null);
  assert.equal(createHarangiFactoryFromEnv({ GOOGLE_API_KEY: 'test-key' }), null);
});

test('Gemini 연결: 둘 다 있으면 도구를 묶은 호출 함수를 만든다 (실제 호출은 하지 않는다)', () => {
  const factory = createHarangiFactoryFromEnv({ GOOGLE_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' });
  assert.equal(typeof factory, 'function');
  const model = factory(createHarangiTools({ places: PLACES, mode: 'EXPLORE', hour: 14 }));
  assert.equal(typeof model, 'function');
});