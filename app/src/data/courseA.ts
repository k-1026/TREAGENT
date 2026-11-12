// 코스 A "사라진 대구의 비밀 레시피" 데모 데이터
// 근거: plan/daeprica_hidden_quest_plan.md 5-1장 (흐름), 4-2장 (실내 우선·야외 15분 이하)
// 대사·미션 문구는 창작 (후보 확정 전 데모용). 운영시간·위치 등은 [확인 필요].

export type Weather = 'normal' | 'hot';

export interface Station {
  id: string;
  name: string;
  indoor: boolean;
  clue: string; // 하랑이 대사 (창작)
  mission: string; // 미션 (창작)
  note: string; // 확인 필요 표시
}

export const course = {
  title: '사라진 대구의 비밀 레시피',
  subtitle: '중구 · 30분',
  story: '옛 약재와 음식 레시피가 골목에서 사라졌어요.',
};

export const stations: Record<string, Station> = {
  dongseongro: {
    id: 'dongseongro',
    name: '동성로',
    indoor: false,
    clue: '한 입만 먼저 찾아볼까요? 첫 단서는 이 거리 어딘가에 있어요.',
    mission: '간판 중 약재나 음식과 관련된 글자 하나를 찾아보세요.',
    note: '[확인 필요] 단서 위치',
  },
  geunDae: {
    id: 'geunDae',
    name: '근대골목',
    indoor: false,
    clue: '오래된 골목은 이야기를 조용히 들고 있어요.',
    mission: '골목에서 가장 오래돼 보이는 벽이나 문을 하나 골라 보세요.',
    note: '[확인 필요] 야외 구간 길이',
  },
  yangnyeongsi: {
    id: 'yangnyeongsi',
    name: '약령시 박물관',
    indoor: true,
    clue: '빨갛게 익을 때까지 기다려 봐요. 시원한 곳에서 단서를 정리해요.',
    mission: '전시에서 약재 이름 하나를 골라 이름을 적어 보세요.',
    note: '[확인 필요] 운영시간·휴관일',
  },
  seomun: {
    id: 'seomun',
    name: '서문시장',
    indoor: true,
    clue: '마지막 조각은 시장 안에 있어요. 조금만 더 가요.',
    mission: '모은 단서 3개를 맞춰 레시피 이름을 완성해 보세요.',
    note: '[확인 필요] 운영시간',
  },
};

// 날씨별 경로. 폭염: 실내(약령시)를 먼저, 야외 구간(근대골목) 제외 [추정]
export const routes: Record<Weather, string[]> = {
  normal: ['dongseongro', 'geunDae', 'yangnyeongsi', 'seomun'],
  hot: ['yangnyeongsi', 'dongseongro', 'seomun'],
};

export const weatherLabel: Record<Weather, { title: string; desc: string }> = {
  normal: { title: '맑고 선선해요', desc: '기본 경로로 4곳을 돌아요.' },
  hot: { title: '너무 더워요', desc: '실내를 먼저, 야외는 줄인 3곳 경로예요.' },
};
