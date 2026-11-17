import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceLoader } from '../src/places/load_places.js';

const ROWS = [{ id: 'J01', type: 'exhibit', status: 'open' }];

test('DB 결과를 그대로 돌려준다', async () => {
  const loader = createPlaceLoader({ query: async () => ROWS });
  assert.deepEqual(await loader(), { ok: true, places: ROWS });
});

test('TTL 안에서는 DB를 다시 부르지 않는다', async () => {
  let calls = 0;
  let t = 0;
  const loader = createPlaceLoader({ query: async () => (calls++, ROWS), ttlMs: 1000, now: () => t });
  await loader();
  t = 999;
  await loader();
  assert.equal(calls, 1);
  t = 1000;
  await loader();
  assert.equal(calls, 2);
});

test('DB 오류는 PLACES_UNAVAILABLE로, 에러 내용은 숨긴다', async () => {
  const loader = createPlaceLoader({ query: async () => { throw new Error('password=secret'); } });
  const r = await loader();
  assert.deepEqual(r, { ok: false, reason: 'PLACES_UNAVAILABLE' });
  assert.ok(!JSON.stringify(r).includes('secret'));
});