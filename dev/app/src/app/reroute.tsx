/*
 * [reroute.tsx] 경로 변경 S-07 (주소: /reroute?sit=사유) — 홈의 경로 변경 알림 띠로 연다.
 * 목업: storyboard/reroute_mockup_v1.html
 *
 * 보이는 것: 안내 띠 → 하랑이 말풍선(스프라이트) → 선택 버튼 → "제안만 해요" 안내
 *  - 바뀐 이유 카드는 뺐다. 하랑이 대사가 같은 내용을 말하고, 카드 속 설명 줄은 기획 메모라 이용자에게 보이지 않아야 한다.
 *
 * 사유(sit): closed 장소 휴관, heat 폭염특보, storm 호우·낙뢰, wind 날씨 변화, crowd 혼잡, off 위치 이탈, none 대체 길 없음
 *  - 사유가 없으면 wind로 보인다 [확인 필요: 실제 사유는 서버가 LOCATION_DEVIATION / WEATHER_CHANGE 등 코드로 알려 줘야 한다]
 *  - heat에서 ?indoor=0이면 "실내 길 없음" (목업의 체크 상자)
 *
 * 아직 연결하지 않은 것
 *  - 대체 길로 바꾸기: 경로 버전 번호 확인이 필요한 서버 기능이다 (dev 절대 규칙 5). 지금은 준비 중(/soon)으로 보낸다.
 *  - 쉼터 버튼: 쉼터 화면은 만들지 않기로 해서 목업의 [쉼터 보기]는 넣지 않았다 (2026-11-24 팀 결정)
 *  - 하랑이 대사: 목업의 초안이다. 승인 전 [확인 필요], 문구는 창작 항목이라 팀이 정한다.
 * 하랑이는 제안만 한다. 이용자가 고르기 전에는 경로가 바뀌지 않고, 도장과 방문 기록은 그대로 남는다.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { WxButton } from '../components/weather_ui';
import { COLOR, pxBox } from '../lib/theme';

type Sit = 'closed' | 'heat' | 'storm' | 'wind' | 'crowd' | 'off' | 'none';
type Tone = 'warn' | 'storm' | 'ok' | 'grey';
type Act = { label: string; primary?: boolean; go: 'soon' | 'travel' | 'home' };

const HARA = require('../../assets/harangi_reroute_v1.webp');

const TONE: Record<Tone, { bg: string; fg: string }> = {
  warn: { bg: '#ffe1d6', fg: COLOR.redDark },
  storm: { bg: '#dfe7f0', fg: '#2f4a6b' },
  ok: { bg: '#e4ecd9', fg: '#2e4a1f' },
  grey: { bg: '#e6e1da', fg: COLOR.ink },
};

const LATER: Act = { label: '나중에 이어하기', go: 'home' }; // 장부에 접어 두고 홈으로 (목업 5-10)

const SITS: Record<Sit, { tone: Tone; banner: string; quote: string; acts: Act[] }> = {
  closed: {
    tone: 'warn', banner: '운영 상태가 바뀌었어요',
    quote: '엇, [스팟]이 오늘 문을 닫았대요! 바로 옆 [대체 스팟]은 열려 있어요. 그쪽으로 갈까요?',
    acts: [{ label: '대체 길로 계속', primary: true, go: 'soon' }, LATER],
  },
  heat: {
    tone: 'warn', banner: '폭염특보 · [기준 시각] 기준',
    quote: '으아, 폭염특보가 떴어요! [기준 시각] 기준이에요. 바깥 길은 멈출게요.',
    acts: [{ label: '실내 길로 계속', primary: true, go: 'soon' }, LATER],
  },
  storm: {
    tone: 'storm', banner: '호우·낙뢰 · 신규 이동 보류',
    quote: '으악, 밖에 나가면 안 돼요! 이건 양보 못 해요!',
    acts: [LATER],
  },
  wind: {
    tone: 'ok', banner: '날씨가 바뀌었어요',
    quote: '엇, 바람이 바뀌었어요! 이쪽 그늘 길이 더 맞아요. 바꿔 볼까요?',
    acts: [{ label: '대체 길로 계속', primary: true, go: 'soon' }, { label: '원래대로 계속', go: 'travel' }, LATER],
  },
  crowd: {
    tone: 'ok', banner: '사람이 많아요',
    quote: '여기 사람이 너무 많대요! 조금 돌아서 갈까요?',
    acts: [{ label: '대체 길로 계속', primary: true, go: 'soon' }, { label: '원래대로 계속', go: 'travel' }, LATER],
  },
  off: {
    tone: 'grey', banner: '길에서 조금 벗어났어요',
    quote: '어라, 길이 달라졌네요! 괜찮아요, 다시 찾아볼까요?',
    acts: [{ label: '원래 길로 돌아가기', primary: true, go: 'travel' }, { label: '여기서 길 다시 짜기', go: 'soon' }],
  },
  none: {
    tone: 'grey', banner: '오늘은 이어 갈 길이 없어요',
    quote: '으악, 오늘은 이어 갈 길이 없어요... 이건 양보 못 해요!',
    acts: [{ label: '다시 확인', primary: true, go: 'soon' }, LATER],
  },
};

const isSit = (v: unknown): v is Sit => typeof v === 'string' && v in SITS;

export default function RerouteScreen() {
  const params = useLocalSearchParams<{ sit?: string; indoor?: string }>();
  const sit: Sit = isSit(params.sit) ? params.sit : 'wind';
  const d = SITS[sit];
  // 폭염에서 실내 길이 없으면 첫 버튼(실내 길)을 뺀다 (목업)
  const noIndoor = sit === 'heat' && params.indoor === '0';
  const banner = noIndoor ? '폭염특보 · 실내 길 없음' : d.banner;
  const acts = noIndoor ? d.acts.slice(1) : d.acts;
  const tone = TONE[d.tone];

  const press = (a: Act) => {
    if (a.go === 'travel') router.replace('/travel');
    else if (a.go === 'home') router.replace('/');
    else router.push({ pathname: '/soon', params: { what: a.label } });
  };

  return (
    <View style={styles.safe}>
      <ScreenHead title="경로 변경" backLabel="‹ 뒤로" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={[CONTENT, styles.scroll]}>
        <View style={[styles.banner, { backgroundColor: tone.bg }]}>
          <Text style={[styles.bannerText, { color: tone.fg }]}>{banner}</Text>
        </View>

        {/* 하랑이 스프라이트 + 말풍선 (말풍선 꼬리는 스프라이트 쪽을 가리킨다) */}
        <View style={styles.haraRow}>
          <Image source={HARA} style={styles.haraImg} resizeMode="contain" />
          <View style={styles.bubble}>
            <View style={styles.tail} />
            <Text style={styles.haraText}>{d.quote}</Text>
          </View>
        </View>

        <View style={{ gap: 12 }}>
          {acts.map((a) => (
            <WxButton key={a.label} label={a.label} primary={a.primary} onPress={() => press(a)} />
          ))}
        </View>

        <Text style={styles.foot}>
          하랑이는 제안만 해요. 이용자가 고르기 전에는 경로가 바뀌지 않아요. 도장과 방문 기록은 그대로 남아요.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  // 내용 묶음을 머리글 아래 빈 공간의 세로 가운데에 둔다 (화면이 짧으면 스크롤 없이 가운데 정렬로 보인다)
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16, paddingHorizontal: 18, gap: 14 },
  banner: { paddingVertical: 14, paddingHorizontal: 16, ...pxBox() },
  bannerText: { fontSize: 16, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
  haraRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  haraImg: { width: 140, height: 140 },
  bubble: { ...pxBox(COLOR.paper), flex: 1, paddingVertical: 12, paddingHorizontal: 14 },
  // 말풍선 꼬리: 왼쪽 아래 두 변만 테두리를 그린 정사각형을 45도 돌린 모양
  tail: {
    position: 'absolute',
    left: -7,
    top: 22,
    width: 12,
    height: 12,
    backgroundColor: COLOR.paper,
    borderLeftWidth: 2.5,
    borderBottomWidth: 2.5,
    borderColor: COLOR.ink,
    transform: [{ rotate: '45deg' }],
  },
  haraText: { fontSize: 15, lineHeight: 24, color: COLOR.ink, textAlign: 'center' },
  foot: { fontSize: 13, lineHeight: 20, color: COLOR.muted, textAlign: 'center' },
});
