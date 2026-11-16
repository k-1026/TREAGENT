import test from 'node:test';
import assert from 'node:assert/strict';
import { decideMode } from '../src/rules/decide_mode.js';
import { MODES, RULE_CONFIG } from '../src/rules/rule_config.js';

// DEMO_ALERT 환경변수에 영향받지 않게 고정한다.
const CFG = { ...RULE_CONFIG, demoAlert: false };
const ok = (temperatureC, apparentTemperatureC = null) => ({ status: 'ok', temperatureC, apparentTemperatureC });
const run = (w, ctx) => decideMode(w, ctx, CFG);

test('온도 경계: 27.9는 EXPLORE, 28은 SHADE, 33은 INDOOR', () => {
  assert.equal(run(ok(27.9)).mode, MODES.EXPLORE);
  assert.equal(run(ok(28)).mode, MODES.SHADE);
  assert.equal(run(ok(33)).mode, MODES.INDOOR);
});

test('SHADE였다면 27.5℃까지 유지하고 26.9℃에서 풀린다', () => {
  assert.equal(run(ok(27.5), { previousMode: MODES.SHADE }).mode, MODES.SHADE);
  assert.equal(run(ok(26.9), { previousMode: MODES.SHADE }).mode, MODES.EXPLORE);
});

test('INDOOR였다면 32.5℃까지 유지, 31℃는 SHADE, 26℃는 EXPLORE', () => {
  assert.equal(run(ok(32.5), { previousMode: MODES.INDOOR }).mode, MODES.INDOOR);
  assert.equal(run(ok(31), { previousMode: MODES.INDOOR }).mode, MODES.SHADE);
  assert.equal(run(ok(26), { previousMode: MODES.INDOOR }).mode, MODES.EXPLORE);
});

test('이전 모드가 HOLD 등 온도 모드가 아니면 히스테리시스를 쓰지 않는다', () => {
  assert.equal(run(ok(27.5), { previousMode: MODES.HOLD }).mode, MODES.EXPLORE);
});

test('체감온도가 있으면 체감온도로, 없으면 기온으로 판정한다', () => {
  const a = run(ok(20, 34));
  assert.equal(a.mode, MODES.INDOOR);
  assert.equal(a.basis, 'apparent');
  assert.equal(run(ok(20)).basis, 'air');
});

test('날씨를 못 얻으면 UNKNOWN', () => {
  assert.equal(run({ status: 'unavailable', reason: 'TIMEOUT' }).mode, MODES.UNKNOWN);
  assert.equal(run(undefined).mode, MODES.UNKNOWN);
});

test('판정 순서: 위험 > 폭염특보 > 날씨 불가', () => {
  const bad = { status: 'unavailable', reason: 'TIMEOUT' };
  assert.equal(run(ok(40), { hazard: true, heatAlert: true }).mode, MODES.HOLD);
  assert.equal(run(bad, { heatAlert: true }).mode, MODES.SAFETY);
  assert.equal(run(ok(10), { heatAlert: true }).reason, 'HEAT_ALERT');
});

test('DEMO_ALERT 설정이 켜지면 SAFETY', () => {
  const r = decideMode(ok(10), {}, { ...RULE_CONFIG, demoAlert: true });
  assert.deepEqual([r.mode, r.reason], [MODES.SAFETY, 'DEMO_ALERT']);
});