import test from 'node:test';
import assert from 'node:assert/strict';
import { createLlmFromEnv } from '../src/ai/gemini_llm.js';

test('키나 모델 이름이 없으면 null (서버는 규칙 결과만 쓴다)', () => {
  assert.equal(createLlmFromEnv({}), null);
  assert.equal(createLlmFromEnv({ GOOGLE_API_KEY: 'test-key' }), null);
  assert.equal(createLlmFromEnv({ GEMINI_MODEL: 'test-model' }), null);
});

test('둘 다 있으면 호출 함수를 만든다 (실제 호출은 하지 않는다)', () => {
  const llm = createLlmFromEnv({ GOOGLE_API_KEY: 'test-key', GEMINI_MODEL: 'test-model' });
  assert.equal(typeof llm, 'function');
});