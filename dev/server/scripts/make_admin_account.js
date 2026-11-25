// 관리자 화면(/admin) 로그인 계정을 만든다. 아이디와 비밀번호를 묻고, 서버 변수에 넣을 값 3줄을 화면에 출력한다.
//   사용: dev/server 폴더에서  node scripts/make_admin_account.js
// 비밀번호는 입력창에서만 받는다 (명령줄 인자나 파일에 남기지 않는다). 출력되는 것은 해시이고 비밀번호 원문이 아니다.
// 출력한 값은 Railway Variables(또는 로컬 .env)에 붙여 넣는다. 이 파일을 실행한 화면 기록은 저장소에 올리지 않는다.
import crypto from 'node:crypto';
import readline from 'node:readline';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../src/admin/admin_session.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
let muted = false;
const realWrite = rl._writeToOutput?.bind(rl);
if (realWrite) rl._writeToOutput = (text) => { if (!muted) realWrite(text); };

// 입력 줄을 순서대로 받는다 (한꺼번에 붙여 넣어도 줄을 놓치지 않게 큐에 쌓는다)
const queued = [];
const waiting = [];
rl.on('line', (line) => (waiting.length > 0 ? waiting.shift()(line) : queued.push(line)));

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    muted = hidden && Boolean(process.stdin.isTTY);
    const done = (line) => {
      muted = false;
      if (hidden && process.stdin.isTTY) process.stdout.write('\n');
      resolve(line);
    };
    if (queued.length > 0) done(queued.shift());
    else waiting.push(done);
  });
}

const username = (await ask('관리자 아이디: ')).trim();
if (username.length < 3) {
  console.error('아이디는 3자 이상이어야 합니다.');
  process.exit(1);
}
const password = await ask(`비밀번호 (${MIN_PASSWORD_LENGTH}자 이상): `, { hidden: true });
const again = await ask('비밀번호 다시 입력: ', { hidden: true });
rl.close();

if (password !== again) {
  console.error('두 번 입력한 비밀번호가 다릅니다.');
  process.exit(1);
}
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`);
  process.exit(1);
}

console.log('\n아래 3줄을 서버 변수(Railway Variables 또는 dev/server/.env)에 넣으세요. 비밀 값이니 GitHub에 올리지 않습니다.\n');
console.log(`ADMIN_USERNAME=${username}`);
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
console.log(`ADMIN_SESSION_SECRET=${crypto.randomBytes(32).toString('base64url')}`);
console.log('\n비밀번호를 바꾸려면 이 스크립트를 다시 실행해 ADMIN_PASSWORD_HASH를 바꿉니다. ADMIN_SESSION_SECRET을 바꾸면 지금 로그인한 사람이 모두 로그아웃됩니다.');
