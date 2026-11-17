import pg from 'pg';

// 서버가 쓰는 이름(camelCase)으로 SQL에서 바로 바꿔 온다. 좌표·주소는 읽지 않는다.
const SQL = `
  select id, name, district, type,
         mode_allowed    as "modeAllowed",
         open_hour       as "openHour",
         close_hour      as "closeHour",
         closed_weekdays as "closedWeekdays",
         hours_text      as "hoursText",
         closed_text     as "closedText",
         caution,
         status
  from public.places
  order by id`;
// 실제 DB로 쿼리를 보내는 함수. DATABASE_URL은 .env에서만 읽는다.
export function createPgQuery(connectionString = process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString, max: 2 });
  return async (text) => (await pool.query(text)).rows;
}

// 장소 목록을 읽어 잠깐 기억해 두는 로더. 테스트에서는 query에 가짜 함수를 넣는다.
export function createPlaceLoader({ query, ttlMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {
  let cache = null; // { at, places }
  return async function loadPlaces() {
    if (cache && now() - cache.at < ttlMs) return { ok: true, places: cache.places };
    try {
      const run = query ?? (query = createPgQuery());
      const places = await run(SQL);
      cache = { at: now(), places };
      return { ok: true, places };
    } catch {
      // 에러 내용에 접속 정보가 들어갈 수 있어서 출력하지 않고 코드만 돌려준다. 추측하지 않는다.
      return { ok: false, reason: 'PLACES_UNAVAILABLE' };
    }
  };
}