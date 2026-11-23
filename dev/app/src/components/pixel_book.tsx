/*
 * [pixel_book.tsx] 도트 그림 (임시 도형) — 장부
 *
 * 역할
 *  - 목업(storyboard/app_login_region_mockup_v1.html)의 장부 그림과 능금 그림을 View 칸으로 그린다.
 *  - 그림 파일과 새 라이브러리를 쓰지 않는다.
 *  - 그림은 글자 격자(문자 하나 = 칸 하나)로 적는다. 같은 색이 가로로 이어지면 한 줄로 합쳐 그린다.
 *
 * 글자 뜻 (PALETTE)
 *  K 잉크 테두리   R 장부 표지   D 장부 책등   L 장부 밝은 선   C 장부 자물쇠 크림   H 장부 밝은 면 (쓰이지 않음)
 *  P 능금 빨강     Q 능금 밝은 빨강   E 능금 어두운 빨강   W 능금 반사빛
 *  S 꼭지          G 잎 초록          V 잎 줄기 (진한 초록)
 *  Y 열쇠 금색     F 열쇠 구멍 종이색  . 빈 칸
 *
 * 능금은 이 파일이 아니라 assets/apple_pixel.png 그림을 쓴다.
 * 쓰는 곳: 타이틀(title.tsx), 로그인·가입 헤더(auth_ui.tsx), 로그인 성공 열쇠 연출(key_overlay.tsx)
 */
import { StyleSheet, View } from 'react-native';
import { COLOR } from '../lib/theme';

const PALETTE: Record<string, string> = {
  K: COLOR.ink,
  R: '#a33a2b',
  D: '#7a2a20',
  L: '#f3dfc0',
  C: COLOR.cream,
  H: COLOR.cream,
  P: '#e53b2f',
  Q: '#ff6a50',
  E: '#b8222c',
  W: '#fbd8b0',
  S: '#e0703a',
  G: '#8bb83a',
  V: '#5f8f2a',
  Y: '#e8b230',
  F: COLOR.paper,
};

// 칸 하나 = cell(px). 그림의 가로·세로 칸 수는 격자에서 정해진다.
// tint를 주면 빈 칸('.')이 아닌 모든 칸을 그 색 하나로 칠한다 (탭·버튼 아이콘처럼 한 가지 색인 그림)
export function PixelSprite({ grid, cell, tint }: { grid: string[]; cell: number; tint?: string }) {
  const width = grid[0].length * cell;
  const height = grid.length * cell;
  return (
    <View style={{ width, height }}>
      {grid.map((row, y) =>
        runs(row).map((run) => (
          <View
            key={`${y}-${run.x}`}
            style={[
              styles.cell,
              {
                left: run.x * cell,
                top: y * cell,
                width: run.len * cell,
                height: cell,
                backgroundColor: tint ?? PALETTE[run.ch] ?? 'transparent',
              },
            ]}
          />
        )),
      )}
    </View>
  );
}

// 한 줄에서 같은 글자가 이어지는 구간을 찾는다 (빈 칸 '.'은 그리지 않는다)
function runs(row: string) {
  const out: { x: number; len: number; ch: string }[] = [];
  let x = 0;
  while (x < row.length) {
    const ch = row[x];
    let len = 1;
    while (x + len < row.length && row[x + len] === ch) len++;
    if (ch !== '.') out.push({ x, len, ch });
    x += len;
  }
  return out;
}

// 사각형들을 격자에 채운다 (뒤에 오는 사각형이 앞 색을 덮는다)
function fromRects(w: number, h: number, rects: [number, number, number, number, string][]) {
  const g = Array.from({ length: h }, () => Array<string>(w).fill('.'));
  for (const [x, y, rw, rh, ch] of rects) {
    for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) g[yy][xx] = ch;
  }
  return g.map((r) => r.join(''));
}

// 장부 24x30 (목업의 장부 사각형 값 그대로)
const BOOK = fromRects(24, 30, [
  [1, 1, 22, 28, 'K'],
  [2, 2, 20, 26, 'R'],
  [2, 2, 4, 26, 'D'],
  [8, 4, 12, 1, 'L'],
  [8, 25, 12, 1, 'L'],
  [8, 4, 1, 22, 'L'],
  [19, 4, 1, 22, 'L'],
  [10, 7, 3, 1, 'L'],
  [12, 8, 3, 1, 'L'],
  [15, 7, 2, 1, 'L'],
  [11, 12, 4, 4, 'C'],
  [12, 16, 2, 5, 'C'],
  [12, 13, 2, 2, 'K'],
]);

// 장부 그림. cell은 칸 한 개의 크기(px). 장부는 24x30 칸이다.
export function PixelBook({ cell }: { cell: number }) {
  return <PixelSprite grid={BOOK} cell={cell} />;
}

// 열쇠 16x16 (목업 로그인 성공 화면의 열쇠 그림을 칸으로 옮김: 둥근 손잡이 + 몸통 + 이 두 개)
const KEY = fromRects(16, 16, [
  [3, 3, 3, 1, 'K'],
  [2, 4, 5, 1, 'K'],
  [1, 5, 7, 3, 'K'],
  [2, 8, 5, 1, 'K'],
  [3, 9, 3, 1, 'K'],
  [4, 4, 1, 1, 'Y'],
  [3, 5, 3, 1, 'Y'],
  [2, 6, 5, 1, 'Y'],
  [3, 7, 3, 1, 'Y'],
  [4, 8, 1, 1, 'Y'],
  [4, 6, 2, 2, 'F'],
  [8, 5, 7, 4, 'K'],
  [8, 6, 6, 2, 'Y'],
  [10, 9, 2, 4, 'K'],
  [10, 9, 1, 3, 'Y'],
  [13, 9, 2, 3, 'K'],
  [13, 9, 1, 2, 'Y'],
]);

// 열쇠 그림. cell은 칸 한 개의 크기(px). 열쇠는 16x16 칸이다.
export function PixelKey({ cell }: { cell: number }) {
  return <PixelSprite grid={KEY} cell={cell} />;
}

const styles = StyleSheet.create({
  cell: { position: 'absolute' },
});
