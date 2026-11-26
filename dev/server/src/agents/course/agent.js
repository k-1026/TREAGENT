import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { AgentError } from '../common/errors.js';
import { callLlm } from '../common/llm_call.js';
import { createBudget } from '../common/budget.js';
import { AGENT_LIMITS } from '../common/config.js';
import { ROUTE_PLACE_COUNT } from '../../ai/ai_config.js';
import { COURSE_LIMITS, PROMPT_VERSION } from './config.js';
import { pickProfile } from './profiles.js';
import { listCandidates, clean } from './tools.js';
import { researcherPrompt, plannerPrompt, writerPrompt, judgePrompt } from './prompts.js';
import { checkPlaces } from './checker.js';
import { checkDraft } from './validator.js';

// 코스 설계 에이전트: 테마 관문 → 연구자 → 근거 합치기 → 기획자 ⇄ 확인자 → 작성자 → 검증 → 평가자 → 끝.
// 순서가 정해진 LangGraph 그래프이고, LLM이 다음 단계를 정하지 않는다 (plan/spec/agent_architecture_v2.md 4-1장).
// 원칙: LLM이 고르고 쓰고, 코드(확인자·검증)가 거부권을 가진다. 모든 노드 결과는 실행 기록에 남는다.
//
// 결과 source:
//   'agent'      에이전트가 만든 코스 (outcome: normal)
//   'substitute' 되돌이 상한을 다 써서 대체 코스를 냈다 (outcome: substitute)
//   'failed'     LLM·예산·시간 문제 등으로 막혔다. 호출하는 쪽이 기존 길 구성으로 내려간다 (outcome: fallback)

const State = Annotation.Root({
  profile: Annotation(),
  rawEvidence: Annotation(), // 연구자가 낸 요약 (합치기 전)
  evidence: Annotation(), // [{ id, placeId, text, source }]
  plannedIds: Annotation(), // 기획자가 고른 장소 id (확인 전)
  checked: Annotation(), // 확인자 결과 (통과 시 ordered 포함)
  draft: Annotation(), // 작성자 결과 { keyword, reason, evidenceIds }
  excluded: Annotation(), // 확인자가 거부해 뺀 장소 id들
  attempts: Annotation(), // { planner, writer }
  feedback: Annotation(), // 직전 거부 사유 (다음 LLM 노드의 프롬프트에 안내로 붙는다)
  route: Annotation(),
  source: Annotation(),
});

const NOOP_RUN = { id: null, step: (meta, fn) => fn(), finish: async () => {}, flush: async () => {} };
const text = (v, max) => (typeof v === 'string' ? clean(v).slice(0, max) : '');

