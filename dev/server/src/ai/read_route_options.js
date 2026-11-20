import {
  AGE_GROUPS,
  THEMES,
  COMPANIONS,
  VARIANTS,
  DEFAULT_VARIANT,
  ZONES,
} from './route_options.js';

// 값이 없거나(undefined) 허용 목록 안에 있으면 통과.
const okOrMissing = (list, value) => value === undefined || list.includes(value);

// 요청 본문에서 선택 입력을 읽는다. 허용 목록 밖의 값이면 null (호출한 쪽에서 400을 돌려준다).
export function readRouteOptions(body) {
  const { ageGroup, theme, companion, zone, variant } = body;
  if (
    !okOrMissing(AGE_GROUPS, ageGroup) ||
    !okOrMissing(THEMES, theme) ||
    !okOrMissing(COMPANIONS, companion) ||
    !okOrMissing(ZONES, zone) ||
    !okOrMissing(VARIANTS, variant)
  ) {
    return null;
  }
  return { ageGroup, theme, companion, zone, variant: variant ?? DEFAULT_VARIANT };
}