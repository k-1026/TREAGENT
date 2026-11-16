// 기상청 격자 변환에 쓰는 기준값 (한반도를 5km 격자로 나눈 규칙)
const RE = 6371.00877; // 지구 반지름 (km)
const GRID = 5.0; // 격자 간격 (km)
const SLAT1 = 30.0; // 투영 기준 위도 1 (도)
const SLAT2 = 60.0; // 투영 기준 위도 2 (도)
const OLON = 126.0; // 기준점 경도 (도)
const OLAT = 38.0; // 기준점 위도 (도)
const XO = 43; // 기준점의 격자 X 번호
const YO = 136; // 기준점의 격자 Y 번호

// 위도(lat), 경도(lon)를 받아서 { nx, ny }를 돌려준다.
export function toGrid(lat, lon) {
  // 도(degree)를 라디안으로 바꾸는 값 (삼각함수는 라디안을 쓴다)
  const DEGRAD = Math.PI / 180;

  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  // 아래 계산은 투영 공식의 "상수 부분"이다. 입력 좌표와 상관없이 같은 값이 나온다.
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  // 여기부터가 입력 좌표를 쓰는 계산이다.
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lon * DEGRAD - olon;
  // 각도를 -180도~180도 범위로 맞춘다.
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  // 결과를 반올림해서 정수 격자 번호로 만든다. (+0.5 후 내림 = 반올림)
  const nx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
  const ny = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
  return { nx, ny };
}