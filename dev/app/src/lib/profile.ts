import type { ProfileData } from './server_api';

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 10;
export const DEFAULT_NICKNAME = '길동무';

// 서버 profile_rules.js, DB create_profiles.sql과 같은 규칙이다. 한쪽을 바꾸면 모두 바꾼다. [확인 필요]
const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9_]{2,10}$/;

// 화면에 부를 이름. 닉네임이 없으면 "길동무"
export function displayName(p: ProfileData | null): string {
  return p?.nickname ?? DEFAULT_NICKNAME;
}

// 입력한 닉네임 검사. 비어 있으면 건너뛰기로 보고 null
export function checkNickname(raw: string): { ok: true; value: string | null } | { ok: false } {
  const t = raw.normalize('NFC').trim();
  if (t.length === 0) return { ok: true, value: null };
  if (!NICKNAME_PATTERN.test(t)) return { ok: false };
  return { ok: true, value: t };
}