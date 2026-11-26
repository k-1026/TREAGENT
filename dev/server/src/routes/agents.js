import express from 'express';
import { MISSION_KINDS } from '../agents/mission/rules.js';

// 에이전트 API: 미션, 이야기하기, 일기, 카드, 도장. 모두 로그인이 필요하다 (app.js에서 requireLogin을 앞에 끼운다).
// 사용자 위치(position)는 서버 안에서 도착·판정 계산에만 쓰고 저장·기록하지 않는다 (절대 규칙 1). 좌표는 body로만 받는다.
// 응답에는 정답, 장소 좌표, 계정 식별자를 넣지 않는다. 에러는 고정 코드만 돌려준다.
//   agents: { mission, chat, diary, card }  (없으면 해당 경로는 503 AGENT_OFF)
//   stores: createXGameStores()의 결과      placeLoader: 장소 목록 로더
const ID = /^[A-Za-z0-9_-]{1,60}$/;
const isPos = (p) => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
const DEFAULT_KINDS = ['quiz', 'photo']; // 장소에 허용 종류 정보가 없으면 영수증은 빼고 시작한다 [확인 필요: 허용 종류를 어디에 저장할지]

const publicPlace = (p) => ({ id: p.id, name: p.name, district: p.district ?? null, type: p.type });

