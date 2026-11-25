import { randomBytes } from 'node:crypto';
import { createActorKey } from '../agents/common/actor_key.js';

// 접속 현황: "최근에 서버를 쓴 로그인 사용자"를 서버 메모리에만 기억한다. DB에는 쓰지 않는다.
//   - 원본 계정 id는 기억하지 않는다. 서버 비밀값(RUN_KEY_SECRET)으로 만든 해시 키만 기억한다.
//   - 비밀값이 없으면 서버를 켤 때마다 바뀌는 임시 비밀값을 쓴다 (stable=false). 이때 키는 서버를 다시 켜면 달라진다.
//   - 앱이 서버를 부를 때만 기록되므로 "접속 중"은 정확한 접속이 아니라 "최근 windowMs 안에 서버를 쓴 사람"이다.
//   - 서버를 다시 켜면 비워진다. 서버가 여러 대면 합쳐지지 않는다 [확인 필요].
//   config: { windowMs, recentMs, maxUsers } (agents/common/config.js의 PRESENCE)
export function createPresence({ secret, config, now = Date.now }) {
  const stable = Boolean(secret);
  const keyOf = createActorKey({ secret: secret || randomBytes(32).toString('hex') });
  const seen = new Map(); // key → { at, demo }  (가장 최근에 본 사람이 뒤에 온다)

  const record = (key, demo) => {
    seen.delete(key);
    seen.set(key, { at: now(), demo });
    if (seen.size > config.maxUsers) seen.delete(seen.keys().next().value); // 가장 오래된 사람부터 잊는다
  };

  return {
    stable,
    keyOf,
    // 로그인 확인을 통과한 요청마다 부른다
    touch(userId) {
      const key = keyOf(userId);
      if (key) record(key, false);
    },
    // 시연(시나리오) 유저: 키가 'demo:'로 시작한다. 실제 사용자와 섞이지 않게 표시한다.
    touchDemo(key) {
      record(key, true);
    },
    // 접속 중인 사람 목록 (최근 순). windowMs가 지난 사람은 지운다.
    snapshot() {
      const t = now();
      for (const [key, v] of seen) if (t - v.at > config.windowMs) seen.delete(key);
      return [...seen].reverse().map(([key, v]) => ({ key, lastSeenAt: new Date(v.at).toISOString(), demo: v.demo }));
    },
  };
}
