import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { buildPersonaSystem, buildScenePrompt } from './harangi_persona.js';
import { validateLine } from './harangi_validate.js';
import { BRIEFING_MAX_LENGTH, HARANGI_TIMEOUT_MS, LINE_MAX_LENGTH, MAX_LINE_ATTEMPTS, MAX_TOOL_ROUNDS } from './harangi_config.js';

// 그래프 상태. messages는 새 메시지를 뒤에 이어 붙이고, 나머지는 마지막 값이 남는다.
const State = Annotation.Root({
  messages: Annotation({ reducer: (left, right) => left.concat(right), default: () => [] }),
  input: Annotation(), // { scene, routeTitle, placeId, facts }
  toolRounds: Annotation(), // 도구를 부른 횟수
  attempts: Annotation(), // 대사 검증에 실패한 횟수
  lastError: Annotation(),
  errors: Annotation(),
  line: Annotation(), // 검증을 통과한 대사
  source: Annotation(), // 'ai' | 'rules'
});

// 제한 시간 안에 끝나지 않으면 실패로 본다. (compose_graph.js의 같은 함수와 같은 역할. 나중에 한 곳으로 합칠 수 있다)
function withTimeout(run, ms) {
  const signal = AbortSignal.timeout(ms);
  return Promise.race([
    run(signal),
    new Promise((_, reject) => {
      signal.addEventListener('abort', () => reject(new Error('TIMEOUT')), { once: true });
    }),
  ]);
}

// AI 메시지의 내용을 글자로 꺼낸다. 문자열이거나 조각(parts) 배열일 수 있다.
function textOf(message) {
  const content = message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((part) => (typeof part === 'string' ? part : part?.type === 'text' ? part.text : '')).join('');
  }
  return '';
}

// 하랑이 대사 그래프: agent(AI, 도구 호출 가능) → tools(조회) → agent → validate → (재시도) → 폴백
//   model: async (messages, { signal }) => AIMessage. 운영에서는 도구를 묶은 Gemini, 테스트에서는 가짜 함수.
//   tools: createHarangiTools(...)의 결과 (조회 전용)
//   validator: (글자, 입력) => { ok, text } | { ok: false, error }. 장면마다 다른 검사를 넣을 수 있다. 기본은 일반 대사 검사.
export function createHarangiGraph({ model, tools, timeoutMs = HARANGI_TIMEOUT_MS, validator = (text) => validateLine(text) }) {
  const toolNode = new ToolNode(tools);

  async function agent(state) {
    try {
      const reply = await withTimeout((signal) => model(state.messages, { signal }), timeoutMs);
      return { messages: [reply], lastError: null };
    } catch {
      // 에러 내용(키가 들어 있을 수 있음)은 버리고 코드만 남긴다.
      return { lastError: 'LLM_FAILED', errors: [...state.errors, 'LLM_FAILED'] };
    }
  }

  async function tools_(state) {
    const out = await toolNode.invoke({ messages: state.messages });
    return { messages: out.messages, toolRounds: state.toolRounds + 1 };
  }

  function validate(state) {
    const last = state.messages[state.messages.length - 1];
    const checked = validator(textOf(last), state.input);
    if (checked.ok) return { line: checked.text, source: 'ai', lastError: null };
    return {
      attempts: state.attempts + 1,
      lastError: checked.error,
      errors: [...state.errors, checked.error],
      messages: [new HumanMessage(`대사가 거부되었습니다 (사유 코드: ${checked.error}). 규칙을 지켜 대사 텍스트만 다시 보내세요. 도구는 더 부르지 않아도 됩니다.`)],
    };
  }

  const fallback = () => ({ source: 'rules', line: null });

  // agent 뒤: 호출 실패 → 폴백, 도구 요청이 있고 횟수가 남았으면 tools, 아니면 validate
  function afterAgent(state) {
    if (state.lastError === 'LLM_FAILED') return 'fallback';
    const last = state.messages[state.messages.length - 1];
    const wantsTools = Array.isArray(last?.tool_calls) && last.tool_calls.length > 0;
    return wantsTools && state.toolRounds < MAX_TOOL_ROUNDS ? 'tools' : 'validate';
  }

  // validate 뒤: 통과 → 끝, 횟수가 남았으면 agent, 아니면 폴백
  function afterValidate(state) {
    if (state.line) return END;
    return state.attempts < MAX_LINE_ATTEMPTS ? 'agent' : 'fallback';
  }

  return new StateGraph(State)
    .addNode('agent', agent)
    .addNode('tools', tools_)
    .addNode('validate', validate)
    .addNode('fallback', fallback)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', afterAgent)
    .addEdge('tools', 'agent')
    .addConditionalEdges('validate', afterValidate)
    .addEdge('fallback', END)
    .compile();
}

// 그래프를 한 번 실행한다. 결과: { source: 'ai' | 'rules', line: 대사 | null, errors, toolRounds }
export async function runHarangiGraph(graph, input) {
  const maxLength = input.scene === 'briefing' ? BRIEFING_MAX_LENGTH : LINE_MAX_LENGTH;
  const out = await graph.invoke({
    messages: [new SystemMessage(buildPersonaSystem({ maxLength })), new HumanMessage(buildScenePrompt(input))],
    input,
    toolRounds: 0,
    attempts: 0,
    lastError: null,
    errors: [],
    line: null,
    source: null,
  });
  return { source: out.source, line: out.line, errors: out.errors, toolRounds: out.toolRounds };
}