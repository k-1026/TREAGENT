import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRoute } from '../src/ai/validate_route.js';

const CANDS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
const GOOD = { title: '근대골목길', placeIds: ['a', 'b', 'c'], reason: '덥지 않은 날이라 천천히 걷기 좋아요.' };
const err = (raw, cands = CANDS) => validateRoute(raw, cands).error;

test('올바른 응답은 통과한다', () => {
  const r = validateRoute(GOOD, CANDS);
  assert.equal(r.ok, true);
  assert.deepEqual(r.route.placeIds, ['a', 'b', 'c']);
});

test('객체가 아니면 거부', () => {
  assert.equal(err(null), 'NOT_OBJECT');
  assert.equal(err('길'), 'NOT_OBJECT');
});

test('후보에 없는 id는 거부', () => {
  assert.equal(err({ ...GOOD, placeIds: ['a', 'b', 'zzz'] }), 'IDS_NOT_CANDIDATE');
});

test('중복 id, 개수 불일치는 거부', () => {
  assert.equal(err({ ...GOOD, placeIds: ['a', 'a', 'b'] }), 'IDS_DUPLICATE');
  assert.equal(err({ ...GOOD, placeIds: ['a', 'b'] }), 'IDS_COUNT');
});

test('후보가 3곳보다 적으면 후보 수만큼만 요구한다', () => {
  const two = [{ id: 'a' }, { id: 'b' }];
  assert.equal(validateRoute({ ...GOOD, placeIds: ['a', 'b'] }, two).ok, true);
});

test('후보가 없으면 거부', () => {
  assert.equal(err(GOOD, []), 'NO_CANDIDATE');
});

test('길 이름은 "길"로 끝나야 하고 길이 제한이 있다', () => {
  assert.equal(err({ ...GOOD, title: '근대골목' }), 'TITLE_SUFFIX');
  assert.equal(err({ ...GOOD, title: '길' }), 'TITLE_LENGTH');
  assert.equal(err({ ...GOOD, title: '아주아주아주아주아주긴이름의길' }), 'TITLE_LENGTH');
});

test('금칙어는 이름과 이유에서 거부', () => {
  assert.equal(err({ ...GOOD, title: '최고의길' }), 'TITLE_FORBIDDEN');
  assert.equal(err({ ...GOOD, reason: '대구에서 유일한 길이에요.' }), 'REASON_FORBIDDEN');
});

test('이유가 비었거나 너무 길면 거부', () => {
  assert.equal(err({ ...GOOD, reason: '   ' }), 'REASON_LENGTH');
  assert.equal(err({ ...GOOD, reason: 'a'.repeat(121) }), 'REASON_LENGTH');
});