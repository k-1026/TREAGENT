import { randomUUID } from 'node:crypto';

// 에이전트가 쓰는 저장소 모음: 도장 장부, 제출 결과, 일기, 카드, 장소 후보.
// DB 판(createPgGameStores)과 서버 메모리 판(createMemoryGameStores)이 같은 모양이다. DATABASE_URL이 없으면 메모리 판을 쓴다.
// 테이블: dev/supabase/migrations/create_agent_game_tables.sql. 도장·제출·일기·카드는 추가만 한다.
// 좌표, 사진·영수증 원본은 저장하지 않는다 (사진은 해시만).

export function createMemoryGameStores() {
  const stamps = [];
  const submissions = [];
  const diaries = [];
  const cards = [];
  const candidates = new Map();
  const places = []; // 반영된 장소 (메모리 판에서는 places 표 대신 여기에 쌓는다)
  return {
    kind: 'memory',
    stamp: {
      async hasStamp(userId, placeId) { return stamps.some((s) => s.userId === userId && s.placeId === placeId); },
      async hasDuplicate(userId, placeId, hash) { return submissions.some((s) => s.userId === userId && s.placeId === placeId && s.imageHash === hash); },
      async addStamp({ userKey, placeId, kind, ticketId }) {
        if (stamps.some((s) => s.userId === userKey && s.placeId === placeId)) throw Object.assign(new Error('ALREADY_STAMPED'), { code: 'ALREADY_STAMPED' });
        stamps.push({ userId: userKey, placeId, kind, ticketId });
        return { stampId: stamps.length };
      },
      async recordSubmission({ userKey, placeId, kind, imageHash, passed, reasonCode }) {
        submissions.push({ userId: userKey, placeId, kind, imageHash: imageHash ?? null, passed, reasonCode: reasonCode ?? null });
      },
      async listStamps(userId) { return stamps.filter((s) => s.userId === userId).map(({ placeId, kind }) => ({ placeId, kind })); },
    },
    diary: { async save({ userKey, tripRef, text, source }) { diaries.push({ userId: userKey, tripRef, text, source }); return { id: diaries.length }; }, list: async (userId) => diaries.filter((d) => d.userId === userId) },
    card: {
      async save({ userKey, tripRef, placeId, card }) {
        cards.push({ userId: userKey, tripRef, placeId, caption: card.caption, stamped: card.stamp, source: card.source });
        return { id: cards.length };
      },
      list: async (userId) => cards.filter((c) => c.userId === userId),
    },
    candidates: {
      async add(c) { const id = randomUUID(); candidates.set(id, { ...c, id, status: 'pending', statusReason: null, createdAt: new Date().toISOString() }); return id; },
      async get(id) { return candidates.get(id) ?? null; },
      async setStatus(id, status, reason = null) { const c = candidates.get(id); if (c) Object.assign(c, { status, statusReason: reason }); },
      async list() { return [...candidates.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100); },
    },
    placesApplied: places,
    async applyToPlaces(c) { places.push(c); },
  };
}

const rowToCandidate = (r) => ({
  id: r.id, name: r.name, type: r.type, district: r.district, sourceUrl: r.source_url, lat: r.lat, lng: r.lng,
  openHour: r.open_hour, closeHour: r.close_hour, caution: r.caution, status: r.status, statusReason: r.status_reason, createdAt: r.created_at,
});

// places.type은 ('outdoor','shade','indoor','exhibit')만 허용한다. 모르는 값이면 반영하지 않고 사람이 고치게 한다.
const PLACE_TYPES = ['outdoor', 'shade', 'indoor', 'exhibit'];

