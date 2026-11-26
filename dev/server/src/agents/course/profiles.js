import { AgentError } from '../common/errors.js';

// 테마별 연구자 프로필. 틀 하나에 프로필을 끼운다. 테마가 늘면 항목만 추가한다 (course_agent_design_v1.md 9장).
// focus: 연구자가 우선 보는 장소 항목 (장소 객체의 키). instruction: 연구자에게 주는 지시.
export const PROFILES = Object.freeze({
  history: {
    focus: ['hoursText', 'caution', 'eduFit'],
    instruction: '운영 시간, 주의사항, 교육 정보를 우선 봅니다. 목록에 없는 사연이나 유래는 쓰지 않습니다.',
  },
  culture: {
    focus: ['hoursText', 'type', 'closedText'],
    instruction: '운영 시간, 장소 유형, 휴관 안내를 우선 봅니다.',
  },
  nature: {
    focus: ['stairs', 'slope', 'restSpots'],
    instruction: '계단, 경사, 쉴 곳을 우선 봅니다. 그늘이나 실내 대안이 있는지 봅니다.',
  },
});

// 테마 관문(코드): 테마로 프로필 하나를 고른다. 모르는 테마면 에이전트를 쓰지 않는다.
export function pickProfile(theme) {
  if (!Object.hasOwn(PROFILES, theme ?? '')) throw new AgentError('THEME_UNSUPPORTED');
  return { theme, ...PROFILES[theme] };
}
