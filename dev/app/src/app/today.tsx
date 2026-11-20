// 오늘의 길 조건 고르기 (주소: /today) — 나이대·테마·동행을 고르고 받으면 후보 길 3개 화면(/today/routes)으로 간다
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Chip } from '../components/chip';
import { ScreenHead } from '../components/screen_head';
import { COLOR, pxBox } from '../lib/theme';
import { useToday } from '../lib/today_context';
import { useProfile } from '../lib/profile_context';
import { COMPANION_OPTIONS, ERROR_LABEL, MODE_LABEL, REASON_LABEL, THEME_OPTIONS } from '../lib/labels';
import { usePlace } from '../lib/place_context';
import { Companion, getTodayRoutes, Theme } from '../lib/server_api';


export default function TodayScreen() {
  const { place } = usePlace();
  const today = useToday();
  const { profile } = useProfile();
  const ageGroup = profile?.ageGroup; // 처음 만날 때 정한 나이대를 서버에서 불러온다
  const [theme, setTheme] = useState<Theme>('history');
  const [companion, setCompanion] = useState<Companion>('solo');
  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState<string | null>(null); // 길을 하나도 못 만든 이유
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!place || !ageGroup) return;
    setLoading(true);
    setError(null);
    setEmpty(null);
    const prefs = { ageGroup, theme, companion };
    const r = await getTodayRoutes(place.latitude, place.longitude, prefs);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const routes = r.data.routes ?? (r.data.route ? [r.data.route] : []);
    if (routes.length === 0) {
      setEmpty(REASON_LABEL[r.data.routeReason ?? ''] ?? `${MODE_LABEL[r.data.mode] ?? '지금은'} — 오늘은 길을 만들지 못했어요`);
      return;
    }
    today.set({ prefs, result: { ...r.data, routes }, rounds: 0 });
    router.push('/today/routes');
  };

  if (!place) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream, padding: 20, gap: 12 }}>
        <Text style={{ color: COLOR.ink }}>위치를 먼저 정해 주세요.</Text>
        <Pressable onPress={() => router.replace('/')}>
          <Text style={{ color: COLOR.red, fontWeight: '700' }}>처음으로</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScreenHead title="오늘의 길" sub="AI가 오늘 날씨에 맞는 길 3개를 골라 줘요" backLabel="‹ 홈" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>테마</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {THEME_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={theme === o.value} onPress={() => setTheme(o.value)} />
          ))}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>누구와 가나요</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COMPANION_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={companion === o.value} onPress={() => setCompanion(o.value)} />
          ))}
        </View>

        <Pressable
          onPress={load}
          disabled={loading}
          style={[pxBox(COLOR.red, COLOR.redDark), { padding: 16, opacity: loading ? 0.6 : 1, marginTop: 8 }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>AI 오늘의 길 받기</Text>
        </Pressable>

        {loading && (
          <View style={{ gap: 6, alignItems: 'center' }}>
            <ActivityIndicator color={COLOR.red} />
            <Text style={{ color: COLOR.muted, fontSize: 11 }}>하랑이가 길 3개를 고르는 중이에요. 조금 걸릴 수 있어요.</Text>
          </View>
        )}
        {error && <Text style={{ color: COLOR.ink }}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>}
        {empty && <Text style={{ color: COLOR.ink }}>{empty}</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}