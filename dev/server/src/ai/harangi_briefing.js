import { THEME_LABELS } from './route_options.js';
import { validateLine } from './harangi_validate.js';
import { BRIEFING_MAX_LENGTH } from './harangi_config.js';

// "오늘의 길" 브리핑. 사실(길 이름, 테마, 소요시간, 장소 이름)은 코드가 정하고, AI는 그 사실을 하랑이 말투로 읽어 준다.
// AI가 시간이나 장소를 지어내지 못하도록 검증하고, 실패하면 코드가 사실을 끼워 만든 고정 문장을 쓴다.

// 이름에서 괄호 설명을 뺀다. 대사에는 지문 방지 때문에 괄호를 쓸 수 없다. 예: "약전골목 (약령시 거리)" → "약전골목"
export const shortName = (name) => String(name).replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();

// 받침이 없으면 "예요", 있으면 "이에요". 예: 역사예요, 자연이에요, 근대골목길이에요
function copula(word) {
  const code = String(word).trim().slice(-1).charCodeAt(0);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  return isHangul && (code - 0xac00) % 28 === 0 ? '예요' : '이에요';
}

// 브리핑에 쓸 사실을 모은다. places는 방문 순서대로 정렬된 장소(이름이 있어야 함).
export function buildBriefingFacts({ title, theme, durationMin, places }) {
  return {
    title,
    themeLabel: Object.hasOwn(THEME_LABELS, theme) ? THEME_LABELS[theme] : null,
    durationMin: Number.isInteger(durationMin) ? durationMin : null,
    placeNames: places.map((p) => shortName(p.name)),
  };
}

// AI를 쓰지 못할 때의 브리핑. 사실만 담은 담백한 문장이다. 창작 임시 문구이며 팀이 확정한다.
export function fixedBriefing(facts) {
  const parts = [`오늘의 길은 ${facts.title}${copula(facts.title)}.`];
  if (facts.themeLabel) parts.push(`테마는 ${facts.themeLabel}${copula(facts.themeLabel)}.`);
  parts.push(facts.durationMin ? `소요시간은 약 ${facts.durationMin}분${copula('분')}.` : '소요시간은 아직 알 수 없어요.');
  parts.push(`${facts.placeNames.join(', ')} 순서로 걸어요.`);
  return parts.join(' ');
}

// AI가 쓴 브리핑을 검사한다. 대사 규칙(금칙어, 지문 금지 등)에 더해 사실과 맞는지 확인한다.
//   - 모든 장소 이름과 테마가 들어 있어야 한다.
//   - 소요시간을 알면 그 값이 그대로 들어 있어야 하고, 모르면 시간을 말하면 안 된다. 다른 분·시간 숫자는 지어낸 것으로 본다.
export function validateBriefing(raw, facts) {
  const base = validateLine(raw, { maxLength: BRIEFING_MAX_LENGTH });
  if (!base.ok) return base;
  const text = base.text;
  if (facts.placeNames.some((name) => !text.includes(name))) return { ok: false, error: 'MISSING_PLACE' };
  if (facts.themeLabel && !text.includes(facts.themeLabel)) return { ok: false, error: 'MISSING_THEME' };
  if (/\d+\s*시간/.test(text)) return { ok: false, error: 'INVENTED_DURATION' };
  const minutes = [...text.matchAll(/(\d+)\s*분/g)].map((m) => Number(m[1]));
  if (facts.durationMin === null) {
    if (minutes.length > 0) return { ok: false, error: 'INVENTED_DURATION' };
  } else {
    if (!minutes.includes(facts.durationMin)) return { ok: false, error: 'MISSING_DURATION' };
    if (minutes.some((m) => m !== facts.durationMin)) return { ok: false, error: 'INVENTED_DURATION' };
  }
  return { ok: true, text };
}