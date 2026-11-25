/*
 * [dev_state_panel.tsx] 개발 중 상황 선택 패널 — 목업의 "상태" 드롭다운과 같은 역할.
 *  - 홈 화면 상태(8종)를 버튼으로 바꿔 본다. 누르면 주소의 ?state= 값이 바뀌고, 홈은 use_home_weather.ts가 그 값을 읽는다.
 *  - __DEV__ 에서만 그린다. 배포 빌드에는 나오지 않는다.
 *  - 서버 데이터가 없어도 상황별 화면 모양을 볼 수 있게 하는 용도다. 데이터를 가짜로 만들지는 않는다.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HOME_STATE_KEYS, HomeStateKey, isHomeStateKey } from '../lib/home_state';
import { COLOR } from '../lib/theme';

const LABEL: Record<HomeStateKey, string> = {
  none: '진행 없음',
  active: '이어하기',
  notice: '경로 변경',
  heat: '폭염',
  storm: '호우',
  unknown: '날씨 확인 불가',
  outside: '중구 밖',
  empty: '코스 없음',
};

export function DevStatePanel() {
  if (!__DEV__) return null;
  const params = useLocalSearchParams<{ state?: string }>();
  const current = isHomeStateKey(params.state) ? params.state : null;

  return (
    <View style={styles.box} pointerEvents="box-none">
      <Text style={styles.title}>[개발] 홈 상태</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {HOME_STATE_KEYS.map((k) => {
          const on = current === k;
          return (
            <Pressable
              key={k}
              onPress={() => router.setParams({ state: k })}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && { color: '#fff' }]}>{LABEL[k]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 200, backgroundColor: 'rgba(42,31,45,0.92)', paddingTop: 6, paddingBottom: 8 },
  title: { color: '#fff3e0', fontSize: 11, fontWeight: '800', paddingHorizontal: 10, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: 10 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 2, borderColor: '#fff3e0', backgroundColor: COLOR.paper },
  chipOn: { backgroundColor: COLOR.red, borderColor: COLOR.redDark },
  chipText: { fontSize: 12, fontWeight: '700', color: COLOR.ink },
});
