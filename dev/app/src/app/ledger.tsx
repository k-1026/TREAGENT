/*
 * [ledger.tsx] 장부 S-09 (주소: /ledger) — 하단 탭 [장부]로 연다. 목업 storyboard/app_home_mockup_v1.html의 #v-ledger
 *
 * 책갈피 3개
 *  - 지도: 대구 9개 구·군 칸. 중구만 열림, 나머지는 준비 중. 내 완주율은 계산 기준이 없어 [○]% [확인 필요]
 *  - 내 여행: 여행 1회가 한 장(9:16 카드, 한 줄 3장, 누르면 /trip_card). 진행 중인 여행은 아래 줄. 기록이 없으면 빈 상태
 *  - 앨범: 해금한 컷씬. 기록이 없으면 빈 상태
 *
 * 데이터: 여행 기록·도장·앨범은 아직 서버에 저장되지 않는다 [확인 필요: 여행 세션 저장 PR].
 *  - 그래서 평소에는 빈 상태가 보인다.
 *  - 개발 중에만 ?state=active 처럼 홈 상태 이름을 붙이면 목업의 예시 줄을 볼 수 있다 (none은 빈 상태).
 * 문구는 목업 자리표시 그대로다 ([날짜], [컷씬 ① 제목] 등).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomTab } from '../components/bottom_tab';
import { EmptyState } from '../components/empty_state';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { TripMini } from '../components/trip_card';
import { isHomeStateKey } from '../lib/home_state';
import { COLOR, pxBox } from '../lib/theme';
import { SAMPLE_TRIPS } from '../lib/trip_card_data';

type Bookmark = 'map' | 'trips' | 'album';
const BOOKMARKS: { key: Bookmark; label: string }[] = [
  { key: 'map', label: '지도' },
  { key: 'trips', label: '내 여행' },
  { key: 'album', label: '앨범' },
];

// 목업 DISTS 순서 (3 x 3, 위치는 예시). MVP는 중구만 안내
const DIST_GRID = ['군위군', '북구', '동구', '서구', '중구', '수성구', '달서구', '남구', '달성군'];

const STAMP = require('../../assets/stamp_nungeum.webp');
const soon = (what: string) => router.push({ pathname: '/soon', params: { what } });

// 도장 세 칸. got개는 진하게, 나머지는 흐리게 (목업 .mini img.e)
function MiniStamps({ got }: { got: number }) {
  return (
    <View style={styles.mini}>
      {[0, 1, 2].map((i) => (
        <Image key={i} source={STAMP} style={[styles.miniStamp, i >= got && styles.stampEmpty]} />
      ))}
    </View>
  );
}

export default function LedgerScreen() {
  const params = useLocalSearchParams<{ state?: string; tab?: string }>();
  // ?tab=album: 컷씬을 본 뒤 [앨범에서 보기]로 돌아오면 앨범 책갈피가 먼저 열린다
  const [tab, setTab] = useState<Bookmark>(params.tab === 'album' ? 'album' : params.tab === 'trips' ? 'trips' : 'map');
  // 기록이 저장되지 않아 평소에는 빈 상태. 개발 중 미리보기에서만 예시 줄을 보인다
  const filled = __DEV__ && isHomeStateKey(params.state) && params.state !== 'none';

  return (
    <View style={styles.safe}>
      <ScreenHead title="장부" sub="하랑이와 함께 걸어 확인한 기록" />

      <ScrollView contentContainerStyle={[CONTENT, styles.scroll]}>
        <View style={styles.seg} accessibilityRole="tablist">
          {BOOKMARKS.map((b) => {
            const on = b.key === tab;
            return (
              <Pressable
                key={b.key}
                onPress={() => setTab(b.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[styles.segButton, on && styles.segOn]}
              >
                <Text style={[styles.segText, on && styles.segTextOn]}>{b.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'map' ? (
          <View style={styles.panel}>
            <Text style={styles.h3}>
              지도 <Text style={styles.h3Sub}>대구 전역 · 구역별 내 완주율</Text>
            </Text>
            <View style={styles.map}>
              {DIST_GRID.map((n) => {
                const on = n === '중구';
                return (
                  <View key={n} style={[styles.dist, on && styles.distOn]}>
                    <Text style={styles.distName}>{n}</Text>
                    <Text style={[styles.distSub, on && styles.distSubOn]}>{on ? '내 완주율 [○]%' : '준비 중'}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.mapNote}>[대구 전역 그림 자리 · 구역 경계는 예시]</Text>
            <View style={[pxBox(), styles.row]}>
              <Text style={styles.rowText}>
                내 완주율 = 내가 완주한 길 ÷ 전체 길 [기준 확인 필요]. MVP는 중구만 안내해요. 나머지 구·군은 준비 중이에요.
              </Text>
            </View>
          </View>
        ) : null}

        {tab === 'trips' ? (
          <View style={styles.panel}>
            <Text style={styles.h3}>내 여행</Text>
            {filled ? (
              <>
                <Text style={styles.h3}>
                  완주한 여행 <Text style={styles.h3Sub}>카드를 누르면 크게 볼 수 있어요</Text>
                </Text>
                {/* 한 줄 3장 (목업 .tc-grid) */}
                <View style={styles.grid}>
                  {SAMPLE_TRIPS.map((t, i) => (
                    <TripMini key={t.title} trip={t} onPress={() => router.push({ pathname: '/trip_card', params: { i: String(i) } })} />
                  ))}
                </View>
                <Text style={styles.h3}>
                  진행 중 <Text style={styles.h3Sub}>이어서 걸을 수 있어요</Text>
                </Text>
                <Pressable onPress={() => soon('이어하기')} style={[pxBox(), styles.row]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>중구 근대골목 걷기</Text>
                    <Text style={styles.rowSmall}>[날짜] · 3곳 · 진행 중 · 눌러서 이어하기 [임시]</Text>
                    <MiniStamps got={2} />
                  </View>
                </Pressable>
              </>
            ) : (
              <EmptyState title="아직 빈 칸뿐이에요" sub="첫 길을 걸으러 갈까요? 길을 마치면 여기 기록이 남아요." action={{ label: '오늘의 길 고르기', onPress: () => router.push('/today') }} />
            )}
            <View style={[pxBox(), styles.row]}>
              <Text style={styles.rowText}>한 장에는 실제로 방문한 장소와 날짜만 담겨요. 좌표는 담지 않아요.</Text>
            </View>
          </View>
        ) : null}

        {tab === 'album' ? (
          <View style={styles.panel}>
            <Text style={styles.h3}>
              앨범 <Text style={styles.h3Sub}>하랑이의 이야기</Text>
            </Text>
            {filled ? (
              <Pressable
                onPress={() => router.push({ pathname: '/cutscene', params: { cut: 'c1', mode: 'replay' } })}
                style={[pxBox(), styles.row]}
              >
                <View style={styles.thumb}>
                  <Text style={styles.thumbText}>{'[컷씬 ①\n썸네일]'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>[컷씬 ① 제목]</Text>
                  <Text style={styles.rowSmall}>[해금한 날짜] · 눌러서 다시 보기</Text>
                </View>
              </Pressable>
            ) : (
              <EmptyState title="아직 앨범이 비어 있어요" sub="같이 걸으면 이야기가 생겨요." action={{ label: '오늘의 길 고르기', onPress: () => router.push('/today') }} />
            )}
          </View>
        ) : null}
      </ScrollView>

      <BottomTab current="ledger" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  scroll: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },

  // 책갈피 (목업 .seg: 고른 것은 잉크 바탕 흰 글씨)
  seg: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  segButton: { ...pxBox(COLOR.paper), flex: 1, paddingVertical: 9, alignItems: 'center' },
  segOn: { backgroundColor: COLOR.ink },
  segText: { fontSize: 13, fontWeight: '700', color: COLOR.muted },
  segTextOn: { color: '#fff' },

  panel: { gap: 12 },
  // 완주한 여행 카드 목록: 한 줄 3장 (목업 .tc-grid)
  grid: { flexDirection: 'row', gap: 12 },
  h3: { fontSize: 14, fontWeight: '800', color: COLOR.ink, marginTop: 4 },
  h3Sub: { fontSize: 12, fontWeight: '400', color: COLOR.muted },

  // 지도 (목업 .map: 높이 200, 잉크 2px 테두리, 구·군 칸 3 x 3)
  map: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 6,
    ...pxBox('#ecdcbf'),
  },
  dist: {
    width: '31.5%',
    height: 58,
    paddingVertical: 5,
    paddingHorizontal: 6,
    ...pxBox('rgba(255,250,241,0.8)'),
  },
  distOn: { backgroundColor: COLOR.paper },
  distName: { fontSize: 13, fontWeight: '700', color: COLOR.ink },
  distSub: { fontSize: 12, color: COLOR.muted },
  distSubOn: { color: COLOR.redDark, fontWeight: '800' },
  mapNote: { fontSize: 12, color: COLOR.muted },

  // 줄 상자 (목업 .row)
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  rowText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLOR.ink },
  rowTitle: { fontSize: 14, fontWeight: '800', color: COLOR.ink, marginBottom: 6 },
  rowSmall: { fontSize: 12, color: COLOR.muted, marginTop: 2 },

  mini: { flexDirection: 'row', gap: 4, marginTop: 4 },
  miniStamp: { width: 20, height: 20 },
  stampEmpty: { opacity: 0.3, filter: [{ grayscale: 1 }] }, // 목업 img.e (흐리고 흑백)

  thumb: { width: 64, height: 48, backgroundColor: '#ecdcbf', alignItems: 'center', justifyContent: 'center' },
  thumbText: { fontSize: 12, color: COLOR.muted, textAlign: 'center' },
});
