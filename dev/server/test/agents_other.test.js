import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecorder } from '../src/agents/common/recorder.js';
import { createMemoryRunStore, foldEvents } from '../src/agents/common/run_store_memory.js';
import { createFakeLlm } from '../src/agents/common/testing/fake_llm.js';
import { createChatAgent, SAFETY_REPLY, UNKNOWN_REPLY, FIXED_REPLY } from '../src/agents/chat/agent.js';
import { createDiaryAgent, checkDiary, templateDiary } from '../src/agents/diary/agent.js';
import { createMissionAgent } from '../src/agents/mission/agent.js';
import { createCardAgent } from '../src/agents/card/agent.js';
import { createPlaceDbAgent } from '../src/agents/place_db/agent.js';

const LIMITS = { maxLlmCalls: 12, deadlineMs: 5000, llmTimeoutMs: 500, maxLoopAttempts: 2 };
const settle = () => new Promise((r) => setTimeout(r, 30));
const rec = () => {
  const store = createMemoryRunStore();
  return { store, recorder: createRecorder({ store }) };
};
const runs = (store) => foldEvents(store.events);
const P = (o) => ({ id: 'p1', name: '약령시', type: 'indoor', lat: 35.8701, lng: 128.6001, hoursText: '09:00~18:00', caution: null, ...o });

// ---------------- 이야기하기 ----------------

test('chat: 위험한 표현은 LLM을 거치지 않고 고정 안내로 간다', async () => {
  const llms = { classify: createFakeLlm([{}]), answer: createFakeLlm(['x']) };
  const chat = createChatAgent({ llms, limits: LIMITS });
  const r = await chat({ question: '쓰러질 것 같아요', places: [P()] });
  assert.equal(r.reply, SAFETY_REPLY);
  assert.equal(r.kind, 'safety');
  assert.equal(llms.classify.calls.length, 0);
});

test('chat: 장소 질문에 근거가 있으면 답하고, 모든 노드가 기록된다', async () => {
  const { store, recorder } = rec();
  const llms = { classify: createFakeLlm([{ category: 'place', placeId: 'p1' }]), answer: createFakeLlm(['우와, 9시부터 열어요!']) };
  const chat = createChatAgent({ llms, recorder, limits: LIMITS });
  const r = await chat({ question: '여기 몇 시에 열어요?', places: [P()] });
  assert.equal(r.reply, '우와, 9시부터 열어요!');
  await settle();
  assert.deepEqual(runs(store)[0].steps.map((s) => `${s.node}:${s.verdict}`), ['safety:pass', 'classify:pass', 'lookup:pass', 'answer:pass', 'check:pass']);
  assert.equal(runs(store)[0].outcome, 'normal');
});

test('chat: 근거가 없는 질문은 지어내지 않고 모른다고 답한다 (답변 LLM 호출 없음)', async () => {
  const llms = { classify: createFakeLlm([{ category: 'place', placeId: 'zzz' }]), answer: createFakeLlm(['지어낸 답']) };
  const chat = createChatAgent({ llms, limits: LIMITS });
  const r = await chat({ question: '이 건물 역사 알려줘', places: [P()] });
  assert.equal(r.reply, UNKNOWN_REPLY);
  assert.equal(llms.answer.calls.length, 0);
});

test('chat: 답변 검증이 계속 실패하면 고정 문장으로 내려간다', async () => {
  const { store, recorder } = rec();
  const llms = { classify: createFakeLlm([{ category: 'chat', placeId: null }]), answer: createFakeLlm(['최고의 하루예요!']) };
  const chat = createChatAgent({ llms, recorder, limits: LIMITS });
  const r = await chat({ question: '안녕', places: [] });
  assert.equal(r.reply, FIXED_REPLY);
  await settle();
  assert.equal(runs(store)[0].outcome, 'substitute');
});

test('chat: LLM이 실패하면 고정 문장 (fallback)', async () => {
  const { store, recorder } = rec();
  const llms = { classify: createFakeLlm([new Error('x')]), answer: createFakeLlm(['a']) };
  const r = await createChatAgent({ llms, recorder, limits: LIMITS })({ question: '안녕', places: [] });
  assert.equal(r.reply, FIXED_REPLY);
  await settle();
  assert.equal(runs(store)[0].outcome, 'fallback');
});