export function createPgGameStores({ query }) {
  return {
    kind: 'db',
    stamp: {
      async hasStamp(userId, placeId) { return (await query('select 1 from public.agent_stamps where user_id = $1 and place_id = $2', [userId, placeId])).length > 0; },
      async hasDuplicate(userId, placeId, hash) {
        return (await query('select 1 from public.agent_submissions where user_id = $1 and place_id = $2 and image_hash = $3 limit 1', [userId, placeId, hash])).length > 0;
      },
      async addStamp({ userKey, placeId, kind, ticketId }) {
        // (user_id, place_id) 유니크 제약이 같은 장소의 두 번째 도장을 막는다 (절대 규칙 4).
        const rows = await query('insert into public.agent_stamps (user_id, place_id, kind, ticket_id) values ($1, $2, $3, $4) returning id', [userKey, placeId, kind, ticketId]);
        return { stampId: rows[0]?.id };
      },
      async recordSubmission({ userKey, placeId, kind, imageHash, passed, reasonCode }) {
        await query('insert into public.agent_submissions (user_id, place_id, kind, image_hash, passed, reason_code) values ($1, $2, $3, $4, $5, $6)', [userKey, placeId, kind, imageHash ?? null, passed, reasonCode ?? null]);
      },
      async listStamps(userId) { return (await query('select place_id as "placeId", kind from public.agent_stamps where user_id = $1 order by id', [userId])); },
    },
    diary: {
      async save({ userKey, tripRef, text, source }) { return { id: (await query('insert into public.agent_diaries (user_id, trip_ref, body, source) values ($1, $2, $3, $4) returning id', [userKey, tripRef ?? null, text, source]))[0]?.id }; },
      list: (userId) => query('select id, trip_ref as "tripRef", body as text, source, created_at as "createdAt" from public.agent_diaries where user_id = $1 order by id desc limit 50', [userId]),
    },
    card: {
      async save({ userKey, tripRef, placeId, card }) {
        const rows = await query('insert into public.agent_cards (user_id, trip_ref, place_id, caption, stamped, image_mime, image_data, source) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id', [userKey, tripRef ?? null, placeId ?? null, card.caption, card.stamp === true, card.image?.mime ?? null, card.image?.base64 ?? null, card.source]);
        return { id: rows[0]?.id };
      },
      list: (userId) => query('select id, trip_ref as "tripRef", place_id as "placeId", caption, stamped, image_mime as "imageMime", image_data as "imageData", source, created_at as "createdAt" from public.agent_cards where user_id = $1 order by id desc limit 50', [userId]),
    },
    candidates: {
      async add(c) {
        const rows = await query('insert into public.place_candidates (name, type, district, source_url, lat, lng, open_hour, close_hour, caution) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id', [c.name, c.type, c.district ?? null, c.sourceUrl, c.lat ?? null, c.lng ?? null, c.openHour ?? null, c.closeHour ?? null, c.caution ?? null]);
        return rows[0].id;
      },
      async get(id) { const r = (await query('select * from public.place_candidates where id = $1', [id]))[0]; return r ? rowToCandidate(r) : null; },
      async setStatus(id, status, reason = null) { await query('update public.place_candidates set status = $2, status_reason = $3, updated_at = now() where id = $1', [id, status, reason]); },
      async list() { return (await query('select * from public.place_candidates order by created_at desc limit 100')).map(rowToCandidate); },
    },
    // 사람이 승인한 후보만 이 함수로 places에 들어간다. 새 장소는 status='unknown'으로 넣어 담당자가 확인한 뒤 open으로 바꾼다.
    async applyToPlaces(c) {
      if (!PLACE_TYPES.includes(c.type)) throw Object.assign(new Error('BAD_TYPE'), { code: 'BAD_PLACE_TYPE' });
      const id = `cand_${String(c.id).replace(/-/g, '').slice(0, 12)}`;
      await query(
        `insert into public.places (id, name, district, type, lat, lng, open_hour, close_hour, caution, status, source)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unknown', $10) on conflict (id) do nothing`,
        [id, c.name, c.district ?? null, c.type, c.lat ?? null, c.lng ?? null, c.openHour ?? null, c.closeHour ?? null, c.caution ?? null, c.sourceUrl],
      );
    },
  };
}
