import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { buildPrompt } from './prompt.js';
import { validateComposition } from './validate_composition.js';
import { LLM_TIMEOUT_MS, MAX_ATTEMPTS } from './ai_config.js';

// 그래프가 들고 다니는 상태. 칸마다 "마지막으로 쓴 값"이 남는다.
const State = Annotation.Root({
  input: Annotation(), // 고정 입력 (모드, 테마, 후보 등)
  attempts: Annotation(), // 지금까지 AI를 부른 횟수
  lastError: Annotation(), // 직전 실패 사유 코드
  errors: Annotation(), // 실패 사유 기록
  raw: Annotation(), // AI가 돌려준 원본
  route: Annotation(), // 검증을 통과한 길
  source: Annotation(), // 'ai' | 'rules'
});

// 제한 시간 안에 끝나지 않으면 실패로 본다. AI 함수가 signal을 무시해도 기다리지 않는다.
function withTimeout(run, ms) {
  const signal = AbortSignal.timeout(ms);
  return Promise.race([
    run(signal),
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('TIMEOUT')), { once: true });
    }),
  ]);
}

// 구성 → 검증 → (실패하면 이유를 알려 한 번 더) → 규칙 폴백 그래프를 만든다.
//   llm: async (프롬프트, { signal }) => AI 응답 객체. 테스트에서는 가짜 함수를 넣는다.
// 그래프는 장소를 고르는 일만 한다. 모드 판정, 후보 거르기, 순서 정하기는 그래프 밖의 코드가 한다.
export function createComposeGraph({ llm, maxAttempts = MAX_ATTEMPTS, timeoutMs = LLM_TIMEOUT_MS }) {
  async function compose(state) {
    const attempts = state.attempts + 1;
    const prompt = buildPrompt({ ...state.input, retryError: state.lastError });
    try {
      const raw = await withTimeout((signal) => llm(prompt, { signal }), timeoutMs);
      return { attempts, raw, lastError: null };
    } catch {
      // 에러 내용(키나 주소가 들어 있을 수 있음)은 버리고 코드만 남긴다.
      return { attempts, raw: null, lastError: 'LLM_FAILED', errors: [...state.errors, 'LLM_FAILED'] };
    }
  }

  function validate(state) {
    if (state.raw === null) return {}; // AI 호출 자체가 실패했으면 검증할 것이 없다.
    const { mode, theme, candidates } = state.input;
    const checked = validateComposition(state.raw, candidates, { mode, theme });
    if (checked.ok) return { route: checked.route, source: 'ai', lastError: null };
    return { lastError: checked.error, errors: [...state.errors, checked.error] };
  }

  const fallback = () => ({ source: 'rules', route: null });

  // 검증 뒤에 어디로 갈지: 통과 → 끝, AI 호출 실패 → 폴백, 검증 실패 → 횟수가 남았으면 다시, 아니면 폴백
  function next(state) {
    if (state.route) return END;
    if (state.lastError === 'LLM_FAILED') return 'fallback';
    return state.attempts < maxAttempts ? 'compose' : 'fallback';
  }

  return new StateGraph(State)
    .addNode('compose', compose)
    .addNode('validate', validate)
    .addNode('fallback', fallback)
    .addEdge(START, 'compose')
    .addEdge('compose', 'validate')
    .addConditionalEdges('validate', next)
    .addEdge('fallback', END)
    .compile();
}

// 그래프를 한 번 실행한다. 결과: { source: 'ai' | 'rules', route: 길 | null, attempts, errors }
export async function runComposeGraph(graph, input) {
  const out = await graph.invoke({
    input,
    attempts: 0,
    lastError: null,
    errors: [],
    raw: null,
    route: null,
    source: null,
  });
  return { source: out.source, route: out.route, attempts: out.attempts, errors: out.errors };
}