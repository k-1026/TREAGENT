import test from 'node:test';
import assert from 'node:assert/strict';
import { pickByRules, rankCandidates } from '../src/ai/pick_by_rules.js';
import { MODES } from '../src/rules/rule_config.js';

const P = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'outdoor',
  openHour: null, closeHour: null, closedWeekdays: [], modeAllowed: null, status: 'open', ...o,
});
const ids = (r) => r.places.map((p) => p.id);

const MIXED = [
  P({ id: 'a', zone: 'namsan' }),
  P({ id: 'b', zone: 'dongseongro' }),
  P({ id: 'c', zone: 'dongseongro' }),
  P({ id: 'd', zone: 'dongseongro' }),
  P({ id: 'e', zone: 'gyodong' }),
];

test('variant B: 20대는 동성로 권역이 먼저, 같은 권역에서 3곳', () => {
  const r = pickByRules(MODES.EXPLORE, MIXED, {}, { ageGroup: '20s', variant: 'B' });
  assert.deepEqual(ids(r), ['b', 'c', 'd']);
  assert.equal(r.zone, 'dongseongro');
});

test('사용자가 고른 권역이 나이대 기본 순서보다 우선', () => {
  const r = pickByRules(MODES.EXPLORE, MIXED, {}, { ageGroup: '20s', variant: 'B', zone: 'namsan' });
  assert.equal(r.places[0].id, 'a');
  assert.equal(r.zone, 'namsan');
});

test('variant C: 나이대별 권역 순서를 쓰지 않는다', () => {
  const r = pickByRules(MODES.EXPLORE, MIXED, {}, { ageGroup: '20s', variant: 'C' });
  assert.deepEqual(ids(r), ['a', 'b', 'c']);
});

test('60대 이상: 계단이 많은 장소는 뒤로', () => {
  const ps = [
    P({ id: 'a', zone: 'namsan', stairs: 'many' }),
    P({ id: 'b', zone: 'namsan' }),
    P({ id: 'c', zone: 'namsan' }),
    P({ id: 'd', zone: 'namsan' }),
  ];
  const r = pickByRules(MODES.EXPLORE, ps, {}, { ageGroup: '60s' });
  assert.deepEqual(ids(r), ['b', 'c', 'd']);
});

test('60대가 아니면 접근성 점수를 쓰지 않는다', () => {
  const ps = [P({ id: 'a', zone: 'namsan', stairs: 'many' }), P({ id: 'b', zone: 'namsan' })];
  const r = pickByRules(MODES.EXPLORE, ps, {}, { ageGroup: '30s', variant: 'C' });
  assert.deepEqual(ids(r), ['a', 'b']);
});

test('접근성 값이 비어 있으면(모름) 불이익을 주지 않는다', () => {
  const ps = [P({ id: 'a', zone: 'namsan', stairs: null }), P({ id: 'b', zone: 'namsan', stairs: 'few' })];
  const r = pickByRules(MODES.EXPLORE, ps, {}, { ageGroup: '60s' });
  assert.deepEqual(ids(r), ['a', 'b']);
});

test('아이 동반: 교육 적합도가 높은 장소가 먼저', () => {
  const ps = [
    P({ id: 'a', zone: 'dongseongro', eduFit: 'no' }),
    P({ id: 'b', zone: 'dongseongro', eduFit: null }),
    P({ id: 'c', zone: 'dongseongro', eduFit: 'good' }),
    P({ id: 'd', zone: 'dongseongro', eduFit: 'ok' }),
  ];
  const r = pickByRules(MODES.EXPLORE, ps, {}, { ageGroup: '30s', companion: 'kids' });
  assert.deepEqual(ids(r), ['c', 'd', 'b']);
});

test('권역에 장소가 모자라면 나머지 후보에서 채운다', () => {
  const ps = [
    P({ id: 'a', zone: 'dongseongro' }),
    P({ id: 'b', zone: 'gyodong' }),
    P({ id: 'c', zone: 'namsan' }),
    P({ id: 'd', zone: 'namsan' }),
  ];
  const r = pickByRules(MODES.EXPLORE, ps, {}, { ageGroup: '20s' });
  assert.deepEqual(ids(r), ['a', 'b', 'c']);
});

test('권역 정보가 없으면 받은 순서대로 3곳', () => {
  const ps = ['a', 'b', 'c', 'd'].map((id) => P({ id }));
  const r = pickByRules(MODES.EXPLORE, ps, {}, { ageGroup: '20s' });
  assert.deepEqual(ids(r), ['a', 'b', 'c']);
  assert.equal(r.zone, null);
});

test('HOLD는 추천하지 않는다', () => {
  const r = pickByRules(MODES.HOLD, MIXED, {}, {});
  assert.equal(r.reason, 'MODE_NO_PLACES');
  assert.deepEqual(r.places, []);
});

test('닫힌 장소와 모드에 맞지 않는 유형은 후보에서 빠진다', () => {
  const ps = [
    P({ id: 'a', type: 'outdoor' }),
    P({ id: 'b', type: 'indoor' }),
    P({ id: 'c', type: 'indoor', status: 'paused' }),
  ];
  assert.deepEqual(ids(rankCandidates(MODES.SHADE, ps)), ['b']);
});

test('후보 전체를 정렬해서 돌려준다 (AI에게 줄 목록의 기준)', () => {
  const r = rankCandidates(MODES.EXPLORE, MIXED, {}, { ageGroup: '20s' });
  assert.deepEqual(ids(r), ['b', 'c', 'd', 'e', 'a']);
});

test('입력 배열을 바꾸지 않는다', () => {
  const before = MIXED.map((p) => p.id);
  pickByRules(MODES.EXPLORE, MIXED, {}, { ageGroup: '20s' });
  assert.deepEqual(MIXED.map((p) => p.id), before);
});