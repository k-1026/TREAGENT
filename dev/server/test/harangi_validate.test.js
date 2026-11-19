import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLine } from '../src/ai/harangi_validate.js';
import { buildPersonaSystem, buildScenePrompt } from '../src/ai/harangi_persona.js';
import { FIXED_LINES, SAFETY_LINES, LINE_MAX_LENGTH } from '../src/ai/harangi_config.js';

const err = (raw) => validateLine(raw).error;

test('올바른 대사는 통과하고 앞뒤 공백은 지운다', () => {
  const r = validateLine('  우와, 도착했어요! 오늘도 같이 걸어요!  ');
  assert.equal(r.ok, true);
  assert.equal(r.text, '우와, 도착했어요! 오늘도 같이 걸어요!');
});

test('문자열이 아니거나 비어 있으면 거부', () => {
  assert.equal(err(null), 'NOT_STRING');
  assert.equal(err('   '), 'EMPTY');
});

test('길이 제한', () => {
  assert.equal(err('가'.repeat(LINE_MAX_LENGTH + 1)), 'TOO_LONG');
  assert.equal(validateLine('가'.repeat(LINE_MAX_LENGTH)).ok, true);
});

test('금칙어는 거부', () => {
  assert.equal(err('여기가 대구에서 유일한 곳이에요!'), 'FORBIDDEN');
});

test('자신을 하랑이라고 부르면 거부 (일인칭은 저)', () => {
  assert.equal(err('하랑이가 안내할게요!'), 'SELF_NAME');
});

test('지문(별표, 괄호)은 거부', () => {
  assert.equal(err('*꼬리를 흔들며* 도착했어요!'), 'STAGE_DIRECTION');
  assert.equal(err('도착했어요! (손을 흔든다)'), 'STAGE_DIRECTION');
});

test('느낌표가 너무 많거나 물결이 있으면 거부', () => {
  assert.equal(err('우와!!!!! 도착!'), 'TOO_MANY_EXCLAMATIONS');
  assert.equal(err('도착했어요~'), 'TILDE');
});

test('운영 시간처럼 숫자 사이의 물결은 허용', () => {
  assert.equal(validateLine('엇, 09:00~18:00에 열려 있어요!').ok, true);
  assert.equal(err('09:00~18:00에 열려요~'), 'TILDE');
});

test('고정 대사는 모두 검사를 통과한다', () => {
  for (const line of [...Object.values(FIXED_LINES), ...Object.values(SAFETY_LINES)]) {
    assert.equal(validateLine(line).ok, true, line);
  }
});

test('페르소나 프롬프트에 핵심 규칙이 들어 있다', () => {
  const p = buildPersonaSystem();
  assert.ok(p.includes('해요체'));
  assert.ok(p.includes('"하랑이"라고 부르지 않습니다'));
  assert.ok(p.includes('유일'));
  assert.ok(p.includes('get_place_info'));
  assert.ok(p.includes('조회 전용'));
});

test('장면 요청문: 시작과 도착', () => {
  assert.ok(buildScenePrompt({ scene: 'start', routeTitle: '맑은날 근대골목길' }).includes('맑은날 근대골목길'));
  assert.ok(buildScenePrompt({ scene: 'arrival', placeId: 'J01' }).includes('J01'));
});