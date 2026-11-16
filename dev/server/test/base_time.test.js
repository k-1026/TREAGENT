import test from 'node:test';
import assert from 'node:assert/strict';
import { getBaseDateTime } from '../src/weather/base_time.js';

// 주의: 시각 뒤의 Z는 UTC다. 한국 시간 = UTC + 9시간.
test('한국 15:00 → 14시 발표분', () => {
  const r = getBaseDateTime(new Date('2026-11-16T06:00:00Z')); // KST 15:00
  assert.equal(r.baseDate, '20261116');
  assert.equal(r.baseTime, '1400');
});

test('한국 14:05 → 아직 14시 자료가 없으니 11시 발표분', () => {
  const r = getBaseDateTime(new Date('2026-11-16T05:05:00Z')); // KST 14:05
  assert.equal(r.baseTime, '1100');
});

test('한국 02:10 → 오늘 02시 발표분', () => {
  const r = getBaseDateTime(new Date('2026-11-15T17:10:00Z')); // KST 11-16 02:10
  assert.equal(r.baseDate, '20261116');
  assert.equal(r.baseTime, '0200');
});

test('한국 01:30 → 어제 23시 발표분 (날짜가 하루 전)', () => {
  const r = getBaseDateTime(new Date('2026-11-15T16:30:00Z')); // KST 11-16 01:30
  assert.equal(r.baseDate, '20261115');
  assert.equal(r.baseTime, '2300');
});

test('한국 00:05 → 어제 23시 발표분', () => {
  const r = getBaseDateTime(new Date('2026-11-15T15:05:00Z')); // KST 11-16 00:05
  assert.equal(r.baseDate, '20261115');
  assert.equal(r.baseTime, '2300');
});