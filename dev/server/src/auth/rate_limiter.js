// 일정 시간 안의 시도 횟수를 제한한다. 서버 메모리에만 기억한다 (서버를 다시 켜면 초기화된다).
//   allow(key): 허용되면 true(그리고 이번 시도를 기록), 너무 많으면 false
const PRUNE_AT = 5000; // 기록한 키가 이만큼 쌓이면 지난 기록을 정리한다

export function createRateLimiter({ max, windowMs, now = () => Date.now() }) {
  const hits = new Map(); // key → 시도 시각 배열

  function prune(t) {
    for (const [key, list] of hits) {
      if (list.every((x) => t - x >= windowMs)) hits.delete(key);
    }
  }

  return {
    allow(key) {
      const t = now();
      if (hits.size >= PRUNE_AT) prune(t);
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
  };
}