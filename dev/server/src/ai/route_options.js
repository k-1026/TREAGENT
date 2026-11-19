// 사용자가 고를 수 있는 선택지와 길 이름 단어 목록. 값은 전부 [확인 필요] 임시 값이다.
// 바꿀 때는 이 파일만 고치면 된다. (값은 서버 내부 코드, 화면 이름은 *_LABELS)

export const AGE_GROUPS = Object.freeze(['10s', '20s', '30s', '40s', '50s', '60s']);
export const AGE_LABELS = Object.freeze({
  '10s': '10대', '20s': '20대', '30s': '30대', '40s': '40대', '50s': '50대', '60s': '60대 이상',
});

// 테마 후보 A (역사·문화·자연). 팀 확정 전.
export const THEMES = Object.freeze(['history', 'culture', 'nature']);
export const THEME_LABELS = Object.freeze({ history: '역사', culture: '문화', nature: '자연' });

// 동행. 'kids'(아이와 함께)만 사용자가 정한 값이고 나머지는 임시다.
export const COMPANIONS = Object.freeze(['solo', 'friends', 'kids']);
export const COMPANION_LABELS = Object.freeze({ solo: '혼자', friends: '친구와', kids: '아이와 함께' });

// 추천 방식. B: 연령 → 권역 기본 순서(기본값), C: 연령 → 장소 점수만(권역 순서 없음). [미검증] 권역 표 초안 기준.
export const VARIANTS = Object.freeze(['B', 'C']);
export const DEFAULT_VARIANT = 'B';

// 권역. [미검증] 이름·경계·개수는 팀이 확정한다. "서문·약령시권"과 "서문시장권"은 겹치는지 확인이 필요하다.
export const ZONES = Object.freeze([
  'dongseongro', // 동성로·중앙권
  'gyodong', // 교동·북성로권
  'daebong', // 대봉·봉산 문화권
  'seomun_yangnyeong', // 서문·약령시권
  'namsan', // 남산권
  'seomun_market', // 서문시장권
]);
export const ZONE_LABELS = Object.freeze({
  dongseongro: '동성로·중앙권',
  gyodong: '교동·북성로권',
  daebong: '대봉·봉산 문화권',
  seomun_yangnyeong: '서문·약령시권',
  namsan: '남산권',
  seomun_market: '서문시장권',
});

// variant B의 나이대별 기본 권역 순서 (앞쪽일수록 먼저). [미검증] 임시 가정. 이유는 근거 자료로 바꿔 갈 것.
export const ZONE_ORDER_BY_AGE = Object.freeze({
  '10s': ['dongseongro', 'gyodong', 'daebong', 'seomun_yangnyeong', 'namsan', 'seomun_market'], // [확인 필요] 표에 없음
  '20s': ['dongseongro', 'gyodong'],
  '30s': ['dongseongro', 'gyodong'],
  '40s': ['daebong', 'seomun_yangnyeong'],
  '50s': ['daebong', 'seomun_yangnyeong'],
  '60s': ['namsan', 'seomun_market'],
});

// 이름 틀 B: "{날씨말} {키워드}길". 날씨말은 코드가 모드로 정한다. (창작 임시값)
export const WEATHER_WORDS = Object.freeze({
  EXPLORE: '맑은날',
  SHADE: '그늘',
  INDOOR: '실내',
});

// 테마별 키워드. AI는 이 목록 안에서만 고른다. history는 seed_courses.sql의 코스 제목 후보에서 가져왔다. (창작 임시값)
export const KEYWORDS = Object.freeze({
  history: ['근대골목', '약령시'],
  culture: ['문화', '전시'],
  nature: ['초록', '숲'],
});