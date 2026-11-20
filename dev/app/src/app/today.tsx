// 오늘의 길 (주소: /today) — 나이대·테마·동행을 고르면 AI가 고른 길과 하랑이 브리핑을 보여 준다
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import {
  AGE_OPTIONS,
  COMPANION_OPTIONS,
  ERROR_LABEL,
  MODE_LABEL,
  REASON_LABEL,
  THEME_OPTIONS,
  TYPE_LABEL,
} from '../lib/labels';
import { usePlace } from '../lib/place_context';
import { AgeGroup, Companion, getTodayRoute, Theme, TodayResult } from '../lib/server_api';

// 고르는 버튼 한 개. 골라진 것은 빨간 바탕으로 보인다.
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: selected ? '#a8242a' : '#e6dccd',
        backgroundColor: selected ? '#a8242a' : '#fff',
      }}
    >
      <Text style={{ color: selected ? '#fff' : '#2b2118', fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export default function TodayScreen() {
  const { place } = usePlace();
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('20s');
  const [theme, setTheme] = useState<Theme>('history');
  const [companion, setCompanion] = useState<Companion>('solo');
  const [result, setResult] = useState<TodayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sameRoute, setSameRoute] = useState(false); // 새로고침했는데 새 조합이 없을 때

  // 처음 받기(refresh=false)와 새로고침(refresh=true)이 같은 함수를 쓴다
  const load = async (refresh: boolean) => {
    if (!place) return;
    setLoading(true);
    setError(null);
    setSameRoute(false);
    const ids = refresh && result?.route ? result.route.places.map((p) => p.id) : undefined;
    const r = await getTodayRoute(place.latitude, place.longitude, { ageGroup, theme, companion }, ids);
    if (r.ok) {
      setResult(r.data);
      setSameRoute(refresh && r.data.route?.isNew === false);
    } else {
      setError(r.error); // 실패해도 보던 길은 그대로 둔다
    }
    setLoading(false);
  };

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

  const route = result?.route;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf6ee' }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#2b2118' }}>오늘의 길</Text>

        <Text style={{ color: '#7a6a5a' }}>나이대</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AGE_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={ageGroup === o.value} onPress={() => setAgeGroup(o.value)} />
          ))}
        </View>

        <Text style={{ color: '#7a6a5a' }}>테마</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {THEME_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={theme === o.value} onPress={() => setTheme(o.value)} />
          ))}
        </View>

        <Text style={{ color: '#7a6a5a' }}>누구와 가나요</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COMPANION_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              selected={companion === o.value}
              onPress={() => setCompanion(o.value)}
            />
          ))}
        </View>

        <Pressable
          onPress={() => load(false)}
          disabled={loading}
          style={{ backgroundColor: '#a8242a', borderRadius: 12, padding: 14, opacity: loading ? 0.6 : 1 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>오늘의 길 받기</Text>
        </Pressable>

        {loading && <ActivityIndicator color="#a8242a" />}
        {error && <Text style={{ color: '#2b2118' }}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>}

        {result && !route && (
          <Text style={{ color: '#2b2118' }}>
            {REASON_LABEL[result.routeReason ?? ''] ?? `${MODE_LABEL[result.mode] ?? '지금은'} — 오늘은 길을 만들지 못했어요`}
          </Text>
        )}

        {route && (
          <>
            {route.briefing && (
              <View style={{ backgroundColor: '#fff3e0', borderRadius: 12, padding: 14 }}>
                <Text style={{ fontWeight: '700', color: '#a8242a', marginBottom: 4 }}>하랑이</Text>
                <Text style={{ color: '#2b2118', lineHeight: 22 }}>{route.briefing.text}</Text>
              </View>
            )}

            <View
              style={{
                backgroundColor: '#fff',
                borderWidth: 1.5,
                borderColor: '#e6dccd',
                borderRadius: 12,
                padding: 14,
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#2b2118' }}>{route.title}</Text>
              <Text style={{ color: '#7a6a5a' }}>
                {route.durationMin ? `소요시간 약 ${route.durationMin}분` : '소요시간을 아직 알 수 없어요'}
              </Text>
              {route.places.map((p, i) => (
                <View key={p.id} style={{ marginTop: 6 }}>
                  <Text style={{ color: '#2b2118', fontWeight: '600' }}>
                    {i + 1}. {p.name} ({TYPE_LABEL[p.type] ?? p.type})
                  </Text>
                  {p.hoursText && <Text style={{ color: '#7a6a5a' }}>운영 {p.hoursText}</Text>}
                  {p.caution && <Text style={{ color: '#a8242a' }}>주의 {p.caution}</Text>}
                </View>
              ))}
            </View>

            {sameRoute && <Text style={{ color: '#7a6a5a' }}>다른 조합이 없어서 같은 길이에요.</Text>}

            <Pressable onPress={() => load(true)} disabled={loading}>
              <Text style={{ color: '#a8242a', fontWeight: '600', opacity: loading ? 0.5 : 1 }}>
                마음에 안 들어요, 새로고침
              </Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.back()}>
          <Text style={{ color: '#7a6a5a' }}>돌아가기</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}