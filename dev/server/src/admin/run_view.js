// 실행 기록 + 구조도 → 관리자 화면이 그릴 정보. "지금 도는 노드"는 DB에 없으므로 여기서 계산한다.
//   run: foldEvents / run_reader의 실행 객체 { status, startedAt, steps: [{ seq, node, verdict, reasonCode, ... }] }
//   graph: agent_graphs.js의 한 그래프
// 반환
//   status: 'running' | 'ended' | 'stale'(끝 줄이 없는데 staleAfterMs를 넘김 = 중단됨)
//   currentNodes: 지금 도는 것으로 보이는 노드 (마지막으로 끝난 노드의 결과와 구조도 화살표로 계산)
//   nodeStats: 노드별 { runs, fails, lastReason }
//   loopHits: 되돌이별 { from, to, count, exhausted }  count는 실제로 되돌아간 횟수
//   unknownNodes: 구조도에 없는 노드 이름 (구조도와 다른 기록)
export function describeRun(run, graph, { now = Date.now(), staleAfterMs = 60_000 } = {}) {
  const steps = [...run.steps].sort((a, b) => a.seq - b.seq);
  const known = new Set(graph.nodes.map((node) => node.id));

  const nodeStats = {};
  const unknownNodes = [];
  for (const s of steps) {
    if (!known.has(s.node)) {
      if (!unknownNodes.includes(s.node)) unknownNodes.push(s.node);
      continue;
    }
    const stat = (nodeStats[s.node] ??= { runs: 0, fails: 0, lastReason: null });
    stat.runs += 1;
    if (s.verdict === 'fail' || s.verdict === 'error') {
      stat.fails += 1;
      stat.lastReason = s.reasonCode ?? null;
    }
  }

  // 되돌이: 실패한 단계 바로 다음 단계가 되돌아갈 노드(to)면 되돌아간 것, 소진 노드(exhaustTo)면 소진된 것
  const loopHits = graph.loops.map((l) => ({ from: l.from, to: l.to, count: 0, exhausted: false }));
  for (let i = 0; i + 1 < steps.length; i += 1) {
    const a = steps[i];
    const b = steps[i + 1];
    if (a.verdict !== 'fail') continue;
    graph.loops.forEach((l, idx) => {
      if (l.from !== a.node) return;
      if (b.node === l.to) loopHits[idx].count += 1;
      else if (b.node === l.exhaustTo) loopHits[idx].exhausted = true;
    });
  }

  let status = run.status;
  if (status === 'running' && now - Date.parse(run.startedAt) > staleAfterMs) status = 'stale';

  // 지금 도는 노드: 실행 중일 때만. 마지막으로 끝난 노드가 통과면 화살표의 다음, 실패면 되돌이 대상.
  let currentNodes = [];
  if (status === 'running') {
    const last = [...steps].reverse().find((s) => known.has(s.node));
    if (!last) {
      currentNodes = graph.nodes.length ? [graph.nodes[0].id] : [];
    } else if (last.verdict === 'pass') {
      currentNodes = graph.edges.filter((e) => e.from === last.node).map((e) => e.to);
    } else if (last.verdict === 'fail') {
      currentNodes = graph.loops.filter((l) => l.from === last.node).map((l) => l.to);
    }
  }

  return { status, currentNodes, nodeStats, loopHits, unknownNodes };
}
