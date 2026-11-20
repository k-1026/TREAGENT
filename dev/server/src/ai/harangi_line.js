import { createHarangiTools } from './harangi_tools.js';
import { createHarangiGraph, runHarangiGraph } from './harangi_graph.js';
import { buildBriefingFacts, fixedBriefing, validateBriefing } from './harangi_briefing.js';
import { FIXED_LINES, SAFETY_LINES } from './harangi_config.js';

const SAFETY_MODES = ['SAFETY', 'HOLD', 'UNKNOWN'];

// 장면 분류: 사용자의 행동(event)과 모드로 장면을 정한다. 코드가 정하고 AI는 관여하지 않는다.
//   안전이 걸린 모드는 어떤 행동이든 'safety'. 모르는 행동은 null.
export function classifyScene({ event, mode }) {
  if (SAFETY_MODES.includes(mode)) return 'safety';
  if (event === 'start') return 'start';
  if (event === 'arrive') return 'arrival';
  if (event === 'briefing') return 'briefing';
  return null;
}

// 안전 안내 문장. 기준 시각이 있으면 함께 적는다. 문장은 고정이고 AI가 쓰지 않는다.
function safetyLine(mode, hour) {
  const base = SAFETY_LINES[mode];
  return mode === 'SAFETY' && Number.isInteger(hour) ? `${base} 기준은 ${hour}시 날씨예요.` : base;
}

// 하랑이 대사 서비스를 만든다. makeModel이 없으면(키 없음) 항상 고정 대사를 쓴다.
//   makeModel: (tools) => async (messages, { signal }) => AIMessage | null
//   cache: createRouteCache() | null. 같은 브리핑 사실이면 같은 문장을 다시 보여 주기 위해 AI 결과를 기억한다.
//   places: 지금 길에 들어 있는 장소들(도구가 조회할 수 있는 범위, 브리핑에서는 방문 순서대로). 좌표는 쓰지 않는다.
export function createHarangiLine({ makeModel = null, cache = null, timeoutMs } = {}) {
  return async function harangiLine({ event, mode, hour, temperatureC, routeTitle, placeId, theme, durationMin, places = [] }) {
    const scene = classifyScene({ event, mode });
    if (scene === null) return { ok: false, reason: 'UNKNOWN_EVENT' };

    // 안전 안내는 AI를 쓰지 않는다. (브리핑 요청이어도 안전 모드에서는 안전 안내가 먼저다)
    if (scene === 'safety') return { ok: true, scene, picker: 'rules', text: safetyLine(mode, hour) };

    // 브리핑은 사실을 코드가 정해 두고, 고정 문장도 그 사실로 만든다.
    const facts = scene === 'briefing' ? buildBriefingFacts({ title: routeTitle, theme, durationMin, places }) : null;
    const fixed = {
      ok: true,
      scene,
      picker: 'rules',
      text: scene === 'briefing' ? fixedBriefing(facts) : FIXED_LINES[scene],
    };
    if (!makeModel) return fixed;

    const cacheKey = facts ? JSON.stringify([scene, facts]) : null;
    const cached = cacheKey ? cache?.get(cacheKey) : undefined;
    if (cached) return { ok: true, scene, picker: 'ai', text: cached };

    const tools = createHarangiTools({ places, mode, hour, temperatureC });
    const validator = scene === 'briefing' ? (text) => validateBriefing(text, facts) : undefined;
    const graph = createHarangiGraph({ model: makeModel(tools), tools, timeoutMs, validator });
    const result = await runHarangiGraph(graph, { scene, routeTitle, placeId, facts });
    if (result.source !== 'ai') return fixed;
    if (cacheKey) cache?.set(cacheKey, result.line);
    return { ok: true, scene, picker: 'ai', text: result.line, toolRounds: result.toolRounds };
  };
}