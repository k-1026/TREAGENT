import test from 'node:test';
import assert from 'node:assert/strict';
import { createActorKey, createActorKeyFromEnv } from '../src/agents/common/actor_key.js';

test('같은 이용자와 비밀값이면 항상 같은 키', () => {
  const key = createActorKey({ secret: 's1' });
  assert.equal(key('user-1'), key('user-1'));
  assert.match(key('user-1'), /^[0-9a-f]{64}$/);
});

test('이용자가 다르거나 비밀값이 다르면 키가 다르다', () => {
  assert.notEqual(createActorKey({ secret: 's1' })('user-1'), createActorKey({ secret: 's1' })('user-2'));
  assert.notEqual(createActorKey({ secret: 's1' })('user-1'), createActorKey({ secret: 's2' })('user-1'));
});

test('키에 원본 계정 id가 들어 있지 않다', () => {
  assert.ok(!createActorKey({ secret: 's1' })('user-1').includes('user-1'));
});

test('비밀값이나 이용자가 없으면 null (원본 id로 대신하지 않는다)', () => {
  assert.equal(createActorKey({ secret: '' })('user-1'), null);
  assert.equal(createActorKey({ secret: undefined })('user-1'), null);
  assert.equal(createActorKey({ secret: 's1' })(undefined), null);
});

test('환경 변수 RUN_KEY_SECRET에서 만든다', () => {
  assert.equal(createActorKeyFromEnv({}) ('user-1'), null);
  assert.equal(createActorKeyFromEnv({ RUN_KEY_SECRET: 's1' })('user-1'), createActorKey({ secret: 's1' })('user-1'));
});
