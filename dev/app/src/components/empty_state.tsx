/*
 * [empty_state.tsx] 빈 상태 — 하랑이 빈 상태 그림 + 굵은 제목 + 흐린 설명 (홈 목업 #em-trips, #em-pouch 등)
 * 쓰는 곳: 장부(내 여행·앨범), 주머니, 오늘 페이지
 * action을 주면 아래에 큰 버튼 하나를 그린다 (목업 storyboard/empty_states_mockup_v1.html의 .cta: 장부 [오늘의 길 고르기], 앨범·주머니 [길 걸으러 가기])
 */
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLOR } from '../lib/theme';

export function EmptyState({ title, sub, action }: { title: string; sub: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/harangi_empty_state_v2.webp')} style={styles.art} resizeMode="contain" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
      {action ? (
        <Pressable onPress={action.onPress} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <Text style={styles.ctaText}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 10 },
  art: { width: '100%', height: 220 },
  title: { fontSize: 15, fontWeight: '800', color: COLOR.ink, textAlign: 'center' },
  sub: { fontSize: 13, lineHeight: 19, color: COLOR.muted, textAlign: 'center' },
  // 목업 .cta: 빨간 바탕, 높이 56, 모서리 6, 잉크 1.5px 테두리
  cta: { alignSelf: 'stretch', height: 56, marginTop: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.red, borderRadius: 6, borderWidth: 1.5, borderColor: COLOR.ink },
  ctaText: { fontSize: 17, fontWeight: '800', color: '#fff' },
});
