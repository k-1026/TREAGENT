import test from 'node:test';
import assert from 'node:assert/strict';
import { createImageGen, readImageEntries, CHARACTER_STYLE, DEFAULT_IMAGE_MODELS } from '../src/agents/card/image_gen.js';

const ok = (data = 'QUJD') => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'x' }, { inlineData: { mimeType: 'image/png', data } }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1290, totalTokenCount: 1295 } }) });
const bad = (status) => ({ ok: false, status, json: async () => ({ error: { message: 'KEY-LEAK' } }) });

test('이미지 모델 목록: 환경 변수가 없으면 기본 모델, 키×모델로 짝짓는다', () => {
  assert.equal(readImageEntries({ GOOGLE_API_KEY: 'k' }).length, DEFAULT_IMAGE_MODELS.length);
  assert.deepEqual(readImageEntries({ GOOGLE_API_KEYS: 'a,b', GEMINI_IMAGE_MODELS: 'm1' }).map((e) => `${e.keyNo}/${e.model}`), ['1/m1', '2/m1']);
  assert.equal(readImageEntries({}).length, 0);
});

test('이미지 생성: 응답의 inlineData를 { base64, mime }으로 돌려주고, 캐릭터 고정 문구와 IMAGE 모달리티를 보낸다', async () => {
  const sent = [];
  const gen = createImageGen({ entries: readImageEntries({ GOOGLE_API_KEY: 'K', GEMINI_IMAGE_MODELS: 'img-m' }), fetchFn: async (url, init) => { sent.push({ url, init }); return ok(); } });
  const r = await gen({ system: 's', user: '약령시 골목을 걷는 장면' });
  assert.deepEqual(r.value, { base64: 'QUJD', mime: 'image/png' });
  assert.equal(r.usage.totalTokens, 1295);
  const body = JSON.parse(sent[0].init.body);
  assert.deepEqual(body.generationConfig.responseModalities, ['IMAGE']);
  assert.ok(body.contents[0].parts[0].text.startsWith(CHARACTER_STYLE));
  assert.ok(sent[0].url.includes('img-m:generateContent'));
  assert.equal(sent[0].init.headers['x-goog-api-key'], 'K'); // 키는 주소(URL)가 아니라 헤더로 보낸다
  assert.ok(!sent[0].url.includes('K'.repeat(1) + '?'));
  assert.equal(gen.model, 'img-m');
});

test('이미지 생성: 한 모델이 실패하면 다음 모델로 넘어가고, 그림이 없는 응답(안전 필터)도 실패로 본다', async () => {
  const calls = [];
  const gen = createImageGen({
    entries: readImageEntries({ GOOGLE_API_KEY: 'K', GEMINI_IMAGE_MODELS: 'm1,m2,m3' }),
    fetchFn: async (url) => {
      calls.push(url.match(/models\/([^:]+):/)[1]);
      if (url.includes('m1:')) return bad(429);
      if (url.includes('m2:')) return { ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }) };
      return ok('WkVS');
    },
  });
  const r = await gen({ system: 's', user: 'u' });
  assert.equal(r.value.base64, 'WkVS');
  assert.deepEqual(calls, ['m1', 'm2', 'm3']);
  assert.ok(!JSON.stringify(gen.pool.status()).includes('KEY-LEAK'));
  assert.deepEqual(gen.pool.status().map((e) => e.lastCode), ['HTTP_429', 'IMAGE_EMPTY', null]);
});

test('이미지 생성: 모든 모델이 실패하면 던진다 (카드 에이전트가 고정 카드 틀로 내려간다)', async () => {
  const gen = createImageGen({ entries: readImageEntries({ GOOGLE_API_KEY: 'K', GEMINI_IMAGE_MODELS: 'm1' }), fetchFn: async () => bad(503) });
  await assert.rejects(gen({ system: 's', user: 'u' }));
});
