import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/auth/rate_limiter.js';
import { generateInviteCode, normalizeInviteCode, INVITE_CODE_LENGTH } from '../src/party/invite_code.js';
import { strictestAge, isExpired } from '../src/party/party_rules.js';

test('시도 제한: 상한까지 허용하고 넘으면 거부, 시간이 지나면 다시 허용', () => {
  let t = 0;
  const limiter = createRateLimiter({ max: 3, windowMs: 1000, now: () => t });
  assert.deepEqual([1, 2, 3, 4].map(() => limiter.allow('u')), [true, true, true, false]);
  t = 1000;
  assert.equal(limiter.allow('u'), true);
});

test('시도 제한: 사용자마다 따로 센다', () => {
  const limiter = createRateLimiter({ max: 1, windowMs: 1000, now: () => 0 });
  assert.equal(limiter.allow('a'), true);
  assert.equal(limiter.allow('a'), false);
  assert.equal(limiter.allow('b'), true);
});

test('초대 코드: 8글자이고 헷갈리는 글자(0, O, 1, I)가 없다', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateInviteCode();
    assert.equal(code.length, INVITE_CODE_LENGTH);
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
  }
});

test('초대 코드: 매번 다른 값이 나온다', () => {
  const codes = new Set(Array.from({ length: 200 }, () => generateInviteCode()));
  assert.equal(codes.size, 200);
});

test('초대 코드 입력 정리: 소문자, 공백, 하이픈은 허용', () => {
  assert.equal(normalizeInviteCode('abcd-efgh'), 'ABCDEFGH');
  assert.equal(normalizeInviteCode('  ab cd efgh '), 'ABCDEFGH');
  assert.equal(normalizeInviteCode('ABCDEFGH'), 'ABCDEFGH');
});

test('초대 코드 입력 정리: 길이나 글자가 틀리면 null', () => {
  for (const bad of ['ABCDEFG', 'ABCDEFGHJ', 'ABCDEFG0', 'ABCDEFGO', 'ABCDEFG1', 'ABCDEFGI', '', null, 12345678, undefined]) {
    assert.equal(normalizeInviteCode(bad), null, String(bad));
  }
});

test('가장 엄격한 나이대는 가장 높은 나이대', () => {
  assert.equal(strictestAge(['20s', '60s', '30s']), '60s');
  assert.equal(strictestAge(['10s']), '10s');
  assert.equal(strictestAge([]), undefined);
  assert.equal(strictestAge(['x', 'y']), undefined);
  assert.equal(strictestAge(['x', '40s']), '40s');
});

test('만료 판단: 만료 시각이 되면 만료', () => {
  const party = { expiresAt: new Date(1000) };
  assert.equal(isExpired(party, 999), false);
  assert.equal(isExpired(party, 1000), true);
  assert.equal(isExpired({ expiresAt: new Date(1000).toISOString() }, 1001), true);
});