test('chat: 질문 속 좌표는 실행 기록에 남지 않는다', async () => {
  const { store, recorder } = rec();
  const llms = { classify: createFakeLlm([{ category: 'chat', placeId: null }]), answer: createFakeLlm(['우와, 안녕하세요!']) };
  await createChatAgent({ llms, recorder, limits: LIMITS })({ question: '나 35.870123, 128.600456 에 있어', places: [] });
  await settle();
  assert.ok(!JSON.stringify(store.events).includes('35.870123'));
});

// ---------------- 기록 정리 ----------------

const VISITS = [{ placeName: '약령시', stamped: true, quizPassed: true }, { placeName: '근대골목', stamped: true, quizPassed: null }];

test('diary: 일기를 쓰고 검증을 통과하면 저장한다', async () => {
  const saved = [];
  const llms = { write: createFakeLlm(['오늘은 약령시와 근대골목을 걸었어요. 도장을 2개 모았어요.']) };
  const diary = createDiaryAgent({ llms, saveDiary: async (d) => saved.push(d), limits: LIMITS });
  const r = await diary({ courseTitle: '근대골목길', date: '2026-11-25', visits: VISITS });
  assert.equal(r.source, 'llm');
  assert.equal(saved.length, 1);
});

test('diary: 사실 밖 장소 이름·숫자·금칙어는 거부하고, 소진되면 틀 일기를 저장한다', async () => {
  const facts = { courseTitle: 'x', date: '2026-11-25', visits: VISITS };
  assert.equal(checkDiary('오늘은 서문시장도 갔어요.', facts, { knownPlaceNames: ['서문시장'] }).code, 'OUTSIDE_FACT');
  assert.equal(checkDiary('오늘 7곳을 걸었어요.', facts).code, 'OUTSIDE_FACT');
  assert.equal(checkDiary('최고였어요.', facts).code, 'FORBIDDEN');
  const saved = [];
  const { store, recorder } = rec();
  const llms = { write: createFakeLlm(['오늘 99곳을 걸었어요.']) };
  const r = await createDiaryAgent({ llms, saveDiary: async (d) => saved.push(d), recorder, limits: LIMITS })({ courseTitle: 'x', date: '2026-11-25', visits: VISITS });
  assert.equal(r.source, 'template');
  assert.equal(r.text, templateDiary({ courseTitle: 'x', date: '2026-11-25', visits: VISITS.map((v) => ({ ...v })) }));
  assert.equal(saved[0].source, 'template');
  await settle();
  assert.equal(runs(store)[0].outcome, 'substitute');
});

test('diary: LLM이 실패해도 틀 일기를 낸다', async () => {
  const saved = [];
  const r = await createDiaryAgent({ llms: { write: createFakeLlm([new Error('x')]) }, saveDiary: async (d) => saved.push(d), limits: LIMITS })({ courseTitle: 'x', date: '2026-11-25', visits: VISITS });
  assert.equal(r.source, 'template');
  assert.equal(saved.length, 1);
});

// ---------------- 미션 ----------------

function missionSetup({ llm = {}, store: storeOver = {}, prepareImage } = {}) {
  const { store: runStore, recorder } = rec();
  const stamps = [];
  const store = {
    hasStamp: async () => false,
    hasDuplicate: async () => false,
    addStamp: async (s) => { stamps.push(s); return { stampId: `s${stamps.length}` }; },
    ...storeOver,
  };
  const ok = { pass: true, reason: 'ok' };
  const llms = {
    explain: createFakeLlm([{ text: '약령시는 09:00~18:00에 열어요.', evidenceKeys: ['hoursText'] }]),
    explain_review: createFakeLlm([ok]),
    pick_kind: createFakeLlm([{ kind: 'quiz' }]),
    generate: createFakeLlm([{ task: '약령시는 몇 시에 문을 닫나요?', answer: '18시' }]),
    generate_review: createFakeLlm([ok]),
    judge: createFakeLlm([ok]),
    hint: createFakeLlm(['오후 늦게 닫아요.']),
    ...llm,
  };
  const agent = createMissionAgent({ llms, store, prepareImage, recorder, limits: LIMITS });
  return { agent, llms, stamps, runStore };
}
const HERE = { latitude: 35.8701, longitude: 128.6001 };
const FAR = { latitude: 35.88, longitude: 128.62 };
const START = (o = {}) => ({ place: P(), position: HERE, userKey: 'u1', ...o });

