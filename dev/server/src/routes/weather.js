import { Router } from 'express';

// 숫자이고 한국 부근 범위 안인지 검사한다. 문자열 "35.8"은 숫자가 아니므로 거부한다.
// [확인 필요] 범위는 한반도를 넉넉히 덮는 값으로 정했다.
function isValidCoordinate(latitude, longitude) {
  return (
    typeof latitude === 'number' && Number.isFinite(latitude) &&
    typeof longitude === 'number' && Number.isFinite(longitude) &&
    latitude >= 33 && latitude <= 39 &&
    longitude >= 124 && longitude <= 132
  );
}

// weatherService를 받아서 /weather 라우터를 만든다.
export function createWeatherRouter(weatherService) {
  const router = Router();

  // POST /weather  본문: { "latitude": 35.87, "longitude": 128.60 }
  // 좌표는 쿼리스트링이 아니라 본문으로만 받는다 (주소는 로그에 남기 때문).
  router.post('/', async (req, res) => {
    // 본문이 아예 없으면 req.body가 undefined라서 ?? {} 로 빈 객체로 바꾼다.
    const { latitude, longitude } = req.body ?? {};

    if (!isValidCoordinate(latitude, longitude)) {
      // 입력값을 되돌려 주지 않고 고정된 코드만 보낸다.
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }

    // Express 5는 async 함수에서 난 예외를 자동으로 에러 처리기로 넘긴다.
    const result = await weatherService.getWeather({ latitude, longitude });
    res.json(result);
  });

  return router;
}