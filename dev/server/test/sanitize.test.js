import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitize } from '../src/agents/common/sanitize.js';

test('좌표·계정·사진·영수증·결제 키는 깊이 있게 제거된다', () => {
  const out = sanitize({
    mode: 'SHADE',
    lat: 35.87,
    userLocation: { latitude: 35.8, longitude: 128.6 },
    nested: { list: [{ userId: 'u-1', keep: 'ok', Photo: 'x', receipt: 'y', cardNumber: '1234' }] },
    token: 'abc',
  });
  assert.deepEqual(out, { mode: 'SHADE', userLocation: {}, nested: { list: [{ keep: 'ok' }] } });
});

test('이름에 lat이 들어 있어도 정확히 일치할 때만 지운다', () => {
  assert.deepEqual(sanitize({ translate: 'a', template: 'b' }), { translate: 'a', template: 'b' });
});

test('문자열 안의 좌표쌍·이메일·이미지 데이터가 가려진다', () => {
  const out = sanitize({ text: '현위치 35.871234, 128.601234 에서 a@b.com 사진 data:image/png;base64,AAAA' });
  assert.ok(!out.text.includes('35.871234'));
  assert.ok(!out.text.includes('a@b.com'));
  assert.ok(!out.text.includes('base64'));
});

test('긴 문자열은 잘리고 큰 배열은 제한된다', () => {
  assert.equal(sanitize('가'.repeat(50), { maxChars: 10 }).length, 11);
  assert.equal(sanitize(Array.from({ length: 80 }, (_, i) => i)).length, 50);
});

test('깊이가 너무 깊으면 잘리고, 함수는 버려진다', () => {
  let deep = { v: 1 };
  for (let i = 0; i < 10; i += 1) deep = { child: deep };
  assert.ok(JSON.stringify(sanitize(deep)).includes('깊이 초과'));
  assert.deepEqual(sanitize({ f: () => 1, ok: 1 }), { ok: 1 });
});
