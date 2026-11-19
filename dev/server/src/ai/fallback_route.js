import { FALLBACK_KEYWORD, FALLBACK_REASON } from './ai_config.js';
import { KEYWORDS, WEATHER_WORDS } from './route_options.js';

// AI를 쓰지 못할 때의 길 이름과 이유를 만든다. 장소는 규칙이 고른 것을 그대로 쓴다.
// 이름: "{날씨말} {키워드}길". 테마가 없거나 모르는 테마면 고정 단어를 쓴다. 날씨말이 없는 모드(SAFETY 등)는 키워드만 쓴다.
export function buildFallbackRoute({ mode, theme, places }) {
  const weatherWord = Object.hasOwn(WEATHER_WORDS, mode) ? WEATHER_WORDS[mode] : null;
  const keyword = Object.hasOwn(KEYWORDS, theme) ? KEYWORDS[theme][0] : FALLBACK_KEYWORD;
  const title = weatherWord ? `${weatherWord} ${keyword}길` : `${keyword}길`;
  return { title, placeIds: places.map((p) => p.id), reason: FALLBACK_REASON };
}