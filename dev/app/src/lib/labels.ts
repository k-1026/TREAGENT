// 화면에 보여 줄 임시 한글 문구. 하랑이 대사와 사유 문장은 [승인 대사 대기]라서 승인되면 바꾼다.

export const TYPE_LABEL: Record<string, string> = {
  outdoor: '야외',
  shade: '그늘',
  indoor: '실내',
  exhibit: '전시',
};

export const MODE_LABEL: Record<string, string> = {
  EXPLORE: '걷기 좋은 날씨',
  SHADE: '그늘 위주',
  INDOOR: '실내 위주',
  SAFETY: '안전 우선',
  HOLD: '이동 보류',
  UNKNOWN: '날씨 확인 불가',
};

// 서버의 route.reason 코드 → 문구
export const REASON_LABEL: Record<string, string> = {
  OK: '오늘 갈 수 있는 길이에요',
  PLACE_CLOSED: '지금 문을 닫은 곳이 있어요',
  PLACE_MISSING: '장소 정보를 확인할 수 없어요',
  NO_ROUTE: '오늘 날씨에 맞는 길이 아직 없어요',
  SAFETY: '안전을 위해 야외 길 안내를 멈췄어요',
  HOLD: '지금은 이동을 쉬어 가요',
  WEATHER_UNAVAILABLE: '날씨를 확인할 수 없어요',
  MODE_NO_ROUTE: '오늘 맞는 길이 아직 없어요',
};

// 통신 오류 종류 → 문구
export const ERROR_LABEL: Record<string, string> = {
  NO_SERVER_URL: '서버 주소가 설정되지 않았어요 (.env 확인)',
  NETWORK: '서버에 연결하지 못했어요',
  TIMEOUT: '서버 응답이 늦어요',
  UNAVAILABLE: '지금 정보를 읽지 못했어요. 잠시 뒤 다시 해 주세요',
  NOT_FOUND: '코스를 찾을 수 없어요',
  INVALID: '요청이 올바르지 않아요',
  SERVER: '서버에 문제가 있어요',
};