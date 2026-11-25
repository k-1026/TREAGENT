import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresence } from '../src/admin/presence.js';

const CFG = { windowMs: 1000, recentMs: 5000, maxUsers: 3 };
function setup(opts = {}) {
  let t = 0;
  const presence = createPresence({ secret: 'secret-1', config: CFG, now: () => t, ...opts });
  return { presence, tick: (ms) => { t += ms; } };
}

test('로그인한 사용자의 요청을 기억하고, 같은 사람은 한 명으로 센다', () => {
  const { presence } = setup();
  presence.touch('user-1');
  presence.touch('user-1');
  presence.touch('user-2');
  assert.equal(presence.snapshot().length, 2);
});

test('원본 계정 id는 기억하지도 내보내지도 않고, 64자리 해시 키만 쓴다', () => {
  const { presence } = setup();
  presence.touch('user-1');
  const [u] = presence.snapshot();
  assert.match(u.key, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify(presence.snapshot()).includes('user-1'));
});

test('같은 비밀값이면 같은 키라서 실행 기록의 actorKey와 맞춰 볼 수 있다', () => {
  const a = createPresence({ secret: 's', config: CFG });
  const b = createPresence({ secret: 's', config: CFG });
  assert.equal(a.keyOf('user-1'), b.keyOf('user-1'));
  assert.notEqual(a.keyOf('user-1'), createPresence({ secret: 'other', config: CFG }).keyOf('user-1'));
});

test('비밀값이 없으면 임시 비밀값을 쓰고(stable=false) 원본 id로 대신하지 않는다', () => {
  const none = createPresence({ secret: undefined, config: CFG });
  assert.equal(none.stable, false);
  assert.match(none.keyOf('user-1'), /^[0-9a-f]{64}$/);
  assert.notEqual(none.keyOf('user-1'), createPresence({ secret: undefined, config: CFG }).keyOf('user-1')); // 서버마다 다르다
  assert.equal(createPresence({ secret: 's', config: CFG }).stable, true);
});

test('windowMs가 지난 사람은 목록에서 빠진다', () => {
  const { presence, tick } = setup();
  presence.touch('user-1');
  tick(600);
  presence.touch('user-2');
  tick(600); // user-1은 1200ms 전, user-2는 600ms 전
  assert.deepEqual(presence.snapshot().map((u) => u.key), [presence.keyOf('user-2')]);
});

test('최근에 본 사람이 앞에 오고, 다시 요청하면 앞으로 올라온다', () => {
  const { presence, tick } = setup();
  presence.touch('a'); tick(10);
  presence.touch('b'); tick(10);
  presence.touch('a');
  assert.deepEqual(presence.snapshot().map((u) => u.key), [presence.keyOf('a'), presence.keyOf('b')]);
});

test('기억하는 사람 수는 maxUsers로 제한되고 가장 오래된 사람부터 잊는다', () => {
  const { presence, tick } = setup();
  for (const id of ['a', 'b', 'c', 'd']) { presence.touch(id); tick(10); }
  const keys = presence.snapshot().map((u) => u.key);
  assert.equal(keys.length, 3);
  assert.ok(!keys.includes(presence.keyOf('a')));
});

test('시연 유저는 demo로 표시된다 (실제 사용자와 구분)', () => {
  const { presence } = setup();
  presence.touchDemo('demo:A');
  presence.touch('user-1');
  const byKey = Object.fromEntries(presence.snapshot().map((u) => [u.key, u.demo]));
  assert.equal(byKey['demo:A'], true);
  assert.equal(byKey[presence.keyOf('user-1')], false);
});

test('계정 id가 없으면(로그인 안 함) 아무것도 기억하지 않는다', () => {
  const { presence } = setup();
  presence.touch(undefined);
  presence.touch('');
  assert.equal(presence.snapshot().length, 0);
});

test('마지막 활동 시각은 ISO 글자로 나온다', () => {
  const { presence } = setup();
  presence.touch('user-1');
  assert.equal(presence.snapshot()[0].lastSeenAt, '1970-01-01T00:00:00.000Z');
});
