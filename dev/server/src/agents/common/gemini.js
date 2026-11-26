import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { createPoolFromEnv } from './failover.js';

// 에이전트용 Gemini LLM 만들기 (공통). 각 LLM 함수의 약속은 llm_call.js와 같다:
//   async ({ system, user, image? }, { signal }) => ({ value, usage })
// defs: { 노드이름: zod 스키마 | null }   스키마가 있으면 구조화 출력, null이면 글(문자열)을 돌려준다.
// pool: failover.js의 키·모델 전환 풀. 한 짝이 실패하면 다음 키·모델로 넘어간다. 풀은 앱 전체가 하나를 같이 쓴다.
// 키나 모델 이름이 없으면 null (그러면 에이전트를 쓰지 않는다). 키는 서버 .env에만 둔다.

// 사용량: 원본 메시지의 usage_metadata. 없으면 null (0이 아니다).
function usageOf(raw) {
  const u = raw?.usage_metadata;
  if (!u) return null;
  return { inputTokens: u.input_tokens ?? null, outputTokens: u.output_tokens ?? null, totalTokens: u.total_tokens ?? null };
}

const textOf = (content) =>
  typeof content === 'string' ? content : Array.isArray(content) ? content.map((c) => (typeof c === 'string' ? c : (c?.text ?? ''))).join('') : '';

// image(base64)가 있으면 사진과 함께 보낸다. 서버에서만 보낸다. [확인 필요] 설치된 @langchain/google-genai의 이미지 입력 방식은 공식 문서로 확인한다.
const messages = ({ system, user, image, imageMime }) => [
  new SystemMessage(system),
  new HumanMessage(image ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: `data:${imageMime ?? 'image/jpeg'};base64,${image}` } }] : user),
];

export function createGeminiLlms({ defs, pool, temperature = 0.3, makeChat = (e) => new ChatGoogleGenerativeAI({ apiKey: e.apiKey, model: e.model, temperature, maxRetries: 0 }) }) {
  const chats = new Map(); // 짝(keyNo+model)마다 한 번만 만든다
  const chatOf = (e) => {
    const k = `${e.keyNo}|${e.model}`;
    if (!chats.has(k)) chats.set(k, makeChat(e));
    return chats.get(k);
  };
  const llms = {};
  for (const [name, schema] of Object.entries(defs)) {
    const fn = (prompt, { signal } = {}) =>
      pool.run(async (entry) => {
        const chat = chatOf(entry);
        if (schema) {
          const out = await chat.withStructuredOutput(schema, { name, includeRaw: true }).invoke(messages(prompt), { signal });
          return { value: out.parsed, usage: usageOf(out.raw) };
        }
        const msg = await chat.invoke(messages(prompt), { signal });
        return { value: textOf(msg.content), usage: usageOf(msg) };
      }, { signal });
    Object.defineProperty(fn, 'model', { get: () => pool.currentModel() }); // 실행 기록에 실제로 쓴 모델이 남는다
    llms[name] = fn;
  }
  return llms;
}

// 공유 풀을 받아 만든다. 풀이 없으면 null.
export const createGeminiLlmsWithPool = (defs, pool) => (pool ? createGeminiLlms({ defs, pool }) : null);

// (호환) 환경 변수에서 풀부터 새로 만든다. 앱에서는 풀 하나를 공유하므로 createGeminiLlmsWithPool을 쓴다.
export const createGeminiLlmsFromEnv = (defs, env = process.env) => createGeminiLlmsWithPool(defs, createPoolFromEnv(env));
