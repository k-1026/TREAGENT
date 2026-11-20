import { ViewStyle } from 'react-native';

export const COLOR = {
  ink: '#5b2a22',
  cream: '#fbefdc',
  cream2: '#f3dfc0',
  beam: '#c9763a',
  red: '#dc3b30',
  redDark: '#9c2420',
  sage: '#9fb58a',
  sageInk: '#2d3d22',
  paper: '#fffaf1',
  muted: '#8a6a5c',
  shade: '#d9bf98',
  yellow: '#fff0b8',
  blue: '#bcd3e6',
  blueInk: '#27425a',
} as const;

// 목업의 .px: 잉크색 테두리 + 아래쪽 그림자
export function pxBox(fill: string = COLOR.paper, shade: string = COLOR.shade): ViewStyle {
  return {
    backgroundColor: fill,
    borderWidth: 3,
    borderColor: COLOR.ink,
    borderBottomWidth: 6,
    borderBottomColor: shade,
  };
}