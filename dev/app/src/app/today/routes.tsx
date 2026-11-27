// 오늘의 길 후보 (주소: /today/routes) — 목업 "오늘의 길 3개". 카드를 누르면 하랑이 브리핑(/today/route/N)으로 간다.
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { RouteCard } from '../../components/route_card';
import { ScreenHead } from '../../components/screen_head';
import { ERROR_LABEL } from '../../lib/labels';
import { usePlace } from '../../lib/place_context';
import { getTodayRoutes } from '../../lib/server_api';
import { COLOR, pxBox } from '../../lib/theme';
import { useToday } from '../../lib/today_context';
import { CONTENT } from '../../components/phone_column';

export default function RoutesScreen() {
  const { place } = usePlace();
  const today = useToday();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const routes = today.result?.routes ?? [];

  if (!today.prefs || routes.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: COLOR.cream, padding: 20, gap: 12 }}>
        <Text style={{ color: COLOR.ink }}>받아 둔 길이 없어요.</Text>
        <Pressable onPress={() => router.replace('/today')}>
          <Text style={{ color: COLOR.red, fontWeight: '700' }}>오늘의 길 받으러 가기</Text>
        </Pressable>
      </View>
    );
  }

  // 다른 길 3개: 지금 보여 준 장소를 모두 빼고 새 조합을 받는다
  const reroll = async () => {
    if (!place || !today.prefs) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    const shown = routes.flatMap((r) => r.places.map((p) => p.id));
    const r = await getTodayRoutes(place.latitude, place.longitude, today.prefs, shown);
    setLoading(false);
    if (!r.ok) {
      setError(r.error); // 실패해도 보던 길은 그대로 둔다
      return;
    }
    const next = r.data.routes ?? (r.data.route ? [r.data.route] : []);
    if (next.length === 0 || next.every((n) => n.isNew === false)) {
      setNotice('다른 길이 더 없어요. 지금 길 중에서 골라 주세요.');
      return;
    }
    today.set({ prefs: today.prefs, result: { ...r.data, routes: next }, rounds: today.rounds + 1 });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScreenHead
        title="오늘의 길"
        sub={today.rounds ? `새로 불러온 길 ${today.rounds + 1}번째 묶음` : `날씨에 맞는 길 ${routes.length}개`}
        backLabel="‹ 홈"
        onBack={() => router.dismissTo('/')}
      />
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 12 }, CONTENT]}>
        {routes.map((r, i) => (
          <RouteCard
            key={`${i}-${r.places.map((p) => p.id).join('-')}`}
            route={r}
            index={i}
            onPress={() => router.push(`/today/route/${i}`)}
          />
        ))}

        {notice && <Text style={{ color: COLOR.muted, fontSize: 12 }}>{notice}</Text>}
        {error && <Text style={{ color: COLOR.ink }}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>}
        {loading && <ActivityIndicator color={COLOR.red} />}

        <Pressable
          onPress={reroll}
          disabled={loading}
          style={[pxBox(), { padding: 12, alignItems: 'center', opacity: loading ? 0.5 : 1 }]}
        >
          <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 12 }}>
            마음에 드는 길이 없어요 · 다른 길 3개 새로 불러오기
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}