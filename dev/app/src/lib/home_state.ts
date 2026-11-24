/*
 * [home_state.ts] 홈 화면 상태표 — 목업 storyboard/app_home_mockup_v1.html의 상태 8종(var S, TIPS)을 옮김
 *
 * 상태마다 바뀌는 것: 방 그림, 날씨 배지(글·색), 말풍선, 큰 버튼(글·이동할 곳), 아래 알림 띠, 오늘 챙길 것
 * 문구는 모두 목업의 자리표시 그대로다 ([임시], [대사 자리] 등). 확정 문구는 팀이 정한다 [창작, 승인 필요].
 *
 * 앱이 실제로 판정하는 상태 (pickHomeState)
 *  - 날씨를 읽음 → none(진행 여행 없음)
 *  - 날씨를 못 읽음(서버 unavailable, 연결 실패) → unknown(날씨 확인 불가)
 * 데이터가 없어 판정하지 않는 상태 (개발 중 미리보기 ?state=이름 으로만 볼 수 있음)
 *  - active, notice: 진행 중인 여행이 저장되지 않음 [확인 필요: 여행 세션 저장 PR]
 *  - heat, storm: 특보 자료가 없음 [확인 필요: 특보 연동]
 *  - outside: 중구 경계 판정 기준이 없음 [확인 필요]
 *  - empty: 오늘의 길을 불러오기 전에는 알 수 없음
 */
import type { ImageSourcePropType } from 'react-native';

export type HomeStateKey = 'none' | 'active' | 'notice' | 'heat' | 'storm' | 'unknown' | 'outside' | 'empty';

export const HOME_STATE_KEYS: HomeStateKey[] = ['none', 'active', 'notice', 'heat', 'storm', 'unknown', 'outside', 'empty'];

// 큰 버튼과 알림 띠를 눌렀을 때 갈 곳. 아직 화면이 없는 곳은 홈에서 준비 중(/soon)으로 보낸다.
// go가 없으면 누르는 버튼이 아니라 안내 문구만 보인다 (쉼터 화면은 만들지 않기로 해서 폭염·호우·확인 불가가 이렇게 보인다, 2026-11-24 팀 결정).
export type HomeGo = 'today' | 'travel' | 'courses' | 'reroute' | 'region';

// 배지 색 (목업 .warn / .storm / .grey)
export type BadgeTone = 'normal' | 'warn' | 'storm' | 'grey';

export type HomeState = {
  room: 'day' | 'heat' | 'storm';
  tone: BadgeTone;
  // 배지 첫 줄. {temp}는 실제 기온 또는 [○]로 바뀐다 (live가 true인 상태만)
  badgeMain: string;
  // 배지 둘째 줄. {area}는 지역 이름, {base}는 기준 시각으로 바뀐다
  badgeSub: string;
  live: boolean; // 실제 날씨 값을 배지에 넣는 상태인가
  bubble: string; // {name}은 닉네임으로 바뀐다
  bubbleAlert: boolean; // 말풍선 아래 빨간 점선 줄 "오늘 비어 있는 장소가 있어요"
  cta: { title: string; sub?: string; go?: HomeGo };
  banner?: { kind: 'note' | 'warn'; text: string; go?: HomeGo };
  tips: string[];
};

