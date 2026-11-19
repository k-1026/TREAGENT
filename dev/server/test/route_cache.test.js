import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouteCache, makeCacheKey } from '../src/ai/route_cache.js';

test('같은 조건은 같은 키, 다른 조건은 다른 키', () => {
  const a = makeCacheKey({ mode: 'SHADE', ageGroup: '20s', theme: 'history', companion: 'kids' });
  const b = makeCacheKey({ mode: 'SHADE', ageGroup: '20s', theme: 'history', companion: 'kids' });
  const c = makeCacheKey({ mode: 'INDOOR', ageGroup: '20s', theme: 'history', companion: 'kids' });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test('variant를 안 주면 B로 본다', () => {
  assert.equal(makeCacheKey({ mode: 'SHADE' }), makeCacheKey({ mode: 'SHADE', variant: 'B' }));
  assert.notEqual(makeCacheKey({ mode: 'SHADE' }), makeCacheKey({ mode: 'SHADE', variant: 'C' }));
});

test('키에는 좌표가 들어가지 않는다', () => {
  const key = makeCacheKey({ mode: 'SHADE', latitude: 35.87, longitude: 128.6 });
  assert.ok(!key.includes('35.87'));
});

test('저장한 값을 보관 시간 안에서 돌려준다', () => {
  let t = 0;
  const cache = createRouteCache({ ttlMs: 1000, now: () => t });
  cache.set('k', { title: '길' });
  t = 999;
  assert.deepEqual(cache.get('k'), { title: '길' });
});

test('보관 시간이 지나면 지운다', () => {
  let t = 0;
  const cache = createRouteCache({ ttlMs: 1000, now: () => t });
  cache.set('k', 1);
  t = 1000;
  assert.equal(cache.get('k'), undefined);
  assert.equal(cache.size, 0);
});

test('최대 개수를 넘으면 가장 오래된 것부터 지운다', () => {
  const cache = createRouteCache({ max: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 2);
  assert.equal(cache.get('c'), 3);
});