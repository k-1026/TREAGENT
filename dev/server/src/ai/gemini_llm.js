import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';

// AI가 돌려줘야 하는 모양. 이름(title)은 받지 않는다. 이름은 코드가 조립한다.
const OutputSchema = z.object({
  placeIds: z.array(z.string()),
  keyword: z.string(),
  reason: z.string(),
});

// Gemini를 부르는 함수를 만든다. 반환: async ({ system, user }, { signal }) => { placeIds, keyword, reason }
export function createGeminiLlm({ apiKey, model, temperature = 0.2 }) {
  const chat = new ChatGoogleGenerativeAI({ apiKey, model, temperature, maxRetries: 0 });
  const structured = chat.withStructuredOutput(OutputSchema, { name: 'route_composition' });
  return async function llm({ system, user }, { signal } = {}) {
    return structured.invoke([new SystemMessage(system), new HumanMessage(user)], { signal });
  };
}

// 환경 변수에서 만든다. 키나 모델 이름이 없으면 null (그러면 서버는 규칙 결과만 쓴다).
//   GOOGLE_API_KEY: 서버 .env에만 둔다. 모델 이름은 공식 문서에서 확인해서 GEMINI_MODEL에 적는다. [확인 필요]
export function createLlmFromEnv(env = process.env) {
  // 키·모델을 쉼표로 여러 개 적어도 읽히게 첫 번째 것을 쓴다 (여러 개 전환은 에이전트 쪽 풀이 맡는다).
  const first = (v) => String(v ?? '').split(',')[0].trim();
  const apiKey = first(env.GOOGLE_API_KEYS ?? env.GOOGLE_API_KEY);
  const model = first(env.GEMINI_MODELS ?? env.GEMINI_MODEL).toLowerCase().replace(/\s+/g, '-');
  if (!apiKey || !model) return null;
  return createGeminiLlm({ apiKey, model });
}