import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../auth/AuthProvider';
import { homeLines } from '../../content/lines';
import { supabase } from '../../lib/supabase';

const RED = '#a8242a';
const BG = '#fbf6ee';

// 홈 자리표시 화면. 진행 중 여행·코스 목록·장부는 이후 단계에서 붙인다 (spec 17-13 순서 4~).
export default function HomeScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [nickname, setNickname] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // RLS 때문에 본인 프로필 행만 조회된다. 실패해도 ‘길동무’로 표시한다.
    supabase
      .from('profiles')
      .select('nickname')
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setNickname(data?.nickname ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const name = nickname && nickname.trim().length > 0 ? nickname : homeLines.defaultName;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.tag}>대프리카 히든 퀘스트</Text>
          <Text style={styles.title}>홈</Text>
          <Text style={styles.body}>하랑이: {homeLines.greeting(name)}</Text>

          <Pressable style={styles.button} onPress={() => router.push('/demo')}>
            <Text style={styles.buttonText}>코스 A 데모 시작</Text>
          </Pressable>
          <Pressable onPress={signOut}>
            <Text style={styles.link}>로그아웃</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  tag: { color: RED, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#2b2118' },
  body: { fontSize: 16, lineHeight: 24, color: '#2b2118' },
  button: { backgroundColor: RED, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: RED, fontSize: 14, textAlign: 'center', paddingVertical: 6 },
});
