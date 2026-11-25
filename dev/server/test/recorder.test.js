import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../src/agents/common/recorder.js';
import { createMemoryRunStore, foldEvents } from '../src/agents/common/run_store_memory.js';

function setup(opts = {}) {
  const store = opts.store ?? createMemoryRunStore();
  let t = 1000;
  const recorder = createRecorder({ store, now: () => (t += 10), newId: () => 'run-1', ...opts });
  return { store, recorder };
}
const fold = (store) => foldEvents(store.events);

test('쓰는 시점은 실행 시작, 노드 결과마다, 실행 끝 세 번뿐이다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.step({ node: 'planner', kind: 'llm', summary: { n: 3 } }, async () => 'a');
  await run.step({ node: 'checker', kind: 'code' }, async () => 'b');
  await run.finish({ outcome: 'normal' });
  assert.deepEqual(store.events.map((e) => e.type), ['run_start', 'step', 'step', 'run_end']);
});

test('foldEvents는 단계 순서·시도 번호·판정을 합쳐 준다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.step({ node: 'planner', kind: 'llm', attempt: 1 }, async () => 'a');
  await run.step({ node: 'checker', kind: 'code', attempt: 2, toRecord: () => ({ verdict: 'fail', reasonCode: 'NOT_OPEN' }) }, () => 'b');
  await run.finish({ outcome: 'normal' });
  const [r] = fold(store);
  assert.equal(r.status, 'ended');
  assert.equal(r.outcome, 'normal');
  assert.deepEqual(r.steps.map((s) => [s.seq, s.node, s.kind, s.attempt, s.verdict]), [
    [1, 'planner', 'llm', 1, 'pass'],
    [2, 'checker', 'code', 2, 'fail'],
  ]);
  assert.equal(r.steps[1].reasonCode, 'NOT_OPEN');
  assert.ok(r.steps[0].durationMs >= 0 && r.steps[0].startedAt);
});

test('진행 중: 끝 이벤트가 없으면 running이고, 끝난 노드까지만 보인다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.step({ node: 'planner', kind: 'llm' }, async () => 1);
  let release;
  const gate = new Promise((res) => { release = res; });
  const pending = run.step({ node: 'writer', kind: 'llm' }, () => gate); // 아직 결과가 안 나온 노드
  await run.flush();
  let [r] = fold(store);
  assert.equal(r.status, 'running');
  assert.deepEqual(r.steps.map((s) => s.node), ['planner']); // 도는 중인 writer는 DB에 없다
  release('done');
  await pending;
  await run.flush();
  [r] = fold(store);
  assert.deepEqual(r.steps.map((s) => s.node), ['planner', 'writer']);
  assert.equal(r.status, 'running'); // 실행은 finish를 불러야 끝난다
});

test('토큰과 호출 수가 기록되고, 잘못된 숫자는 null이 된다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.step({ node: 'a', kind: 'llm', toRecord: () => ({ llmCalls: 1, inputTokens: 120, outputTokens: 30, totalTokens: 150 }) }, () => 1);
  await run.step({ node: 'b', kind: 'llm', toRecord: () => ({ llmCalls: -1, inputTokens: 1.5, outputTokens: '7', totalTokens: undefined }) }, () => 1);
  await run.step({ node: 'c', kind: 'code' }, () => 1);
  await run.finish({ outcome: 'normal' });
  const [a, b, c] = fold(store)[0].steps;
  assert.deepEqual([a.llmCalls, a.inputTokens, a.outputTokens, a.totalTokens], [1, 120, 30, 150]);
  assert.deepEqual([b.llmCalls, b.inputTokens, b.outputTokens, b.totalTokens], [null, null, null, null]);
  assert.deepEqual([c.inputTokens, c.totalTokens], [null, null]); // 토큰을 모르면 0이 아니라 null
});

