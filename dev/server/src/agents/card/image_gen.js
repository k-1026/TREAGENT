import { createFailoverPool, readEntries } from '../common/failover.js';

// 하랑이 카드의 이미지 생성 (Gemini 이미지 모델). 글 모델과 같은 키를 쓰고, 이미지 모델 목록은 따로 둔다.
//   GEMINI_IMAGE_MODELS=모델1,모델2   (없으면 아래 기본값). 키는 GOOGLE_API_KEYS / GOOGLE_API_KEY를 같이 쓴다.
//   한 짝(키×모델)이 실패하면(쿼터, 과부하, 이용 불가 모델 등) 다음 짝으로 넘어간다 (common/failover.js).
// 호출 방식: REST generateContent에 generationConfig.responseModalities: ['IMAGE'] 를 주면, 응답의
//   candidates[0].content.parts[]에 inlineData { mimeType, data(base64) } 가 온다 (2026-11-26 공식 응답 모양 기준) [확인 필요: 모델별 무료 한도].
// 이 함수는 card 에이전트의 image 노드 LLM 약속을 따른다: async ({ system, user, image? }, { signal }) => ({ value: { base64, mime }, usage })
//   image(base64)를 주면 기준 이미지로 함께 보낸다 (캐릭터 모습을 맞출 때). 이용자 사진은 보내지 않는다.
export const DEFAULT_IMAGE_MODELS = ['gemini-3.1-flash-image', 'gemini-2.5-flash-image'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// 캐릭터 고정 문구: brand/character/prompts.md의 하랑이 설명을 따른다. 프롬프트 작성자가 쓴 장면 설명 앞에 항상 붙는다.
export const CHARACTER_STYLE = 'Same chibi squirrel mascot Harangi, pixel-art RPG style, plain simple background, no text, no letters, no signs, no logos, no real people.';

export function readImageEntries(env = process.env) {
  const models = String(env.GEMINI_IMAGE_MODELS ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  // 글 모델 대신 이미지 모델 목록을 넣어 같은 키 목록과 짝짓는다
  return readEntries({ GOOGLE_API_KEYS: env.GOOGLE_API_KEYS ?? env.GOOGLE_API_KEY, GEMINI_MODELS: (models.length ? models : DEFAULT_IMAGE_MODELS).join(',') });
}

export function createImageGen({ entries, pool = createFailoverPool({ entries }), fetchFn = fetch, timeoutMs = 40000 }) {
  const fn = (prompt, { signal } = {}) =>
    pool.run(async (entry) => {
      const parts = [{ text: `${CHARACTER_STYLE}\n${prompt.user}` }];
      if (prompt.image) parts.push({ inlineData: { mimeType: 'image/png', data: prompt.image } });
      const res = await fetchFn(`${BASE}/${entry.model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': entry.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ['IMAGE'] } }),
        signal: signal ?? AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw Object.assign(new Error('IMAGE_HTTP'), { status: res.status }); // 응답 본문(키가 섞일 수 있음)은 버린다
      const json = await res.json();
      const part = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
      if (!part) throw Object.assign(new Error('IMAGE_EMPTY'), { code: 'IMAGE_EMPTY' }); // 안전 필터 등으로 그림이 없는 응답
      const u = json.usageMetadata;
      return {
        value: { base64: part.inlineData.data, mime: part.inlineData.mimeType ?? 'image/png' },
        usage: u ? { inputTokens: u.promptTokenCount ?? null, outputTokens: u.candidatesTokenCount ?? null, totalTokens: u.totalTokenCount ?? null } : null,
      };
    }, { signal });
  Object.defineProperty(fn, 'model', { get: () => pool.currentModel() });
  fn.pool = pool;
  return fn;
}

// 환경 변수에서 만든다. 키가 없으면 null (그러면 카드는 항상 고정 카드 틀이다).
export function createImageGenFromEnv(env = process.env) {
  const entries = readImageEntries(env);
  return entries.length > 0 ? createImageGen({ entries }) : null;
}
