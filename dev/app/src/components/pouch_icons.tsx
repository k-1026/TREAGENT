/*
 * [pouch_icons.tsx] 주머니 물건 아이콘 16x16 (홈 목업 주머니의 svg 사각형 값을 칸으로 옮김)
 *
 * 들어 있는 것: 열쇠(pixel_book의 PixelKey), 손수건, 배지, 인증서
 * 목업의 기울어진 면(polygon)은 칸 모양이 비슷해지도록 사각형 여러 개로 나눠 옮겼다.
 * 글자 뜻: K 잉크, C 크림, t 연한 갈색, r 빨강, d 진한 빨강, g 초록
 */
import { fromRects, PixelKey, PixelSprite } from './pixel_book';

const ITEM_PALETTE = {
  C: '#fbefdc',
  t: '#e3cba5',
  r: '#dc3b30',
  d: '#9c2420',
  g: '#6d9a58',
};

// 손수건: 빨간 테두리 무늬 + 접힌 모서리
const HANDKERCHIEF = fromRects(16, 16, [
  [2, 3, 12, 11, 'K'],
  [3, 4, 10, 9, 'C'],
  [4, 5, 8, 1, 'r'],
  [4, 11, 8, 1, 'r'],
  [4, 5, 1, 7, 'r'],
  [11, 5, 1, 7, 'r'],
  [6, 7, 4, 3, 't'],
  [10, 3, 4, 4, 'K'],
  [10, 4, 3, 1, 't'],
  [11, 5, 2, 1, 't'],
  [12, 6, 1, 1, 't'],
  [13, 3, 1, 4, 'K'],
]);

// 배지: 팔각형 빨간 메달 + 리본 두 줄
const BADGE = fromRects(16, 16, [
  [4, 11, 3, 5, 'K'],
  [5, 11, 1, 4, 'd'],
  [9, 11, 3, 5, 'K'],
  [10, 11, 1, 4, 'd'],
  // 바깥 팔각형 (잉크)
  [5, 0, 6, 1, 'K'],
  [4, 1, 8, 1, 'K'],
  [3, 2, 10, 1, 'K'],
  [2, 3, 12, 7, 'K'],
  [3, 10, 10, 1, 'K'],
  [5, 11, 6, 1, 'K'],
  // 안쪽 팔각형 (빨강)
  [5, 1, 6, 1, 'r'],
  [4, 2, 8, 1, 'r'],
  [3, 3, 10, 7, 'r'],
  [4, 10, 8, 1, 'r'],
  [6, 4, 4, 5, 'C'],
  [7, 5, 2, 3, 'r'],
  [8, 3, 2, 1, 'g'],
]);

// 인증서: 글줄이 있는 종이 + 빨간 도장 리본
const CERTIFICATE = fromRects(16, 16, [
  [1, 2, 14, 11, 'K'],
  [2, 3, 12, 9, 'C'],
  [3, 4, 10, 1, 't'],
  [3, 6, 10, 1, 't'],
  [3, 8, 5, 1, 't'],
  [9, 8, 5, 5, 'K'],
  [10, 9, 3, 3, 'r'],
  [10, 13, 1, 3, 'K'],
  [10, 13, 1, 2, 'd'],
  [12, 13, 1, 3, 'K'],
  [12, 13, 1, 2, 'd'],
]);

export type PouchItem = 'key' | 'handkerchief' | 'badge' | 'certificate';

// cell 3 → 48px (목업 .ico 48px)
export function PouchIcon({ name, cell = 3 }: { name: PouchItem; cell?: number }) {
  if (name === 'key') return <PixelKey cell={cell} />;
  const grid = name === 'handkerchief' ? HANDKERCHIEF : name === 'badge' ? BADGE : CERTIFICATE;
  return <PixelSprite grid={grid} cell={cell} palette={ITEM_PALETTE} />;
}
