import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// 하랑이가 부를 수 있는 도구. 모두 조회 전용이다. 점수, 도장, 방문 기록을 바꾸는 도구는 만들지 않는다.
//   places: 지금 길에 들어 있는 장소만 넘긴다. 그 밖의 장소는 조회할 수 없다.
// 좌표는 어떤 도구에서도 돌려주지 않는다. 값이 없는 항목은 아예 빼서 AI가 없는 사실을 말하지 않게 한다.
export function createHarangiTools({ places, mode, hour, temperatureC }) {
  const byId = new Map(places.map((p) => [p.id, p]));

  const getPlaceInfo = tool(
    async ({ placeId }) => {
      const place = byId.get(placeId);
      if (!place) return JSON.stringify({ error: 'NOT_IN_ROUTE' });
      const info = {
        name: place.name,
        type: place.type,
        hoursText: place.hoursText,
        closedText: place.closedText,
        caution: place.caution,
        stairs: place.stairs,
        slope: place.slope,
        restSpots: place.restSpots,
        eduFit: place.eduFit,
      };
      const present = Object.fromEntries(Object.entries(info).filter(([, v]) => v != null && v !== ''));
      return JSON.stringify(present);
    },
    {
      name: 'get_place_info',
      description: '지금 길에 있는 장소 한 곳의 정보를 조회한다. 이름, 운영 시간, 주의사항 등 값이 있는 항목만 돌려준다.',
      schema: z.object({ placeId: z.string().describe('조회할 장소 id') }),
    },
  );

  const getTodayContext = tool(
    async () =>
      JSON.stringify({
        mode,
        hour: Number.isInteger(hour) ? hour : null,
        temperatureC: Number.isFinite(temperatureC) ? temperatureC : null,
      }),
    {
      name: 'get_today_context',
      description: '오늘의 날씨 모드, 시각(시), 기온을 조회한다.',
      schema: z.object({}),
    },
  );

  return [getPlaceInfo, getTodayContext];
}