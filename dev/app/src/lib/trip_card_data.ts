/*
 * [trip_card_data.ts] 내 여행 카드 예시 자료 — 목업 storyboard/app_home_mockup_v1.html의 TRIPS 그대로
 *
 * 실제 여행 기록(완주 날짜, 장소별 시각·사실, 도장)은 아직 서버에 저장되지 않는다 [확인 필요: 여행 세션·방문 기록 저장 PR].
 * 그래서 이 자료는 개발 중 미리보기에서만 쓴다. 문구는 모두 자리표시이고 하랑이 말은 창작 후보라 팀이 정한다.
 * 카드에는 실제로 방문한 장소와 날짜만 담고 좌표는 담지 않는다 (목업 안내).
 */
export type TripEntry = { t: string; p: string; fact: string; rec: string };
export type Trip = {
  date: string;
  wx: string;
  title: string;
  say: string;
  name: string;
  ents: TripEntry[];
  close: string;
};

const ent = (p: string, fact: string, n: number): TripEntry => ({ t: '[시각]', p, fact, rec: `방문 기록 · 장소 ${n} · [미션 종류]` });

export const SAMPLE_TRIPS: Trip[] = [
  {
    date: '[완주 날짜 1]', wx: '[날씨 한 줄] · [기준 시각]', title: '중구 근대골목 걷기', say: '오늘도 같이 걸어 줘서 고마워요!', name: '[이름]',
    ents: [
      ent('[장소 1 이름]에 도착했어요.', '[사실 1: 그날 보여 준 설명]', 1),
      ent('[장소 2 이름]에서 걸었어요.', '[사실 2: 퀴즈 결과 또는 설명, 범위는 결정 필요]', 2),
      ent('[장소 3 이름]까지 걸었어요.', '[사실 3]', 3),
    ],
    close: '오늘 길은 {이름} 님이랑 걸은 한 장이에요. 다음에도 같이 가요!',
  },
  {
    date: '[완주 날짜 2]', wx: '[날씨 한 줄] · [기준 시각]', title: '중구 약령시 한 바퀴', say: '장부에 한 칸이 또 채워졌어요.', name: '[이름]',
    ents: [ent('[장소 1 이름]에 들렀어요.', '[사실 1]', 1), ent('[장소 2 이름]을 천천히 봤어요.', '[사실 2]', 2), ent('[장소 3 이름]에서 마쳤어요.', '[사실 3]', 3)],
    close: '천천히 걸은 날이었어요. 또 같이 가요!',
  },
  {
    date: '[완주 날짜 3]', wx: '[날씨 한 줄] · [기준 시각]', title: '동성로 한 바퀴', say: '다음 길은 같이 골라 볼까요?', name: '[이름]',
    ents: [ent('[장소 1 이름]에서 출발했어요.', '[사실 1]', 1), ent('[장소 2 이름]에 들렀어요.', '[사실 2]', 2), ent('[장소 3 이름]에서 쉬었어요.', '[사실 3]', 3)],
    close: '다음에 또 걸어요.',
  },
];
