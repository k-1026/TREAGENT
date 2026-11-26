// 코스 설계 도구. 모두 읽기 전용이고 장소 id로만 말한다. 좌표는 돌려주지 않는다 (절대 규칙 1, 3).
// [확인 필요] LangGraph tool calling 반복은 설치 버전 문서 확인 전이라, 지금은 코드가 도구를 부른 결과를 연구자 프롬프트에 넣는 방식이다.

const FACT_KEYS = ['type', 'zone', 'hoursText', 'closedText', 'caution', 'stairs', 'slope', 'restSpots', 'eduFit'];

// 줄바꿈과 겹친 공백을 한 칸으로 줄인다 (DB 문구가 지시문처럼 줄을 바꿔 들어오는 것을 막는다).
export const clean = (value) => String(value).replace(/\s+/g, ' ').trim();

// 장소 한 곳의 값이 있는 항목만 돌려준다 (없는 사실을 지어내지 않게 빈 항목은 뺀다).
export function getPlaceFacts(candidates, placeId) {
  const place = candidates.find((p) => p.id === placeId);
  if (!place) return { error: 'NOT_CANDIDATE' };
  const facts = { id: place.id, name: clean(place.name) };
  for (const key of FACT_KEYS) {
    const v = place[key];
    if (v != null && v !== '') facts[key] = clean(v);
  }
  return facts;
}

export const listCandidates = (candidates) => candidates.map((p) => getPlaceFacts(candidates, p.id));

// 웹 검색 자리. 이번 단계에서는 연결하지 않는다 (마지막 단계에서 연결).
export const webSearch = async () => ({ error: 'NOT_CONFIGURED' });
