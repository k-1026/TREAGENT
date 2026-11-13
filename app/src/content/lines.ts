// 하랑이 말투의 임시 문구. 창작이며 CON 확인 전이다 (spec F-13, 7-3 표에서 승인 대사로 교체 예정).
// 톤: 짧고 가볍게, 담백하게, 과장 없이 (brand-daeprica 스킬). 사용자 탓을 하지 않는다 (15-3 장면별 톤).
// 승인 대사 테이블(approved_lines)이 연결되면 이 파일은 조회 실패 시 기본 대사로만 쓴다.

export const authLines = {
  welcome: '하랑이예요. 먼저 길동무로 들어올 수 있게 로그인해 주세요.',
  setupNeeded: '아직 서버 연결 정보가 없어요. 앱의 .env 설정을 먼저 확인해 주세요.',
  emailInvalid: '이메일 주소를 다시 확인해 주세요.',
  passwordShort: '비밀번호는 6자 이상으로 적어 주세요.',
  signInFailed: '이메일이나 비밀번호가 맞지 않아요. 다시 한 번 확인해 주세요.',
  emailNotConfirmed: '메일 확인이 아직 안 됐어요. 받은 편지함에서 확인 링크를 눌러 주세요.',
  alreadyRegistered: '이미 가입된 이메일이에요. 로그인으로 들어와 주세요.',
  weakPassword: '비밀번호를 조금 더 길게 적어 주세요.',
  rateLimited: '요청이 잠시 몰렸어요. 잠깐 뒤에 다시 시도해 주세요.',
  signUpDisabled: '지금은 새로 가입할 수 없어요.',
  network: '연결이 불안정해요. 네트워크를 확인하고 다시 시도해 주세요.',
  unknown: '잠깐 문제가 생겼어요. 다시 시도해 주세요.',
  confirmMail: '가입 메일을 보냈어요. 확인 링크를 누른 뒤 로그인해 주세요.',
};

export const homeLines = {
  greeting: (name: string) => `${name}, 오늘도 같이 걸어요.`,
  defaultName: '길동무', // 닉네임이 없으면 ‘길동무’ (spec F-02)
};
