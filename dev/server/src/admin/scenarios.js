import { callLlm } from '../agents/common/llm_call.js';
import { createBudget } from '../agents/common/budget.js';
import { createFakeLlm, reply } from '../agents/common/testing/fake_llm.js';
import { GRAPHS } from './agent_graphs.js';

// 시연용 시나리오: 가짜 LLM으로 구조도(agent_graphs.js)를 따라 도는 가짜 에이전트다. 실제 에이전트가 아니다.
// 목적: 기록기·예산·시간 제한·구조도·관리자 화면이 제대로 이어지는지 눈으로 확인한다. 실제 LLM은 부르지 않는다 (비용 0원).
// 구조도 데이터를 그대로 따라 걷기 때문에 기록되는 노드 이름이 항상 구조도의 노드 id와 같다.

export const DEMO_DELAY_MS = 400; // 화면에서 깜빡임을 볼 수 있게 노드 사이에 넣는 인공 지연 (시연용)
const DEMO_TIMEOUT_MS = 1500; // 시간 초과 시나리오가 오래 걸리지 않게 하는 시연용 상한
const DEMO_USAGE = { inputTokens: 120, outputTokens: 40, totalTokens: 160 }; // 가짜 토큰 수 (실제 값 아님)
const ALWAYS_FAIL = (code) => Array(20).fill(code);

// agent: 구조도 키 / script: 노드별 판정을 시도 순서대로 적는다. 'ok'는 통과, 그 밖의 글자는 실패 사유 코드다.
//   script.hang: 이 노드의 LLM이 멈춘다 / script.maxCalls: LLM 호출 예산을 이만큼으로 줄인다
const DEFS = {
  pass: { agent: 'course', title: '코스 설계 · 한 번에 통과', description: '모든 노드가 한 번에 통과합니다.', script: {} },
  swap_place: { agent: 'course', title: '코스 설계 · 영업 확인 실패 후 장소 교체', description: '확인자가 NOT_OPEN으로 거부하고, 기획자가 장소를 바꿔 다시 통과합니다.', script: { checker: ['NOT_OPEN', 'ok'] } },
  rewrite: { agent: 'course', title: '코스 설계 · 검증 실패 후 다시 쓰기', description: '검증이 한 번 실패하고 작성자가 다시 써서 통과합니다.', script: { validator: ['LENGTH', 'ok'] } },
  exhaust: { agent: 'course', title: '코스 설계 · 시도 횟수 소진 후 대체 코스', description: '확인자가 계속 거부해서 상한을 다 쓰고 대체 코스로 갑니다.', script: { checker: ALWAYS_FAIL('NOT_OPEN') } },
  llm_timeout: { agent: 'course', title: '코스 설계 · LLM 시간 초과 후 폴백', description: '연구자의 LLM이 멈춰서 시간 제한에 걸리고 폴백으로 끝납니다.', script: { hang: 'researcher' } },
  budget: { agent: 'course', title: '코스 설계 · 호출 예산 소진 후 폴백', description: 'LLM 호출 예산이 모자라 작성자 단계에서 멈추고 폴백으로 끝납니다.', script: { maxCalls: 2 } },
  quiz_pass: { agent: 'mission_quiz', title: '미션 퀴즈 · 한 번에 통과', description: '설명, 출제, 제출, 판정이 모두 통과하고 도장이 기록됩니다.', script: {} },
  photo_resubmit: { agent: 'mission_photo', title: '미션 인증샷 · 중복 제출 후 다시 제출', description: '제출 점검이 DUPLICATE로 거부해서 사진을 다시 내고 통과합니다.', script: { submit_check: ['DUPLICATE', 'ok'] } },
  photo_exhaust: { agent: 'mission_photo', title: '미션 인증샷 · 판정 확인 불통과 후 폴백', description: '판정 확인(코드)이 GPS_OUT으로 계속 거부해서 상한을 다 쓰고 도장 보류(폴백)로 끝납니다.', script: { judge_check: ALWAYS_FAIL('GPS_OUT') } },
  receipt_pass: { agent: 'mission_receipt', title: '미션 영수증 · 한 번에 통과', description: '영수증 제출과 판정이 통과하고 도장이 기록됩니다.', script: {} },
  receipt_resubmit: { agent: 'mission_receipt', title: '미션 영수증 · 결제 정보 가림 실패 후 다시 제출', description: '제출 점검이 PAYMENT_NOT_MASKED로 거부해서 다시 내고 통과합니다.', script: { submit_check: ['PAYMENT_NOT_MASKED', 'ok'] } },
};

