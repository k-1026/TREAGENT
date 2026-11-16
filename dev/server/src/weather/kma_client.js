import { WEATHER_CONFIG } from './config.js';

// 실패 종류를 담는 에러. 메시지에는 종류 코드만 넣는다.
// 요청 주소(인증키 포함)나 응답 원문은 절대 담지 않는다.
export class KmaError extends Error {
  constructor(kind) {
    super(kind);
    this.name = 'KmaError';
    this.kind = kind;
  }
}

// 다시 시도해 볼 가치가 있는 실패 종류들
const RETRYABLE_KINDS = new Set(['TIMEOUT', 'NETWORK', 'HTTP_ERROR', 'RATE_LIMITED']);

// 시간 초과로 끊긴 에러인지 확인한다.
function isTimeout(err) {
  return err?.name === 'TimeoutError' || err?.name === 'AbortError';
}

// 기상청에 보낼 주소를 만든다. 인증키가 들어 있으니 밖으로 내보내거나 출력하지 않는다.
function buildUrl({ nx, ny, baseDate, baseTime }, serviceKey, config) {
  const url = new URL(`${config.baseUrl}/${config.operation}`);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', String(config.numOfRows));
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', baseDate);
  url.searchParams.set('base_time', baseTime);
  url.searchParams.set('nx', String(nx));
  url.searchParams.set('ny', String(ny));
  return url;
}

// 호출을 딱 한 번 하고, 성공하면 items 배열, 실패하면 KmaError를 던진다.
async function attemptOnce(url, fetchImpl, config) {
  let res;
  try {
    // AbortSignal.timeout: 정해진 시간이 지나면 요청을 자동으로 끊는다.
    res = await fetchImpl(url, { signal: AbortSignal.timeout(config.timeoutMs) });
  } catch (err) {
    throw new KmaError(isTimeout(err) ? 'TIMEOUT' : 'NETWORK');
  }

  // 서버 오류(5xx)와 요청 과다(429)는 다시 해 볼 수 있다. 그 밖의 4xx는 다시 해도 같다.
  if (res.status >= 500 || res.status === 429) throw new KmaError('HTTP_ERROR');
  if (!res.ok) throw new KmaError('UPSTREAM_ERROR');

  let body;
  try {
    body = await res.json();
  } catch (err) {
    throw new KmaError(isTimeout(err) ? 'TIMEOUT' : 'BAD_RESPONSE');
  }

  // 응답이 HTTP 200이어도 본문 안의 결과 코드가 오류일 수 있다.
  // [확인 필요] response.header.resultCode / response.body.items.item 구조는 활용가이드로 확인 전
  const code = body?.response?.header?.resultCode;
  const { ok, retryable, noData } = config.resultCodes;
  if (ok.includes(code)) {
    const items = body?.response?.body?.items?.item;
    if (!Array.isArray(items)) throw new KmaError('BAD_RESPONSE');
    return items;
  }
  if (retryable.includes(code)) throw new KmaError('RATE_LIMITED');
  if (noData.includes(code)) throw new KmaError('NO_DATA');
  throw new KmaError('UPSTREAM_ERROR'); // 모르는 코드는 재시도 없이 실패
}

// 재시도까지 포함한 호출. deps는 테스트에서 가짜로 바꿔 끼우는 부품들이다.
export async function fetchForecast(params, deps = {}) {
  const {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    random = Math.random,
    serviceKey = process.env.KMA_SERVICE_KEY,
    config = WEATHER_CONFIG,
  } = deps;

  if (!serviceKey) throw new KmaError('MISSING_KEY');
  const url = buildUrl(params, serviceKey, config);

  for (let attempt = 0; ; attempt++) {
    try {
      return await attemptOnce(url, fetchImpl, config);
    } catch (err) {
      const kind = err instanceof KmaError ? err.kind : 'UPSTREAM_ERROR';
      const canRetry = RETRYABLE_KINDS.has(kind) && attempt < config.maxRetries;
      if (!canRetry) throw err instanceof KmaError ? err : new KmaError(kind);
      // 1초, 2초, ... 에 무작위 값을 보태 여러 요청이 동시에 몰리지 않게 한다.
      const delay = config.retryBaseDelayMs * 2 ** attempt + Math.floor(random() * config.retryJitterMs);
      await sleep(delay);
    }
  }
}