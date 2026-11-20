import test from 'node:test';
import assert from 'node:assert/strict';
import { AIMessage } from '@langchain/core/messages';
import { buildBriefingFacts, fixedBriefing, shortName, validateBriefing } from '../src/ai/harangi_briefing.js';
import { createHarangiLine } from '../src/ai/harangi_line.js';
import { createRouteCache } from '../src/ai/route_cache.js';
import { buildPersonaSystem, buildScenePrompt } from '../src/ai/harangi_persona.js';
import { validateLine } from '../src/ai/harangi_validate.js';
import { BRIEFING_MAX_LENGTH } from '../src/ai/harangi_config.js';

const FACTS = { title: '맑은날 근대골목길', themeLabel: '역사', durationMin: 100, placeNames: ['가장소', '나장소', '다장소'] };
const GOOD_TEXT = '우와, 오늘의 길은 맑은날 근대골목길이에요! 역사 테마로 약 100분 걸려요. 가장소, 나장소, 다장소를 차례로 돌아요!';

test('이름에서 괄호 설명을 뺀다', () => {
  assert.equal(shortName('약전골목 (약령시 거리)'), '약전골목');
  assert.equal(shortName('도서관 (복지관 5층)  분관'), '도서관 분관');
  assert.equal(shortName('동성로'), '동성로');
});

test('브리핑 사실: 테마 이름, 소요시간, 짧은 장소 이름', () => {
  const f = buildBriefingFacts({
    title: '그늘 근대골목길',
    theme: 'history',
    durationMin: 95,
    places: [{ name: '약전골목 (약령시 거리)' }, { name: '동성로' }],
  });
  assert.deepEqual(f, { title: '그늘 근대골목길', themeLabel: '역사', durationMin: 95, placeNames: ['약전골목', '동성로'] });
  const none = buildBriefingFacts({ title: 't', theme: 'moon', durationMin: null, places: [] });
  assert.deepEqual([none.themeLabel, none.durationMin], [null, null]);
  assert.equal(buildBriefingFacts({ title: 't', theme: 'x', durationMin: 12.5, places: [] }).durationMin, null);
});

test('고정 브리핑: 사실만 담은 문장 (받침에 따라 이에요/예요)', () => {
  assert.equal(
    fixedBriefing(FACTS),
    '오늘의 길은 맑은날 근대골목길이에요. 테마는 역사예요. 소요시간은 약 100분이에요. 가장소, 나장소, 다장소 순서로 걸어요.',
  );
  assert.ok(fixedBriefing({ ...FACTS, themeLabel: '자연' }).includes('테마는 자연이에요.'));
  assert.ok(fixedBriefing({ ...FACTS, themeLabel: '문화' }).includes('테마는 문화예요.'));
});

test('고정 브리핑: 소요시간을 모르면 모른다고 말하고, 테마가 없으면 빼며, 그래도 검증을 통과한다', () => {
  const noTime = { ...FACTS, durationMin: null };
  assert.ok(fixedBriefing(noTime).includes('소요시간은 아직 알 수 없어요.'));
  assert.ok(!fixedBriefing({ ...FACTS, themeLabel: null }).includes('테마는'));
  for (const facts of [FACTS, noTime, { ...FACTS, themeLabel: null }]) {
    assert.equal(validateBriefing(fixedBriefing(facts), facts).ok, true, fixedBriefing(facts));
  }
});

test('브리핑 검증: 올바른 문장은 통과', () => {
  assert.deepEqual(validateBriefing(GOOD_TEXT, FACTS), { ok: true, text: GOOD_TEXT });
});

test('브리핑 검증: 장소나 테마가 빠지면 거부', () => {
  assert.equal(validateBriefing(GOOD_TEXT.replace('나장소, ', ''), FACTS).error, 'MISSING_PLACE');
  assert.equal(validateBriefing(GOOD_TEXT.replace('역사', '옛날'), FACTS).error, 'MISSING_THEME');
});

test('브리핑 검증: 소요시간이 빠졌거나 지어낸 시간이면 거부', () => {
  assert.equal(validateBriefing(GOOD_TEXT.replace('약 100분 ', ''), FACTS).error, 'MISSING_DURATION');
  assert.equal(validateBriefing(GOOD_TEXT.replace('100분', '90분'), FACTS).error, 'MISSING_DURATION');
  assert.equal(validateBriefing(`${GOOD_TEXT} 중간에 10분 쉬어요.`, FACTS).error, 'INVENTED_DURATION');
  assert.equal(validateBriefing(`${GOOD_TEXT} 2시간 코스예요.`, FACTS).error, 'INVENTED_DURATION');
});

test('브리핑 검증: 소요시간을 모르면 시간을 말하면 안 된다', () => {
  const noTime = { ...FACTS, durationMin: null };
  assert.equal(validateBriefing(GOOD_TEXT, noTime).error, 'INVENTED_DURATION');
  assert.equal(validateBriefing(GOOD_TEXT.replace('약 100분', '넉넉히'), noTime).ok, true);
});

test('브리핑 검증: 대사 규칙(금칙어, 지문, 길이)도 그대로 적용', () => {
  assert.equal(validateBriefing(`${GOOD_TEXT} 여기가 유일해요.`, FACTS).error, 'FORBIDDEN');
  assert.equal(validateBriefing(`${GOOD_TEXT} (손을 흔든다)`, FACTS).error, 'STAGE_DIRECTION');
  assert.equal(validateBriefing(`${GOOD_TEXT}${'가'.repeat(BRIEFING_MAX_LENGTH)}`, FACTS).error, 'TOO_LONG');
  // 일반 대사는 100자 제한이고 브리핑은 더 길게 허용한다
  assert.equal(validateLine(GOOD_TEXT.repeat(2)).error, 'TOO_LONG');
});

