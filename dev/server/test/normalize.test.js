import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForecast } from '../src/weather/normalize.js';

const row = (fcstTime, fcstValue, category = 'TMP', fcstDate = '20261116') => ({
  category, fcstDate, fcstTime, fcstValue,
});
const BASE = '2026-11-16T11:00:00+09:00';

test('한국 14:30이면 15시 기온을 고른다 (2026-11-16은 월요일)', () => {
  const items = [row('1500', '20'), row('1600', '21'), row('1700', '19')];
  const r = normalizeForecast(items, { now: new Date('2026-11-16T05:30:00Z'), baseIso: BASE });
  assert.deepEqual(r, {
    status: 'ok', temperatureC: 20, apparentTemperatureC: null,
    hour: 15, dayOfWeek: 1, baseTime: BASE, source: 'kma',
  });
});

test('한국 15:20이면 15시 행을 쓴다 (현재 시 포함)', () => {
  const items = [row('1500', '20'), row('1600', '21')];
  const r = normalizeForecast(items, { now: new Date('2026-11-16T06:20:00Z'), baseIso: BASE });
  assert.equal(r.hour, 15);
});

test('기온 외 항목은 무시한다', () => {
  const items = [row('1500', '55', 'REH'), row('1500', '20')];
  const r = normalizeForecast(items, { now: new Date('2026-11-16T05:30:00Z'), baseIso: BASE });
  assert.equal(r.temperatureC, 20);
});

test('기온 행이 없으면 MISSING_VALUE', () => {
  const r = normalizeForecast([row('1500', '55', 'REH')], { now: new Date('2026-11-16T05:30:00Z'), baseIso: BASE });
  assert.deepEqual(r, { status: 'unavailable', reason: 'MISSING_VALUE' });
});

test('빈 문자열 기온은 0도가 아니라 MISSING_VALUE', () => {
  const r = normalizeForecast([row('1500', '')], { now: new Date('2026-11-16T05:30:00Z'), baseIso: BASE });
  assert.equal(r.status, 'unavailable');
});

test('이미 지난 시각의 값뿐이면 MISSING_VALUE', () => {
  const r = normalizeForecast([row('0900', '12')], { now: new Date('2026-11-16T05:30:00Z'), baseIso: BASE });
  assert.equal(r.reason, 'MISSING_VALUE');
});