test('step은 DB 쓰기를 기다리지 않는다 (기록이 느려도 에이전트는 안 느려진다)', async () => {
  const store = { append: () => new Promise(() => {}) };
  const recorder = createRecorder({ store });
  const run = recorder.startRun({ agent: 'course' });
  const r = await Promise.race([
    run.step({ node: 'n', kind: 'code' }, () => 42),
    new Promise((res) => setTimeout(() => res('blocked'), 200)),
  ]);
  assert.equal(r, 42);
});

test('앞 쓰기가 느려도 이벤트 순서는 지켜진다', async () => {
  const events = [];
  const store = {
    append: async (e) => {
      if (e.type === 'run_start') await new Promise((res) => setTimeout(res, 30));
      events.push(e.type);
    },
  };
  const recorder = createRecorder({ store });
  const run = recorder.startRun({ agent: 'course' });
  await run.step({ node: 'n', kind: 'code' }, () => 1);
  await run.finish({ outcome: 'normal' });
  assert.deepEqual(events, ['run_start', 'step', 'run_end']);
});

test('toRecord의 LLM 정보가 기록되고 출력의 개인정보는 걸러진다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.step(
    { node: 'writer', kind: 'llm', toRecord: () => ({ output: { reason: '좋아요', lat: 35.1 }, llmCalls: 1, model: 'm', promptVersion: 'v1' }) },
    () => 1,
  );
  await run.finish({ outcome: 'normal' });
  const s = fold(store)[0].steps[0];
  assert.deepEqual(s.output, { reason: '좋아요' });
  assert.deepEqual([s.llmCalls, s.model, s.promptVersion], [1, 'm', 'v1']);
});

test('단계가 던지면 error로 기록하고 다시 던진다. 메시지는 저장하지 않는다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  const err = Object.assign(new Error('quota secret-key-123'), { code: 'LLM_FAILED' });
  await assert.rejects(() => run.step({ node: 'n', kind: 'llm' }, () => { throw err; }), /secret-key-123/);
  await run.finish({ outcome: 'fallback', fallbackReason: 'LLM_FAILED' });
  const r = fold(store)[0];
  assert.deepEqual([r.steps[0].verdict, r.steps[0].reasonCode], ['error', 'LLM_FAILED']);
  assert.equal(r.fallbackReason, 'LLM_FAILED');
  assert.ok(!JSON.stringify(store.events).includes('secret-key-123'));
});

test('입력 요약의 좌표·계정은 저장되지 않는다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.step({ node: 'n', kind: 'code', summary: { lat: 35.8, userId: 'u-9', theme: 'history' } }, () => 1);
  await run.finish({ outcome: 'normal' });
  assert.deepEqual(fold(store)[0].steps[0].inputSummary, { theme: 'history' });
  assert.ok(!JSON.stringify(store.events).includes('u-9'));
});

test('actorKey는 그대로 저장되고, 없으면 null', async () => {
  const { store, recorder } = setup();
  recorder.startRun({ agent: 'a', actorKey: 'hash-1' });
  recorder.startRun({ agent: 'b' });
  await recorder.startRun({ agent: 'c' }).flush();
  const starts = store.events.filter((e) => e.type === 'run_start');
  assert.deepEqual(starts.map((e) => e.actorKey), ['hash-1', null, null]);
});

test('finish를 두 번 불러도 run_end는 한 번만', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.finish({ outcome: 'normal' });
  await run.finish({ outcome: 'normal' });
  assert.equal(store.events.filter((e) => e.type === 'run_end').length, 1);
});

test('finish 뒤의 step은 실행은 하되 기록하지 않는다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.finish({ outcome: 'normal' });
  assert.equal(await run.step({ node: 'late', kind: 'code' }, () => 7), 7);
  await run.flush();
  assert.equal(store.events.filter((e) => e.type === 'step').length, 0);
});

