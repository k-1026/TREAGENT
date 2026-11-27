/*
 * [district.tsx] 구·군 선택 화면 (주소: /district)
 *
 * 역할
 *  - 위치 권한을 거부했거나 위치를 읽지 못했을 때, 구·군을 직접 고르게 한다.
 *  - 모양은 목업(storyboard/app_login_region_mockup_v1.html ⑤)을 따른다.
 *
 * 동작
 *  - DISTRICTS 목록을 2열 버튼으로 보여 준다.
 *  - 기준점(center)이 있는 구·군은 "안내해요"(빨강), 없는 구·군은 "준비 중"(흐리게)으로 보이고 누를 수 없다.
 *  - 하나를 누르면 위치 확인 화면(/location)으로 돌아가며, 선택한 코드를 district 파라미터로 넘긴다.
 *  - "닫기"는 선택 없이 이전 화면으로 돌아간다.
 *
 * 확인 필요
 *  - 목업처럼 9개를 모두 보여 주고, 중구만 누를 수 있다. 나머지 구·군을 언제 열지는 [결정 필요]
 *
 * 규칙: 좌표는 다루지 않는다. 선택값은 저장하지 않는다 (앱을 다시 켜면 사라진다).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DISTRICTS } from '../lib/districts';
import { BTN_RED, COLOR, pxBox } from '../lib/theme';
import { CONTENT } from '../components/phone_column';

export default function DistrictScreen() {
  // mode=setting이면 설정 위치 화면(/location_setting)으로, 아니면 최초 위치 화면(/location)으로 돌아간다
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return (
    <View style={styles.safe}>
      {/* 위쪽 주황 헤더 (목업 .head2) */}
      <View style={styles.head}>
        {/* 제목은 아래 내용과 같은 폭(CONTENT) 안에서 왼쪽에 맞춘다 */}
        <View style={CONTENT}>
          <Text style={styles.headTitle}>어느 동네에서 시작할까요?</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, CONTENT]}>
        <Text style={styles.note}>지금은 중구만 안내해요. 나머지 동네는 준비 중이에요.</Text>

        <View style={styles.grid}>
          {DISTRICTS.map((d) => {
            const open = !!d.center;
            return (
              <Pressable
                key={d.code}
                disabled={!open}
                onPress={() => router.dismissTo({ pathname: mode === 'setting' ? '/location_setting' : '/location', params: { district: d.code } })}
                style={({ pressed }) => [
                  styles.tile,
                  open ? pxBox(BTN_RED, COLOR.redDark) : pxBox(COLOR.paper, COLOR.shade),
                  !open && styles.tileOff,
                  pressed && open && styles.pressed,
                ]}
              >
                <Text style={[styles.tileName, { color: open ? '#fff' : COLOR.ink }]}>{d.name}</Text>
                <Text style={[styles.tileSmall, { color: open ? '#ffe1d6' : COLOR.muted }]}>{open ? '안내해요' : '준비 중'}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={({ pressed }) => [styles.close, pxBox(COLOR.paper, COLOR.shade), pressed && styles.pressed]}>
          <Text style={styles.closeText}>닫기</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },

  head: {
    height: 130,
    backgroundColor: COLOR.beam,
    borderBottomWidth: 3,
    borderBottomColor: COLOR.ink,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: COLOR.ink,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },

  body: { flex: 1 },
  bodyContent: { padding: 22, paddingHorizontal: 24, gap: 14 },
  note: { fontSize: 12, color: COLOR.muted, lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  tile: { width: '48%', paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' },
  tileOff: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
  tileName: { fontSize: 18, fontWeight: '800' },
  tileSmall: { fontSize: 12, marginTop: 4 },

  // 닫기: 버튼 모양 (종이색 칸, 잉크 테두리)
  close: { alignItems: 'center', paddingVertical: 14 },
  closeText: { color: COLOR.ink, fontWeight: '800', fontSize: 17 },
});
