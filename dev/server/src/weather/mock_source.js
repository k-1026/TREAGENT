// 가짜 기상청: 실제 fetch처럼 동작하지만 정해진 응답만 돌려준다.
// WEATHER_SOURCE=mock 일 때와 테스트에서 쓴다. 모든 값은 시연용이다.
export const MOCK_SCENARIOS = [
  'ok', 'hot', 'very_hot', 'missing_value', 'rate_limited', 'no_data', 'http_error', 'timeout', 'bad_json',
];

const pad2 = (n) => String(n).padStart(2, '0');

// 발표 시각 다음 시각부터 36시간치 기온(TMP) 행을 만든다. 기상청 단기예보와 같은 모양이다.
function buildItems(baseDate, baseTime, tempValue) {
  const y = Number(baseDate.slice(0, 4));
  const m = Number(baseDate.slice(4, 6));
  const d = Number(baseDate.slice(6, 8));
  const h = Number(baseTime.slice(0, 2));
  const items = [];
  for (let i = 1; i <= 36; i += 1) {
    // Date.UTC의 시(hour)가 24를 넘으면 날짜가 자동으로 넘어간다. 한국 시계 값으로 읽는다.
    const t = new Date(Date.UTC(y, m - 1, d, h + i));
    items.push({
      baseDate,
      baseTime,
      category: 'TMP',
      fcstDate: `${t.getUTCFullYear()}${pad2(t.getUTCMonth() + 1)}${pad2(t.getUTCDate())}`,
      fcstTime: `${pad2(t.getUTCHours())}00`,
      fcstValue: String(tempValue),
    });
  }
  return items;
}

const okResponse = (items) =>
  new Response(
    JSON.stringify({
      response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { items: { item: items } } },
    }),
  );
const codeResponse = (code) =>
  new Response(JSON.stringify({ response: { header: { resultCode: code, resultMsg: 'MOCK' } } }));

const TEMPS = { ok: 20, hot: 30, very_hot: 35 }; // 시연 값

// scenario를 받아 "fetch처럼 쓸 수 있는 함수"를 돌려준다.
export function createMockFetch(scenario = 'ok') {
  if (!MOCK_SCENARIOS.includes(scenario)) {
    throw new Error('알 수 없는 mock 시나리오');
  }
  return async (url) => {
    const q = new URL(url).searchParams;
    const baseDate = q.get('base_date');
    const baseTime = q.get('base_time');
    switch (scenario) {
      case 'missing_value':
        return okResponse(buildItems(baseDate, baseTime, ''));
      case 'rate_limited':
        return codeResponse('22');
      case 'no_data':
        return codeResponse('03');
      case 'http_error':
        return new Response('', { status: 500 });
      case 'timeout':
        throw new DOMException('timeout', 'TimeoutError');
      case 'bad_json':
        return new Response('깨진 응답');
      default:
        return okResponse(buildItems(baseDate, baseTime, TEMPS[scenario]));
    }
  };
}