test('mission: 퀴즈 전체 흐름 — 출제, 제출, 판정, 도장 기록', async () => {
  const { agent, stamps, runStore } = missionSetup();
  const s = await agent.start(START());
  assert.equal(s.status, 'waiting');
  assert.equal(s.mission.kind, 'quiz');
  assert.ok(!JSON.stringify(s).includes('18시')); // 정답은 이용자에게 나가지 않는다
  const r = await agent.submit({ ticketId: s.mission.ticketId, submission: { answer: '18시' }, userKey: 'u1' });
  assert.equal(r.status, 'stamped');
  assert.equal(stamps.length, 1);
  await settle();
  const run = runs(runStore)[0];
  assert.equal(run.agent, 'mission_quiz');
  assert.equal(run.outcome, 'normal');
  assert.deepEqual(run.steps.map((x) => x.node), ['arrive', 'explain', 'explain_check', 'explain_review', 'pick_kind', 'generate', 'generate_check', 'generate_review', 'submit', 'submit_check', 'judge', 'judge_check', 'stamp']);
});

test('mission: 도착하지 않으면 시작하지 않는다 (GPS_OUT) — 위치는 기록에 남지 않는다', async () => {
  const { agent, runStore, llms } = missionSetup();
  const s = await agent.start(START({ position: FAR }));
  assert.deepEqual([s.ok, s.reason], [false, 'GPS_OUT']);
  assert.equal(llms.explain.calls.length, 0);
  await settle();
  assert.ok(!JSON.stringify(runStore.events).includes('35.88'));
});

test('mission: 허용되지 않은 종류를 LLM이 골라도 코드가 허용 종류로 바꾼다', async () => {
  const { agent } = missionSetup({ llm: { pick_kind: createFakeLlm([{ kind: 'receipt' }]) } });
  const s = await agent.start(START({ allowedKinds: ['photo'] }));
  assert.equal(s.mission.kind, 'photo');
});

test('mission: 퀴즈 출제에서 정답이 문제에 그대로 나오면 다시 출제한다', async () => {
  const llm = { generate: createFakeLlm([{ task: '정답은 18시입니다. 몇 시?', answer: '18시' }, { task: '약령시는 몇 시에 닫나요?', answer: '18시' }]) };
  const { agent, llms } = missionSetup({ llm });
  const s = await agent.start(START());
  assert.equal(s.mission.task, '약령시는 몇 시에 닫나요?');
  assert.equal(llms.generate.calls.length, 2);
});

test('mission: 출제가 계속 거부되면 준비된 과제로 내려가고 미션은 멈추지 않는다', async () => {
  const llm = { generate_review: createFakeLlm([{ pass: false, reason: 'x' }]) };
  const { agent, runStore } = missionSetup({ llm });
  const s = await agent.start(START());
  assert.equal(s.status, 'waiting');
  assert.equal(s.mission.kind, 'photo'); // 준비된 퀴즈가 없어 인증샷 과제로
  await settle();
  assert.ok(runs(runStore)[0].steps.some((x) => x.node === 'fallback'));
});

test('mission: 판정 확인(코드)이 거부권을 가진다 — LLM이 통과라고 해도 GPS 밖이면 도장 없음', async () => {
  const { agent, stamps } = missionSetup();
  const s = await agent.start(START());
  const r = await agent.submit({ ticketId: s.mission.ticketId, submission: { answer: '18시', position: FAR }, userKey: 'u1' });
  assert.deepEqual([r.status, r.code], ['retry', 'GPS_OUT']);
  assert.equal(stamps.length, 0);
});

test('mission: 이미 도장을 받은 장소는 ALREADY_STAMPED로 거부한다', async () => {
  const { agent, stamps } = missionSetup({ store: { hasStamp: async () => true } });
  const s = await agent.start(START());
  const r = await agent.submit({ ticketId: s.mission.ticketId, submission: { answer: '18시' }, userKey: 'u1' });
  assert.equal(r.code, 'ALREADY_STAMPED');
  assert.equal(stamps.length, 0);
});

