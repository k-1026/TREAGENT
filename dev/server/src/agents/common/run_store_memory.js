// 테스트용 가짜 실행 기록 저장소. 이벤트를 메모리에만 쌓는다.
export function createMemoryRunStore() {
  const events = [];
  return {
    events,
    async append(event) {
      events.push(structuredClone(event));
    },
  };
}

// 이벤트 목록을 "실행 + 단계" 모양으로 합친다. 관리자 화면이 보여 줄 모양과 같다.
//   run.status: 'running'(run_end 없음) | 'ended'
//   steps에는 결과가 나온(끝난) 노드만 있다. 지금 도는 노드는 구조도로 계산한다 (여기서는 하지 않는다).
export function foldEvents(events) {
  const runs = new Map();
  for (const e of events) {
    if (e.type === 'run_start') {
      runs.set(e.runId, {
        id: e.runId, agent: e.agent, actorKey: e.actorKey, startedAt: e.startedAt,
        endedAt: null, outcome: null, fallbackReason: null, status: 'running', steps: [],
      });
      continue;
    }
    const run = runs.get(e.runId);
    if (!run) continue;
    if (e.type === 'step') {
      const { type, runId, ...rest } = e;
      run.steps.push(rest);
    } else if (e.type === 'run_end') {
      Object.assign(run, { endedAt: e.endedAt, outcome: e.outcome, fallbackReason: e.fallbackReason, status: 'ended' });
    }
  }
  for (const run of runs.values()) run.steps.sort((a, b) => a.seq - b.seq);
  return [...runs.values()];
}
