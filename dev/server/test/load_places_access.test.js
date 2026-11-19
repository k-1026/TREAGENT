import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceLoader } from '../src/places/load_places.js';

const ROWS = [{ id: 'J01', type: 'exhibit', status: 'open' }];

test('새 열이 있는 DB는 새 SQL 한 번으로 읽는다', async () => {
  const texts = [];
  const loader = createPlaceLoader({ query: async (t) => (texts.push(t), ROWS) });
  assert.deepEqual(await loader(), { ok: true, places: ROWS });
  assert.equal(texts.length, 1);
  assert.ok(texts[0].includes('p.zone'));
  assert.ok(texts[0].includes('"routeOrder"'));
  assert.ok(texts[0].includes('"eduFit"'));
});

test('새 열이 없는 DB(첫 SQL 실패)는 기본 SQL로 다시 읽는다', async () => {
  const texts = [];
  const query = async (t) => {
    texts.push(t);
    if (t.includes('p.zone')) throw new Error('column "zone" does not exist');
    return ROWS;
  };
  const r = await createPlaceLoader({ query })();
  assert.deepEqual(r, { ok: true, places: ROWS });
  assert.equal(texts.length, 2);
  assert.ok(!texts[1].includes('p.zone'));
});

test('두 SQL 모두 장소 좌표(lat, lng)를 읽는다', async () => {
  const texts = [];
  const query = async (t) => {
    texts.push(t);
    if (t.includes('p.zone')) throw new Error('x');
    return ROWS;
  };
  await createPlaceLoader({ query })();
  for (const t of texts) {
    assert.ok(t.includes('p.lat') && t.includes('p.lng'));
  }
});

test('두 SQL이 모두 실패하면 PLACES_UNAVAILABLE이고 에러 내용은 숨긴다', async () => {
  const query = async () => {
    throw new Error('password=secret');
  };
  const r = await createPlaceLoader({ query })();
  assert.deepEqual(r, { ok: false, reason: 'PLACES_UNAVAILABLE' });
  assert.ok(!JSON.stringify(r).includes('secret'));
});