test('mission: 판정이 거절이면 다시 제출, 횟수를 다 쓰면 도장 보류', async () => {
  const { agent, stamps, runStore } = missionSetup({ llm: { judge: createFakeLlm([{ pass: false, reason: '오답' }]) } });
  const s = await agent.start(START());
  const id = s.mission.ticketId;
  assert.equal((await agent.submit({ ticketId: id, submission: { answer: 'a' }, userKey: 'u1' })).status, 'retry');
  assert.equal((await agent.submit({ ticketId: id, submission: { answer: 'b' }, userKey: 'u1' })).status, 'retry');
  const last = await agent.submit({ ticketId: id, submission: { answer: 'c' }, userKey: 'u1' });
  assert.equal(last.status, 'held');
  assert.equal(stamps.length, 0);
  await settle();
  assert.equal(runs(runStore)[0].outcome, 'fallback');
  assert.equal((await agent.submit({ ticketId: id, submission: { answer: 'd' }, userKey: 'u1' })).reason, 'ALREADY_DONE');
});

test('mission: 판정 LLM이 실패하면 저절로 통과시키지 않고 도장 보류', async () => {
  const { agent, stamps } = missionSetup({ llm: { judge: createFakeLlm([new Error('x')]) } });
  const s = await agent.start(START());
  const r = await agent.submit({ ticketId: s.mission.ticketId, submission: { answer: '18시' }, userKey: 'u1' });
  assert.equal(r.status, 'held');
  assert.equal(stamps.length, 0);
});

test('mission: 다른 이용자의 티켓은 쓸 수 없다', async () => {
  const { agent } = missionSetup();
  const s = await agent.start(START());
  const r = await agent.submit({ ticketId: s.mission.ticketId, submission: { answer: '18시' }, userKey: 'u2' });
  assert.equal(r.reason, 'NO_TICKET');
});

test('mission: 퀴즈 힌트는 정답을 말하면 거부하고, 정답은 힌트 입력에 없다', async () => {
  const { agent, llms } = missionSetup({ llm: { hint: createFakeLlm(['답은 18시예요', '오후 늦게 닫아요.']) } });
  const s = await agent.start(START());
  const id = s.mission.ticketId;
  const h1 = await agent.hint({ ticketId: id, userKey: 'u1' });
  assert.deepEqual([h1.ok, h1.reason], [false, 'ANSWER_EXPOSED']);
  const h2 = await agent.hint({ ticketId: id, userKey: 'u1' });
  assert.equal(h2.hint, '오후 늦게 닫아요.');
  for (const c of llms.hint.calls) assert.ok(!JSON.stringify(c.input).includes('18시'));
});

test('mission: 인증샷은 준비된(EXIF 제거) 사진만 Gemini로 보내고, 준비 실패면 보내지 않는다', async () => {
  const photo = { pick_kind: createFakeLlm([{ kind: 'photo' }]), generate: createFakeLlm([{ task: '약령시 입구를 찍어 주세요.', answer: null }]) };
  const okPrep = async () => ({ ok: true, base64: 'CLEANED', hash: 'h1' });
  const a = missionSetup({ llm: photo, prepareImage: okPrep });
  const s = await a.agent.start(START());
  assert.equal(s.mission.kind, 'photo');
  const r = await a.agent.submit({ ticketId: s.mission.ticketId, submission: { imageBase64: 'RAW' }, userKey: 'u1' });
  assert.equal(r.status, 'stamped');
  assert.equal(a.llms.judge.calls[0].input.image, 'CLEANED');
  await settle();
  assert.ok(!JSON.stringify(a.runStore.events).includes('CLEANED')); // 사진 원본은 기록에 없다

  const b = missionSetup({ llm: photo }); // prepareImage 기본값: 항상 실패
  const s2 = await b.agent.start(START());
  const r2 = await b.agent.submit({ ticketId: s2.mission.ticketId, submission: { imageBase64: 'RAW' }, userKey: 'u1' });
  assert.deepEqual([r2.status, r2.code], ['retry', 'IMAGE_PREP_UNAVAILABLE']);
  assert.equal(b.llms.judge.calls.length, 0);
});

