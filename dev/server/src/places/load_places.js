import pg from 'pg';

// 서버가 쓰는 이름(camelCase)으로 SQL에서 바로 바꿔 온다. 주소와 사용자 좌표는 다루지 않는다.
// 장소의 좌표(lat, lng)는 방문 순서를 계산하는 데만 쓰고, 응답에는 내보내지 않는다.
// place_mode_fit(장소×모드 적합도)을 한 행으로 합쳐서 fit 객체로 가져온다.
//   fit 예: { EXPLORE: { fit: 'good', estimated: false }, SHADE: { ... } }
const columns = (extra) => `
  p.id, p.name, p.district, p.type,
  p.role,
  p.lat, p.lng,
  p.permission_state as "permissionState",
  p.mode_allowed     as "modeAllowed",
  p.open_hour        as "openHour",
  p.close_hour       as "closeHour",
  p.closed_weekdays  as "closedWeekdays",
  p.hours_text       as "hoursText",
  p.closed_text      as "closedText",
  p.caution,
  p.status,${extra}
  coalesce(
    jsonb_object_agg(f.mode, jsonb_build_object('fit', f.fit, 'estimated', f.is_estimated))
      filter (where f.mode is not null),
    '{}'::jsonb
  ) as fit`;

const buildSql = (extra) => `
  select ${columns(extra)}
  from public.places p
  left join public.place_mode_fit f on f.place_id = p.id
  group by p.id
  order by p.id`;

// 새 열(권역, 걷는 순서, 계단, 경사, 쉴 곳, 교육 적합도). alter_places_access.sql을 실행한 DB에만 있다.
const SQL_WITH_ACCESS = buildSql(`
  p.zone,
  p.route_order      as "routeOrder",
  p.stairs,
  p.slope,
  p.rest_spots       as "restSpots",
  p.edu_fit          as "eduFit",`);

// 새 열이 아직 없는 DB를 위한 기본 SQL.
const SQL_BASE = buildSql('');

// 실제 DB로 쿼리를 보내는 함수. DATABASE_URL은 .env에서만 읽는다.
export function createPgQuery(connectionString = process.env.DATABASE_URL) {
  const pool = new pg.Pool({ connectionString, max: 2 });
    return async (text, params) => (await pool.query(text, params)).rows;
}

// 장소 목록을 읽어 잠깐 기억해 두는 로더. 테스트에서는 query에 가짜 함수를 넣는다.
// 새 열 SQL이 실패하면(열이 아직 없는 DB) 기본 SQL로 다시 읽는다. 그때는 새 열 값이 비어 있다(모름으로 취급).
export function createPlaceLoader({ query, ttlMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {
  let cache = null; // { at, places }
  return async function loadPlaces() {
    if (cache && now() - cache.at < ttlMs) return { ok: true, places: cache.places };
    try {
      const run = query ?? (query = createPgQuery());
      let places;
      try {
        places = await run(SQL_WITH_ACCESS);
      } catch {
        places = await run(SQL_BASE);
      }
      cache = { at: now(), places };
      return { ok: true, places };
    } catch {
      // 에러 내용에 접속 정보가 들어갈 수 있어서 출력하지 않고 코드만 돌려준다. 추측하지 않는다.
      return { ok: false, reason: 'PLACES_UNAVAILABLE' };
    }
  };
}