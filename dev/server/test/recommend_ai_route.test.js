import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { createWeatherService } from '../src/weather/index.js';
import { createComposeRoute } from '../src/ai/compose_route.js';
import { createRouteCache } from '../src/ai/route_cache.js';

const NOW = () => new Date('2026-11-16T05:30:00Z'); // 한국 14:30, 월요일
const fast = { sleep: () => Promise.resolve(), random: () => 0 };
// 로그인 필수라서 가짜 검증기와 토큰 헤더를 쓴다.
const tokenVerifier = { verify: async () => ({ ok: true, userId: '00000000-0000-4000-8000-000000000001' }) };
const AUTH = { Authorization: 'Bearer test' };

const place = (o) => ({
  id: 'x', name: 'x', district: '중구', type: 'exhibit', openHour: null, closeHour: null,
  closedWeekdays: [], modeAllowed: null, status: 'open', zone: 'dongseongro', hoursText: null, caution: null, ...o,
});
// 같은 위도에서 경도만 0.01씩 다른 6곳. 장소 좌표는 응답에 나오면 안 된다.
const PLACES = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) =>
  place({ id, name: `${id.toUpperCase()}장소`, lat: 35.87, lng: 128.6 + i * 0.01 }),
);
const okLoader = async () => ({ ok: true, places: PLACES });
const COORD = { latitude: 35.8714, longitude: 128.6014 };
const answer = (ids) => ({ placeIds: ids, keyword: '근대골목', reason: '천천히 걷기 좋아요.' });
const GOOD = answer(['a', 'c', 'b']);

function fakeLlm(reply) {
  const calls = [];
  const fn = async (prompt) => {
    calls.push(prompt);
    return reply;
  };
  fn.calls = calls;
  return fn;
}
// 호출할 때마다 a,b,c 와 d,e,f 를 번갈아 고르는 가짜 AI
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

