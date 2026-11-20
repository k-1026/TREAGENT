import { ROUTE_CACHE_MAX, ROUTE_CACHE_TTL_MS } from './ai_config.js';

// "같은 조건이면 같은 코스"를 위한 캐시 키. 좌표는 넣지 않는다.
export function makeCacheKey({ mode, ageGroup, theme, companion, zone, variant, district }) {
  return JSON.stringify([
    mode,
    ageGroup ?? null,
    theme ?? null,
    companion ?? null,
    zone ?? null,
    variant ?? 'B',
    district ?? null,
  ]);
}

// 서버 메모리에 결과를 잠깐 기억한다. 서버를 다시 켜면 사라진다. (일행 저장소로 바꾸기 전의 임시 구현)
export function createRouteCache({ ttlMs = ROUTE_CACHE_TTL_MS, max = ROUTE_CACHE_MAX, now = () => Date.now() } = {}) {
  const map = new Map(); // key → { at, value }
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (now() - entry.at >= ttlMs) {
        map.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value) {
      map.delete(key);
      // 너무 많이 쌓이지 않게 가장 오래된 것부터 지운다.
      if (map.size >= max) map.delete(map.keys().next().value);
      map.set(key, { at: now(), value });
    },
    get size() {
      return map.size;
    },
  };
}