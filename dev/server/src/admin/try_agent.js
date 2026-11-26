import { koreaClock } from '../routes/recommend.js';
import { buildFallbackRoute } from '../ai/fallback_route.js';
import { DEMO_PREFIX } from './user_status.js';

// 관리자 화면의 "에이전트 시험 실행": 실제 장소 자료로 샘플 입력을 만들어 에이전트를 한 번 돌리고 결과를 돌려준다.
// 진짜 LLM을 부른다 (키가 없으면 해당 에이전트는 꺼져 있다고 알려 준다). 실행 기록은 시연 유저(demo:admin)로 남는다.
// 사용자 좌표는 쓰지 않는다. 미션은 장소 좌표를 "내 위치"로 흉내 내서 시작만 한다 (정답은 서버가 쥐고 있어 응답에 없다).
export const TRY_AGENTS = ['course', 'chat', 'mission', 'diary', 'card'];
const ACTOR = `${DEMO_PREFIX}admin`;

export function createTryAgent({ agents, placeLoader, now = () => new Date() }) {
  return async function tryAgent(name, { question } = {}) {
    if (!TRY_AGENTS.includes(name)) return { ok: false, error: 'UNKNOWN_AGENT' };
    const agent = agents[name];
    if (!agent) return { ok: false, error: 'AGENT_OFF', hint: name === 'course' ? 'COURSE_AGENT=on 과 AI 키가 필요합니다' : 'AI 키(GOOGLE_API_KEYS, GEMINI_MODELS)가 필요합니다' };
    const loaded = await placeLoader();
    if (!loaded.ok) return { ok: false, error: 'PLACES_UNAVAILABLE' };
    const places = loaded.places.filter((p) => (p.role ?? 'visit') === 'visit' && p.status === 'open' && Number.isFinite(p.lat));
    if (places.length < 3) return { ok: false, error: 'NOT_ENOUGH_PLACES' };
    const today = new Date(now().getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    const started = Date.now();
    const pick = places.slice(0, 3);
    let result;
    let runId = null;
    if (name === 'course') {
      const { hour, dayOfWeek } = koreaClock(now());
      const candidates = places.slice(0, 12);
      const substitute = buildFallbackRoute({ mode: 'EXPLORE', theme: 'history', places: pick });
      const r = await agent({ mode: 'EXPLORE', theme: 'history', ageGroup: '20s', companion: 'solo', hour, dayOfWeek, temperatureC: 22, candidates }, { substitute, actorKey: ACTOR });
      runId = r.runId ?? null;
      result = { source: r.source, reason: r.reason ?? null, route: r.route ? { title: r.route.title, reason: r.route.reason, placeIds: r.route.placeIds } : null, durationBasis: r.durationBasis ?? null, walkMin: r.walkMin ?? null };
    } else if (name === 'chat') {
      const r = await agent({ question: question || `${pick[0].name}은(는) 몇 시에 열어요?`, places: pick }, { actorKey: ACTOR });
      runId = r.runId ?? null;
      result = { reply: r.reply, kind: r.kind };
    } else if (name === 'mission') {
      const p = pick[0];
      const r = await agent.start({ place: p, position: { latitude: p.lat, longitude: p.lng }, allowedKinds: ['quiz', 'photo'], userKey: ACTOR, actorKey: ACTOR });
      result = r.ok ? { status: r.status, fallback: r.fallback === true, kind: r.mission.kind, explanation: r.mission.explanation, task: r.mission.task } : { reason: r.reason };
    } else if (name === 'diary') {
      const r = await agent({ courseTitle: '시험 길', date: today, visits: pick.map((p) => ({ placeName: p.name, stamped: true, quizPassed: null })), knownPlaceNames: places.map((p) => p.name) }, { actorKey: ACTOR });
      runId = r.runId ?? null;
      result = r.ok ? { text: r.text, source: r.source } : { reason: r.reason };
    } else {
      const r = await agent({ courseTheme: 'history', date: today, result: { placeName: pick[0].name, kind: 'quiz', passed: true, caution: pick[0].caution } }, { actorKey: ACTOR });
      runId = r.runId ?? null;
      result = r.ok ? { caption: r.card.caption, source: r.source, hasImage: Boolean(r.card.image) } : { reason: r.reason };
    }
    return { ok: true, agent: name, ms: Date.now() - started, runId, result };
  };
}