test('mission: 같은 사진 중복 제출은 DUPLICATE, 영수증은 다시 보기가 있고 퀴즈는 없다', async () => {
  const receipt = { pick_kind: createFakeLlm([{ kind: 'receipt' }]), generate: createFakeLlm([{ task: '약령시에서 차를 사 주세요.', answer: null }]) };
  const { agent, stamps } = missionSetup({ llm: receipt, prepareImage: async () => ({ ok: true, base64: 'C', hash: 'dup' }), store: { hasDuplicate: async () => true } });
  const s = await agent.start(START());
  assert.equal((await agent.replay({ ticketId: s.mission.ticketId, userKey: 'u1' })).task, '약령시에서 차를 사 주세요.');
  const r = await agent.submit({ ticketId: s.mission.ticketId, submission: { imageBase64: 'R' }, userKey: 'u1' });
  assert.equal(r.code, 'DUPLICATE');
  assert.equal(stamps.length, 0);
  const q = missionSetup();
  const qs = await q.agent.start(START());
  assert.equal((await q.agent.replay({ ticketId: qs.mission.ticketId, userKey: 'u1' })).reason, 'NOT_REPLAYABLE');
});

// ---------------- 하랑이 카드 ----------------

const FIXED = { base64: 'FIXEDIMG', mime: 'image/png' };
const RESULT = { placeName: '약령시', kind: 'quiz', passed: true };
const IMG = { base64: 'GENIMG', mime: 'image/png' };
const cardLlms = (o = {}) => ({
  prompt: createFakeLlm([{ imagePrompt: '하랑이가 약령시 골목을 걷는 그림' }]),
  image: createFakeLlm([IMG]),
  image_review: createFakeLlm([{ pass: true, reason: 'ok' }]),
  ...o,
});

test('card: 생성한 그림으로 카드를 조립해 저장한다 (문구는 템플릿)', async () => {
  const saved = [];
  const { store, recorder } = rec();
  const agent = createCardAgent({ llms: cardLlms(), saveCard: async (c) => (saved.push(c), c), fixedCard: FIXED, recorder, limits: LIMITS });
  const r = await agent({ courseTheme: 'history', date: '2026-11-25', result: RESULT });
  assert.equal(r.source, 'generated');
  assert.equal(saved[0].caption, '약령시에서 도장을 받았어요.');
  await settle();
  assert.deepEqual(runs(store)[0].steps.map((s) => s.node), ['facts', 'prompt', 'image', 'image_check', 'image_review', 'assemble', 'save']);
  assert.ok(!JSON.stringify(store.events).includes('GENIMG')); // 이미지 원본은 기록에 없다
});

test('card: 이미지 검증이 계속 실패하면 고정 카드 틀로 내려간다', async () => {
  const { store, recorder } = rec();
  const llms = cardLlms({ image: createFakeLlm([{ base64: 'x', mime: 'image/gif' }]) });
  const r = await createCardAgent({ llms, fixedCard: FIXED, recorder, limits: LIMITS })({ courseTheme: 'history', date: '2026-11-25', result: RESULT });
  assert.equal(r.source, 'fixed');
  assert.equal(r.card.image, FIXED);
  await settle();
  assert.equal(runs(store)[0].outcome, 'substitute');
});

test('card: 이미지 검토가 거절하면 프롬프트를 다시 쓴다', async () => {
  const llms = cardLlms({ image_review: createFakeLlm([{ pass: false, reason: '글자 있음' }, { pass: true, reason: 'ok' }]) });
  const r = await createCardAgent({ llms, fixedCard: FIXED, limits: LIMITS })({ courseTheme: 'history', date: '2026-11-25', result: RESULT });
  assert.equal(r.source, 'generated');
  assert.equal(llms.prompt.calls.length, 2);
});

test('card: 이미지 생성이 실패해도 카드는 나온다', async () => {
  const llms = cardLlms({ image: createFakeLlm([new Error('quota')]) });
  const r = await createCardAgent({ llms, fixedCard: FIXED, limits: LIMITS })({ courseTheme: 'history', date: '2026-11-25', result: RESULT });
  assert.equal(r.ok, true);
  assert.equal(r.source, 'fixed');
});

test('card: 민감한 소재는 이미지 생성을 건너뛰고 고정 카드 틀을 쓴다', async () => {
  const llms = cardLlms();
  const r = await createCardAgent({ llms, fixedCard: FIXED, limits: LIMITS })({ courseTheme: 'history', date: '2026-11-25', result: { ...RESULT, caution: '식민지 시기 건물' } });
  assert.equal(r.source, 'fixed');
  assert.equal(llms.image.calls.length, 0);
});

// ---------------- 장소 DB 갱신 ----------------

