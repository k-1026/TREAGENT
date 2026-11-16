// 날씨 어댑터 설정값 모음. 값이 바뀌면 이 파일만 고친다.
// [확인 필요] 표시가 붙은 값은 기상청 활용가이드로 아직 확인하지 못했다.
// 확인한 것: 포털 페이지(https://www.data.go.kr/data/15084084/openapi.do)에는
// 요청 파라미터와 응답 코드 00(정상)만 있고, 아래 값들은 없었다.
export const WEATHER_CONFIG = {
  // [확인 필요] 기상청 단기예보 서비스 주소와 오퍼레이션 이름
  baseUrl: 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0',
  operation: 'getVilageFcst',

  // [확인 필요] 단기예보 발표 시각(시). 발표 직후엔 자료가 아직 없을 수 있어 지연 분을 둔다.
  baseHours: [2, 5, 8, 11, 14, 17, 20, 23],
  publishDelayMinutes: 10,

  // 호출 한 번의 제한 시간(밀리초)
  timeoutMs: 5000,
  // 재시도 횟수(처음 호출 제외), 대기 시간(1초, 2초...)과 무작위 보탬(0~250ms)
  maxRetries: 2,
  retryBaseDelayMs: 1000,
  retryJitterMs: 250,

  // 한 번에 받을 행 수. [확인 필요] 한 발표분 전체를 받기에 충분한지
  numOfRows: 1000,

  // 캐시: 성공은 발표 주기(3시간) 안에서만 재사용, 실패는 짧게만 기억해 호출 폭주를 막는다.
  successTtlMs: 3 * 60 * 60 * 1000,
  failureTtlMs: 20 * 1000,

  // [확인 필요] 응답 코드 분류. 모르는 코드는 재시도 없이 "확인 불가"로 처리한다.
  resultCodes: {
    ok: ['00'],
    retryable: ['22'], // 호출 횟수 초과로 알려져 있으나 [미검증]
    noData: ['03'], // 데이터 없음 [미검증]
  },
};