export function createAgentsRouter({ agents, stores, placeLoader }) {
  const router = express.Router();
  const small = express.json({ limit: '16kb' });
  const big = express.json({ limit: '8mb' }); // 사진 제출만 크다

  const off = (name) => (req, res, next) => (agents?.[name] ? next() : res.status(503).json({ error: 'AGENT_OFF' }));
  const bad = (res) => res.status(400).json({ error: 'INVALID_INPUT' }); // 입력값은 되돌려 주지 않는다

  async function findPlace(id) {
    const loaded = await placeLoader();
    return loaded.ok ? (loaded.places.find((p) => p.id === id) ?? null) : null;
  }

  // ---- 미션 ----
  router.post('/mission/start', small, off('mission'), async (req, res) => {
    const { placeId, position, allowedKinds } = req.body ?? {};
    if (typeof placeId !== 'string' || !ID.test(placeId) || !isPos(position)) return bad(res);
    if (allowedKinds !== undefined && !(Array.isArray(allowedKinds) && allowedKinds.every((k) => MISSION_KINDS.includes(k)))) return bad(res);
    const place = await findPlace(placeId);
    if (!place) return res.status(404).json({ error: 'NO_PLACE' });
    const kinds = allowedKinds?.length ? allowedKinds : (place.missionKinds ?? DEFAULT_KINDS);
    const r = await agents.mission.start({ place, position, allowedKinds: kinds, userKey: req.userId });
    if (!r.ok) return res.status(r.reason === 'GPS_OUT' || r.reason === 'NO_POSITION' ? 409 : 503).json({ error: r.reason });
    res.json({ status: r.status, fallback: r.fallback === true, mission: r.mission, place: publicPlace(place) });
  });

  router.post('/mission/submit', big, off('mission'), async (req, res) => {
    const { ticketId, answer, imageBase64, position } = req.body ?? {};
    if (typeof ticketId !== 'string' || !ID.test(ticketId)) return bad(res);
    if (position !== undefined && !isPos(position)) return bad(res);
    const r = await agents.mission.submit({ ticketId, submission: { answer, imageBase64, position }, userKey: req.userId });
    if (!r.ok) return res.status(r.reason === 'NO_TICKET' ? 404 : 409).json({ error: r.reason });
    res.json({ status: r.status, code: r.code ?? null, stamp: r.stamp ? { id: r.stamp.stampId } : null, submitsLeft: r.submitsLeft ?? null });
  });

  router.post('/mission/hint', small, off('mission'), async (req, res) => {
    const { ticketId } = req.body ?? {};
    if (typeof ticketId !== 'string' || !ID.test(ticketId)) return bad(res);
    const r = await agents.mission.hint({ ticketId, userKey: req.userId });
    if (!r.ok) return res.status(r.reason === 'NO_TICKET' ? 404 : 409).json({ error: r.reason });
    res.json({ hint: r.hint });
  });

  router.post('/mission/replay', small, off('mission'), async (req, res) => {
    const { ticketId } = req.body ?? {};
    if (typeof ticketId !== 'string' || !ID.test(ticketId)) return bad(res);
    const r = await agents.mission.replay({ ticketId, userKey: req.userId });
    if (!r.ok) return res.status(r.reason === 'NO_TICKET' ? 404 : 409).json({ error: r.reason });
    res.json({ task: r.task });
  });

  // ---- 하랑이와 이야기하기 ----
  router.post('/chat', small, off('chat'), async (req, res) => {
    const { question, placeIds } = req.body ?? {};
    if (typeof question !== 'string' || question.length === 0 || question.length > 500) return bad(res);
    if (placeIds !== undefined && !(Array.isArray(placeIds) && placeIds.length <= 5 && placeIds.every((i) => typeof i === 'string' && ID.test(i)))) return bad(res);
    const loaded = await placeLoader();
    const places = loaded.ok ? loaded.places.filter((p) => (placeIds ?? []).includes(p.id)) : [];
    const r = await agents.chat({ question, places });
    res.json({ reply: r.reply, kind: r.kind });
  });

  // ---- 도장과 기록 ----
  router.get('/stamps', async (req, res) => {
    res.json({ stamps: await stores.stamp.listStamps(req.userId) });
  });

  // 일기: 방문 사실은 서버 장부(도장)로 정한다. 이용자가 보낸 값은 장소 id와 길 이름·날짜뿐이다.
  router.post('/diary', small, off('diary'), async (req, res) => {
    const { courseTitle, date, placeIds, tripRef } = req.body ?? {};
    if (typeof courseTitle !== 'string' || courseTitle.length > 40 || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return bad(res);
    if (!(Array.isArray(placeIds) && placeIds.length >= 1 && placeIds.length <= 7 && placeIds.every((i) => typeof i === 'string' && ID.test(i)))) return bad(res);
    const loaded = await placeLoader();
    if (!loaded.ok) return res.status(503).json({ error: 'PLACES_UNAVAILABLE' });
    const stamps = await stores.stamp.listStamps(req.userId);
    const visits = placeIds.map((id) => loaded.places.find((p) => p.id === id)).filter(Boolean).map((p) => {
      const s = stamps.find((x) => x.placeId === p.id);
      return { placeName: p.name, stamped: Boolean(s), quizPassed: s ? s.kind === 'quiz' : null };
    });
    if (visits.length === 0) return bad(res);
    const r = await agents.diary({ courseTitle, date, visits, knownPlaceNames: loaded.places.map((p) => p.name) });
    if (!r.ok) return res.status(422).json({ error: r.reason ?? 'DIARY_FAILED' });
    await stores.diary.save({ userKey: req.userId, tripRef: typeof tripRef === 'string' ? tripRef.slice(0, 60) : null, text: r.text, source: r.source });
    res.json({ text: r.text, source: r.source });
  });

  // 카드: 미션 결과(도장)가 있는 장소마다 한 장. 한 번에 한 장소씩 부른다.
  router.post('/card', small, off('card'), async (req, res) => {
    const { courseTheme, date, placeId, tripRef } = req.body ?? {};
    if (typeof courseTheme !== 'string' || courseTheme.length > 20 || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || typeof placeId !== 'string' || !ID.test(placeId)) return bad(res);
    const place = await findPlace(placeId);
    if (!place) return res.status(404).json({ error: 'NO_PLACE' });
    const stamp = (await stores.stamp.listStamps(req.userId)).find((s) => s.placeId === placeId);
    const r = await agents.card({ courseTheme, date, result: { placeName: place.name, kind: stamp?.kind ?? 'photo', passed: Boolean(stamp), caution: place.caution } });
    if (!r.ok) return res.status(422).json({ error: r.reason ?? 'CARD_FAILED' });
    await stores.card.save({ userKey: req.userId, tripRef: typeof tripRef === 'string' ? tripRef.slice(0, 60) : null, placeId, card: r.card });
    res.json({ card: { placeName: r.card.placeName, caption: r.card.caption, stamp: r.card.stamp, date: r.card.date, source: r.card.source, image: r.card.image ?? null } });
  });

  return router;
}
