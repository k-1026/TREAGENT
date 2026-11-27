/*
 * [today_page.tsx] 오늘 페이지 (주소: /today_page) — 홈 장면의 [오늘 페이지 ▾](책상 위 장부)로 연다.
 * 목업 storyboard/app_home_mockup_v1.html의 #v-today
 *
 * 보이는 것: 추천 길 안내 → 오늘 걸을 장소 3칸(장소마다 도장 1개) → [이 길 확인하기]
 *  - 장소 이름: [오늘의 길 고르기]에서 길을 골랐으면 그 길의 장소, 아니면 [스팟 1~3] 자리표시
 *  - 도장: 도장 기록이 저장되지 않아 평소에는 0/3 [확인 필요: 도장 서버 기능]
 *  - [이 길 확인하기] → 오늘의 길 고르기(/today)
 * 개발 중 미리보기: ?state=active·notice는 도장 2/3, ?state=empty는 "오늘 칸 없음" 빈 상태
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../components/empty_state';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { isHomeStateKey } from '../lib/home_state';
import { COLOR, pxBox } from '../lib/theme';
import { useToday } from '../lib/today_context';

const STAMP = require('../../assets/stamp_nungeum.webp');
const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function TodayPageScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const preview = __DEV__ && isHomeStateKey(params.state) ? params.state : null;
  const { result, chosen } = useToday();

  // 고른 길이 있으면 그 장소 이름을 쓴다 (없으면 자리표시)
  const picked = chosen !== null ? (result?.routes?.[chosen] ?? null) : null;
  const names = [0, 1, 2].map((i) => picked?.places[i]?.name ?? `[스팟 ${i + 1}]`);
  const stamps = preview === 'active' || preview === 'notice' ? 2 : 0;
  const noCells = preview === 'empty';

  return (
    <View style={styles.safe}>
      <ScreenHead title="오늘 페이지" sub="펼친 장부의 오늘 페이지" backLabel="‹ 뒤로" onBack={goHome} />
      <ScrollView contentContainerStyle={[CONTENT, styles.scroll]}>
        <View style={[pxBox(), styles.row]}>
          <Text style={styles.rowText}>
            <Text style={styles.bold}>{'추천 길 · [요일] · [시간대] · [날씨]\n'}</Text>
            날씨와 시간대에 맞춰 고른 추천 길이에요. 장소 3곳을 걸어요. [승인 대사 대기]
          </Text>
        </View>

        {noCells ? (
          // 빈 상태 버튼: 목업 empty_states_mockup_v1의 today [다른 길 보기] → 오늘의 길 고르기
          <EmptyState
            title="오늘은 안내할 칸이 없어요"
            sub="[승인 대사 대기 · 오늘 칸 없음] 내일 다시 확인해요."
            action={{ label: '다른 길 보기', onPress: () => router.push('/today') }}
          />
        ) : (
          <>
            <Text style={styles.h3}>
              오늘 걸을 장소 <Text style={styles.h3Sub}>{`도장 ${stamps}/3 · 장소마다 도장 1개`}</Text>
            </Text>
            {names.map((n, i) => {
              const done = i < stamps;
              return (
                <View key={i} style={[pxBox(), styles.cell]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cellTitle}>{`${n} · [미션 종류]`}</Text>
                    <Text style={styles.cellText}>[상태 한 줄: 검수된 정보 요약]</Text>
                    <Text style={styles.cellSmall}>{done ? '내가 채운 장소 · 미션 완료' : '아직 비어 있어요'}</Text>
                  </View>
                  {done ? <Image source={STAMP} style={styles.stamp} /> : <View style={styles.slot} />}
                </View>
              );
            })}
            <Pressable onPress={() => router.push('/today')} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
              <Text style={styles.ctaText}>이 길 확인하기</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  scroll: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  row: { paddingVertical: 10, paddingHorizontal: 12 },
  rowText: { fontSize: 13, lineHeight: 19, color: COLOR.ink },
  bold: { fontSize: 14, fontWeight: '800' },
  h3: { fontSize: 14, fontWeight: '800', color: COLOR.ink, marginTop: 4 },
  h3Sub: { fontSize: 12, fontWeight: '400', color: COLOR.muted },

  // 장소 칸 (목업 .cell: 오른쪽에 도장 34px 또는 빈 자리)
  cell: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  cellTitle: { fontSize: 13, fontWeight: '800', color: COLOR.ink },
  cellText: { fontSize: 12, lineHeight: 17, color: COLOR.ink },
  cellSmall: { fontSize: 12, color: COLOR.muted, marginTop: 2 },
  stamp: { width: 34, height: 34 },
  slot: { width: 34, height: 34, backgroundColor: COLOR.cream2, borderWidth: 2, borderColor: COLOR.muted },

  cta: { ...pxBox(COLOR.red, COLOR.redDark), height: 68, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
