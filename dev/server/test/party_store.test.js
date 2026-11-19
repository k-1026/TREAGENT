import test from 'node:test';
import assert from 'node:assert/strict';
import { createPgPartyStore } from '../src/party/party_store.js';
import { createMemoryPartyStore } from '../src/party/memory_party_store.js';

// 정해 둔 결과를 차례로 돌려주는 가짜 DB. 보낸 SQL과 값을 기록한다.
function recorder(results = []) {
  const calls = [];
  const fn = async (sql, params) => {
    calls.push({ sql, params });
    const r = results.shift();
    if (r instanceof Error) throw r;
    return r ?? [];
  };
  fn.calls = calls;
  return fn;
}
const UID = '00000000-0000-4000-8000-000000000001';
const PID = '00000000-0000-4000-8000-0000000000aa';

// 이 구현은 실제 DB 없이 "보내는 SQL과 값의 모양"과 결과 해석만 확인한다. SQL 문법 자체는 Supabase에서 직접 실행해 확인해야 한다.
test('DB 저장소: 일행 만들기는 한 문장으로 값을 순서대로 넘긴다', async () => {
  const q = recorder([[{ id: PID, inviteCode: 'ABCDEFGH', expiresAt: new Date(0) }]]);
  const expiresAt = new Date('2026-11-20T05:00:00Z');
  const r = await createPgPartyStore({ query: q }).createParty({
    hostUserId: UID, inviteCode: 'ABCDEFGH', ageGroup: '20s', companion: undefined, theme: 'history', zone: undefined, variant: undefined, expiresAt,
  });
  assert.equal(r.id, PID);
  assert.equal(q.calls.length, 1);
  assert.deepEqual(q.calls[0].params, [UID, 'ABCDEFGH', null, 'history', null, 'B', '2026-11-20T05:00:00.000Z', '20s']);
  assert.ok(q.calls[0].sql.includes('with p as'));
});

test('DB 저장소: 조회는 없으면 null', async () => {
  const store = createPgPartyStore({ query: recorder([[], [], [], []]) });
  assert.equal(await store.findByCode('ABCDEFGH'), null);
  assert.equal(await store.findById(PID), null);
  assert.equal(await store.latestRoute(PID, 'EXPLORE'), null);
  assert.deepEqual(await store.listMembers(PID), []);
});

test('DB 저장소: 참여 결과는 JOINED, ALREADY, FULL', async () => {
  const joined = createPgPartyStore({ query: recorder([[{ party_id: PID }]]) });
  assert.equal(await joined.addMember({ partyId: PID, userId: UID, ageGroup: '30s', maxMembers: 6 }), 'JOINED');
  const already = createPgPartyStore({ query: recorder([[], [{ '?column?': 1 }]]) });
  assert.equal(await already.addMember({ partyId: PID, userId: UID, ageGroup: '30s', maxMembers: 6 }), 'ALREADY');
  const q = recorder([[], []]);
  const full = createPgPartyStore({ query: q });
  assert.equal(await full.addMember({ partyId: PID, userId: UID, ageGroup: '30s', maxMembers: 6 }), 'FULL');
  assert.deepEqual(q.calls[0].params, [PID, UID, '30s', 6]);
});

test('DB 저장소: 길 저장은 새 행이 들어갔을 때만 true', async () => {
  const route = { partyId: PID, mode: 'EXPLORE', version: 2, title: '길', reason: undefined, picker: 'ai', placeIds: ['a', 'b'] };
  const ok = recorder([[{ id: 1 }]]);
  assert.equal(await createPgPartyStore({ query: ok }).saveRoute(route), true);
  assert.deepEqual(ok.calls[0].params, [PID, 'EXPLORE', 2, '길', null, 'ai', ['a', 'b']]);
  assert.equal(await createPgPartyStore({ query: recorder([[]]) }).saveRoute(route), false);
});

test('DB 저장소: 시작 처리는 시작 시각을 돌려준다', async () => {
  const when = new Date('2026-11-19T05:00:00Z');
  const store = createPgPartyStore({ query: recorder([[{ startedAt: when }]]) });
  assert.equal(await store.markStarted(PID), when);
});

