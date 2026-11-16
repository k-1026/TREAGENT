import test from 'node:test';
import assert from 'node:assert/strict';
import { createCache } from '../src/weather/cache.js';

test('같은 키는 loader를 한 번만 호출한다', async () => {
  const cache = createCache();
  let calls = 0;
  const loader = async () => { calls += 1; return 'v'; };
  await cache.getOrLoad('k', loader, () => 1000);
  await cache.getOrLoad('k', loader, () => 1000);
  assert.equal(calls, 1);
});

test('보관 시간이 지나면 다시 호출한다', async () => {
  let t = 0;
  const cache = createCache({ now: () => t });
  let calls = 0;
  const loader = async () => { calls += 1; return calls; };
  await cache.getOrLoad('k', loader, () => 1000);
  t = 999;
  await cache.getOrLoad('k', loader, () => 1000); // 아직 유효
  t = 1000;
  await cache.getOrLoad('k', loader, () => 1000); // 만료
  assert.equal(calls, 2);
});

test('동시에 같은 키를 요청해도 loader는 한 번만 호출한다', async () => {
  const cache = createCache();
  let calls = 0;
  const loader = async () => { calls += 1; await new Promise((r) => setTimeout(r, 20)); return 'v'; };
  const results = await Promise.all([
    cache.getOrLoad('k', loader, () => 1000),
    cache.getOrLoad('k', loader, () => 1000),
    cache.getOrLoad('k', loader, () => 1000),
  ]);
  assert.deepEqual(results, ['v', 'v', 'v']);
  assert.equal(calls, 1);
});

test('결과에 따라 보관 시간을 다르게 줄 수 있다 (실패는 짧게)', async () => {
  let t = 0;
  const cache = createCache({ now: () => t });
  let calls = 0;
  const loader = async () => { calls += 1; return { ok: false }; };
  const ttlOf = (v) => (v.ok ? 10000 : 20);
  await cache.getOrLoad('k', loader, ttlOf);
  t = 21;
  await cache.getOrLoad('k', loader, ttlOf);
  assert.equal(calls, 2);
});