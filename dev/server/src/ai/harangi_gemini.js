import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

// 도구를 묶은 Gemini 모델을 만드는 함수를 만든다.
// 도구는 요청마다 다르므로(그 길의 장소만 조회 가능) 도구를 받아서 그때 묶는다.
//   반환: (tools) => async (messages, { signal }) => AIMessage
export function createHarangiModelFactory({ apiKey, model, temperature = 0.7 }) {
  const chat = new ChatGoogleGenerativeAI({ apiKey, model, temperature, maxRetries: 0 });
  return (tools) => {
    const bound = chat.bindTools(tools);
    return (messages, { signal } = {}) => bound.invoke(messages, { signal });
  };
}

// 환경 변수에서 만든다. 키나 모델 이름이 없으면 null (그러면 서버는 고정 대사만 쓴다).
export function createHarangiFactoryFromEnv(env = process.env) {
  const apiKey = env.GOOGLE_API_KEY;
  const model = env.GEMINI_MODEL;
  if (!apiKey || !model) return null;
  return createHarangiModelFactory({ apiKey, model });
}