test('저장소가 실패하면 ignore는 통과하고 실패를 센다', async () => {
  const store = { append: async () => { throw new Error('db down'); } };
  const recorder = createRecorder({ store });
  const run = recorder.startRun({ agent: 'course' });
  assert.equal(await run.step({ node: 'n', kind: 'code' }, () => 1), 1);
  await run.finish({ outcome: 'normal' });
  assert.equal(recorder.failures, 3); // run_start, step, run_end
});

test('저장소가 실패하면 throw 옵션은 flush에서 던진다', async () => {
  const store = { append: async () => { throw new Error('db down'); } };
  const recorder = createRecorder({ store, onRecordError: 'throw' });
  const run = recorder.startRun({ agent: 'course' });
  await assert.rejects(() => run.finish({ outcome: 'normal' }), /db down/);
});

test('잘못된 kind나 outcome은 TypeError', async () => {
  const { recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await assert.rejects(() => run.step({ node: 'n', kind: 'bad' }, () => 1), TypeError);
  assert.throws(() => run.finish({ outcome: 'bad' }), TypeError);
});

test('프롬프트 원문이 기록되고, 코드 단계에는 null이다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  await run.step({ node: 'planner', kind: 'llm', prompt: { system: '시스템 안내', user: '후보 A, B, C' } }, () => 1);
  await run.step({ node: 'checker', kind: 'code' }, () => 1);
  await run.finish({ outcome: 'normal' });
  const [llm, code] = fold(store)[0].steps;
  assert.deepEqual(llm.prompt, { system: '시스템 안내', user: '후보 A, B, C' });
  assert.equal(code.prompt, null);
});

test('프롬프트는 LLM이 실패한 단계에도 남는다 (무엇을 보내다 실패했는지 보려고)', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  const err = Object.assign(new Error('boom'), { code: 'LLM_TIMEOUT' });
  await assert.rejects(() => run.step({ node: 'researcher', kind: 'llm', prompt: { system: 's', user: 'u' } }, () => { throw err; }));
  await run.finish({ outcome: 'fallback' });
  const s = fold(store)[0].steps[0];
  assert.deepEqual([s.verdict, s.prompt], ['error', { system: 's', user: 'u' }]);
});

test('프롬프트의 좌표·계정·이메일도 걸러지고, 길이는 promptMaxChars로 자른다 (요약 한도와 따로)', async () => {
  const { store, recorder } = setup({ maxChars: 5, promptMaxChars: 40 });
  const run = recorder.startRun({ agent: 'course' });
  await run.step({
    node: 'planner', kind: 'llm',
    prompt: { system: '현위치 35.871234, 128.601234 a@b.com', user: '가'.repeat(100), userId: 'u-9', lat: 35.1 },
    summary: '나'.repeat(100),
  }, () => 1);
  await run.finish({ outcome: 'normal' });
  const s = fold(store)[0].steps[0];
  assert.ok(!s.prompt.system.includes('35.871234') && !s.prompt.system.includes('a@b.com'));
  assert.equal(s.prompt.user.length, 41); // 40자 + 말줄임표
  assert.deepEqual(Object.keys(s.prompt).sort(), ['system', 'user']); // userId, lat 키는 빠짐
  assert.equal(s.inputSummary.length, 6); // 요약은 maxChars 5 + 말줄임표
  assert.ok(!JSON.stringify(store.events).includes('u-9'));
});

test('동시에 도는 단계도 서로 다른 seq를 받고, 먼저 시작한 순서로 정렬된다', async () => {
  const { store, recorder } = setup();
  const run = recorder.startRun({ agent: 'course' });
  let releaseA;
  const gateA = new Promise((res) => { releaseA = res; });
  const a = run.step({ node: 'a', kind: 'code' }, () => gateA); // 먼저 시작, 나중에 끝남
  const b = run.step({ node: 'b', kind: 'code' }, async () => 2); // 나중에 시작, 먼저 끝남
  await b;
  releaseA(1);
  await a;
  await run.finish({ outcome: 'normal' });
  assert.deepEqual(fold(store)[0].steps.map((s) => [s.seq, s.node]), [[1, 'a'], [2, 'b']]);
});
