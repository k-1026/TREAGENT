import crypto from 'node:crypto';

// 초대 코드: 헷갈리는 글자(0, O, 1, I)를 뺀 32글자 중 8글자. 예측할 수 없게 crypto로 뽑는다.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;
const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

export function generateInviteCode() {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return code;
}

// 사용자가 입력한 코드를 정리한다. 소문자, 공백, 하이픈은 허용하고 모양이 틀리면 null.
export function normalizeInviteCode(input) {
  if (typeof input !== 'string') return null;
  const code = input.trim().toUpperCase().replace(/[\s-]/g, '');
  return CODE_PATTERN.test(code) ? code : null;
}