// llms: { researcher, planner, writer, judge }  각각 async ({ system, user }, { signal }) => ({ value, usage })
// walkTime: async (a, b) => 도보 분 | null. 없으면 추정식을 쓴다.
// recorder: createRecorder(...) 결과. 없으면 기록하지 않는다 (테스트).
export function createCourseAgent({
  llms,
  walkTime = null,
  recorder = null,
  limits = AGENT_LIMITS,
  courseLimits = COURSE_LIMITS,
  makeBudget = () => createBudget({ maxCalls: limits.maxLlmCalls, deadlineMs: limits.deadlineMs }),
}) {
  // input: { mode, theme, ageGroup, companion, hour, dayOfWeek, temperatureC, candidates(좌표 포함, 서버 안에서만 씀) }
  // substitute: 대체 코스 { title, placeIds, reason } (규칙으로 고른 코스. 호출하는 쪽이 만든다)
  return async function runCourseAgent(input, { substitute, actorKey = null } = {}) {
    const run = recorder ? recorder.startRun({ agent: 'course', actorKey }) : NOOP_RUN;
    const budget = makeBudget();
    const { candidates } = input;
    const context = { hour: input.hour, dayOfWeek: input.dayOfWeek };
    const count = Math.min(ROUTE_PLACE_COUNT, candidates.length);
    // LLM에 보내는 입력에는 후보 목록(좌표 포함)을 싣지 않는다.
    const llmInput = { mode: input.mode, theme: input.theme, ageGroup: input.ageGroup, companion: input.companion, hour: input.hour, temperatureC: input.temperatureC };
    const timeoutMs = limits.llmTimeoutMs;

    // LLM 노드 한 단계: 예산 차감 + 제한 시간 + 기록. toOutput은 기록용 요약이다.
    const llmStep = (node, attempt, prompt, summary, toOutput) =>
      run.step(
        {
          node,
          kind: 'llm',
          attempt,
          prompt,
          summary,
          toRecord: (r) => ({
            output: toOutput(r.value),
            llmCalls: 1,
            model: llms[node]?.model ?? null,
            promptVersion: PROMPT_VERSION,
            inputTokens: r.usage?.inputTokens ?? null,
            outputTokens: r.usage?.outputTokens ?? null,
            totalTokens: r.usage?.totalTokens ?? null,
          }),
        },
        () => callLlm({ llm: llms[node], input: prompt, budget, timeoutMs }),
      );

    // 코드 노드 한 단계. fn은 { ok, code, ... }를 돌려주고, ok가 아니면 fail로 기록한다.
    const codeStep = (node, attempt, summary, fn, toOutput = () => null) =>
      run.step(
        {
          node,
          kind: 'code',
          attempt,
          summary,
          toRecord: (r) => ({ verdict: r.ok ? 'pass' : 'fail', reasonCode: r.code ?? null, output: toOutput(r) }),
        },
        fn,
      );

    const gate = (state) => codeStep('gate', 1, { theme: input.theme }, async () => ({ ok: true, profile: pickProfile(input.theme) }), (r) => ({ focus: r.profile.focus })).then((r) => ({ profile: r.profile }));

    const researcher = async (state) => {
      const facts = listCandidates(candidates);
      const prompt = researcherPrompt({ input: llmInput, profile: state.profile, facts });
      const r = await llmStep('researcher', 1, prompt, { candidates: candidates.length }, (v) => ({ evidence: Array.isArray(v?.evidence) ? v.evidence.length : 0 }));
      return { rawEvidence: Array.isArray(r.value?.evidence) ? r.value.evidence : [] };
    };

    // 근거 합치기(코드): 후보 안의 장소 근거만 남기고 id를 붙인다. LLM 요약이 없는 장소는 DB 값으로 한 줄을 만든다.
    const merge = async (state) => {
      const raw = state.rawEvidence ?? [];
      const known = new Set(candidates.map((p) => p.id));
      const items = [];
      const covered = new Set();
      for (const e of raw) {
        const summary = text(e?.summary, courseLimits.evidenceMaxChars);
        if (!summary || !known.has(e?.placeId)) continue;
        items.push({ placeId: e.placeId, text: summary });
        covered.add(e.placeId);
      }
      for (const p of candidates) {
        if (covered.has(p.id)) continue;
        const parts = [`유형 ${p.type}`];
        if (p.hoursText) parts.push(`운영 ${clean(p.hoursText)}`);
        if (p.caution) parts.push(`주의 ${clean(p.caution)}`);
        items.push({ placeId: p.id, text: text(parts.join(', '), courseLimits.evidenceMaxChars) });
      }
      const evidence = items.map((it, i) => ({ id: `E${i + 1}`, placeId: it.placeId, text: it.text, source: 'db' }));
      const r = await codeStep('merge', 1, { raw: raw.length }, async () => ({ ok: true, evidence }), (x) => ({ evidence: x.evidence.length }));
      return { evidence: r.evidence, excluded: [], attempts: { planner: 0, writer: 0 } };
    };

    const planner = async (state) => {
      const attempt = state.attempts.planner + 1;
      const pool = candidates.filter((p) => !state.excluded.includes(p.id));
      const prompt = plannerPrompt({ input: llmInput, evidence: state.evidence, candidates: pool, count, retry: state.feedback });
      const r = await llmStep('planner', attempt, prompt, { pool: pool.length, excluded: state.excluded.length }, (v) => ({ placeIds: Array.isArray(v?.placeIds) ? v.placeIds : null }));
      return { plannedIds: r.value?.placeIds, attempts: { ...state.attempts, planner: attempt }, feedback: null };
    };

    const checker = async (state) => {
      const attempt = state.attempts.planner;
      const r = await codeStep(
        'checker',
        attempt,
        { placeIds: state.plannedIds },
        () => checkPlaces({ placeIds: state.plannedIds, candidates, context, walkTime, ageGroup: input.ageGroup, count, limits: courseLimits }),
        (x) => ({ walkMin: x.walkMin ?? null, durationBasis: x.durationBasis ?? null, bad: x.badPlaceIds }),
      );
      if (r.ok) return { checked: r };
      // 실패한 장소는 다음 기획에서 뺀다. 사유 코드는 기획자에게 안내로 돌려준다.
      return { checked: r, excluded: [...new Set([...state.excluded, ...r.badPlaceIds])], feedback: r.code };
    };

    const writer = async (state) => {
      const attempt = state.attempts.writer + 1;
      const byId = new Map(candidates.map((p) => [p.id, p]));
      const places = state.checked.ordered.map((id) => byId.get(id));
      const prompt = writerPrompt({ input: llmInput, places, evidence: state.evidence, retry: state.feedback });
      const r = await llmStep('writer', attempt, prompt, { placeIds: state.checked.ordered }, (v) => ({ keyword: v?.keyword ?? null, evidenceIds: v?.evidenceIds ?? null }));
      return { draft: r.value, attempts: { ...state.attempts, writer: attempt }, feedback: null };
    };

    const validator = async (state) => {
      const r = await codeStep(
        'validator',
        state.attempts.writer,
        { placeIds: state.checked.ordered },
        async () => checkDraft({ draft: state.draft, placeIds: state.checked.ordered, candidates, evidence: state.evidence, mode: input.mode, theme: input.theme }),
        (x) => (x.ok ? { title: x.route.title } : null),
      );
      return r.ok ? { route: r.route, feedback: null } : { route: null, feedback: r.code };
    };

    const judge = async (state) => {
      const byId = new Map(candidates.map((p) => [p.id, p]));
      const places = state.checked.ordered.map((id) => byId.get(id));
      const prompt = judgePrompt({ input: llmInput, places, evidence: state.evidence, draft: state.draft });
      const r = await llmStep('judge', state.attempts.writer, prompt, { placeIds: state.checked.ordered }, (v) => ({ pass: v?.pass === true, reason: text(v?.reason, 100) }));
      // 형식이 맞지 않은 답은 거절로 본다 (자동 통과 없음).
      if (r.value?.pass === true) return { feedback: null };
      return { route: null, feedback: text(r.value?.reason, 100) || 'JUDGE_REJECTED' };
    };

    const substituteNode = async () => {
      const r = await codeStep('substitute', 1, { placeIds: substitute?.placeIds ?? [] }, async () => ({ ok: true }), () => ({ title: substitute?.title ?? null }));
      void r;
      return { route: substitute, source: 'substitute' };
    };

    const max = limits.maxLoopAttempts;
    const poolEnough = (state) => candidates.filter((p) => !state.excluded.includes(p.id)).length >= count;
    const afterChecker = (state) => (state.checked.ok ? 'writer' : state.attempts.planner < max && poolEnough(state) ? 'planner' : 'substitute');
    const afterValidator = (state) => (state.route ? 'judge' : state.attempts.writer < max ? 'writer' : 'substitute');
    const afterJudge = (state) => (state.route && state.feedback === null ? END : state.attempts.writer < max ? 'writer' : 'substitute');

    const graph = new StateGraph(State)
      .addNode('gate', gate)
      .addNode('researcher', researcher)
      .addNode('merge', merge)
      .addNode('planner', planner)
      .addNode('checker', checker)
      .addNode('writer', writer)
      .addNode('validator', validator)
      .addNode('judge', judge)
      .addNode('substitute', substituteNode)
      .addEdge(START, 'gate')
      .addEdge('gate', 'researcher')
      .addEdge('researcher', 'merge')
      .addEdge('merge', 'planner')
      .addEdge('planner', 'checker')
      .addConditionalEdges('checker', afterChecker)
      .addEdge('writer', 'validator')
      .addConditionalEdges('validator', afterValidator)
      .addConditionalEdges('judge', afterJudge)
      .addEdge('substitute', END)
      .compile();

    try {
      if (count === 0) throw new AgentError('NO_CANDIDATE');
      const out = await graph.invoke({ excluded: [], attempts: { planner: 0, writer: 0 }, feedback: null, route: null, source: null });
      if (out.source === 'substitute') {
        run.finish({ outcome: 'substitute', fallbackReason: 'ATTEMPTS_EXHAUSTED' });
        return { source: 'substitute', route: substitute, runId: run.id, attempts: out.attempts };
      }
      // 방문 순서는 확인자가 정한 순서(코드)다. 문장은 검증을 통과한 것이다.
      const route = { ...out.route, placeIds: out.checked.ordered };
      run.finish({ outcome: 'normal' });
      return {
        source: 'agent',
        route,
        durationBasis: out.checked.durationBasis,
        walkMin: out.checked.walkMin ?? null,
        runId: run.id,
        attempts: out.attempts,
      };
    } catch (err) {
      const code = typeof err?.code === 'string' ? err.code : 'ERROR';
      run.finish({ outcome: 'fallback', fallbackReason: code });
      return { source: 'failed', reason: code, runId: run.id };
    }
  };
}
