// 코스 상세와 오늘의 길 (주소: /course/<코스 id>) — 스토리보드 S-04
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { ERROR_LABEL, MODE_LABEL, REASON_LABEL, TYPE_LABEL } from '../../lib/labels';
import { usePlace } from '../../lib/place_context';
import { getRoute, RouteResult } from '../../lib/server_api';
import { CONTENT } from '../../components/phone_column';

export default function CourseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { place } = usePlace();
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!place) return; // 위치가 없으면 부르지 않는다 (아래에서 안내 화면을 보여 줌)
    let cancelled = false;
    getRoute(id, place.latitude, place.longitude).then((r) => {
      if (cancelled) return;
      if (r.ok) setRoute(r.data);
      else setError(r.error);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, place, attempt]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setAttempt((a) => a + 1);
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

  const weatherText =
    route?.weather.status === 'ok'
      ? `${Math.round(route.weather.apparentTemperatureC ?? route.weather.temperatureC)}℃`
      : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf6ee' }}>
      <ScrollView contentContainerStyle={[{ padding: 20, gap: 12 }, CONTENT]}>
        {loading && (
          <>
            <ActivityIndicator color="#a8242a" />
            <Text style={{ color: '#7a6a5a' }}>오늘의 길을 확인하는 중이에요...</Text>
          </>
        )}

        {error && (
          <>
            <Text style={{ color: '#2b2118' }}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>
            <Pressable onPress={retry}>
              <Text style={{ color: '#a8242a', fontWeight: '600' }}>다시 확인</Text>
            </Pressable>
          </>
        )}

        {!loading && route && (
          <>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#2b2118' }}>{route.title}</Text>
            <Text style={{ color: '#7a6a5a' }}>
              약 {route.durationMin}분 · {MODE_LABEL[route.mode] ?? route.mode}
              {weatherText ? ` · ${weatherText}` : ''}
            </Text>
            {/* 기준 시각 (F-05): 서버 시계의 시(한국) */}
            <Text style={{ color: '#7a6a5a' }}>{route.asOf.hour}시 기준</Text>

            {/* 경로 상태 사유. 사유 문장과 하랑이 대사는 [승인 대사 대기] */}
            <Text style={{ color: route.available ? '#2b2118' : '#a8242a', fontWeight: '600' }}>
              {REASON_LABEL[route.reason] ?? route.reason}
            </Text>

            {!route.available && route.stations.length === 0 && (
              <Text style={{ color: '#7a6a5a' }}>지금은 이 길을 안내할 수 없어요. 이따 다시 확인해 주세요.</Text>
            )}

            {route.stations.map((s) => (
              <View
                key={s.id}
                style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: s.open ? '#e6dccd' : '#d9a3a5', borderRadius: 12, padding: 14, gap: 4 }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#2b2118' }}>
                  {s.order}. {s.name}
                </Text>
                <Text style={{ color: '#7a6a5a' }}>
                  {TYPE_LABEL[s.type] ?? s.type} · {s.open ? '지금 열려 있어요' : '지금은 닫혀 있어요'}
                </Text>
                {s.hoursText && <Text style={{ color: '#2b2118' }}>운영: {s.hoursText}</Text>}
                {s.closedText && <Text style={{ color: '#2b2118' }}>휴무: {s.closedText}</Text>}
                {s.caution && <Text style={{ color: '#a8242a' }}>주의: {s.caution}</Text>}
              </View>
            ))}

            {route.stations.length > 0 && (
              <Text style={{ color: '#7a6a5a' }}>
                첫 곳: {route.stations[0].name} [임시: 추천 순서의 첫 곳. 가장 가까운 곳 기준은 다음 단계]
              </Text>
            )}
            <Text style={{ color: '#7a6a5a' }}>[승인 대사 대기] 하랑이 안내 문구는 확정 전이에요.</Text>

            <Pressable onPress={retry}>
              <Text style={{ color: '#a8242a', fontWeight: '600' }}>다시 확인</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: '#a8242a', fontWeight: '600' }}>코스 목록</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}