test('프롬프트: 브리핑 장면에 사실이 들어가고, 글자 수 상한은 브리핑 기준', () => {
  const p = buildScenePrompt({ scene: 'briefing', facts: FACTS });
  assert.ok(p.includes('길 이름: 맑은날 근대골목길'));
  assert.ok(p.includes('테마: 역사'));
  assert.ok(p.includes('소요시간: 약 100분'));
  assert.ok(p.includes('장소(방문 순서): 가장소 → 나장소 → 다장소'));
  assert.ok(buildScenePrompt({ scene: 'briefing', facts: { ...FACTS, durationMin: null } }).includes('시간은 말하지 않습니다'));
  assert.ok(buildPersonaSystem({ maxLength: BRIEFING_MAX_LENGTH }).includes(`${BRIEFING_MAX_LENGTH}자 이내`));
  assert.ok(buildPersonaSystem().includes('100자 이내'));
});

// ---- 서비스 ----
const PLACES = [{ name: '가장소' }, { name: '나장소 (별관)' }, { name: '다장소' }];
const ARGS = { event: 'briefing', mode: 'EXPLORE', hour: 14, routeTitle: '맑은날 근대골목길', theme: 'history', durationMin: 100, places: PLACES };
const OK_TEXT = '우와, 오늘의 길은 맑은날 근대골목길이에요! 역사 테마로 약 100분 걸려요. 가장소, 나장소, 다장소를 차례로 돌아요!';

function makeModel(...texts) {
  const state = { calls: 0, messages: [] };
  const make = () => async (messages) => {
    state.messages.push([...messages]);
    state.calls += 1;
    const t = texts[Math.min(state.calls - 1, texts.length - 1)];
    if (t instanceof Error) throw t;
    return new AIMessage({ content: t });
  };
  make.state = state;
  return make;
}

test('브리핑 서비스: AI가 사실에 맞게 쓰면 그 문장을 쓴다', async () => {
  const make = makeModel(OK_TEXT);
  const r = await createHarangiLine({ makeModel: make })(ARGS);
  assert.deepEqual([r.ok, r.scene, r.picker, r.text], [true, 'briefing', 'ai', OK_TEXT]);
  const human = String(make.state.messages[0][1].content);
  assert.ok(human.includes('소요시간: 약 100분'));
  assert.ok(human.includes('나장소')); // 괄호 설명은 빠진 이름
  assert.ok(!human.includes('별관'));
});

test('브리핑 서비스: 사실과 다르면 한 번 다시 시도하고, 그래도 틀리면 고정 브리핑', async () => {
  const wrong = '우와, 오늘의 길이에요! 약 30분이에요.';
  const retried = await createHarangiLine({ makeModel: makeModel(wrong, OK_TEXT) })(ARGS);
  assert.equal(retried.picker, 'ai');
  const make = makeModel(wrong);
  const fixed = await createHarangiLine({ makeModel: make })(ARGS);
  assert.equal(make.state.calls, 2);
  assert.equal(fixed.picker, 'rules');
  assert.equal(
    fixed.text,
    '오늘의 길은 맑은날 근대골목길이에요. 테마는 역사예요. 소요시간은 약 100분이에요. 가장소, 나장소, 다장소 순서로 걸어요.',
  );
});

test('브리핑 서비스: AI가 실패하거나 모델이 없으면 고정 브리핑', async () => {
  const failed = await createHarangiLine({ makeModel: makeModel(new Error('boom')) })(ARGS);
  assert.equal(failed.picker, 'rules');
  const none = await createHarangiLine()(ARGS);
  assert.equal(none.picker, 'rules');
  assert.equal(none.text, failed.text);
});

test('브리핑 서비스: 같은 사실이면 AI를 다시 부르지 않고 같은 문장을 보여 준다', async () => {
  const make = makeModel(OK_TEXT);
  const service = createHarangiLine({ makeModel: make, cache: createRouteCache() });
  const first = await service(ARGS);
  const second = await service(ARGS);
  assert.equal(make.state.calls, 1);
  assert.equal(second.text, first.text);
  await service({ ...ARGS, durationMin: 105 }); // 사실이 달라지면 새로 만든다
  assert.equal(make.state.calls >= 2, true);
});

test('브리핑 서비스: 안전이 걸린 모드에서는 브리핑 대신 안전 안내(AI 없음)', async () => {
  const make = makeModel(OK_TEXT);
  const r = await createHarangiLine({ makeModel: make })({ ...ARGS, mode: 'SAFETY' });
  assert.deepEqual([r.scene, r.picker], ['safety', 'rules']);
  assert.equal(make.state.calls, 0);
});

test('브리핑 서비스: 소요시간을 모르면(null) 시간 없이 브리핑한다', async () => {
  const text = '우와, 오늘의 길은 맑은날 근대골목길이에요! 역사 테마로 가장소, 나장소, 다장소를 차례로 돌아요!';
  const r = await createHarangiLine({ makeModel: makeModel(text) })({ ...ARGS, durationMin: null });
  assert.equal(r.picker, 'ai');
  const bad = await createHarangiLine({ makeModel: makeModel(OK_TEXT) })({ ...ARGS, durationMin: null });
  assert.equal(bad.picker, 'rules');
  assert.ok(bad.text.includes('소요시간은 아직 알 수 없어요.'));
});