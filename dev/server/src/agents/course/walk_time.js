import { getWalkingRoute } from '../../tmap/pedestrian.js';

// 확인자가 쓰는 도보 시간 함수. T맵을 서버가 직접 부른다 (MCP 사용 안 함). LLM에는 노출하지 않는다.
//   반환: async (a, b) => 분 | null.  a, b는 { lat, lng } (장소 좌표. 이용자 좌표가 아니다).
// 같은 구간은 한 요청 안에서 한 번만 부른다. 실패하면 null을 돌려주고, 확인자가 추정식으로 내려간다.
// TMAP_APP_KEY가 없으면 null을 돌려주는 함수가 된다 (추정식 사용).
export function createWalkTime({ getRoute = getWalkingRoute, env = process.env } = {}) {
  if (getRoute === getWalkingRoute && !env.TMAP_APP_KEY) return async () => null;
  const memo = new Map();
  return async function walkTime(a, b) {
    const key = `${a.lat},${a.lng}>${b.lat},${b.lng}`;
    if (memo.has(key)) return memo.get(key);
    let min = null;
    try {
      const r = await getRoute(a, b);
      if (Number.isFinite(r?.time)) min = Math.ceil(r.time / 60); // T맵의 time은 초
    } catch {
      min = null; // 원본 에러는 버린다 (좌표가 섞일 수 있음)
    }
    memo.set(key, min);
    return min;
  };
}
