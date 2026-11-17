// 규칙 엔진 설정표. 숫자와 모드 이름을 한곳에 모아 두어서, 값을 바꿀 때 이 파일만 고치면 된다.
// (결정 ④: 설정은 코드 상수로 둔다. 나중에 DB로 옮기려면 이 객체만 바꿔 끼우면 된다.)

// 모드 코드 (결정 ⑦). 문자열 상수라서 오타를 막으려고 객체로 묶어 둔다.
export const MODES = Object.freeze({
  EXPLORE: 'EXPLORE', // 걷기 좋은 날씨: 야외 탐험 길
  SHADE: 'SHADE', // 더운 날씨: 그늘·짧은 이동 위주
  INDOOR: 'INDOOR', // 매우 더운 날씨: 실내 위주
  SAFETY: 'SAFETY', // 폭염특보 등 안전 우선: 야외 이동 자제 안내
  HOLD: 'HOLD', // 위험 상황: 추천을 멈추고 대기
  UNKNOWN: 'UNKNOWN', // 날씨를 못 얻음: 판정하지 않음
});

export const RULE_CONFIG = Object.freeze({
  // [확인 필요] 28℃, 33℃는 임시 값이다 (결정 ①). 근거 확정 전까지 바꿀 수 있다 (D-06).
  shadeFromC: 28, // 이 온도 이상이면 SHADE
  indoorFromC: 33, // 이 온도 이상이면 INDOOR
  // 경계에서 모드가 깜박이지 않게 하는 폭 (결정 ③, 히스테리시스).
  // 한 번 올라간 모드는 경계값에서 이 폭만큼 더 내려가야 풀린다.
  hysteresisC: 1.0,
  // 데모용 폭염특보 강제 켜기 (결정 ⑤). 실제 특보 API는 [확인 필요]라서 아직 연결하지 않는다.
  // 환경변수 DEMO_ALERT=1 이면 폭염특보가 있는 것처럼 판정한다.
  demoAlert: process.env.DEMO_ALERT === '1',
});


export const MODE_ALLOWED_TYPES = Object.freeze({
  [MODES.EXPLORE]: ['outdoor', 'shade', 'indoor', 'exhibit'],
  [MODES.SHADE]: ['shade', 'indoor', 'exhibit'],
  [MODES.INDOOR]: ['indoor', 'exhibit'],
  [MODES.SAFETY]: ['indoor', 'exhibit'],
  [MODES.UNKNOWN]: ['indoor', 'exhibit'],
  [MODES.HOLD]: [],
})