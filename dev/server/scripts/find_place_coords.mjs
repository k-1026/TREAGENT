// 장소 이름으로 TMAP 장소 검색(POI)을 해서 좌표 후보를 보여 준다. DB에는 쓰지 않는다.
// 실행: node --env-file=.env scripts/find_place_coords.mjs        (전체)
//       node --env-file=.env scripts/find_place_coords.mjs J01    (한 곳)
import { createPgQuery } from '../src/places/load_places.js';

const KEY = process.env.TMAP_APP_KEY;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// "약전골목 (약령시 거리)" → "약전골목" : 괄호 설명은 검색에 방해가 된다
const clean = (name) => name.replace(/\s*[(（].*?[)）]\s*/g, ' ').trim();
const fix = (v) => Number(v).toFixed(6);

async function search(keyword) {
  const url = 'https://apis.openapi.sk.com/tmap/pois?' + new URLSearchParams({
    version: '1', searchKeyword: keyword, count: '10',
    reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
  });
  const res = await fetch(url, {
    headers: { appKey: KEY, Accept: 'application/json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  const json = await res.json();
  return json.searchPoiInfo?.pois?.poi ?? [];
}

const query = createPgQuery();
const only = process.argv[2];
const places = (await query('select id, name from public.places order by id'))
  .filter((p) => !only || p.id === only);

for (const p of places) {
  console.log(`\n${p.id} ${p.name}`);
  try {
    const found = (await search(clean(p.name)))
      .filter((x) => (x.upperAddrName ?? '').includes('대구')) // 대구만
      .slice(0, 3);
    if (found.length === 0) console.log('  (후보 없음 → 직접 조사)');
    found.forEach((x, i) => {
      const addr = [x.upperAddrName, x.middleAddrName, x.lowerAddrName, x.roadName].filter(Boolean).join(' ');
      console.log(`  ${i + 1}) ${x.name} | ${addr}`);
      console.log(`     중심 ${fix(x.noorLat)}, ${fix(x.noorLon)} | 입구 ${fix(x.frontLat)}, ${fix(x.frontLon)}`);
    });
  } catch (e) {
    console.log(`  오류: ${e.message}`);
  }
  await sleep(200); // 연속 호출을 조금 늦춘다
}
process.exit(0); // DB 연결 풀이 열려 있어서 직접 끝낸다