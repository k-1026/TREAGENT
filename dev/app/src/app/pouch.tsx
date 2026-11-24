/*
 * [pouch.tsx] 주머니 S-20 (주소: /pouch) — 홈 [주머니] 버튼으로 연다. 목업 storyboard/app_home_mockup_v1.html의 #v-pouch
 *
 * 들어 있는 물건 (목업 순서)
 *  - 열쇠: 상징 1개, 모으는 재화가 아님. 누르면 하랑이 한마디 → 아직 준비 중
 *  - 손수건: 하랑이가 빌려 감 (반납 전)
 *  - 배지, 인증서: [잠정, P2]
 *
 * 데이터: 받은 물건은 서버에 저장되지 않는다. 물건은 틀리면 안 되는 값이라 서버·DB에서만 정해야 한다 (dev 절대 규칙 3).
 *  - 그래서 평소에는 빈 상태가 보인다 [확인 필요: 물건 지급 서버 기능].
 *  - 개발 중에만 ?state=active 처럼 홈 상태 이름을 붙이면 목업의 예시 줄을 볼 수 있다.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../components/empty_state';
import { CONTENT } from '../components/phone_column';
import { PouchIcon, PouchItem } from '../components/pouch_icons';
import { ScreenHead } from '../components/screen_head';
import { isHomeStateKey } from '../lib/home_state';
import { COLOR, pxBox } from '../lib/theme';

const ITEMS: { icon: PouchItem; name: string; text: string; note?: string; soon?: string }[] = [
  { icon: 'key', name: '열쇠', text: '[날짜]에 처음 열렸어요 (눌러 보기)', note: '상징 1개, 모으는 재화가 아니에요', soon: '열쇠 하랑이 한마디' },
  { icon: 'handkerchief', name: '손수건', text: '하랑이가 빌려 갔어요 (반납 전)' },
  { icon: 'badge', name: '배지', text: '권역을 완주하면 받아요 [잠정, P2]' },
  { icon: 'certificate', name: '인증서', text: '길동무 인증서를 받으면 담겨요 [잠정, P2]' },
];

const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function PouchScreen() {
  const params = useLocalSearchParams<{ state?: string }>();
  const filled = __DEV__ && isHomeStateKey(params.state) && params.state !== 'none';

  return (
    <View style={styles.safe}>
      <ScreenHead title="주머니" sub="내가 받은 물건" backLabel="‹ 홈" onBack={goHome} />
      <ScrollView contentContainerStyle={[CONTENT, styles.scroll]}>
        {filled ? (
          ITEMS.map((it) => {
            const body = (
              <>
                <PouchIcon name={it.icon} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name}>{it.name}</Text>
                  <Text style={styles.text}>{it.text}</Text>
                  {it.note ? <Text style={styles.note}>{it.note}</Text> : null}
                </View>
              </>
            );
            const what = it.soon;
            return what ? (
              <Pressable
                key={it.name}
                onPress={() => router.push({ pathname: '/soon', params: { what } })}
                style={[pxBox(), styles.row]}
              >
                {body}
              </Pressable>
            ) : (
              <View key={it.name} style={[pxBox(), styles.row]}>
                {body}
              </View>
            );
          })
        ) : (
          <EmptyState title="아직 받은 물건이 없어요" sub="[승인 대사 대기 · 주머니 비어 있음]" />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  scroll: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  name: { fontSize: 14, fontWeight: '800', color: COLOR.ink, marginBottom: 8 },
  text: { fontSize: 13, lineHeight: 19, color: COLOR.ink },
  note: { fontSize: 12, color: COLOR.muted, marginTop: 2 },
});
