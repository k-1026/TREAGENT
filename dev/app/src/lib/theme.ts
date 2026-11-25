import { ViewStyle } from 'react-native';

// 색 값은 목업(storyboard/app_home_mockup_v1.html, 2026-11-24 갱신본)을 따른다.
//  - beam  #b9682f → #a85a24 (홈 목업 갱신본 값). 흰 글씨 대비 약 5.1로 4.5 기준을 넘는다 (WCAG 식으로 직접 계산)
//  - red   #dc3b30 → #d03a2f (contrast_compare_v1 후보 B). 흰 글씨 대비 4.46 → 4.85
//  - muted #8a6a5c → #7a5a4c (contrast_compare_v1 후보 D). 크림 바탕 대비 4.30 → 5.44
export const COLOR = {
  ink: '#5b2a22',
  cream: '#fbefdc',
  cream2: '#f3dfc0',
  beam: '#a85a24',
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

// 목업의 .px 칸 모양 (홈 목업 갱신본): 모서리 6px 둥글게, 잉크색 1.5px 테두리, 아래로 4px 그림자.
// 그림자 색은 칸마다 다르다 (빨간 버튼은 진한 빨강, 나머지는 shade). 2026-11-24 팀원 요청으로 새 목업 모양을 따름.
export function pxBox(fill: string = COLOR.paper, shade: string = COLOR.shade): ViewStyle {
  return {
    backgroundColor: fill,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLOR.ink,
    boxShadow: `0px 4px 0px 0px ${shade}`,
  };
}

// 버튼 빨강. 이제 앱 전체 빨강(COLOR.red)과 같은 값이다. 기존 코드가 쓰고 있어 이름은 남겨 둔다.
export const BTN_RED = COLOR.red;
