import test from 'node:test';
import assert from 'node:assert/strict';
import { runScenario, SCENARIOS } from '../src/admin/scenarios.js';
import { GRAPHS } from '../src/admin/agent_graphs.js';
import { describeRun } from '../src/admin/run_view.js';
import { createRecorder } from '../src/agents/common/recorder.js';
import { createMemoryRunStore, foldEvents } from '../src/agents/common/run_store_memory.js';

const LIMITS = { maxLlmCalls: 8, deadlineMs: 5000, llmTimeoutMs: 30, maxLoopAttempts: 2 };

async function play(name, opts = {}) {
  const store = createMemoryRunStore();
  const recorder = createRecorder({ store });
  const run = recorder.startRun({ agent: SCENARIOS[name].agent });
  const result = await runScenario(name, { run, limits: LIMITS, ...opts });
  await run.flush();
  const [r] = foldEvents(store.events);
  return { store, recorder, result, run: r };
}
const nodes = (r) => r.steps.map((s) => `${s.node}${s.attempt > 1 ? `#${s.attempt}` : ''}`);

test('pass: 모든 노드가 한 번에 통과하고 정상으로 끝난다', async () => {
  const { result, run } = await play('pass');
  assert.deepEqual(result, { outcome: 'normal', fallbackReason: null });
  assert.deepEqual(nodes(run), ['gate', 'researcher', 'merge', 'planner', 'checker', 'writer', 'validator', 'judge']);
  assert.ok(run.steps.every((s) => s.verdict === 'pass'));
});

test('swap_place: 확인자가 NOT_OPEN으로 거부하고 기획자가 다시 해서 통과한다', async () => {
  const { result, run } = await play('swap_place');
  assert.equal(result.outcome, 'normal');
  assert.deepEqual(nodes(run).slice(3, 7), ['planner', 'checker', 'planner#2', 'checker#2']);
  const failed = run.steps.find((s) => s.verdict === 'fail');
  assert.deepEqual([failed.node, failed.reasonCode], ['checker', 'NOT_OPEN']);
});

test('rewrite: 검증이 실패하면 작성자가 다시 쓴다', async () => {
  const { result, run } = await play('rewrite');
  assert.equal(result.outcome, 'normal');
  assert.deepEqual(nodes(run).filter((n) => n.startsWith('writer')), ['writer', 'writer#2']);
  assert.equal(run.steps.find((s) => s.node === 'validator').reasonCode, 'LENGTH');
});

test('exhaust: 상한을 다 쓰면 대체 코스로 가고 outcome은 substitute', async () => {
  const { result, run } = await play('exhaust');
  assert.deepEqual(result, { outcome: 'substitute', fallbackReason: 'ATTEMPTS_EXHAUSTED' });
  assert.equal(nodes(run).at(-1), 'substitute');
  assert.equal(run.steps.filter((s) => s.node === 'checker' && s.verdict === 'fail').length, LIMITS.maxLoopAttempts);
  assert.ok(!nodes(run).includes('writer'));
});

test('llm_timeout: LLM이 멈추면 시간 제한에 걸려 폴백으로 끝난다', async () => {
  const { result, run } = await play('llm_timeout');
  assert.deepEqual(result, { outcome: 'fallback', fallbackReason: 'LLM_TIMEOUT' });
  const last = run.steps.at(-1);
  assert.deepEqual([last.node, last.verdict, last.reasonCode], ['researcher', 'error', 'LLM_TIMEOUT']);
});

test('budget: 호출 예산이 모자라면 작성자 단계에서 멈추고 폴백으로 끝난다', async () => {
  const { result, run } = await play('budget');
  assert.deepEqual(result, { outcome: 'fallback', fallbackReason: 'BUDGET_CALLS' });
  const last = run.steps.at(-1);
  assert.deepEqual([last.node, last.verdict, last.reasonCode], ['writer', 'error', 'BUDGET_CALLS']);
});

test('quiz_pass: 미션 퀴즈가 구조도 순서대로 돌고 도장 기록으로 끝난다', async () => {
  const { result, run } = await play('quiz_pass');
  assert.deepEqual(result, { outcome: 'normal', fallbackReason: null });
  assert.deepEqual(nodes(run), [
    'arrive', 'explain', 'explain_check', 'explain_review', 'pick_kind', 'generate', 'generate_check', 'generate_review',
    'submit', 'submit_check', 'judge', 'judge_check', 'stamp',
  ]);
  assert.equal(run.steps.find((s) => s.node === 'submit').kind, 'human'); // 제출은 사람 단계
});

test('photo_resubmit: 제출 점검이 DUPLICATE로 거부하면 사진을 다시 내고 통과한다', async () => {
  const { result, run } = await play('photo_resubmit');
  assert.equal(result.outcome, 'normal');
  assert.deepEqual(nodes(run).slice(8, 12), ['submit', 'submit_check', 'submit#2', 'submit_check#2']);
  assert.equal(run.steps.find((s) => s.verdict === 'fail').reasonCode, 'DUPLICATE');
  assert.equal(nodes(run).at(-1), 'stamp');
});

test('photo_exhaust: 판정 확인(코드)이 계속 거부하면 상한을 다 쓰고 폴백(도장 보류)으로 끝난다', async () => {
  const { result, run } = await play('photo_exhaust');
  assert.deepEqual(result, { outcome: 'fallback', fallbackReason: 'ATTEMPTS_EXHAUSTED' });
  assert.equal(nodes(run).at(-1), 'fallback');
  assert.ok(!nodes(run).includes('stamp')); // 도장은 기록하지 않는다
  assert.deepEqual(run.steps.filter((s) => s.verdict === 'fail').map((s) => [s.node, s.reasonCode]), [['judge_check', 'GPS_OUT'], ['judge_check', 'GPS_OUT']]);
});

test('receipt_pass, receipt_resubmit: 영수증 흐름이 돌고 결제 정보 가림 실패는 다시 제출한다', async () => {
  assert.equal((await play('receipt_pass')).result.outcome, 'normal');
  const { result, run } = await play('receipt_resubmit');
  assert.equal(result.outcome, 'normal');
  assert.equal(run.steps.find((s) => s.verdict === 'fail').reasonCode, 'PAYMENT_NOT_MASKED');
  assert.ok(nodes(run).includes('submit#2'));
});

test('모든 시나리오가 기록한 노드 이름은 그 에이전트 구조도에 있다 (구조도와 같음)', async () => {
  for (const [name, sc] of Object.entries(SCENARIOS)) {
    const graph = GRAPHS[sc.agent];
    const ids = new Set(graph.nodes.map((n) => n.id));
    const { run } = await play(name);
    for (const s of run.steps) assert.ok(ids.has(s.node), `${name}: ${s.node}`);
    const view = describeRun(run, graph);
    assert.deepEqual(view.unknownNodes, [], name);
    assert.deepEqual(view.currentNodes, [], `${name}: 끝난 실행에는 도는 노드가 없다`);
  }
});

test('모든 시나리오는 구조도의 도움말(optional) 노드를 건드리지 않는다', async () => {
  for (const [name, sc] of Object.entries(SCENARIOS)) {
    const optional = new Set(GRAPHS[sc.agent].nodes.filter((n) => n.optional).map((n) => n.id));
    const { run } = await play(name);
    assert.ok(run.steps.every((s) => !optional.has(s.node)), name);
  }
});

test('LLM 단계에는 가짜 토큰과 모델 정보가 기록되고, 코드 단계에는 null이다', async () => {
  const { run } = await play('pass');
  const planner = run.steps.find((s) => s.node === 'planner');
  assert.deepEqual([planner.inputTokens, planner.outputTokens, planner.totalTokens], [120, 40, 160]);
  assert.deepEqual([planner.model, planner.promptVersion, planner.llmCalls], ['fake-llm', 'demo-v1', 1]);
  const gate = run.steps.find((s) => s.node === 'gate');
  assert.deepEqual([gate.inputTokens, gate.model], [null, null]);
});

test('되돌이 횟수는 구조도 계산과 맞는다', async () => {
  const { run } = await play('swap_place');
  const hit = describeRun(run, GRAPHS.course).loopHits.find((l) => l.from === 'checker');
  assert.deepEqual([hit.count, hit.exhausted], [1, false]);
  const ex = describeRun((await play('exhaust')).run, GRAPHS.course).loopHits.find((l) => l.from === 'checker');
  assert.deepEqual([ex.count, ex.exhausted], [LIMITS.maxLoopAttempts - 1, true]);
  const photo = describeRun((await play('photo_exhaust')).run, GRAPHS.mission_photo).loopHits.find((l) => l.from === 'judge_check');
  assert.deepEqual([photo.count, photo.exhausted], [LIMITS.maxLoopAttempts - 1, true]);
});

test('기록에 좌표·계정 같은 키가 없다', async () => {
  for (const name of ['swap_place', 'photo_resubmit', 'receipt_resubmit']) {
    const { store } = await play(name);
    assert.ok(!/"(lat|lng|latitude|longitude|userId|email|token|photo|receipt|image)"/i.test(JSON.stringify(store.events)), name);
  }
});

test('LLM 단계에는 프롬프트가 기록되고 코드·사람 단계에는 없다', async () => {
  const { run } = await play('quiz_pass');
  for (const s of run.steps) {
    if (s.kind === 'llm') assert.ok(s.prompt.system.length > 0 && s.prompt.user.includes(`단계: ${s.node}`), s.node);
    else assert.equal(s.prompt, null, s.node);
  }
});

test('다시 시도하는 프롬프트에는 지난 실패 사유가 안내로 붙는다', async () => {
  const { run } = await play('swap_place');
  const [first, second] = run.steps.filter((s) => s.node === 'planner');
  assert.ok(!first.prompt.user.includes('[안내]'));
  assert.ok(second.prompt.user.includes('[안내]') && second.prompt.user.includes('NOT_OPEN'));
});

test('LLM이 멈춰서 실패한 단계에도 프롬프트가 남는다', async () => {
  const { run } = await play('llm_timeout');
  const last = run.steps.at(-1);
  assert.deepEqual([last.verdict, last.reasonCode], ['error', 'LLM_TIMEOUT']);
  assert.ok(last.prompt.user.includes('researcher'));
});

test('delayMs를 주면 노드 사이에 그만큼 쉰다', async () => {
  const t0 = Date.now();
  await play('pass', { delayMs: 15 });
  assert.ok(Date.now() - t0 >= 60);
});

test('SCENARIOS는 어느 에이전트인지와 제목만 내보내고 대본은 내보내지 않는다', () => {
  for (const sc of Object.values(SCENARIOS)) {
    assert.deepEqual(Object.keys(sc).sort(), ['agent', 'description', 'title']);
    assert.ok(GRAPHS[sc.agent]);
  }
});

test('알 수 없는 시나리오는 TypeError', async () => {
  const recorder = createRecorder({ store: createMemoryRunStore() });
  const run = recorder.startRun({ agent: 'course' });
  await assert.rejects(() => runScenario('nope', { run, limits: LIMITS }), TypeError);
});
