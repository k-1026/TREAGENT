import { createPgQuery } from '../places/load_places.js';

// 코스와 경로를 한 번에 읽는다. 경로가 없는 코스도 나오도록 left join.
const SQL = `
  select c.id, c.title, c.theme, c.district,
         c.duration_min      as "durationMin",
         r.type              as "routeType",
         r.ordered_place_ids as "orderedPlaceIds"
  from public.courses c
  left join public.course_routes r on r.course_id = c.id
  where c.published
  order by c.id, r.type`;

// 행(코스×경로)을 코스별로 묶는다: { id, title, ..., routes: { explore: [...], indoor: [...] } }
export function groupCourses(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        title: row.title,
        theme: row.theme,
        district: row.district,
        durationMin: row.durationMin,
        routes: {},
      });
    }
    if (row.routeType) byId.get(row.id).routes[row.routeType] = row.orderedPlaceIds;
  }
  return [...byId.values()];
}

export function createCourseLoader({ query, ttlMs = 5 * 60 * 1000, now = () => Date.now() } = {}) {
  let cache = null; // { at, courses }
  return async function loadCourses() {
    if (cache && now() - cache.at < ttlMs) return { ok: true, courses: cache.courses };
    try {
      const run = query ?? (query = createPgQuery());
      const courses = groupCourses(await run(SQL));
      cache = { at: now(), courses };
      return { ok: true, courses };
    } catch {
      // 에러 내용(접속 정보 가능)은 숨기고 코드만 돌려준다.
      return { ok: false, reason: 'COURSES_UNAVAILABLE' };
    }
  };
}