test('DB 저장소: 입력값은 SQL 글자에 섞이지 않고 값으로만 넘어간다 (SQL 주입 방어)', async () => {
  const evil = "x'; drop table public.parties; --";
  const q = recorder([[{ id: PID }], [], [], [], [], [], [], [], []]);
  const store = createPgPartyStore({ query: q });
  await store.createParty({ hostUserId: evil, inviteCode: evil, ageGroup: evil, companion: evil, theme: evil, zone: evil, variant: evil, expiresAt: new Date(0) });
  await store.findByCode(evil);
  await store.findById(evil);
  await store.listMembers(evil);
  await store.addMember({ partyId: evil, userId: evil, ageGroup: evil, maxMembers: 6 });
  await store.latestRoute(evil, evil);
  await store.saveRoute({ partyId: evil, mode: evil, version: 1, title: evil, reason: evil, picker: evil, placeIds: [evil] });
  await store.markStarted(evil);
  assert.ok(q.calls.length >= 8);
  for (const { sql, params } of q.calls) {
    assert.ok(!sql.includes(evil) && !sql.includes('drop table'), sql);
    assert.ok(params.flat().includes(evil) || params.length > 0); // 값은 params로만 간다
  }
  assert.ok(q.calls.some((c) => c.params.includes(evil)));
});

// ---- 메모리 저장소(테스트·DB 없는 시연용)도 같은 약속을 지킨다 ----
test('메모리 저장소: 만들기, 조회, 참여, 인원 상한', async () => {
  const store = createMemoryPartyStore();
  const created = await store.createParty({ hostUserId: 'h', inviteCode: 'ABCDEFGH', ageGroup: '20s', theme: 'history', expiresAt: new Date(1000) });
  assert.equal((await store.findById(created.id)).hostUserId, 'h');
  assert.equal((await store.findByCode('ABCDEFGH')).id, created.id);
  assert.equal(await store.addMember({ partyId: created.id, userId: 'u1', ageGroup: '30s', maxMembers: 2 }), 'JOINED');
  assert.equal(await store.addMember({ partyId: created.id, userId: 'u1', ageGroup: '30s', maxMembers: 2 }), 'ALREADY');
  assert.equal(await store.addMember({ partyId: created.id, userId: 'u2', ageGroup: '30s', maxMembers: 2 }), 'FULL');
  assert.deepEqual((await store.listMembers(created.id)).map((m) => m.role), ['host', 'member']);
});

test('메모리 저장소: 초대 코드가 겹치면 DB처럼 23505 오류', async () => {
  const store = createMemoryPartyStore();
  const args = { hostUserId: 'h', inviteCode: 'ABCDEFGH', ageGroup: '20s', expiresAt: new Date(1000) };
  await store.createParty(args);
  await assert.rejects(store.createParty(args), (err) => err.code === '23505');
});

test('메모리 저장소: 길은 버전을 올려 쌓고, 같은 버전은 다시 못 넣는다', async () => {
  const store = createMemoryPartyStore();
  const base = { partyId: 'p', mode: 'EXPLORE', title: '길', picker: 'ai', placeIds: ['a'] };
  assert.equal(await store.saveRoute({ ...base, version: 1 }), true);
  assert.equal(await store.saveRoute({ ...base, version: 1 }), false);
  assert.equal(await store.saveRoute({ ...base, version: 2, placeIds: ['b'] }), true);
  assert.equal((await store.latestRoute('p', 'EXPLORE')).version, 2);
  assert.equal(await store.latestRoute('p', 'SHADE'), null);
});

test('메모리 저장소: 시작 처리는 처음 시각을 그대로 돌려준다', async () => {
  let t = 1000;
  const store = createMemoryPartyStore({ now: () => new Date(t) });
  const { id } = await store.createParty({ hostUserId: 'h', inviteCode: 'ABCDEFGH', ageGroup: '20s', expiresAt: new Date(9999) });
  const first = await store.markStarted(id);
  t = 5000;
  assert.equal((await store.markStarted(id)).getTime(), first.getTime());
});