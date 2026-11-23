// 장소 이름으로 TMAP 장소 검색(POI)을 해서 좌표를 찾는다. DB에 좌표가 없는 장소에만 쓴다.
// 결과는 메모리에만 12시간 기억한다 (TMAP 약관: 저장 데이터는 24시간 뒤 사용 불가 [확인 필요]).
const URL = 'https://apis.openapi.sk.com/tmap/pois';
const norm = (s) => String(s ?? '').replace(/[\s()（）·,.\-]/g, '').toLowerCase();

// 검색어 후보: 괄호 설명을 뺀 이름 → '·'로 나눈 각 부분. 예) "이상화·서상돈 고택" → 전체, "이상화", "서상돈 고택"
function keywords(name) {
  const base = name.replace(/\s*[(（].*?[)）]\s*/g, ' ').trim();
  return [...new Set([base, ...base.split('·').map((s) => s.trim())].filter((s) => s.length >= 2))];
}

// 같은 장소인지 판단한다. 대구 안, 같은 구, 이름이 서로 포함, 주차장 제외.
function isSamePlace(poi, place, kw) {
  if (!(poi.upperAddrName ?? '').includes('대구')) return false;
  if (place.district && poi.middleAddrName && poi.middleAddrName !== place.district) return false;
  if (/주차/.test(poi.name) && !kw.includes('주차')) return false;
  const a = norm(poi.name);
  const b = norm(kw);
  return a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a));
}

async function lookup(place) {
  const key = process.env.TMAP_APP_KEY;
  if (!key) throw new Error('TMAP_NOT_CONFIGURED');
  for (const kw of keywords(place.name)) {
    const url = `${URL}?${new URLSearchParams({
      version: '1', searchKeyword: kw, count: '10',
      reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
    })}`;
    const res = await fetch(url, {
      headers: { appKey: key, Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 204) continue; // 결과 없음
    if (!res.ok) throw new Error(`TMAP_HTTP_${res.status}`);
    const pois = (await res.json()).searchPoiInfo?.pois?.poi ?? [];
    const matched = pois
      .filter((poi) => isSamePlace(poi, place, kw))
      .sort((x, y) => Number(norm(x.name) !== norm(kw)) - Number(norm(y.name) !== norm(kw))); // 이름이 똑같은 것을 앞으로
    if (matched[0]) return { lat: Number(matched[0].noorLat), lng: Number(matched[0].noorLon) };
  }
  return null;
}

export function createPoiFinder({ ttlMs = 12 * 60 * 60 * 1000, now = () => Date.now() } = {}) {
  const cache = new Map(); // 장소 id → { at, value }
  return async function findCoord(place) {
    const hit = cache.get(place.id);
    if (hit && now() - hit.at < ttlMs) return hit.value;
    try {
      const value = await lookup(place);
      cache.set(place.id, { at: now(), value }); // "없음"(null)도 기억해서 같은 검색을 되풀이하지 않는다
      return value;
    } catch {
      return null; // 일시 오류는 기억하지 않아서 다음에 다시 시도한다
    }
  };
}