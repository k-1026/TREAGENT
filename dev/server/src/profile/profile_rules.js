import { AGE_GROUPS } from '../ai/route_options.js';

// create_profiles.sql의 check와 같은 규칙이다. 한쪽을 바꾸면 다른 쪽도 바꾼다. [확인 필요]
export const NICKNAME_PATTERN = /^[가-힣A-Za-z0-9_]{2,10}$/;

// 본문 { nickname?, ageGroup }을 검사한다. 이상하면 null.
// 닉네임이 없거나 비어 있으면 nickname은 null(건너뛰기)이다.
export function readProfileInput(body) {
  const { nickname, ageGroup } = body ?? {};
  if (!AGE_GROUPS.includes(ageGroup)) return null;
  if (nickname === undefined || nickname === null) return { nickname: null, ageGroup };
  if (typeof nickname !== 'string') return null;
  const t = nickname.normalize('NFC').trim();
  if (t === '') return { nickname: null, ageGroup };
  if (!NICKNAME_PATTERN.test(t)) return null;
  return { nickname: t, ageGroup };
}

// 닉네임 한 개만 검사한다(중복 확인용). 규칙에 맞으면 다듬은 값, 아니면 null.
export function readNicknameOnly(body) {
  const { nickname } = body ?? {};
  if (typeof nickname !== 'string') return null;
  const t = nickname.normalize('NFC').trim();
  return NICKNAME_PATTERN.test(t) ? t : null;
}