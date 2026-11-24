/*
 * [empty_state.tsx] 빈 상태 — 하랑이 빈 상태 그림 + 굵은 제목 + 흐린 설명 (홈 목업 #em-trips, #em-pouch 등)
 * 쓰는 곳: 장부(내 여행·앨범), 주머니, 오늘 페이지
 */
import { Image, StyleSheet, Text, View } from 'react-native';
import { COLOR } from '../lib/theme';

export function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/harangi_empty_state_v2.webp')} style={styles.art} resizeMode="contain" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 10 },
  art: { width: '100%', height: 220 },
  title: { fontSize: 15, fontWeight: '800', color: COLOR.ink, textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 19, color: COLOR.muted, textAlign: 'center' },
});
