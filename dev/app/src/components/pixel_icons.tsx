/*
 * [pixel_icons.tsx] 한 가지 색 도트 아이콘 (홈 목업 storyboard/app_home_mockup_v1.html의 .qi, .ic 모양을 칸으로 옮김)
 *
 * 들어 있는 것
 *  - 빠른 버튼 아이콘: 모든 길(줄 목록), 주머니 (쉼터 아이콘은 쉼터를 만들지 않기로 해서 뺐다)
 *  - 하단 탭 아이콘: 홈(집), 장부(펼친 책), 내 정보(사람)
 *
 * 그림 규칙: 글자 하나 = 칸 하나, 'K' = 칠하는 칸, '.' = 빈 칸. 색은 tint로 정한다.
 * 쓰는 곳: 홈 화면(app/index.tsx), 하단 탭(bottom_tab.tsx)
 */
import { PixelSprite } from './pixel_book';

const ICONS = {
  // 모든 길: 가로줄 세 개
  list: ['KKKKKKKKKK', 'KKKKKKKKKK', '..........', 'KKKKKKKKKK', 'KKKKKKKKKK', '..........', 'KKKKKKKKKK', 'KKKKKKKKKK', '..........'],
  // 주머니: 묶은 입구 + 둥근 몸통
  pouch: ['...KKKK...', '....KK....', '...KKKK...', '.KKKKKKKK.', 'KKKKKKKKKK', 'KKKKKKKKKK', 'KKKKKKKKKK', '.KKKKKKKK.', '..KKKKKK..'],
  // 홈: 집
  home: ['.....K.....', '....KKK....', '...KKKKK...', '..KKKKKKK..', '.KKKKKKKKK.', 'KKKKKKKKKKK', '.KKKKKKKKK.', '.KKK...KKK.', '.KKK...KKK.', '.KKK...KKK.'],
  // 장부: 펼친 책
  book: ['KKKKK.KKKKK', 'KKKKKKKKKKK', 'KKKKKKKKKKK', 'KKKKKKKKKKK', 'KKKKKKKKKKK', 'KKKKKKKKKKK', 'KKKKKKKKKKK', 'KKKKKKKKKKK', 'KKKKK.KKKKK', '.....K.....'],
  // 내 정보: 사람
  me: ['...KKKKK...', '..KKKKKKK..', '..KKKKKKK..', '...KKKKK...', '....KKK....', '.KKKKKKKKK.', 'KKKKKKKKKKK', 'KKKKKKKKKKK', 'KKKKKKKKKKK', 'KKKKKKKKKKK'],
} as const;

export type PixelIconName = keyof typeof ICONS;

export function PixelIcon({ name, color, cell = 2 }: { name: PixelIconName; color: string; cell?: number }) {
  return <PixelSprite grid={[...ICONS[name]]} cell={cell} tint={color} />;
}
