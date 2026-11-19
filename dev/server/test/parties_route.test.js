import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createWeatherService } from '../src/weather/index.js';
import { createComposeRoute } from '../src/ai/compose_route.js';
import { createMemoryPartyStore } from '../src/party/memory_party_store.js';
import { PARTY_MAX_MEMBERS, PARTY_REFRESH_LIMIT } from '../src/party/party_rules.js';

const START_MS = Date.parse('2026-11-16T05:30:00Z'); // 한국 14:30, 월요일
const fast = { sleep: () => Promise.resolve(), random: () => 0 };
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

// 가짜 로그인 확인: "Bearer tok-숫자" 이면 그 숫자의 사용자로 본다.
const verifier = {
  verify: async (header) => {
    const m = /^Bearer tok-(\d+)$/.exec(header ?? '');
    return m ? { ok: true, userId: uid(Number(m[1])) } : { ok: false };
  },
};

const place = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'exhibit', openHour: null, closeHour: null,
  closedWeekdays: [], modeAllowed: null, status: 'open', hoursText: null, caution: null, ...o,
});
const PLACES = [
  place({ id: 'a', name: '가장소', zone: 'dongseongro', lat: 35.87, lng: 128.6 }),
  place({ id: 'b', name: '나장소', zone: 'dongseongro', lat: 35.87, lng: 128.61 }),
  place({ id: 'c', name: '다장소', zone: 'dongseongro', lat: 35.87, lng: 128.62 }),
  place({ id: 'd', name: '라장소', zone: 'dongseongro', lat: 35.87, lng: 128.63 }),
  place({ id: 'e', name: '마장소', zone: 'namsan', lat: 35.87, lng: 128.64 }),
  place({ id: 'f', name: '바장소', zone: 'namsan', lat: 35.87, lng: 128.65 }),
];
const COORD = { latitude: 35.8714, longitude: 128.6014 };
const answer = (ids) => ({ placeIds: ids, keyword: '근대골목', reason: '천천히 걷기 좋아요.' });

// 정해 둔 답을 차례로 돌려주는 가짜 AI. 받은 프롬프트를 기록한다.
function fakeLlm(...replies) {
  const calls = [];
  const fn = async (prompt) => {
    calls.push(prompt);
    return replies[Math.min(calls.length - 1, replies.length - 1)];
  };
  fn.calls = calls;
  return fn;
}
// 호출할 때마다 a,b,c 와 d,e,f 를 번갈아 고르는 가짜 AI (새로고침 때마다 다른 조합이 나온다)
function alternatingLlm() {
  const sets = [['a', 'b', 'c'], ['d', 'e', 'f']];
  const calls = [];
  const fn = async (prompt) => {
    calls.push(prompt);
    return answer(sets[(calls.length - 1) % 2]);
  };
  fn.calls = calls;
  return fn;
}

