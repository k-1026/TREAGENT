import test from 'node:test';
import assert from 'node:assert/strict';
import { describeUsers, restoreUsersFromRuns } from '../src/admin/user_status.js';

const NOW = Date.parse('2026-11-25T01:00:00.000Z');
const RECENT = 10 * 60 * 1000;
const K1 = 'a1b2c3d4'.padEnd(64, '0');
const K2 = 'ffeeddcc'.padEnd(64, '1');
const K3 = '12345678'.padEnd(64, '2');
const user = (key, demo = false) => ({ key, lastSeenAt: '2026-11-25T00:59:00.000Z', demo });
const run = (actorKey, agent, status, endedAt = null) => ({ actorKey, agent, status, endedAt });
const D = (users, runs) => describeUsers({ users, runs, now: NOW, recentMs: RECENT });

test('진행 중인 실행이 있으면 using, 그 에이전트가 표시된다', () => {
  const r = D([user(K1)], [run(K1, 'course', 'running')]);
  assert.deepEqual([r.users[0].state, r.users[0].agents], ['using', ['course']]);
  assert.deepEqual(r.counts, { connected: 1, using: 1, recent: 0, idle: 0 });
  assert.deepEqual(r.perAgent, { course: 1 });
});

test('recentMs 안에 끝난 실행만 있으면 recent, 오래됐으면 idle', () => {
  const recent = D([user(K1)], [run(K1, 'chat', 'ended', '2026-11-25T00:55:00.000Z')]);
  assert.deepEqual([recent.users[0].state, recent.users[0].agents], ['recent', ['chat']]);
  const old = D([user(K1)], [run(K1, 'chat', 'ended', '2026-11-25T00:30:00.000Z')]);
  assert.equal(old.users[0].state, 'idle');
});

test('실행이 없거나 다른 사람의 실행뿐이면 idle (접속만 함)', () => {
  const r = D([user(K1), user(K2)], [run(K3, 'course', 'running')]);
  assert.deepEqual(r.users.map((u) => u.state), ['idle', 'idle']);
  assert.deepEqual(r.counts, { connected: 2, using: 0, recent: 0, idle: 2 });
  assert.deepEqual(r.perAgent, {});
});

test('중단됨(stale) 실행은 사용 중으로 세지 않는다', () => {
  assert.equal(D([user(K1)], [run(K1, 'course', 'stale')]).users[0].state, 'idle');
});

test('진행 중이 최근 사용보다 우선한다', () => {
  const r = D([user(K1)], [run(K1, 'course', 'ended', '2026-11-25T00:59:00.000Z'), run(K1, 'mission_photo', 'running')]);
  assert.deepEqual([r.users[0].state, r.users[0].agents], ['using', ['mission_photo']]);
});

test('한 사람이 여러 에이전트를 동시에 쓰면 각 에이전트에 1명씩 센다', () => {
  const r = D([user(K1)], [run(K1, 'course', 'running'), run(K1, 'chat', 'running'), run(K1, 'course', 'running')]);
  assert.deepEqual(r.users[0].agents.sort(), ['chat', 'course']);
  assert.deepEqual(r.perAgent, { course: 1, chat: 1 });
});

test('에이전트별 사용 인원은 사람 수로 센다', () => {
  const r = D([user(K1), user(K2), user(K3)], [run(K1, 'course', 'running'), run(K2, 'course', 'running')]);
  assert.deepEqual(r.perAgent, { course: 2 });
  assert.deepEqual(r.counts, { connected: 3, using: 2, recent: 0, idle: 1 });
});

test('화면에는 해시 키의 앞부분만 내보낸다 (전체 키와 원본 id는 나오지 않음)', () => {
  const r = D([user(K1)], []);
  assert.equal(r.users[0].id, 'a1b2c3d4');
  assert.equal(r.users[0].label, '유저 a1b2');
  assert.ok(!JSON.stringify(r).includes(K1));
});

test('시연 유저는 이름과 demo 표시가 따로 나온다', () => {
  const r = D([user('demo:A', true)], [run('demo:A', 'course', 'running')]);
  assert.deepEqual([r.users[0].label, r.users[0].demo, r.users[0].id], ['시연 유저 A', true, 'demo:A']);
});

test('actorKey가 없는 실행(로그인 없는 시연 등)은 어느 사람에게도 붙지 않는다', () => {
  assert.equal(D([user(K1)], [run(null, 'course', 'running')]).users[0].state, 'idle');
});

