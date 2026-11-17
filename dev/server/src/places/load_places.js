// 서버가 쓰는 이름(camelCase)으로 SQL에서 바로 바꿔 온다. 좌표·주소는 읽지 않는다.
import pg from 'pg';

// 서버가 쓰는 이름(camelCase)으로 SQL에서 바로 바꿔 온다. 좌표·주소는 읽지 않는다.
// place_mode_fit(장소×모드 적합도)을 한 행으로 합쳐서 fit 객체로 가져온다.
//   fit 예: { EXPLORE: { fit: 'good', estimated: false }, SHADE: { ... } }
const SQL = `
  select p.id, p.name, p.district, p.type,
         p.role,
         p.permission_state as "permissionState",
         p.mode_allowed     as "modeAllowed",
         p.open_hour        as "openHour",
         p.close_hour       as "closeHour",
         p.closed_weekdays  as "closedWeekdays",
         p.hours_text       as "hoursText",
         p.closed_text      as "closedText",
         p.caution,
         p.status,
         coalesce(
           jsonb_object_agg(f.mode, jsonb_build_object('fit', f.fit, 'estimated', f.is_estimated))
             filter (where f.mode is not null),
           '{}'::jsonb
         ) as fit
  from public.places p
  left join public.place_mode_fit f on f.place_id = p.id
  group by p.id
  order by p.id`;

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