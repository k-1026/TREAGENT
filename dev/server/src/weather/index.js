import { toGrid } from './kma_grid.js';
import { getBaseDateTime } from './base_time.js';
import { fetchForecast, KmaError } from './kma_client.js';
import { normalizeForecast, unavailable } from './normalize.js';
import { createCache } from './cache.js';
import { createMockFetch } from './mock_source.js';
import { WEATHER_CONFIG } from './config.js';

// 날씨 서비스를 만든다. 값을 안 넣으면 .env의 WEATHER_SOURCE, WEATHER_MOCK_SCENARIO를 쓴다.
export function createWeatherService({
  source = process.env.WEATHER_SOURCE ?? 'mock', // 'kma' 또는 'mock'
  scenario = process.env.WEATHER_MOCK_SCENARIO ?? 'ok',
  fetchImpl, // 테스트에서 가짜 fetch를 넣을 때 쓴다 (source가 kma일 때)
  clientDeps = {}, // 테스트에서 sleep 등을 바꿀 때 쓴다
  now = () => new Date(),
  cache = createCache(),
  config = WEATHER_CONFIG,
} = {}) {
  if (source !== 'kma' && source !== 'mock') {
    throw new Error('WEATHER_SOURCE는 kma 또는 mock이어야 한다');
  }

  // 기상청(또는 mock)에서 가져와서 { ok: true, items } 또는 { ok: false, reason }으로 돌려준다.
  // 에러 객체는 밖으로 내보내거나 출력하지 않고 종류 코드만 쓴다.
  async function load(params) {
    try {
      const items = await fetchForecast(params, {
        ...clientDeps,
        fetchImpl: source === 'mock' ? createMockFetch(scenario) : fetchImpl,
        serviceKey: source === 'mock' ? 'MOCK_KEY' : clientDeps.serviceKey,
      });
      return { ok: true, items };
    } catch (err) {
      return { ok: false, reason: err instanceof KmaError ? err.kind : 'UPSTREAM_ERROR' };
    }
  }

  // 위도, 경도를 받아서 날씨 값(또는 unavailable)을 돌려준다. 이 함수는 던지지 않는다.
  async function getWeather({ latitude, longitude }) {
    // 좌표는 여기서 격자 번호로 바꾸는 데만 쓴다. 이후에는 격자 번호만 쓴다.
    const { nx, ny } = toGrid(latitude, longitude);
    const base = getBaseDateTime(now());
    const key = `${nx}:${ny}:${base.baseDate}${base.baseTime}`; // 좌표가 아닌 격자 번호

    const loaded = await cache.getOrLoad(
      key,
      () => load({ nx, ny, baseDate: base.baseDate, baseTime: base.baseTime }),
      (value) => (value.ok ? config.successTtlMs : config.failureTtlMs),
    );
    if (!loaded.ok) return unavailable(loaded.reason);

    const result = normalizeForecast(loaded.items, { now: now(), baseIso: base.baseIso });
    return result.status === 'ok' ? { ...result, source } : result;
  }

  return { getWeather };
}