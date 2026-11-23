// 코스 목록 (주소: /courses) — 스토리보드 S-14 → S-04의 첫 단계
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text } from 'react-native';
import { ERROR_LABEL, TYPE_LABEL } from '../lib/labels';
import { usePlace } from '../lib/place_context';
import { CourseCard, getCourses } from '../lib/server_api';
import { CONTENT } from '../components/phone_column';

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

  // 위치를 아직 안 정했으면 처음 화면으로 돌려보낸다 (앱을 다시 켜면 메모리가 비기 때문)
  if (!place) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf6ee', padding: 20, gap: 12 }}>
        <Text style={{ color: '#2b2118' }}>위치를 먼저 정해 주세요.</Text>
        <Pressable onPress={() => router.replace('/')}>
          <Text style={{ color: '#a8242a', fontWeight: '600' }}>처음으로</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf6ee' }}>
      <ScrollView contentContainerStyle={[{ padding: 20, gap: 12 }, CONTENT]}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#2b2118' }}>코스 둘러보기</Text>

        {loading && <ActivityIndicator color="#a8242a" />}

        {error && (
          <>
            <Text style={{ color: '#2b2118' }}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>
            <Pressable onPress={retry}>
              <Text style={{ color: '#a8242a', fontWeight: '600' }}>다시 해 보기</Text>
            </Pressable>
          </>
        )}

        {!loading && !error && courses?.length === 0 && (
          <Text style={{ color: '#2b2118' }}>아직 열린 코스가 없어요.</Text>
        )}

        {courses?.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push(`/course/${c.id}`)}
            style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e6dccd', borderRadius: 12, padding: 14, gap: 4 }}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#2b2118' }}>{c.title}</Text>
            <Text style={{ color: '#7a6a5a' }}>
              {c.district ?? ''} · 약 {c.durationMin}분 · {c.types.map((t) => TYPE_LABEL[t] ?? t).join('·')}
            </Text>
          </Pressable>
        ))}

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: '#a8242a', fontWeight: '600' }}>뒤로</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}