const RESULTS = [{ title: '새 장소', url: 'https://example.go.kr/a', snippet: '대구 중구 새 장소 안내' }];
const CAND = { name: '새 장소', type: 'indoor', district: '중구', sourceUrl: 'https://example.go.kr/a', lat: 35.87, lng: 128.6, openHour: 9, closeHour: 18, caution: null };

function placeDbSetup(over = {}) {
  const { store, recorder } = rec();
  const cands = new Map();
  const applied = [];
  const candidateStore = {
    add: async (c) => { const id = `c${cands.size + 1}`; cands.set(id, { ...c, id }); return id; },
    get: async (id) => cands.get(id),
    setStatus: async (id, status) => { cands.get(id).status = status; },
  };
  const llms = { discover: createFakeLlm([{ candidates: [CAND] }]), planner: createFakeLlm([{ names: ['새 장소'] }]), ...over.llms };
  const agent = createPlaceDbAgent({ llms, search: over.search ?? (async () => RESULTS), candidateStore, applyToPlaces: async (c) => applied.push(c), existingNames: () => over.existing ?? [], recorder, limits: LIMITS });
  return { agent, cands, applied, store };
}

test('place_db: 후보는 보관소에만 쓰고, 사람이 승인해야 places에 반영된다', async () => {
  const { agent, cands, applied, store } = placeDbSetup();
  const d = await agent.discover({ area: '중구' });
  assert.equal(d.status, 'waiting_approval');
  assert.equal(applied.length, 0); // LLM 단계가 끝나도 아직 반영되지 않았다
  assert.equal(cands.get('c1').status, 'pending');
  const r = await agent.decide({ approvalId: d.approvalId, decision: 'approve' });
  assert.equal(r.status, 'applied');
  assert.equal(applied.length, 1);
  await settle();
  const run = runs(store)[0];
  assert.equal(run.outcome, 'normal');
  assert.deepEqual(run.steps.map((s) => s.node), ['discover', 'planner', 'checker', 'store', 'approve', 'apply']);
});

test('place_db: 사람이 거절하면 보류하고 반영하지 않는다', async () => {
  const { agent, cands, applied } = placeDbSetup();
  const d = await agent.discover({ area: '중구' });
  const r = await agent.decide({ approvalId: d.approvalId, decision: 'reject', reason: '정보 부족' });
  assert.equal(r.status, 'held');
  assert.equal(cands.get('c1').status, 'held');
  assert.equal(applied.length, 0);
});

test('place_db: 웹 검색이 연결되지 않으면 후보를 만들지 않는다', async () => {
  const { agent, llms } = { ...placeDbSetup({ search: undefined }) };
  const a = createPlaceDbAgent({ llms: { discover: createFakeLlm([{ candidates: [CAND] }]), planner: createFakeLlm([{ names: [] }]) }, candidateStore: {}, applyToPlaces: async () => {}, limits: LIMITS });
  const r = await a.discover({ area: '중구' });
  assert.deepEqual([r.ok, r.reason], [false, 'WEB_SEARCH_NOT_CONFIGURED']);
  void agent; void llms;
});

test('place_db: 검색 결과에 없는 출처, 범위 밖 좌표, 중복 이름은 확인자가 거부하고 폐기한다', async () => {
  for (const [bad, code] of [[{ sourceUrl: 'https://made.up/x' }, 'SOURCE_NOT_FOUND'], [{ lat: 37.5, lng: 127.0 }, 'OUT_OF_AREA'], [{ openHour: 20, closeHour: 9 }, 'BAD_HOURS']]) {
    const { agent, store, applied } = placeDbSetup({ llms: { discover: createFakeLlm([{ candidates: [{ ...CAND, ...bad }] }]) } });
    const d = await agent.discover({ area: '중구' });
    assert.equal(d.status, 'discarded', code);
    assert.equal(applied.length, 0);
    await settle();
    assert.ok(runs(store)[0].steps.some((s) => s.reasonCode === code), code);
  }
  const dup = placeDbSetup({ existing: ['새 장소'] });
  assert.equal((await dup.agent.discover({ area: '중구' })).status, 'discarded');
});

test('place_db: 식민지·전쟁 소재는 주의로 표시해 보관한다', async () => {
  const { agent, cands } = placeDbSetup({ llms: { discover: createFakeLlm([{ candidates: [{ ...CAND, caution: '일제강점기 건물' }] }]) } });
  await agent.discover({ area: '중구' });
  assert.equal(cands.get('c1').caution, '주의');
});
