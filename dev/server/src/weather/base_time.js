import { WEATHER_CONFIG } from './config.js';

// 숫자를 두 자리 글자로 만든다. 5 → '05'
function pad2(n) {
  return String(n).padStart(2, '0');
}

// now(Date)를 받아서 "지금 요청해도 되는 가장 최근 발표분"을 돌려준다.
// 예: { baseDate: '20261116', baseTime: '1400', baseIso: '2026-11-16T14:00:00+09:00' }
export function getBaseDateTime(now = new Date()) {
  const { baseHours, publishDelayMinutes } = WEATHER_CONFIG;

  // 한국 시간(UTC+9)으로 맞춘다. 서버 컴퓨터의 시간대와 상관없이 같은 결과를 내기 위해서다.
  // 한국 시간으로 옮긴 Date는 getUTC... 로 읽는다 (옮겨 둔 값을 그대로 읽기 위한 방법).
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  // 발표 직후엔 자료가 없을 수 있으니 지연 시간만큼 뺀 시각을 기준으로 삼는다.
  const shifted = new Date(now.getTime() + KST_OFFSET_MS - publishDelayMinutes * 60 * 1000);

  const hour = shifted.getUTCHours();
  // 그 시각 이전(포함)의 발표 시각들 중에서 고른다.
  const candidates = baseHours.filter((h) => h <= hour);

  let day = shifted;
  let baseHour;
  if (candidates.length > 0) {
    baseHour = Math.max(...candidates);
  } else {
    // 오늘 첫 발표 전이면 어제의 마지막 발표분을 쓴다.
    day = new Date(shifted.getTime() - 24 * 60 * 60 * 1000);
    baseHour = Math.max(...baseHours);
  }

  const yyyy = day.getUTCFullYear();
  const mm = pad2(day.getUTCMonth() + 1);
  const dd = pad2(day.getUTCDate());
  const hh = pad2(baseHour);
  return {
    baseDate: `${yyyy}${mm}${dd}`,
    baseTime: `${hh}00`,
    baseIso: `${yyyy}-${mm}-${dd}T${hh}:00:00+09:00`,
  };
}