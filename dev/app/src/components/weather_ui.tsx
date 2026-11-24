/*
 * [weather_ui.tsx] 날씨 상세 화면의 공통 표와 부품 (목업 storyboard/shelter_weather_mockup_v1.html)
 *
 * WX: 날씨 종류별 글과 색 (보통·폭염·호우·확인 불가). 색은 홈 배지와 같다 (보통 노랑, 폭염 빨강, 호우 남색, 확인 불가 회색)
 * 부품: 안내 띠(WxBanner), 카드(WxCard), 점선 줄(WxRow), 큰 버튼(WxButton)
 * 문구는 목업 자리표시 그대로다 ([기준 시각], [운영 시간] 등). 안전 정보는 기준(시각, 운영 시간, AWS 여부)을 함께 적는다 (CLAUDE.md).
 */
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WeatherKind } from '../lib/use_home_weather';
import { COLOR } from '../lib/theme';

export const WX: Record<
  WeatherKind,
  { big: string; sub: string; color: string; bannerBg: string; bannerFg: string; banner: string; doList: string[] }
> = {
  normal: {
    big: '맑음', sub: '체감 [○]℃ · [기준 시각] 기준', color: '#f5b82e', bannerBg: '#e4ecd9', bannerFg: '#2e4a1f',
    banner: '야외 길을 그대로 안내해요.', doList: ['야외 코스: 표시'],
  },
  heat: {
    big: '폭염특보', sub: '체감 [○]℃ · [기준 시각] 기준', color: '#dc3b30', bannerBg: '#ffe1d6', bannerFg: COLOR.redDark,
    banner: '야외 길 안내를 멈췄어요.', doList: ['야외 코스: 숨김 (실내 경로로 바뀜)'],
  },
  storm: {
    big: '호우·이동 보류', sub: '강수 [○]mm · [기준 시각] 기준', color: '#2f4a6b', bannerBg: '#dfe7f0', bannerFg: '#2f4a6b',
    banner: '신규 이동을 보류했어요. 안전한 곳에서 기다려요.', doList: ['야외 코스: 숨김'],
  },
  unknown: {
    big: '날씨를 불러오지 못했어요', sub: '[기준 시각] 기준 · 확인 중', color: '#b9b2a8', bannerBg: '#e6e1da', bannerFg: COLOR.ink,
    banner: '날씨를 확인할 수 없어 길을 권하지 않아요.',
    doList: ['야외 코스: 권하지 않음'],
  },
};

export function WxBanner({ kind }: { kind: WeatherKind }) {
  const w = WX[kind];
  return (
    <View style={[styles.banner, { backgroundColor: w.bannerBg }]}>
      <Text style={[styles.bannerText, { color: w.bannerFg }]}>{w.banner}</Text>
    </View>
  );
}

export function WxCard({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

// 점선 아래줄이 있는 한 줄 (마지막 줄은 last로 선을 뺀다)
export function WxRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function WxButton({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.primary, pressed && { opacity: 0.85 }]}>
      <Text style={[styles.buttonText, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export const wxText = StyleSheet.create({
  big: { fontSize: 17, lineHeight: 24, fontWeight: '800', color: COLOR.ink },
  small: { fontSize: 14, lineHeight: 21, color: COLOR.muted, marginTop: 6 },
});

const styles = StyleSheet.create({
  // 목업 .banner / .card: 잉크 2px 테두리
  banner: { paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2, borderColor: COLOR.ink },
  bannerText: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  card: { backgroundColor: COLOR.paper, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 2, borderColor: COLOR.ink },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.shade,
    borderStyle: 'dashed',
  },
  rowLabel: { fontSize: 15, lineHeight: 22, color: COLOR.muted },
  rowValue: { flex: 1, fontSize: 15, lineHeight: 22, color: COLOR.ink, textAlign: 'right' },
  // 목업 .btn: 높이 56, 둥근 모서리 6, 잉크 1.5px
  button: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLOR.paper,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLOR.ink,
  },
  primary: { backgroundColor: COLOR.red },
  buttonText: { fontSize: 17, fontWeight: '800', color: COLOR.ink },
});
