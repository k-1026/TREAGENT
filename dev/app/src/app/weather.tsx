/*
 * [weather.tsx] 날씨 상세 (주소: /weather) — 홈 왼쪽 위 날씨 배지로 연다.
 * 목업: storyboard/app_home_mockup_v1.html #v-weather, storyboard/shelter_weather_mockup_v1.html 날씨 화면 (쉼터 화면은 제외)
 *
 * 보이는 것: 안내 띠 → 지금 날씨(색 네모 + 큰 글) → 측정 방식·측정 시각·다음 갱신 → 이 날씨에 할 수 있는 것 → [지역 바꾸기]
 *  - 보통 날씨는 서버에서 받은 실제 기온과 기준 시를 보여 준다. 하늘 상태(맑음 등)는 서버가 주지 않아 쓰지 않는다.
 *  - 폭염·호우는 특보 자료가 없어 개발 중 미리보기(?state=heat 등)로만 보인다.
 *  - 측정 방식(AWS 여부), 다음 갱신 시각은 자료가 없어 자리표시 [확인 필요]
 *  - 쉼터 화면은 만들지 않기로 해서 쉼터 버튼은 없다 (2026-11-24 팀 결정)
 *  - [지역 바꾸기]: 배지가 날씨 상세로 바뀌어서, 위치 확인 화면으로 가는 길을 여기에 둔다 (목업에 없음) [확인 필요]
 */
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { WX, WxBanner, WxButton, WxCard, WxRow, wxText } from '../components/weather_ui';
import { COLOR } from '../lib/theme';
import { useHomeWeather, weatherKindOf } from '../lib/use_home_weather';

const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function WeatherScreen() {
  const hw = useHomeWeather();
  const kind = weatherKindOf(hw.stateKey);
  const w = WX[kind];
  const live = kind === 'normal' && hw.temp !== null && hw.hour !== null;
  const baseText = live ? `${hw.hour}시` : hw.loading && !hw.preview ? '확인 중' : '[기준 시각]';
  const big = live ? `기온 ${Math.round(hw.temp!)}℃` : kind === 'normal' ? '기온 [○]℃' : w.big;
  const sub = live || kind === 'normal' ? `체감 [○]℃ · ${baseText} 기준` : w.sub;

  return (
    <View style={styles.safe}>
      <ScreenHead title="오늘 날씨" sub={`날씨 기준 시각 · ${baseText}`} backLabel="‹ 뒤로" onBack={goHome} />
      <ScrollView contentContainerStyle={[CONTENT, styles.scroll]}>
        <WxBanner kind={kind} />

        <WxCard>
          <View style={styles.now}>
            <View style={[styles.swatch, { backgroundColor: w.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={wxText.big}>{big}</Text>
              <Text style={wxText.small}>{sub}</Text>
            </View>
          </View>
        </WxCard>

        <WxCard>
          <WxRow label="측정 방식" value="[AWS 여부 · 확인 필요]" />
          <WxRow label="측정 시각" value={baseText} />
          <WxRow label="다음 갱신" value="[시각 자리]" last />
        </WxCard>

        <WxCard>
          <Text style={wxText.big}>이 날씨에 할 수 있는 것</Text>
          <View style={{ marginTop: 8 }}>
            {w.doList.map((d, i) => (
              <View key={d} style={[styles.doRow, i === w.doList.length - 1 && { borderBottomWidth: 0 }]}>
                <Text style={styles.doDot}>·</Text>
                <Text style={styles.doText}>{d}</Text>
              </View>
            ))}
          </View>
        </WxCard>

        <WxButton label="지역 바꾸기" primary onPress={() => router.push('/location')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  scroll: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28, gap: 14 },
  now: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatch: { width: 22, height: 22, borderWidth: 2, borderColor: COLOR.ink },
  doRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLOR.shade,
    borderStyle: 'dashed',
  },
  doDot: { fontSize: 15, lineHeight: 22, color: COLOR.muted },
  doText: { flex: 1, fontSize: 15, lineHeight: 22, color: COLOR.ink },
});
