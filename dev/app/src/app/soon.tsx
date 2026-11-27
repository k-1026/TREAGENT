/*
 * [soon.tsx] 준비 중 화면 (주소: /soon?what=이름) — 홈 목업의 "준비 중"(v-todo) 자리
 *
 * 역할: 아직 만들지 않은 기능(장부, 쉼터, 주머니, 오늘 페이지)을 누르면 여기로 온다.
 */
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { COLOR, pxBox } from '../lib/theme';

export default function SoonScreen() {
  const { what } = useLocalSearchParams<{ what?: string }>();
  return (
    <View style={styles.safe}>
      <ScreenHead
        title={what ?? '준비 중'}
        sub="준비 중이에요"
        backLabel="‹ 뒤로"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <View style={[styles.body, CONTENT]}>
        <View style={[pxBox(), styles.card]}>
          <Text style={styles.text}>{`${what ?? '이 기능'}은(는) 아직 만들고 있어요. [임시 문구]`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  body: { padding: 16 },
  card: { padding: 14 },
  text: { color: COLOR.ink, fontSize: 13, lineHeight: 19 },
});
