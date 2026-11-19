import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTitle } from '../src/ai/build_title.js';
import { validateComposition } from '../src/ai/validate_composition.js';
import { readRouteOptions } from '../src/ai/read_route_options.js';

const CANDS = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const CTX = { mode: 'SHADE', theme: 'history' };
const GOOD = { placeIds: ['a', 'b', 'c'], keyword: '근대골목', reason: '그늘이 많아 걷기 좋아요.' };

test('이름은 날씨말과 키워드로 조립된다', () => {
  assert.equal(buildTitle({ mode: 'SHADE', theme: 'history', keyword: '근대골목' }), '그늘 근대골목길');
});

test('모르는 모드·테마·키워드는 null', () => {
  assert.equal(buildTitle({ mode: 'SAFETY', theme: 'history', keyword: '근대골목' }), null);
  assert.equal(buildTitle({ mode: 'SHADE', theme: 'x', keyword: '근대골목' }), null);
  assert.equal(buildTitle({ mode: 'SHADE', theme: 'history', keyword: '자유로운이름' }), null);
  assert.equal(buildTitle({ mode: '__proto__', theme: 'history', keyword: '근대골목' }), null);
});

test('올바른 구성은 통과하고 이름이 조립된다', () => {
  const r = validateComposition(GOOD, CANDS, CTX);
  assert.equal(r.ok, true);
  assert.equal(r.route.title, '그늘 근대골목길');
});

test('허용 목록 밖 키워드는 거부', () => {
  assert.equal(validateComposition({ ...GOOD, keyword: '아무말' }, CANDS, CTX).error, 'KEYWORD_NOT_ALLOWED');
});

test('객체가 아닌 응답은 거부', () => {
  assert.equal(validateComposition(null, CANDS, CTX).error, 'NOT_OBJECT');
});

test('장소 id 문제는 1단계 검증이 잡는다', () => {
  assert.equal(validateComposition({ ...GOOD, placeIds: ['a', 'b', 'zzz'] }, CANDS, CTX).error, 'IDS_NOT_CANDIDATE');
});

test('선택 입력: 없으면 기본값', () => {
  assert.deepEqual(readRouteOptions({}), {
    ageGroup: undefined,
    theme: undefined,
    companion: undefined,
    zone: undefined,
    variant: 'B',
  });
});

test('선택 입력: 허용 밖의 값이면 null', () => {
  assert.equal(readRouteOptions({ ageGroup: '70s' }), null);
  assert.equal(readRouteOptions({ theme: ['history'] }), null);
  assert.equal(readRouteOptions({ zone: 'moon' }), null);
  assert.equal(readRouteOptions({ variant: 'Z' }), null);
});

test('선택 입력: 올바른 값은 그대로 통과', () => {
  const r = readRouteOptions({ ageGroup: '60s', companion: 'kids', zone: 'namsan', variant: 'C' });
  assert.deepEqual(r, { ageGroup: '60s', theme: undefined, companion: 'kids', zone: 'namsan', variant: 'C' });
});