export const HOME_STATES: Record<HomeStateKey, HomeState> = {
  none: {
    room: 'day', tone: 'normal', live: true,
    badgeMain: '기온 {temp}℃ · 체감 [○]℃', badgeSub: '{area} · {base} 기준 ▾',
    bubble: '{name} 님, [대사 자리]', bubbleAlert: true,
    cta: { title: '오늘의 길 고르기', sub: '날씨에 맞는 길을 찾아봐요 [임시]', go: 'today' },
    tips: ['생수', '운동화', '겉옷'],
  },
  active: {
    room: 'day', tone: 'normal', live: true,
    badgeMain: '기온 {temp}℃ · 체감 [○]℃', badgeSub: '{area} · {base} 기준 ▾',
    bubble: '{name} 님, [출발 준비 대사]', bubbleAlert: false,
    cta: { title: '이어하기', sub: '다음: [장소명] · 3곳 중 2곳 [임시]', go: 'travel' },
    tips: ['생수', '운동화', '겉옷'],
  },
  notice: {
    room: 'day', tone: 'normal', live: true,
    badgeMain: '기온 {temp}℃ · 체감 [○]℃', badgeSub: '{area} · {base} 기준 ▾',
    bubble: '{name} 님, [경로 변경 대사]', bubbleAlert: false,
    cta: { title: '이어하기', sub: '다음: [장소명] · 3곳 중 2곳 [임시]', go: 'travel' },
    banner: { kind: 'note', text: '경로가 바뀌었어요 [임시 문구] · 눌러서 확인', go: 'reroute' },
    tips: ['경로가 바뀌었어요', '생수', '운동화'],
  },
  heat: {
    room: 'heat', tone: 'warn', live: false,
    badgeMain: '폭염특보 · 체감 [○]℃', badgeSub: '{area} · [기준 시각] 기준 · [AWS 여부] ▾',
    bubble: '{name} 님, [쉬어 가는 대사]', bubbleAlert: false,
    cta: { title: '야외 길 안내를 멈췄어요 [임시]' },
    banner: { kind: 'warn', text: '[기준 시각] 기준 · 야외 안내 중단' },
    tips: ['생수', '캡모자', '쿨토시'],
  },
  storm: {
    room: 'storm', tone: 'storm', live: false,
    badgeMain: '호우 · 강수 [○]mm', badgeSub: '{area} · [기준 시각] 기준 ▾',
    bubble: '{name} 님, [안전 대사]', bubbleAlert: false,
    cta: { title: '신규 이동을 보류했어요 [임시]' },
    banner: { kind: 'warn', text: '[기준 시각] 기준 · 야외 코스 숨김 · 신규 이동 보류' },
    tips: ['우산', '여벌 양말', '운동화'],
  },
  unknown: {
    room: 'day', tone: 'grey', live: false,
    badgeMain: '날씨를 불러오지 못했어요', badgeSub: '{area} · 확인 중 ▾',
    bubble: '{name} 님, [확인 불가 대사]', bubbleAlert: false,
    cta: { title: '날씨를 확인할 수 없어 길을 권하지 않아요 [임시]' },
    tips: ['날씨를 확인하지 못했어요'],
  },
  outside: {
    room: 'day', tone: 'normal', live: true,
    badgeMain: '기온 {temp}℃ · 체감 [○]℃', badgeSub: '중구 밖 · 지금은 중구만 안내 ▾',
    bubble: '{name} 님, [중구 안내 대사]', bubbleAlert: false,
    cta: { title: '중구 코스 둘러보기', sub: '지금은 중구만 안내해요 [임시]', go: 'courses' },
    banner: { kind: 'note', text: '지금 계신 곳은 중구가 아니에요. 중구 코스를 안내해요 [임시 문구]', go: 'region' },
    tips: ['운동화', '생수', '캡모자'],
  },
  empty: {
    room: 'day', tone: 'normal', live: true,
    badgeMain: '기온 {temp}℃ · 체감 [○]℃', badgeSub: '{area} · {base} 기준 ▾',
    bubble: '{name} 님, [갸웃 대사]', bubbleAlert: false,
    cta: { title: '오늘의 길 고르기', sub: '날씨에 맞는 길을 찾아봐요 [임시]', go: 'today' },
    tips: ['오늘은 안내할 길이 없어요. 내일 다시 확인해요.'],
  },
};

// 방 그림 (목업 BG: 폭염·호우만 다른 그림)
export const ROOM_IMAGE: Record<HomeState['room'], ImageSourcePropType> = {
  day: require('../../assets/home_room_day_v2.webp'),
  heat: require('../../assets/home_room_heat_v1.webp'),
  storm: require('../../assets/home_room_storm_v1.webp'),
};

// 준비물 아이콘 (목업 ICON). 아이콘이 없는 항목은 글만 보인다 (예: "경로가 바뀌었어요")
export const TIP_ICON: Record<string, ImageSourcePropType> = {
  생수: require('../../assets/item_water_v1.png'),
  운동화: require('../../assets/item_sneakers_v1.png'),
  겉옷: require('../../assets/item_jacket_v1.png'),
  캡모자: require('../../assets/item_cap_v1.png'),
  쿨토시: require('../../assets/item_sleeves_v1.png'),
  우산: require('../../assets/item_umbrella_v1.png'),
  '여벌 양말': require('../../assets/item_socks_v1.png'),
};

// 배지 색 (목업 .badge 바탕 / 그림자 / 동그라미)
export const BADGE_TONE: Record<BadgeTone, { bg: string; shade: string; dot: string }> = {
  normal: { bg: '#fbefdc', shade: '#b98d62', dot: '#f5b82e' },
  warn: { bg: '#ffe1d6', shade: '#c58a7a', dot: '#d03a2f' },
  storm: { bg: '#dfe7f0', shade: '#8fa3b8', dot: '#2f4a6b' },
  grey: { bg: '#fbefdc', shade: '#b98d62', dot: '#b9b2a8' },
};

// 실제로 판정하는 상태. 지금은 날씨를 읽었는지만 본다 (위 설명 참고).
export function pickHomeState(weather: 'loading' | 'ok' | 'unavailable'): HomeStateKey {
  return weather === 'unavailable' ? 'unknown' : 'none';
}

export function isHomeStateKey(v: unknown): v is HomeStateKey {
  return typeof v === 'string' && (HOME_STATE_KEYS as string[]).includes(v);
}
