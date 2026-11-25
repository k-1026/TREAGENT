import { createHmac } from 'node:crypto';

// 이용자 연결 키: 계정 id를 서버 비밀값으로 해시한 값. 원본 계정 id는 어디에도 저장하지 않는다.
//   같은 이용자 + 같은 비밀값 → 항상 같은 키. 관리자가 유저를 입력하면 서버가 같은 방식으로 계산해서 찾는다.
//   비밀값이 없으면 null을 돌려준다 (원본 id로 대신하지 않는다 → 이용자 연결 없이 기록).
//   비밀값을 바꾸면 이전 기록과의 연결이 끊어진다. 키는 서버 .env와 Railway Variables에만 둔다.
//   [결정 필요] 해시 키도 개인정보로 볼지는 팀이 확인한다.
export function createActorKey({ secret }) {
  return function actorKey(userId) {
    if (!secret || !userId) return null;
    return createHmac('sha256', secret).update(String(userId)).digest('hex');
  };
}

// 환경 변수 RUN_KEY_SECRET에서 만든다. 없으면 항상 null을 돌려주는 함수가 된다.
export function createActorKeyFromEnv(env = process.env) {
  return createActorKey({ secret: env.RUN_KEY_SECRET });
}
