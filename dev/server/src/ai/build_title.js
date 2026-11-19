import { KEYWORDS, WEATHER_WORDS } from './route_options.js';

// 모드, 테마, 키워드로 길 이름을 조립한다. 허용되지 않는 값이면 null.
export function buildTitle({ mode, theme, keyword }) {
  if (!Object.hasOwn(WEATHER_WORDS, mode)) return null;
  if (!Object.hasOwn(KEYWORDS, theme)) return null;
  if (!KEYWORDS[theme].includes(keyword)) return null;
  return `${WEATHER_WORDS[mode]} ${keyword}길`;
}