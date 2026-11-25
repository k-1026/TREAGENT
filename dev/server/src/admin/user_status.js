// 접속 중인 사람이 지금 에이전트를 쓰는지 계산한다. 접속 현황(presence)과 실행 기록(actorKey)을 맞춰 본다.
//   users: presence.snapshot()의 결과 [{ key, lastSeenAt, demo }]
//   runs: [{ agent, actorKey, status, endedAt }]  status는 describeRun의 'running' | 'ended' | 'stale'
// 상태: using(진행 중인 실행이 있음) / recent(recentMs 안에 끝난 실행이 있음) / idle(접속만 함)
// 화면에는 해시 키의 앞부분만 내보낸다. 원본 계정 id는 이 코드에 들어오지 않는다.
export const DEMO_PREFIX = 'demo:';

// 서버를 다시 켠 직후처럼 접속 현황(메모리)이 비었을 때, 실행 기록(DB)에서 "최근 windowMs 안에 에이전트를 쓴 사람"을 다시 채운다.
//   users: presence.snapshot()   runs: [{ actorKey, startedAt, endedAt }]   stable: presence.stable (RUN_KEY_SECRET이 있는가)
//   - presence에 이미 있는 사람은 그대로 두고, 없는 사람만 기록에서 복원한다 (restored: true).
//   - stable이 false(임시 키)면 실제 사용자는 복원하지 않는다. 서버를 켤 때마다 키가 달라져서 같은 사람이 둘로 보이기 때문이다.
//     시연 유저(demo:)는 키가 고정이라 복원한다.
//   - 접속만 하고 에이전트를 안 쓴 사람은 기록이 없어서 복원되지 않는다. 그 사람이 다음 요청을 보내면 다시 나타난다.
export function restoreUsersFromRuns({ users, runs, now = Date.now, windowMs, stable }) {
  const have = new Set(users.map((u) => u.key));
  const lastAt = new Map(); // key → 마지막 활동 시각(시작과 끝 중 늦은 것)
  for (const r of runs) {
    const key = r.actorKey;
    if (!key || have.has(key)) continue;
    if (!stable && !key.startsWith(DEMO_PREFIX)) continue;
    const at = Math.max(Date.parse(r.startedAt), r.endedAt ? Date.parse(r.endedAt) : 0);
    if (now - at > windowMs) continue;
    if (!(lastAt.get(key) >= at)) lastAt.set(key, at);
  }
  const restored = [...lastAt].map(([key, at]) => ({ key, lastSeenAt: new Date(at).toISOString(), demo: key.startsWith(DEMO_PREFIX), restored: true }));
  return [...users.map((u) => ({ ...u, restored: false })), ...restored].sort((a, b) => Date.parse(b.lastSeenAt) - Date.parse(a.lastSeenAt));
}

const labelOf = (key) => (key.startsWith(DEMO_PREFIX) ? `시연 유저 ${key.slice(DEMO_PREFIX.length)}` : `유저 ${key.slice(0, 4)}`);
const idOf = (key) => (key.startsWith(DEMO_PREFIX) ? key : key.slice(0, 8));
const unique = (list) => [...new Set(list)];

export function describeUsers({ users, runs, now = Date.now(), recentMs }) {
  const byKey = new Map();
  for (const r of runs) {
    if (!r.actorKey) continue;
    (byKey.get(r.actorKey) ?? byKey.set(r.actorKey, []).get(r.actorKey)).push(r);
  }

  const counts = { connected: users.length, using: 0, recent: 0, idle: 0 };
  const perAgent = {}; // 에이전트별로 지금 쓰고 있는 사람 수
  const out = users.map((u) => {
    const mine = byKey.get(u.key) ?? [];
    const running = mine.filter((r) => r.status === 'running');
    const recent = mine.filter((r) => r.status === 'ended' && r.endedAt && now - Date.parse(r.endedAt) <= recentMs);
    let state = 'idle';
    let agents = [];
    if (running.length) {
      state = 'using';
      agents = unique(running.map((r) => r.agent));
      for (const a of agents) perAgent[a] = (perAgent[a] ?? 0) + 1;
    } else if (recent.length) {
      state = 'recent';
      agents = unique(recent.map((r) => r.agent));
    }
    counts[state] += 1;
    return { id: idOf(u.key), label: labelOf(u.key), demo: u.demo, restored: Boolean(u.restored), lastSeenAt: u.lastSeenAt, state, agents };
  });
  return { counts, perAgent, users: out };
}