async function withServer(scenario, placeLoader, composeRoute, run, harangiLine) {
  const logs = [];
  const original = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  const server = createApp({
    weatherService: createWeatherService({ source: 'mock', scenario, now: NOW, clientDeps: fast }),
    placeLoader,
    composeRoute,
    harangiLine,
    tokenVerifier,
    now: NOW,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await run(base);
    await new Promise((resolve) => setImmediate(resolve));
  } finally {
    console.log = original;
    await new Promise((resolve) => server.close(resolve));
  }
  return logs;
}

const call = (base, body) =>
  fetch(`${base}/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...AUTH },
    body: JSON.stringify(body),
  });
const ids = (list) => list.map((p) => p.id);

test('선택 입력이 없으면 route 없이 예전 응답 그대로', async () => {
  const llm = fakeLlm(GOOD);
  await withServer('ok', okLoader, createComposeRoute({ llm }), async (base) => {
    const json = await (await call(base, COORD)).json();
    assert.equal(json.mode, 'EXPLORE');
    assert.ok(!('route' in json));
    assert.equal(llm.calls.length, 0);
  });
});

test('선택 입력이 있으면 AI가 고른 길을 코드가 정렬해서 route로 주고, 소요시간도 준다', async () => {
  const llm = fakeLlm(GOOD);
  await withServer('ok', okLoader, createComposeRoute({ llm }), async (base) => {
    const json = await (await call(base, { ...COORD, ageGroup: '20s', theme: 'history' })).json();
    assert.equal(json.route.picker, 'ai');
    assert.equal(json.route.title, '맑은날 근대골목길');
    assert.deepEqual(ids(json.route.places), ['a', 'b', 'c']);
    assert.equal(json.route.orderBasis, 'distance');
    assert.equal(json.route.durationMin, 100);
    assert.equal(json.route.durationBasis, 'distance');
    assert.equal(json.route.isNew, true);
    assert.equal(llm.calls.length, 1);
    // 기존 필드도 그대로 있다
    assert.equal(json.mode, 'EXPLORE');
    assert.equal(json.selection, 'OK');
  });
});

test('AI가 없으면(키 없음) 규칙 결과', async () => {
  await withServer('ok', okLoader, createComposeRoute({ llm: null }), async (base) => {
    const json = await (await call(base, { ...COORD, ageGroup: '20s', theme: 'history' })).json();
    assert.equal(json.route.picker, 'rules');
    assert.equal(json.route.title, '맑은날 근대골목길');
    assert.deepEqual(ids(json.route.places), ['a', 'b', 'c']);
  });
});

test('테마 없이 나이대만 보내면 AI를 부르지 않는다', async () => {
  const llm = fakeLlm(GOOD);
  await withServer('ok', okLoader, createComposeRoute({ llm }), async (base) => {
    const json = await (await call(base, { ...COORD, ageGroup: '60s' })).json();
    assert.equal(json.route.picker, 'rules');
    assert.equal(llm.calls.length, 0);
  });
});

test('날씨를 못 얻으면(UNKNOWN) AI를 부르지 않고 규칙 결과', async () => {
  const llm = fakeLlm(GOOD);
  await withServer('http_error', okLoader, createComposeRoute({ llm }), async (base) => {
    const json = await (await call(base, { ...COORD, theme: 'history' })).json();
    assert.equal(json.mode, 'UNKNOWN');
    assert.equal(json.route.picker, 'rules');
    assert.equal(json.route.title, '근대골목길');
    assert.equal(llm.calls.length, 0);
  });
});

test('후보가 없으면 route는 null이고 사유를 준다', async () => {
  const empty = async () => ({ ok: true, places: [] });
  await withServer('ok', empty, createComposeRoute({ llm: fakeLlm(GOOD) }), async (base) => {
    const json = await (await call(base, { ...COORD, theme: 'history' })).json();
    assert.equal(json.route, null);
    assert.equal(json.routeReason, 'NO_CANDIDATE');
  });
});

test('길 구성이 예외를 던져도 추천 응답은 200이고 에러 내용은 숨긴다', async () => {
  const boom = async () => {
    throw new Error('secret-x');
  };
  await withServer('ok', okLoader, boom, async (base) => {
    const res = await call(base, { ...COORD, theme: 'history' });
    const text = await res.text();
    assert.equal(res.status, 200);
    assert.equal(JSON.parse(text).routeReason, 'COMPOSE_FAILED');
    assert.ok(!text.includes('secret-x'));
  });
});

test('허용 목록 밖의 선택 입력은 400 INVALID_INPUT', async () => {
  await withServer('ok', okLoader, createComposeRoute({ llm: null }), async (base) => {
    for (const extra of [
      { ageGroup: '70s' },
      { theme: 'moon' },
      { companion: 7 },
      { zone: 'nowhere' },
      { variant: 'Z' },
      { refresh: 'yes' },
      { briefing: 1 },
      { count: 0 },
      { count: 4 },
      { count: 1.5 },
      { count: '3' },
      { excludePlaceIds: 'a' },
      { excludePlaceIds: ['a b'] },
      { excludePlaceIds: Array.from({ length: 13 }, (_, i) => `p${i}`) },
    ]) {
      const res = await call(base, { ...COORD, ...extra });
      assert.equal(res.status, 400, JSON.stringify(extra));
      assert.deepEqual(await res.json(), { error: 'INVALID_INPUT' });
    }
  });
});

test('응답과 로그에 사용자 좌표도 장소 좌표도 없다', async () => {
  let text = '';
  const logs = await withServer('ok', okLoader, createComposeRoute({ llm: fakeLlm(GOOD) }), async (base) => {
    text = await (await call(base, { ...COORD, ageGroup: '20s', theme: 'history' })).text();
  });
  assert.ok(!text.includes('35.87') && !text.includes('128.6'));
  const log = logs.join('\n');
  assert.ok(!log.includes('35.87') && !log.includes('128.6'));
});

// ---- 새로고침 ----
test('새로고침: 이미 본 장소(excludePlaceIds)를 뺀 새 조합을 받는다', async () => {
  const llm = alternatingLlm();
  await withServer('ok', okLoader, createComposeRoute({ llm }), async (base) => {
    const first = await (await call(base, { ...COORD, theme: 'history' })).json();
    assert.deepEqual(ids(first.route.places), ['a', 'b', 'c']);
    const again = await (await call(base, { ...COORD, theme: 'history', refresh: true, excludePlaceIds: ids(first.route.places) })).json();
    assert.deepEqual(ids(again.route.places), ['d', 'e', 'f']);
    assert.equal(again.route.isNew, true);
    assert.ok(!llm.calls[1].user.includes('id=a'));
  });
});

test('새로고침한 길이 이후 같은 조건의 기본 길이 된다 (기억해 둔 길을 건너뛰고 새로 저장)', async () => {
  const llm = alternatingLlm();
  const compose = createComposeRoute({ llm, cache: createRouteCache() });
  await withServer('ok', okLoader, compose, async (base) => {
    const body = { ...COORD, theme: 'history' };
    const r1 = await (await call(base, body)).json();
    const r2 = await (await call(base, body)).json(); // 기억해 둔 길 (AI 호출 없음)
    assert.equal(llm.calls.length, 1);
    assert.deepEqual(ids(r2.route.places), ids(r1.route.places));
    const r3 = await (await call(base, { ...body, refresh: true, excludePlaceIds: ids(r1.route.places) })).json();
    assert.equal(llm.calls.length, 2);
    assert.deepEqual(ids(r3.route.places), ['d', 'e', 'f']);
    const r4 = await (await call(base, body)).json(); // 새로고침한 길이 기본이 됨
    assert.equal(llm.calls.length, 2);
    assert.deepEqual(ids(r4.route.places), ['d', 'e', 'f']);
  });
});

test('새로고침: 새 조합을 만들 후보가 부족하면 isNew가 false', async () => {
  const fourPlaces = async () => ({ ok: true, places: PLACES.slice(0, 4) });
  await withServer('ok', fourPlaces, createComposeRoute({ llm: fakeLlm(answer(['a', 'b', 'c'])) }), async (base) => {
    const json = await (await call(base, { ...COORD, theme: 'history', refresh: true, excludePlaceIds: ['a', 'b', 'c'] })).json();
    assert.equal(json.route.isNew, false);
    assert.deepEqual(ids(json.route.places), ['a', 'b', 'c']);
  });
});

test('새로고침을 너무 자주 하면 429 (무료 한도 보호)', async () => {
  await withServer('ok', okLoader, createComposeRoute({ llm: alternatingLlm() }), async (base) => {
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await call(base, { ...COORD, theme: 'history', refresh: true })).status, 200);
    }
    const over = await call(base, { ...COORD, theme: 'history', refresh: true });
    assert.equal(over.status, 429);
    assert.deepEqual(await over.json(), { error: 'TOO_MANY_REFRESHES' });
    // 새로고침이 아닌 요청은 영향을 받지 않는다
    assert.equal((await call(base, { ...COORD, theme: 'history' })).status, 200);
  });
});
// ---- 후보 길 여러 개 (count) ----
test('count를 안 보내면 routes는 1개이고 route와 같다', async () => {
  await withServer('ok', okLoader, createComposeRoute({ llm: alternatingLlm() }), async (base) => {
    const json = await (await call(base, { ...COORD, theme: 'history' })).json();
    assert.equal(json.routes.length, 1);
    assert.deepEqual(json.routes[0], json.route);
  });
});

test('count: 3 → 서로 겹치지 않는 길을 만들고, 새 조합이 없으면 거기서 멈춘다', async () => {
  const llm = alternatingLlm();
  await withServer('ok', okLoader, createComposeRoute({ llm }), async (base) => {
    const json = await (await call(base, { ...COORD, theme: 'history', count: 3 })).json();
    // 장소가 6곳뿐이라 겹치지 않는 길은 2개까지
    assert.equal(json.routes.length, 2);
    assert.deepEqual(ids(json.routes[0].places), ['a', 'b', 'c']);
    assert.deepEqual(ids(json.routes[1].places), ['d', 'e', 'f']);
    assert.deepEqual(json.route, json.routes[0]);
  });
});

test('count: 3 + briefing → 길마다 하랑이 브리핑이 붙는다', async () => {
  const lines = [];
  const harangiLine = async (input) => {
    lines.push(input);
    return { ok: true, text: `${input.routeTitle} 이야기`, picker: 'rules' };
  };
  await withServer('ok', okLoader, createComposeRoute({ llm: alternatingLlm() }), async (base) => {
    const json = await (await call(base, { ...COORD, theme: 'history', count: 3, briefing: true })).json();
    assert.equal(lines.length, json.routes.length);
    for (const r of json.routes) assert.equal(r.briefing.text, `${r.title} 이야기`);
  }, harangiLine);
});

test('count: 3 → 후보가 없으면 routes는 빈 목록이고 사유를 준다', async () => {
  const none = async () => ({ ok: true, places: [] });
  await withServer('ok', none, createComposeRoute({ llm: null }), async (base) => {
    const json = await (await call(base, { ...COORD, theme: 'history', count: 3 })).json();
    assert.equal(json.route, null);
    assert.deepEqual(json.routes, []);
    assert.ok(json.routeReason);
  });
});
// ---- 하랑이 브리핑 ----
test('하랑이 브리핑: briefing을 요청했을 때만 호출하고, 테마·소요시간·장소를 넘긴다', async () => {
  const calls = [];
  const harangiLine = async (args) => {
    calls.push(args);
    return { ok: true, scene: 'briefing', picker: 'ai', text: '브리핑 문장' };
  };
  await withServer(
    'ok',
    okLoader,
    createComposeRoute({ llm: fakeLlm(GOOD) }),
    async (base) => {
      const plain = await (await call(base, { ...COORD, theme: 'history' })).json();
      assert.ok(!('briefing' in plain.route));
      assert.equal(calls.length, 0);
      const json = await (await call(base, { ...COORD, theme: 'history', briefing: true })).json();
      assert.deepEqual(json.route.briefing, { text: '브리핑 문장', picker: 'ai' });
      assert.equal(calls.length, 1);
      assert.equal(calls[0].event, 'briefing');
      assert.equal(calls[0].mode, 'EXPLORE');
      assert.equal(calls[0].theme, 'history');
      assert.equal(calls[0].durationMin, 100);
      assert.deepEqual(calls[0].places.map((p) => p.name), ['A장소', 'B장소', 'C장소']);
    },
    harangiLine,
  );
});

test('하랑이 브리핑이 실패하면 briefing은 null이고 길 응답은 그대로, 에러 내용은 숨긴다', async () => {
  const harangiLine = async () => {
    throw new Error('secret-z');
  };
  await withServer(
    'ok',
    okLoader,
    createComposeRoute({ llm: fakeLlm(GOOD) }),
    async (base) => {
      const res = await call(base, { ...COORD, theme: 'history', briefing: true });
      const text = await res.text();
      const json = JSON.parse(text);
      assert.equal(json.route.title, '맑은날 근대골목길');
      assert.equal(json.route.briefing, null);
      assert.ok(!text.includes('secret-z'));
    },
    harangiLine,
  );
});

test('장소를 하나씩 직접 고치는 주소(/recommend/swap)는 없다 (404)', async () => {
  await withServer('ok', okLoader, createComposeRoute({ llm: null }), async (base) => {
    const res = await fetch(`${base}/recommend/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ ...COORD, currentPlaceIds: ['a'], replacePlaceId: 'a' }),
    });
    assert.equal(res.status, 404);
  });
});