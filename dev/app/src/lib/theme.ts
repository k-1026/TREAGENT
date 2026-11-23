import { ViewStyle } from 'react-native';

// 색 값은 목업(storyboard/app_login_region_mockup_v1.html)을 따른다.
// 대비가 모자란 세 색은 storyboard/contrast_compare_v1.html의 권장값으로 바꿨다.
//  - beam  #c9763a → #b9682f (후보 A). 주황 위 작은 글씨 대비 3.12 → 3.77. 아직 4.5 미달 [결정 필요: 글씨 크기 또는 글씨 색]
//  - red   #dc3b30 → #d03a2f (후보 B). 흰 글씨 대비 4.46 → 4.85
//  - muted #8a6a5c → #7a5a4c (후보 D). 크림 바탕 대비 4.30 → 5.44
export const COLOR = {
  ink: '#5b2a22',
  cream: '#fbefdc',
  cream2: '#f3dfc0',
  beam: '#b9682f',
  red: '#d03a2f',
  redDark: '#9c2420',
  sage: '#9fb58a',
  sageInk: '#2d3d22',
  paper: '#fffaf1',
  muted: '#7a5a4c',
  shade: '#d9bf98',
  yellow: '#fff0b8',
  blue: '#bcd3e6',
  blueInk: '#27425a',
} as const;

// 목업의 .px 테두리. 네 변 모두 같은 잉크색 3px 선으로 통일한다 (2026-11-23 요청: 아래쪽만 다른 색·두께 선을 없앰).
// shade 인자는 예전 호출(pxBox(색, 그림자색))과 맞추려고 남겨 두었고, 지금은 쓰지 않는다.
export function pxBox(fill: string = COLOR.paper, shade: string = COLOR.shade): ViewStyle {
  return {
    backgroundColor: fill,
    borderWidth: 3,
    borderColor: COLOR.ink,
  };
}

// 버튼 빨강. 이제 앱 전체 빨강(COLOR.red)과 같은 값이다. 기존 코드가 쓰고 있어 이름은 남겨 둔다.
export const BTN_RED = COLOR.red;
