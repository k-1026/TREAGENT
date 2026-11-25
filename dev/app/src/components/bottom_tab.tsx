/*
 * [bottom_tab.tsx] 하단 탭 — 홈 · 장부 · 내 정보 (홈 목업 storyboard/app_home_mockup_v1.html의 nav.tab)
 *
 * 모양: 높이 84, 종이색 바탕, 위쪽 잉크색 3px 선. 지금 화면의 탭은 잉크색, 나머지는 흐린 갈색.
 * 이동: 홈 → /, 장부 → /ledger, 내 정보 → /me (홈·장부는 탭끼리 바꾸는 것이라 replace)
 * 쓰는 곳: 홈 화면(app/index.tsx), 장부(app/ledger.tsx)
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLOR } from '../lib/theme';
import { PixelIcon, PixelIconName } from './pixel_icons';

type TabKey = 'home' | 'ledger' | 'me';

const TABS: { key: TabKey; label: string; icon: PixelIconName; go: () => void }[] = [
  { key: 'home', label: '홈', icon: 'home', go: () => router.replace('/') },
  { key: 'ledger', label: '장부', icon: 'book', go: () => router.replace('/ledger') },
  { key: 'me', label: '내 정보', icon: 'me', go: () => router.push('/me') },
];

export function BottomTab({ current }: { current: TabKey }) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const on = t.key === current;
        const color = on ? COLOR.ink : COLOR.muted;
        return (
          <Pressable key={t.key} onPress={on ? undefined : t.go} style={styles.button} accessibilityState={{ selected: on }}>
            <PixelIcon name={t.icon} color={color} />
            <Text style={[styles.label, { color }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 84, backgroundColor: COLOR.paper, borderTopWidth: 3, borderTopColor: COLOR.ink, flexDirection: 'row', paddingTop: 8 },
  button: { flex: 1, alignItems: 'center', gap: 5, paddingTop: 6 },
  label: { fontSize: 12, fontWeight: '700' },
});
