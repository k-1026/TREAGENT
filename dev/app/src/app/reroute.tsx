/*
 * [reroute.tsx] 경로 변경 S-07 (주소: /reroute?sit=사유) — 홈의 경로 변경 알림 띠로 연다.
 * 목업: storyboard/reroute_mockup_v1.html
 *
 * 보이는 것: 안내 띠 → 바뀐 이유 카드 → 하랑이 한마디 → 선택 버튼 → "제안만 해요" 안내
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
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { WxButton, WxCard, wxText } from '../components/weather_ui';
import { COLOR, pxBox } from '../lib/theme';

type Sit = 'closed' | 'heat' | 'storm' | 'wind' | 'crowd' | 'off' | 'none';
type Tone = 'warn' | 'storm' | 'ok' | 'grey';
type Act = { label: string; primary?: boolean; go: 'soon' | 'travel' | 'home' };

const TONE: Record<Tone, { bg: string; fg: string }> = {
  warn: { bg: '#ffe1d6', fg: COLOR.redDark },
  storm: { bg: '#dfe7f0', fg: '#2f4a6b' },
  ok: { bg: '#e4ecd9', fg: '#2e4a1f' },
  grey: { bg: '#e6e1da', fg: COLOR.ink },
};

const LATER: Act = { label: '나중에 이어하기', go: 'home' }; // 장부에 접어 두고 홈으로 (목업 5-10)

const SITS: Record<Sit, { tone: Tone; banner: string; why: string; note: string; quote: string; acts: Act[] }> = {
  closed: {
    tone: 'warn', banner: '운영 상태가 바뀌었어요', why: '[스팟]이 오늘 문을 닫았어요',
    note: '운영자가 바꾼 상태가 다음 재평가 때 반영됨 (F-08, F-18)',
    quote: '엇, [스팟]이 오늘 문을 닫았대요! 바로 옆 [대체 스팟]은 열려 있어요. 그쪽으로 갈까요?',
    acts: [{ label: '대체 길로 계속', primary: true, go: 'soon' }, LATER],
  },
  heat: {
    tone: 'warn', banner: '폭염특보 · [기준 시각] 기준', why: '바깥 길을 멈췄어요',
    note: '기준 시각과 운영 시간은 필수',
    quote: '으아, 폭염특보가 떴어요! [기준 시각] 기준이에요. 바깥 길은 멈출게요.',
    acts: [{ label: '실내 길로 계속', primary: true, go: 'soon' }, LATER],
  },
  storm: {
    tone: 'storm', banner: '호우·낙뢰 · 신규 이동 보류', why: '지금은 밖으로 나가지 않아요',
    note: '신규 이동 보류 (F-23)',
    quote: '으악, 밖에 나가면 안 돼요! 이건 양보 못 해요!',
    acts: [LATER],
  },
  wind: {
    tone: 'ok', banner: '날씨가 바뀌었어요', why: '이쪽 그늘 길이 더 맞아요',
    note: '안전 위험이 없는 변화일 때만 "원래대로" 선택 가능',
    quote: '엇, 바람이 바뀌었어요! 이쪽 그늘 길이 더 맞아요. 바꿔 볼까요?',
    acts: [{ label: '대체 길로 계속', primary: true, go: 'soon' }, { label: '원래대로 계속', go: 'travel' }, LATER],
  },
  crowd: {
    tone: 'ok', banner: '사람이 많아요', why: '혼잡을 피해 조금 돌아가요',
    note: '혼잡 분산 모드 (20261110_game_storyboard_v1.md A-3)',
    quote: '여기 사람이 너무 많대요! 조금 돌아서 갈까요?',
    acts: [{ label: '대체 길로 계속', primary: true, go: 'soon' }, { label: '원래대로 계속', go: 'travel' }, LATER],
  },
  off: {
    tone: 'grey', banner: '길에서 조금 벗어났어요', why: '길이 달라졌어요',
    note: '이탈 기준(거리, 시간)은 [결정 필요]. 이용자를 탓하는 말은 쓰지 않음',
    quote: '어라, 길이 달라졌네요! 괜찮아요, 다시 찾아볼까요?',
    acts: [{ label: '원래 길로 돌아가기', primary: true, go: 'travel' }, { label: '여기서 길 다시 짜기', go: 'soon' }],
  },
  none: {
    tone: 'grey', banner: '오늘은 이어 갈 길이 없어요', why: '대체 길이 아직 없어요',
    note: '추측하지 않음 (명세 T-03, T-08)',
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

        <WxCard>
          <Text style={wxText.big}>{d.why}</Text>
          <Text style={wxText.small}>{d.note}</Text>
        </WxCard>

        <View style={styles.hara}>
          <Text style={styles.haraText}>
            <Text style={styles.haraName}>하랑이 </Text>
            {d.quote}
          </Text>
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
  scroll: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28, gap: 14 },
  banner: { paddingVertical: 14, paddingHorizontal: 16, ...pxBox() },
  bannerText: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  hara: { ...pxBox(COLOR.paper), paddingVertical: 12, paddingHorizontal: 14 },
  haraText: { fontSize: 15, lineHeight: 24, color: COLOR.ink },
  haraName: { fontWeight: '800', color: COLOR.beam },
  foot: { fontSize: 13, lineHeight: 20, color: COLOR.muted },
});