// 서버를 띄우고 run(api)을 실행한다. api(n, method, path, body)는 tok-n 사용자로 요청한다.
async function withServer(opts, run) {
  const { scenario = 'ok', store = createMemoryPartyStore(), verifierOverride, llm = null, places = PLACES, clock = { t: START_MS }, placeLoader, composeRoute, harangiLine } = opts;
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  const server = createApp({
    weatherService: createWeatherService({ source: 'mock', scenario, now: () => new Date(START_MS), clientDeps: fast }),
    placeLoader: placeLoader ?? (async () => ({ ok: true, places: typeof places === 'function' ? places() : places })),
    composeRoute: composeRoute ?? createComposeRoute({ llm }),
    harangiLine,
    partyStore: store,
    tokenVerifier: verifierOverride === undefined ? verifier : verifierOverride,
    now: () => new Date(clock.t),
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const texts = [];
  async function api(n, method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(n === null ? {} : { Authorization: `Bearer tok-${n}` }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    texts.push(text);
    return { status: res.status, json: text ? JSON.parse(text) : null };
  }
  api.base = base;
  try {
    await run(api, { store, clock });
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.log = original;
    await new Promise((resolve) => server.close(resolve));
  }
  return { logs, texts };
}

// 일행을 만들고 구성원을 참여시킨다. members: [{ n, age }]
async function setup(api, { host = { n: 1, age: '20s' }, members = [], party = { theme: 'history' } } = {}) {
  const created = await api(host.n, 'POST', '/parties', { ageGroup: host.age, ...party });
  assert.equal(created.status, 201);
  for (const m of members) {
    const joined = await api(m.n, 'POST', '/parties/join', { inviteCode: created.json.inviteCode, ageGroup: m.age });
    assert.equal(joined.status, 200);
  }
  return { id: created.json.partyId, code: created.json.inviteCode };
}
const ids = (route) => route.places.map((p) => p.id);

test('로그인이 없거나 틀리면 401, 확인 설정이 없으면 503', async () => {
  await withServer({}, async (api) => {
    assert.equal((await api(null, 'POST', '/parties', { ageGroup: '20s' })).status, 401);
    const wrong = await fetch(`${api.base}/parties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ ageGroup: '20s' }),
    });
    assert.equal(wrong.status, 401);
    assert.deepEqual(await wrong.json(), { error: 'UNAUTHORIZED' });
    const r = await api(1, 'GET', '/parties/00000000-0000-4000-8000-0000000000aa');
    assert.equal(r.status, 404); // 로그인은 통과했고 일행이 없다
  });
  await withServer({ verifierOverride: null }, async (api) => {
    const r = await api(1, 'POST', '/parties', { ageGroup: '20s' });
    assert.equal(r.status, 503);
    assert.deepEqual(r.json, { error: 'AUTH_NOT_CONFIGURED' });
  });
});

test('일행 만들기: 나이대는 필수, 허용 밖의 값은 400, 만든 사람은 host로 보인다', async () => {
  await withServer({}, async (api) => {
    assert.equal((await api(1, 'POST', '/parties', {})).status, 400);
    assert.equal((await api(1, 'POST', '/parties', { ageGroup: '70s' })).status, 400);
    assert.equal((await api(1, 'POST', '/parties', { ageGroup: '20s', theme: 'moon' })).status, 400);
    const { id, code } = await setup(api, { party: { theme: 'history', companion: 'kids' } });
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    const info = (await api(1, 'GET', `/parties/${id}`)).json;
    assert.equal(info.myRole, 'host');
    assert.equal(info.inviteCode, code);
    assert.equal(info.memberCount, 1);
    assert.deepEqual(info.ageGroups, ['20s']);
    assert.equal(info.companion, 'kids');
  });
});

test('초대 코드 참여: 소문자·공백 허용, 다시 참여하면 joined false, 틀린 코드는 404', async () => {
  await withServer({}, async (api) => {
    const { id, code } = await setup(api);
    const spaced = `${code.slice(0, 4).toLowerCase()} ${code.slice(4).toLowerCase()}`;
    const first = await api(2, 'POST', '/parties/join', { inviteCode: spaced, ageGroup: '60s' });
    assert.deepEqual(first.json, { partyId: id, joined: true });
    const again = await api(2, 'POST', '/parties/join', { inviteCode: code, ageGroup: '60s' });
    assert.deepEqual(again.json, { partyId: id, joined: false });
    assert.equal((await api(3, 'POST', '/parties/join', { inviteCode: 'ZZZZZZZZ', ageGroup: '30s' })).status, 404);
    assert.equal((await api(3, 'POST', '/parties/join', { inviteCode: 'abc', ageGroup: '30s' })).status, 400);
    assert.equal((await api(3, 'POST', '/parties/join', { inviteCode: code, ageGroup: '99s' })).status, 400);
  });
});

test('구성원 정보: 초대 코드는 host에게만, 다른 구성원의 id는 알려 주지 않는다', async () => {
  const { texts } = await withServer({}, async (api) => {
    const { id } = await setup(api, { members: [{ n: 2, age: '60s' }] });
    const member = (await api(2, 'GET', `/parties/${id}`)).json;
    assert.equal(member.myRole, 'member');
    assert.ok(!('inviteCode' in member));
    assert.equal(member.memberCount, 2);
    assert.deepEqual(member.ageGroups, ['20s', '60s']);
  });
  const all = texts.join('\n');
  assert.ok(!all.includes(uid(1)) && !all.includes(uid(2)));
});

test('인원 상한을 넘으면 409 PARTY_FULL', async () => {
  await withServer({}, async (api) => {
    const members = Array.from({ length: PARTY_MAX_MEMBERS - 1 }, (_, i) => ({ n: i + 2, age: '30s' }));
    const { code } = await setup(api, { members });
    const r = await api(PARTY_MAX_MEMBERS + 5, 'POST', '/parties/join', { inviteCode: code, ageGroup: '30s' });
    assert.equal(r.status, 409);
    assert.deepEqual(r.json, { error: 'PARTY_FULL' });
  });
});

test('초대 코드 시도 횟수 제한: 10번 넘으면 429', async () => {
  await withServer({}, async (api) => {
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await api(20, 'POST', '/parties/join', { inviteCode: 'ZZZZZZZZ', ageGroup: '30s' })).status, 404);
    }
    assert.equal((await api(20, 'POST', '/parties/join', { inviteCode: 'ZZZZZZZZ', ageGroup: '30s' })).status, 429);
  });
});

test('구성원이 아니면 일행이 있는지도 알려 주지 않는다 (404)', async () => {
  await withServer({}, async (api) => {
    const { id } = await setup(api);
    assert.equal((await api(9, 'GET', `/parties/${id}`)).status, 404);
    assert.equal((await api(9, 'POST', `/parties/${id}/recommend`, COORD)).status, 404);
    assert.equal((await api(9, 'POST', `/parties/${id}/start`)).status, 404);
    assert.equal((await api(9, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1 })).status, 404);
    assert.equal((await api(1, 'GET', '/parties/not-a-uuid')).status, 404);
  });
});

test('일행이 만료되면 참여와 조회는 410', async () => {
  await withServer({}, async (api, { clock }) => {
    const { id, code } = await setup(api);
    clock.t += 25 * 60 * 60 * 1000;
    assert.equal((await api(2, 'POST', '/parties/join', { inviteCode: code, ageGroup: '30s' })).status, 410);
    assert.equal((await api(1, 'GET', `/parties/${id}`)).status, 410);
  });
});

test('같은 일행이면 같은 길: 한 사람이 구성하면 다른 사람은 AI를 다시 부르지 않고 같은 길을 본다', async () => {
  const llm = fakeLlm(answer(['a', 'c', 'b']), answer(['d', 'e', 'f']));
  await withServer({ llm }, async (api) => {
    const { id } = await setup(api, { members: [{ n: 2, age: '20s' }] });
    const host = (await api(1, 'POST', `/parties/${id}/recommend`, COORD)).json;
    const member = (await api(2, 'POST', `/parties/${id}/recommend`, COORD)).json;
    assert.equal(host.routeVersion, 1);
    assert.equal(host.route.picker, 'ai');
    assert.equal(host.route.title, '맑은날 근대골목길');
    assert.deepEqual(ids(host.route), ['a', 'b', 'c']);
    assert.deepEqual(member, host);
    assert.equal(llm.calls.length, 1);
  });
});

test('길에는 소요시간(약 N분)이 들어 있다', async () => {
  await withServer({ llm: fakeLlm(answer(['a', 'b', 'c'])) }, async (api) => {
    const { id } = await setup(api);
    const r = (await api(1, 'POST', `/parties/${id}/recommend`, COORD)).json;
    assert.equal(r.route.durationMin, 100);
    assert.equal(r.route.durationBasis, 'distance');
  });
});

test('나이대가 섞이면 가장 엄격한 쪽(60대 이상)에 맞춰 구성한다', async () => {
  const llm = fakeLlm(answer(['a', 'b', 'c']));
  await withServer({ llm }, async (api) => {
    const { id } = await setup(api, { members: [{ n: 2, age: '60s' }] });
    await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    assert.ok(llm.calls[0].user.includes('나이대: 60대 이상'));
  });
});

test('모드가 바뀌면(날씨) 안전을 위해 그 모드의 길을 새로 만든다', async () => {
  const store = createMemoryPartyStore();
  let partyId;
  await withServer({ store, llm: fakeLlm(answer(['a', 'b', 'c'])) }, async (api) => {
    ({ id: partyId } = await setup(api));
    const r = (await api(1, 'POST', `/parties/${partyId}/recommend`, COORD)).json;
    assert.equal(r.mode, 'EXPLORE');
    assert.equal(r.route.title, '맑은날 근대골목길');
  });
  await withServer({ store, scenario: 'hot', llm: fakeLlm(answer(['a', 'b', 'c'])) }, async (api) => {
    const r = (await api(1, 'POST', `/parties/${partyId}/recommend`, COORD)).json;
    assert.equal(r.mode, 'SHADE');
    assert.equal(r.routeVersion, 1);
    assert.equal(r.route.title, '그늘 근대골목길');
  });
});

test('저장된 길의 장소가 닫히면 새 버전을 만든다', async () => {
  const llm = fakeLlm(answer(['a', 'c', 'b']), answer(['a', 'c', 'd']));
  let places = PLACES;
  await withServer({ llm, places: () => places }, async (api) => {
    const { id } = await setup(api);
    const v1 = (await api(1, 'POST', `/parties/${id}/recommend`, COORD)).json;
    assert.equal(v1.routeVersion, 1);
    places = PLACES.map((p) => (p.id === 'b' ? { ...p, status: 'paused' } : p));
    const v2 = (await api(1, 'POST', `/parties/${id}/recommend`, COORD)).json;
    assert.equal(v2.routeVersion, 2);
    assert.ok(!ids(v2.route).includes('b'));
  });
});

test('거의 동시에 요청해도 일행은 같은 길을 본다', async () => {
  const llm = fakeLlm(answer(['a', 'b', 'c']), answer(['d', 'e', 'f']));
  await withServer({ llm }, async (api) => {
    const { id } = await setup(api, { members: [{ n: 2, age: '20s' }] });
    const [x, y] = await Promise.all([
      api(1, 'POST', `/parties/${id}/recommend`, COORD),
      api(2, 'POST', `/parties/${id}/recommend`, COORD),
    ]);
    assert.equal(x.json.routeVersion, 1);
    assert.equal(y.json.routeVersion, 1);
    assert.deepEqual(ids(x.json.route).sort(), ids(y.json.route).sort());
  });
});

test('길 구성이 실패하면 route는 null이고 아무것도 저장하지 않는다', async () => {
  const boom = async () => {
    throw new Error('secret-x');
  };
  const store = createMemoryPartyStore();
  const { texts } = await withServer({ store, composeRoute: boom }, async (api) => {
    const { id } = await setup(api);
    const r = await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    assert.equal(r.status, 200);
    assert.deepEqual([r.json.route, r.json.routeReason], [null, 'COMPOSE_FAILED']);
    assert.equal(await store.latestRoute(id, 'EXPLORE'), null);
  });
  assert.ok(!texts.join('').includes('secret-x'));
});

test('하랑이 브리핑: briefing을 요청하면 테마, 소요시간, 장소가 담긴 브리핑이 함께 온다', async () => {
  const calls = [];
  const harangiLine = async (args) => {
    calls.push(args);
    return { ok: true, scene: 'briefing', picker: 'ai', text: '브리핑 문장' };
  };
  await withServer({ llm: fakeLlm(answer(['a', 'b', 'c'])), harangiLine }, async (api) => {
    const { id } = await setup(api);
    const plain = (await api(1, 'POST', `/parties/${id}/recommend`, COORD)).json;
    assert.ok(!('briefing' in plain.route));
    assert.equal(calls.length, 0);
    const r = (await api(1, 'POST', `/parties/${id}/recommend`, { ...COORD, briefing: true })).json;
    assert.deepEqual(r.route.briefing, { text: '브리핑 문장', picker: 'ai' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].event, 'briefing');
    assert.equal(calls[0].theme, 'history');
    assert.equal(calls[0].durationMin, 100);
    assert.equal(calls[0].routeTitle, '맑은날 근대골목길');
    assert.deepEqual(calls[0].places.map((p) => p.name), ['가장소', '나장소', '다장소']);
  });
});

test('하랑이 브리핑이 실패해도 길 응답은 그대로 나간다', async () => {
  const harangiLine = async () => {
    throw new Error('secret-y');
  };
  const { texts } = await withServer({ llm: fakeLlm(answer(['a', 'b', 'c'])), harangiLine }, async (api) => {
    const { id } = await setup(api);
    const r = (await api(1, 'POST', `/parties/${id}/recommend`, { ...COORD, briefing: true })).json;
    assert.equal(r.route.title, '맑은날 근대골목길');
    assert.equal(r.route.briefing, null);
  });
  assert.ok(!texts.join('').includes('secret-y'));
});

test('새로고침(host만, 시작 전만): 지금 길의 장소를 뺀 새 길이 새 버전으로 저장되고 일행 모두가 같은 새 길을 본다', async () => {
  const llm = alternatingLlm();
  await withServer({ llm }, async (api) => {
    const { id } = await setup(api, { members: [{ n: 2, age: '20s' }] });
    const first = (await api(1, 'POST', `/parties/${id}/recommend`, COORD)).json;
    assert.deepEqual(ids(first.route), ['a', 'b', 'c']);

    const refreshed = await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1 });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.json.refreshed, true);
    assert.equal(refreshed.json.routeVersion, 2);
    assert.deepEqual(ids(refreshed.json.route), ['d', 'e', 'f']);
    // 새 후보 목록에는 이미 본 장소가 없다
    assert.ok(!llm.calls[1].user.includes('id=a') && llm.calls[1].user.includes('id=d'));

    const member = (await api(2, 'POST', `/parties/${id}/recommend`, COORD)).json;
    assert.equal(member.routeVersion, 2);
    assert.deepEqual(ids(member.route), ['d', 'e', 'f']);
  });
});

test('새로고침: 오래된 버전으로 요청하면 409 STALE_ROUTE', async () => {
  await withServer({ llm: alternatingLlm() }, async (api) => {
    const { id } = await setup(api);
    await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1 });
    const stale = await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1 });
    assert.equal(stale.status, 409);
    assert.deepEqual(stale.json, { error: 'STALE_ROUTE', latestVersion: 2 });
  });
});

test('새로고침 횟수 상한을 넘으면 409 REFRESH_LIMIT', async () => {
  await withServer({ llm: alternatingLlm() }, async (api) => {
    const { id } = await setup(api);
    await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    for (let v = 1; v <= PARTY_REFRESH_LIMIT; v += 1) {
      const r = await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: v });
      assert.equal(r.status, 200, `v${v}`);
      assert.equal(r.json.routeVersion, v + 1);
    }
    const over = await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: PARTY_REFRESH_LIMIT + 1 });
    assert.deepEqual([over.status, over.json.error], [409, 'REFRESH_LIMIT']);
  });
});

test('새 조합을 만들 후보가 부족하면 새 버전을 만들지 않고 지금 길을 그대로 돌려준다', async () => {
  const store = createMemoryPartyStore();
  await withServer({ store, llm: fakeLlm(answer(['a', 'b', 'c'])), places: PLACES.slice(0, 4) }, async (api) => {
    const { id } = await setup(api);
    await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    const r = await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1 });
    assert.equal(r.status, 200);
    assert.equal(r.json.refreshed, false);
    assert.equal(r.json.routeVersion, 1);
    assert.deepEqual(ids(r.json.route), ['a', 'b', 'c']);
    assert.equal((await store.latestRoute(id, 'EXPLORE')).version, 1);
  });
});

test('새로고침과 시작은 host만 할 수 있다 (403)', async () => {
  await withServer({ llm: fakeLlm(answer(['a', 'b', 'c'])) }, async (api) => {
    const { id } = await setup(api, { members: [{ n: 2, age: '20s' }] });
    await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    const refresh = await api(2, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1 });
    assert.deepEqual([refresh.status, refresh.json.error], [403, 'NOT_HOST']);
    const start = await api(2, 'POST', `/parties/${id}/start`);
    assert.deepEqual([start.status, start.json.error], [403, 'NOT_HOST']);
  });
});

test('시작한 뒤에는 새로고침과 새 참여가 막힌다, 시작은 다시 눌러도 같은 시각', async () => {
  await withServer({ llm: fakeLlm(answer(['a', 'b', 'c'])) }, async (api) => {
    const { id, code } = await setup(api);
    await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    const first = await api(1, 'POST', `/parties/${id}/start`);
    const second = await api(1, 'POST', `/parties/${id}/start`);
    assert.ok(first.json.startedAt);
    assert.equal(second.json.startedAt, first.json.startedAt);
    const refresh = await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1 });
    assert.deepEqual([refresh.status, refresh.json.error], [409, 'ALREADY_STARTED']);
    const join = await api(2, 'POST', '/parties/join', { inviteCode: code, ageGroup: '30s' });
    assert.deepEqual([join.status, join.json.error], [409, 'ALREADY_STARTED']);
  });
});

test('길이 아직 없으면 새로고침은 409 NO_ROUTE', async () => {
  await withServer({}, async (api) => {
    const { id } = await setup(api);
    const r = await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1 });
    assert.deepEqual([r.status, r.json.error], [409, 'NO_ROUTE']);
  });
});

test('장소를 하나씩 직접 고치는 API는 없다 (404)', async () => {
  await withServer({ llm: fakeLlm(answer(['a', 'b', 'c'])) }, async (api) => {
    const { id } = await setup(api);
    await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    const swap = await api(1, 'POST', `/parties/${id}/swap`, { ...COORD, routeVersion: 1, replacePlaceId: 'b', newPlaceId: 'd' });
    assert.equal(swap.status, 404);
    const open = await fetch(`${api.base}/recommend/swap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(open.status, 404);
  });
});

test('잘못된 입력은 400 INVALID_INPUT', async () => {
  await withServer({ llm: fakeLlm(answer(['a', 'b', 'c'])) }, async (api) => {
    const { id } = await setup(api);
    for (const body of [{}, { latitude: 'x', longitude: 128.6 }, { ...COORD, previousMode: 'NOPE' }, { ...COORD, briefing: 'yes' }]) {
      assert.equal((await api(1, 'POST', `/parties/${id}/recommend`, body)).status, 400);
    }
    for (const body of [
      {},
      { ...COORD },
      { ...COORD, routeVersion: '1' },
      { ...COORD, routeVersion: 0 },
      { ...COORD, routeVersion: 1.5 },
      { ...COORD, routeVersion: 1, briefing: 1 },
      { latitude: 'x', longitude: 1, routeVersion: 1 },
    ]) {
      assert.equal((await api(1, 'POST', `/parties/${id}/refresh`, body)).status, 400, JSON.stringify(body));
    }
  });
});

test('장소 DB를 못 읽으면 503', async () => {
  const failing = async () => ({ ok: false, reason: 'PLACES_UNAVAILABLE' });
  await withServer({ placeLoader: failing }, async (api) => {
    const { id } = await setup(api);
    const r = await api(1, 'POST', `/parties/${id}/recommend`, COORD);
    assert.deepEqual([r.status, r.json.error], [503, 'PLACES_UNAVAILABLE']);
  });
});

test('초대 코드가 겹치면 새 코드로 다시 시도하고, 계속 겹치면 503', async () => {
  const inner = createMemoryPartyStore();
  let failures = 2;
  const flaky = {
    ...inner,
    createParty: async (args) => {
      if (failures > 0) {
        failures -= 1;
        throw Object.assign(new Error('dup'), { code: '23505' });
      }
      return inner.createParty(args);
    },
  };
  await withServer({ store: flaky }, async (api) => {
    assert.equal((await api(1, 'POST', '/parties', { ageGroup: '20s' })).status, 201);
    failures = 99;
    const r = await api(2, 'POST', '/parties', { ageGroup: '20s' });
    assert.deepEqual([r.status, r.json.error], [503, 'CODE_GENERATION_FAILED']);
  });
});

test('다른 종류의 저장소 오류는 숨기고 500으로 답한다', async () => {
  const broken = { ...createMemoryPartyStore(), createParty: async () => { throw new Error('db password=secret'); } };
  const { texts } = await withServer({ store: broken }, async (api) => {
    const r = await api(1, 'POST', '/parties', { ageGroup: '20s' });
    assert.equal(r.status, 500);
  });
  assert.ok(!texts.join('').includes('secret'));
});

test('응답과 로그에 좌표, 토큰, 사용자 id가 없다', async () => {
  const harangiLine = async () => ({ ok: true, scene: 'briefing', picker: 'rules', text: '브리핑' });
  const { logs, texts } = await withServer({ llm: alternatingLlm(), harangiLine }, async (api) => {
    const { id } = await setup(api, { members: [{ n: 2, age: '60s' }] });
    await api(1, 'POST', `/parties/${id}/recommend`, { ...COORD, briefing: true });
    await api(1, 'POST', `/parties/${id}/refresh`, { ...COORD, routeVersion: 1, briefing: true });
    await api(2, 'GET', `/parties/${id}`);
  });
  const all = [...logs, ...texts].join('\n');
  for (const secret of ['35.87', '128.6', 'tok-', uid(1), uid(2)]) {
    assert.ok(!all.includes(secret), `노출됨: ${secret}`);
  }
});