import { AGE_GROUPS } from '../ai/route_options.js';

// 일행 설정. [확인 필요] 값은 임시이며 팀이 정한다.
export const PARTY_MAX_MEMBERS = 6;
export const PARTY_TTL_MS = 24 * 60 * 60 * 1000; // 일행(과 초대 코드)이 유효한 시간
export const JOIN_LIMIT = Object.freeze({ max: 10, windowMs: 10 * 60 * 1000 }); // 초대 코드 참여 시도 제한 (코드 무작정 대입 방지)
export const PARTY_REFRESH_LIMIT = 5; // 일행이 한 모드에서 새로고침할 수 있는 최대 횟수 (AI 호출과 무료 한도를 아끼기 위해)

// 일행의 나이대들 중 가장 엄격한 기준(가장 높은 나이대)을 고른다. 접근성 기준을 가장 조심해야 하는 쪽에 맞추기 위해서다.
// 유효한 나이대가 없으면 undefined.
export function strictestAge(ageGroups) {
  let best = -1;
  for (const age of ageGroups) {
    best = Math.max(best, AGE_GROUPS.indexOf(age));
  }
  return best === -1 ? undefined : AGE_GROUPS[best];
}

// 일행이 만료되었는지. expiresAt은 Date나 날짜 문자열.
export function isExpired(party, nowMs) {
  return new Date(party.expiresAt).getTime() <= nowMs;
}