// ---- 서버를 다시 켠 뒤 실행 기록에서 접속 현황 복원 ----
const WINDOW = 5 * 60 * 1000;
const rec = (actorKey, startedAt, endedAt = null) => ({ actorKey, startedAt, endedAt });
const R = (users, runs, stable = true) => restoreUsersFromRuns({ users, runs, now: NOW, windowMs: WINDOW, stable });

test('복원: 접속 목록이 비어도, windowMs 안에 에이전트를 쓴 사람은 기록에서 다시 나타난다', () => {
  const r = R([], [rec(K1, '2026-11-25T00:57:00.000Z', '2026-11-25T00:58:00.000Z')]);
  assert.deepEqual(r, [{ key: K1, lastSeenAt: '2026-11-25T00:58:00.000Z', demo: false, restored: true }]);
});

test('복원: windowMs보다 오래된 기록은 복원하지 않는다', () => {
  assert.deepEqual(R([], [rec(K1, '2026-11-25T00:40:00.000Z', '2026-11-25T00:41:00.000Z')]), []);
});

test('복원: 아직 끝나지 않은 실행은 시작 시각을 마지막 활동으로 본다', () => {
  assert.equal(R([], [rec(K1, '2026-11-25T00:58:30.000Z')])[0].lastSeenAt, '2026-11-25T00:58:30.000Z');
});

test('복원: 이미 접속 목록에 있는 사람은 그대로 두고 중복으로 더하지 않는다 (restored: false)', () => {
  const r = R([user(K1)], [rec(K1, '2026-11-25T00:57:00.000Z', '2026-11-25T00:58:00.000Z')]);
  assert.equal(r.length, 1);
  assert.equal(r[0].restored, false);
  assert.equal(r[0].lastSeenAt, '2026-11-25T00:59:00.000Z'); // 접속 기록의 시각을 쓴다
});

test('복원: 같은 사람의 여러 실행은 가장 늦은 활동 하나로 합친다', () => {
  const r = R([], [rec(K1, '2026-11-25T00:56:00.000Z', '2026-11-25T00:57:00.000Z'), rec(K1, '2026-11-25T00:58:00.000Z', '2026-11-25T00:59:30.000Z')]);
  assert.equal(r.length, 1);
  assert.equal(r[0].lastSeenAt, '2026-11-25T00:59:30.000Z');
});

test('복원: 키가 임시(stable=false)이면 실제 사용자는 복원하지 않고, 고정 키인 시연 유저만 복원한다', () => {
  const runs = [rec(K1, '2026-11-25T00:58:00.000Z'), rec('demo:A', '2026-11-25T00:58:00.000Z')];
  assert.deepEqual(R([], runs, false).map((u) => u.key), ['demo:A']);
  assert.deepEqual(R([], runs, true).map((u) => u.key).sort(), [K1, 'demo:A'].sort());
});

test('복원: actorKey가 없는 실행은 건너뛰고, 결과는 마지막 활동이 최근인 순이다', () => {
  const r = R([user(K3)], [rec(null, '2026-11-25T00:58:00.000Z'), rec(K1, '2026-11-25T00:55:00.000Z'), rec(K2, '2026-11-25T00:59:30.000Z')]);
  assert.deepEqual(r.map((u) => u.key), [K2, K3, K1]); // K2 00:59:30, K3 00:59:00, K1 00:55:00
});

test('복원한 사람도 사용 중·최근 사용 상태가 계산되고 restored 표시가 나간다', () => {
  const runs = [{ actorKey: K1, agent: 'course', status: 'ended', endedAt: '2026-11-25T00:58:00.000Z', startedAt: '2026-11-25T00:57:00.000Z' }];
  const users = R([], runs);
  const out = describeUsers({ users, runs, now: NOW, recentMs: RECENT });
  assert.deepEqual([out.users[0].state, out.users[0].agents, out.users[0].restored], ['recent', ['course'], true]);
  assert.deepEqual(out.counts, { connected: 1, using: 0, recent: 1, idle: 0 });
  assert.ok(!JSON.stringify(out).includes(K1)); // 전체 키는 나가지 않는다
});

test('접속자가 없으면 빈 목록과 0', () => {
  assert.deepEqual(D([], [run(K1, 'course', 'running')]), { counts: { connected: 0, using: 0, recent: 0, idle: 0 }, perAgent: {}, users: [] });
});
