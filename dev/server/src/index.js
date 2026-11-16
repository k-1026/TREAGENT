// 같은 폴더의 app.js에서 createApp 함수를 가져온다.
// './app.js'에서 .js 확장자를 꼭 써야 한다("type": "module" 규칙).
import { createApp } from './app.js';

// 포트(서버의 문 번호)를 정한다.
// process.env.PORT는 환경변수 값이고 항상 글자로 온다. Number()로 숫자로 바꾼다.
// 값이 없거나 숫자가 아니면 || 뒤의 3000을 쓴다.
const port = Number(process.env.PORT) || 3000;

// 서버를 만들고 포트를 열어 요청을 기다린다.
// '0.0.0.0'은 같은 Wi-Fi의 다른 기기(휴대폰)도 접속할 수 있게 하는 주소다.
// 'localhost'만 쓰면 이 컴퓨터에서만 열린다.
createApp().listen(port, '0.0.0.0', () => {
  // 서버가 켜진 직후 한 번 실행되어 접속 주소를 알려 준다.
  console.log(`서버 시작: http://localhost:${port}/health`);
});