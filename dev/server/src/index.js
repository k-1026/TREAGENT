/*
 * [index.js] 서버 시작점 (npm start가 실행하는 파일)
 *
 * 역할
 *  - .env의 PORT로 서버를 연다. 값이 없으면 3000.
 *  - 0.0.0.0으로 열어서 같은 Wi-Fi의 휴대폰에서도 접속할 수 있게 한다.
 *  - 휴대폰에서 열어 볼 주소를 터미널에 안내한다.
 */
import os from 'node:os';
import { createApp } from './app.js';

const port = Number(process.env.PORT) || 3000;

// 이 컴퓨터의 Wi-Fi/랜 주소(IPv4) 목록. 앱의 EXPO_PUBLIC_SERVER_URL에 쓸 값을 찾는 용도.
function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

createApp().listen(port, '0.0.0.0', () => {
  console.log(`서버 시작: http://localhost:${port}/health`);
  for (const ip of lanAddresses()) {
    console.log(`휴대폰에서 확인: http://${ip}:${port}/health`);
  }
});