// 화면과 라우터에 보여 주는 정보 (대본은 내보내지 않는다)
export const SCENARIOS = Object.freeze(
  Object.fromEntries(Object.entries(DEFS).map(([name, d]) => [name, { agent: d.agent, title: d.title, description: d.description }])),
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// run: recorder.startRun({ agent: SCENARIOS[name].agent })의 결과 (호출하는 쪽이 만든다)
// limits: { maxLlmCalls, deadlineMs, llmTimeoutMs, maxLoopAttempts }
// 반환: { outcome, fallbackReason }
export async function runScenario(name, { run, limits, delayMs = 0 }) {
  const def = DEFS[name];
  if (!def) throw new TypeError('알 수 없는 시나리오');
  const graph = GRAPHS[def.agent];
  const script = def.script;

  const budget = createBudget({ maxCalls: script.maxCalls ?? limits.maxLlmCalls, deadlineMs: limits.deadlineMs });
  const timeoutMs = Math.min(limits.llmTimeoutMs, DEMO_TIMEOUT_MS);
  const llms = {};
  const llmOf = (id) => (llms[id] ??= createFakeLlm([script.hang === id ? 'hang' : reply(`${id} 시연 결과`, DEMO_USAGE)]));
  const pause = () => (delayMs ? sleep(delayMs) : undefined);

  // 시연용 가짜 프롬프트. 다시 시도할 때는 지난 실패 사유를 안내로 붙인다 (실제 프롬프트도 이런 모양이 될 것이다).
  const promptOf = (id, attempt, retryReason) => ({
    system: '[시연용 가짜 프롬프트] 당신은 산책 코스를 설계하는 도우미입니다. 주어진 후보 안에서만 고르세요.',
    user: `단계: ${id}, 시도: ${attempt}\n테마: history, 나이대: 20s\n후보: A장소, B장소, C장소, D장소${
      retryReason ? `\n[안내] 지난 시도가 ${retryReason} 사유로 거부되었습니다. 바꿔서 다시 답하세요.` : ''
    }`,
  });

  const llmStep = async (node, attempt, retryReason, code) => {
    await pause();
    const prompt = promptOf(node.id, attempt, retryReason);
    return run.step(
      {
        node: node.id,
        kind: 'llm',
        attempt,
        prompt,
        summary: { theme: 'history', attempt },
        toRecord: (r) => ({
          ...(code === 'ok' ? {} : { verdict: 'fail', reasonCode: code }),
          output: { text: r.value },
          llmCalls: 1,
          model: 'fake-llm',
          promptVersion: 'demo-v1',
          inputTokens: r.usage?.inputTokens ?? null,
          outputTokens: r.usage?.outputTokens ?? null,
          totalTokens: r.usage?.totalTokens ?? null,
        }),
      },
      () => callLlm({ llm: llmOf(node.id), input: prompt, budget, timeoutMs }),
    );
  };

  // 코드 노드와 사람 노드 (제출은 사람이 하는 단계라 가짜로 "냈다"고 기록한다)
  const plainStep = async (node, attempt, code) => {
    await pause();
    return run.step(
      {
        node: node.id,
        kind: node.kind,
        attempt,
        summary: { attempt },
        toRecord: () => (code === 'ok' ? { verdict: 'pass' } : { verdict: 'fail', reasonCode: code }),
      },
      async () => code,
    );
  };

  // 구조도를 따라 걷는다: 통과하면 화살표의 다음 노드, 실패하면 되돌이 대상, 상한을 다 쓰면 소진 노드로 간다.
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const nextOf = (id) => graph.edges.find((e) => e.from === id)?.to ?? null;
  const runCount = {}; // 노드별로 몇 번 돌았는지 (= 시도 번호)
  const retryReason = {}; // 되돌아온 노드가 받을 지난 실패 사유
  let current = graph.nodes[0].id;
  let outcome = 'normal';
  let fallbackReason = null;
  try {
    while (current) {
      const node = byId.get(current);
      const attempt = (runCount[current] = (runCount[current] ?? 0) + 1);
      const code = script[current]?.[attempt - 1] ?? 'ok';
      if (node.kind === 'llm') await llmStep(node, attempt, retryReason[current] ?? null, code);
      else await plainStep(node, attempt, code);
      retryReason[current] = null;

      if (code === 'ok') {
        current = nextOf(current);
        continue;
      }
      const l = graph.loops.find((x) => x.from === current);
      if (!l) {
        outcome = 'fallback';
        fallbackReason = code;
        break;
      }
      if ((runCount[l.to] ?? 0) >= limits.maxLoopAttempts) {
        // 상한을 다 썼다: 소진 노드(대체 코스·폴백)를 한 번 돌리고 끝낸다
        await plainStep(byId.get(l.exhaustTo), 1, 'ok');
        outcome = l.exhaustTo === 'substitute' ? 'substitute' : 'fallback';
        fallbackReason = 'ATTEMPTS_EXHAUSTED';
        break;
      }
      retryReason[l.to] = code;
      current = l.to;
    }
  } catch (err) {
    outcome = 'fallback';
    fallbackReason = typeof err?.code === 'string' ? err.code : 'ERROR';
  }
  await run.finish({ outcome, fallbackReason });
  return { outcome, fallbackReason };
}
