/*
 * [courses.tsx] 모든 길 (주소: /courses) — 목업 storyboard/app_home_mockup_v1.html의 #v-all (스토리보드 S-14 → S-04의 첫 단계)
 * 머리글은 다른 화면과 같은 ScreenHead, 길 한 줄은 .row.px 칸 모양. 불러오기·오류 처리 동작은 그대로다.
 * 홈에서는 "중구 밖" 상태의 [중구 코스 둘러보기] 큰 버튼으로 온다 (홈 목업 갱신본에서 빠른 버튼의 [모든 길]이 빠짐).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { ERROR_LABEL, TYPE_LABEL } from '../lib/labels';
import { usePlace } from '../lib/place_context';
import { CourseCard, getCourses } from '../lib/server_api';
import { COLOR, pxBox } from '../lib/theme';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function CoursesScreen() {
  const { place } = usePlace();
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true); // 처음부터 불러오는 중으로 시작
  const [attempt, setAttempt] = useState(0); // 다시 해 보기를 누를 때마다 1씩 커져서 다시 불러온다

  useEffect(() => {
    let cancelled = false; // 화면을 떠난 뒤 늦게 온 응답은 무시한다
    getCourses().then((r) => {
      if (cancelled) return;
      if (r.ok) setCourses(r.data);
      else setError(r.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // 다시 해 보기: 버튼을 눌렀을 때(이벤트 핸들러)는 상태를 바로 바꿔도 된다
  const retry = () => {
    setLoading(true);
    setError(null);
    setAttempt((a) => a + 1);
  };

  // 위치를 아직 안 정했으면 위치 화면으로 보낸다 (앱을 다시 켜면 메모리가 비기 때문). 오늘의 길(today.tsx)과 같은 방식 (#317)
  if (!place) {
    return (
      <View style={styles.safe}>
        <ScreenHead title="모든 길" sub="중구 안의 모든 길" backLabel="‹ 뒤로" onBack={goBack} />
        <View style={[CONTENT, styles.body]}>
          <View style={[pxBox(), styles.card]}>
            <Text style={styles.big}>위치를 먼저 정해 주세요</Text>
          </View>
          <Pressable onPress={() => router.replace('/location')} style={({ pressed }) => [pxBox(COLOR.red, COLOR.redDark), styles.btn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.btnText}>위치 정하러 가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      <ScreenHead title="모든 길" sub="중구 안의 모든 길" backLabel="‹ 뒤로" onBack={goBack} />
      <ScrollView contentContainerStyle={[CONTENT, styles.body]}>
        {loading && <ActivityIndicator color={COLOR.red} />}

        {error && (
          <>
            <View style={[pxBox(), styles.card]}>
              <Text style={styles.big}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>
            </View>
            <Pressable onPress={retry} style={({ pressed }) => [pxBox(COLOR.red, COLOR.redDark), styles.btn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.btnText}>다시 해 보기</Text>
            </Pressable>
          </>
        )}

        {!loading && !error && courses?.length === 0 && (
          <View style={[pxBox(), styles.card]}>
            <Text style={styles.big}>아직 열린 코스가 없어요</Text>
          </View>
        )}

        {courses?.map((c) => (
          <Pressable key={c.id} onPress={() => router.push(`/course/${c.id}`)} style={[pxBox(), styles.card]}>
            <Text style={styles.title}>{c.title}</Text>
            <Text style={styles.sub}>
              {c.district ?? ''} · 약 {c.durationMin}분 · {c.types.map((t) => TYPE_LABEL[t] ?? t).join('·')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  body: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  card: { paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  big: { fontSize: 15, fontWeight: '800', color: COLOR.ink },
  title: { fontSize: 15, fontWeight: '800', color: COLOR.ink },
  sub: { fontSize: 12, color: COLOR.muted, lineHeight: 18 },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
