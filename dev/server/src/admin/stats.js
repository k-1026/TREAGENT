// 대시보드 통계: 실행 기록(실행 + 단계)을 모아 통과율, 폴백 비율, 소요 시간, 호출 수, 토큰, 실패 사유를 계산한다 (plan/spec/agent_architecture_v2.md 5-2장 "지표").
// 읽기만 하는 순수 함수다. 입력은 run_reader의 실행 객체 { agent, startedAt, endedAt, outcome, fallbackReason, status, steps }.
// 기준: 끝난 실행(ended)만 통과율·폴백 비율의 분모로 쓴다. 진행 중·중단된 실행은 따로 센다.
// 토큰은 모르는 단계(null)가 있으면 합계에서 빼고 "모름 N건"으로 알린다 (0으로 세지 않는다).
import { KST_OFFSET_MS } from '../agents/common/config.js';

const RANGES = { day: 24 * 3600_000, week: 7 * 24 * 3600_000, all: null };
export const parseRange = (v) => (Object.hasOwn(RANGES, v) ? v : 'day');
export const sinceOf = (range, now = Date.now()) => (RANGES[range] == null ? null : new Date(now - RANGES[range]).toISOString());

const ratio = (a, b) => (b > 0 ? a / b : null);
const avg = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
const pct95 = (xs) => {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
};
const dayKey = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10); // 한국 시간 날짜
const topN = (map, n) => [...map.values()].sort((a, b) => b.count - a.count).slice(0, n);

export function computeStats(runs, { now = Date.now(), range = 'day', limits = {}, staleAfterMs = 60_000 } = {}) {
  const duration = (r) => (r.endedAt ? Date.parse(r.endedAt) - Date.parse(r.startedAt) : null);
  const isStale = (r) => !r.endedAt && now - Date.parse(r.startedAt) > staleAfterMs;

  const agents = new Map();
  const reasons = new Map(); // agent|node|reason → count (코드 판정이 막은 이유, 에러)
  const fallbacks = new Map();
  const models = new Map();
  const daily = new Map();
  let llmCalls = 0;
  let tokensKnown = { input: 0, output: 0, total: 0 };
  let tokenUnknownCalls = 0;
  const callsPerRun = [];

  for (const r of runs) {
    const a = agents.get(r.agent) ?? agents.set(r.agent, { agent: r.agent, runs: 0, ended: 0, normal: 0, substitute: 0, fallback: 0, running: 0, stale: 0, durations: [], llmCalls: 0, totalTokens: 0 }).get(r.agent);
    a.runs += 1;
    if (r.endedAt) {
      a.ended += 1;
      if (r.outcome === 'normal' || r.outcome === 'substitute' || r.outcome === 'fallback') a[r.outcome] += 1;
      const d = duration(r);
      if (d != null && d >= 0) a.durations.push(d);
    } else if (isStale(r)) a.stale += 1;
    else a.running += 1;

    if (r.outcome === 'fallback' || r.outcome === 'substitute') {
      const key = `${r.outcome}|${r.fallbackReason ?? '-'}`;
      const f = fallbacks.get(key) ?? fallbacks.set(key, { outcome: r.outcome, reason: r.fallbackReason ?? '-', count: 0 }).get(key);
      f.count += 1;
    }

    const day = dayKey(Date.parse(r.startedAt));
    const dd = daily.get(day) ?? daily.set(day, { day, runs: 0, notNormal: 0 }).get(day);
    dd.runs += 1;
    if (r.endedAt && r.outcome !== 'normal') dd.notNormal += 1;

    let runCalls = 0;
    for (const s of r.steps ?? []) {
      if (s.verdict === 'fail' || s.verdict === 'error') {
        const key = `${r.agent}|${s.node}|${s.reasonCode ?? '-'}`;
        const x = reasons.get(key) ?? reasons.set(key, { agent: r.agent, node: s.node, reasonCode: s.reasonCode ?? '-', kind: s.kind, verdict: s.verdict, count: 0 }).get(key);
        x.count += 1;
      }
      if (s.kind === 'llm') {
        const calls = s.llmCalls ?? 1;
        runCalls += calls;
        const m = models.get(s.model ?? '(모름)') ?? models.set(s.model ?? '(모름)', { model: s.model ?? '(모름)', calls: 0, errors: 0, totalTokens: 0, durations: [] }).get(s.model ?? '(모름)');
        m.calls += calls;
        if (s.verdict === 'error') m.errors += 1;
        if (s.durationMs != null) m.durations.push(s.durationMs);
        if (s.totalTokens != null) {
          m.totalTokens += s.totalTokens;
          a.totalTokens += s.totalTokens;
          tokensKnown.total += s.totalTokens;
          tokensKnown.input += s.inputTokens ?? 0;
          tokensKnown.output += s.outputTokens ?? 0;
        } else tokenUnknownCalls += calls;
      }
    }
    a.llmCalls += runCalls;
    llmCalls += runCalls;
    callsPerRun.push(runCalls);
  }

  const rows = [...agents.values()].map((a) => ({
    agent: a.agent, runs: a.runs, ended: a.ended, normal: a.normal, substitute: a.substitute, fallback: a.fallback, running: a.running, stale: a.stale,
    passRate: ratio(a.normal, a.ended), substituteRate: ratio(a.substitute, a.ended), fallbackRate: ratio(a.fallback, a.ended),
    avgDurationMs: avg(a.durations), p95DurationMs: pct95(a.durations), llmCalls: a.llmCalls, totalTokens: a.totalTokens,
  })).sort((x, y) => y.runs - x.runs);

  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const ended = sum('ended');
  const allDurations = [...agents.values()].flatMap((a) => a.durations);
  const maxCalls = limits.maxLlmCalls ?? null;
  const overHalf = maxCalls ? callsPerRun.filter((c) => c > maxCalls / 2).length : null;

  // 최근 7일(한국 시간) 빈 날도 0으로 채운다
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const k = dayKey(now - i * 86400_000);
    days.push(daily.get(k) ?? { day: k, runs: 0, notNormal: 0 });
  }

  return {
    range,
    totals: {
      runs: runs.length, ended, running: sum('running'), stale: sum('stale'),
      normal: sum('normal'), substitute: sum('substitute'), fallback: sum('fallback'),
      passRate: ratio(sum('normal'), ended), substituteRate: ratio(sum('substitute'), ended), fallbackRate: ratio(sum('fallback'), ended),
      avgDurationMs: avg(allDurations), p95DurationMs: pct95(allDurations),
      llmCalls, tokens: { ...tokensKnown, unknownCalls: tokenUnknownCalls },
    },
    byAgent: rows,
    topReasons: topN(reasons, 10),
    fallbackReasons: topN(fallbacks, 8),
    byModel: [...models.values()].map((m) => ({ model: m.model, calls: m.calls, errors: m.errors, totalTokens: m.totalTokens, avgMs: avg(m.durations) })).sort((a, b) => b.calls - a.calls),
    daily: days,
    budget: {
      maxLlmCallsPerRun: maxCalls, dailyMax: limits.dailyMax ?? null,
      avgCallsPerRun: runs.length ? Math.round((llmCalls / runs.length) * 10) / 10 : null,
      maxCallsInRun: callsPerRun.length ? Math.max(...callsPerRun) : null,
      runsOverHalfBudget: overHalf,
    },
  };
}
