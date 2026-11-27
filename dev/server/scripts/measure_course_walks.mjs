// 코스 후보(dev/supabase/inputs/course_candidates_v1.csv)의 경로마다 T맵 도보 거리·시간을 잰다. DB에는 쓰지 않는다.
// 실행: node --env-file=.env scripts/measure_course_walks.mjs            (전체)
//       node --env-file=.env scripts/measure_course_walks.mjs H01 K03    (일부 코스만)
// 필요: .env의 TMAP_APP_KEY, DATABASE_URL (장소 좌표를 읽는다)
// 결과: dev/supabase/inputs/course_walks_tmap_v1.csv (코스, 경로 종류, 구간별 거리 m·시간 분, 합계)
// 좌표는 장소의 좌표다. 사용자 좌표가 아니다 (절대 규칙 1).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPgQuery } from '../src/places/load_places.js';
import { getWalkingRoute } from '../src/tmap/pedestrian.js';

const INPUTS = fileURLToPath(new URL('../../supabase/inputs/', import.meta.url));
const TYPES = ['explore', 'shade', 'indoor'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 따옴표로 감싼 CSV 한 줄을 나눈다 (course_candidates_v1.csv는 모든 칸이 따옴표 안에 있다).
function parseCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
  const split = (line) => [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replaceAll('""', '"'));
  const header = split(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(split(line).map((v, i) => [header[i], v])));
}

if (!process.env.TMAP_APP_KEY) {
  console.error('TMAP_APP_KEY가 .env에 없습니다. 키를 넣은 뒤 다시 실행하세요.');
  process.exit(1);
}

const only = new Set(process.argv.slice(2));
const courses = parseCsv(readFileSync(INPUTS + 'course_candidates_v1.csv', 'utf8'))
  .filter((c) => only.size === 0 || only.has(c.course_id));

const query = createPgQuery();
const coords = new Map((await query('select id, lat, lng from public.places where lat is not null and lng is not null'))
  .map((p) => [p.id, { lat: Number(p.lat), lng: Number(p.lng) }]));
// DB에 아직 없는 장소 추가안의 좌표도 쓴다 (DB 값이 있으면 DB 값을 우선).
for (const a of parseCsv(readFileSync(INPUTS + 'place_additions_input_v1.csv', 'utf8'))) {
  if (!coords.has(a.id) && a.lat && a.lng) coords.set(a.id, { lat: Number(a.lat), lng: Number(a.lng) });
}

const out = [['course_id', 'route_type', 'place_ids', 'leg_m', 'leg_min', 'total_m', 'total_min', 'error']];
for (const c of courses) {
  for (const type of TYPES) {
    const ids = (c[`${type}_route`] ?? '').split(' > ').filter(Boolean);
    if (ids.length < 2) continue;
    const pts = ids.map((id) => coords.get(id));
    let row;
    if (pts.some((p) => !p)) {
      row = [c.course_id, type, ids.join(' '), '', '', '', '', 'NO_COORD'];
    } else {
      try {
        const r = await getWalkingRoute(pts[0], pts[pts.length - 1], pts.slice(1, -1));
        const legs = r.legs.map((l) => Math.round(l.distance)).join(' / ');
        const mins = r.legs.map((l) => Math.round(l.time / 60)).join(' / ');
        row = [c.course_id, type, ids.join(' '), legs, mins, Math.round(r.distance), Math.round(r.time / 60), ''];
      } catch (e) {
        row = [c.course_id, type, ids.join(' '), '', '', '', '', e.message];
      }
      await sleep(300); // 연속 호출을 조금 늦춘다
    }
    console.log(row.join(' | '));
    out.push(row);
  }
}
writeFileSync(INPUTS + 'course_walks_tmap_v1.csv', '﻿' + out.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n');
console.log(`저장: dev/supabase/inputs/course_walks_tmap_v1.csv (${out.length - 1}줄)`);
process.exit(0); // DB 연결 풀이 열려 있어서 직접 끝낸다
