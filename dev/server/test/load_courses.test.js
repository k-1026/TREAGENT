import test from 'node:test';
import assert from 'node:assert/strict';
import { createCourseLoader } from '../src/courses/load_courses.js';

const ROWS = [
  { id: 'C01', title: '제목', theme: null, district: '중구', durationMin: 60, routeType: 'explore', orderedPlaceIds: ['J03', 'J04', 'J01'] },
  { id: 'C01', title: '제목', theme: null, district: '중구', durationMin: 60, routeType: 'indoor', orderedPlaceIds: ['J01', 'J21', 'J09'] },
  { id: 'C02', title: '경로 없음', theme: null, district: null, durationMin: 30, routeType: null, orderedPlaceIds: null },
];

test('행을 코스별로 묶는다 (경로가 없는 코스도 포함)', async () => {
  const loader = createCourseLoader({ query: async () => ROWS });
  const r = await loader();
  assert.equal(r.ok, true);
  assert.equal(r.courses.length, 2);
  assert.deepEqual(r.courses[0].routes, { explore: ['J03', 'J04', 'J01'], indoor: ['J01', 'J21', 'J09'] });
  assert.deepEqual(r.courses[1].routes, {});
});

test('TTL 안에서는 DB를 다시 부르지 않는다', async () => {
  let calls = 0;
  let t = 0;
  const loader = createCourseLoader({ query: async () => { calls += 1; return ROWS; }, ttlMs: 1000, now: () => t });
  await loader();
  t = 500;
  await loader();
  assert.equal(calls, 1);
  t = 1500;
  await loader();
  assert.equal(calls, 2);
});

test('DB 오류는 COURSES_UNAVAILABLE로, 에러 내용은 숨긴다', async () => {
  const loader = createCourseLoader({ query: async () => { throw new Error('password=secret'); } });
  const r = await loader();
  assert.deepEqual(r, { ok: false, reason: 'COURSES_UNAVAILABLE' });
  assert.ok(!JSON.stringify(r).includes('secret'));
});