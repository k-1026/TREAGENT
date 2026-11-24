/*
 * [course/[id].tsx] 코스 상세와 오늘의 길 (주소: /course/<코스 id>) — 스토리보드 S-04, 목업 #v-course
 * 머리글은 다른 화면과 같은 ScreenHead, 장소와 안내는 .row.px 칸 모양. 길을 불러오고 오류를 처리하는 동작은 그대로다.
 * 목업의 [이 길로 출발]은 넣지 않았다: 출발은 [오늘의 길 고르기]에서 길을 고른 뒤 코스 브리핑의 [확인]으로 한다 [확인 필요].
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Tag } from '../../components/chip';
import { CONTENT } from '../../components/phone_column';
import { ScreenHead } from '../../components/screen_head';
import { ERROR_LABEL, MODE_LABEL, REASON_LABEL, TYPE_LABEL } from '../../lib/labels';
import { usePlace } from '../../lib/place_context';
import { getRoute, RouteResult } from '../../lib/server_api';
import { COLOR, pxBox } from '../../lib/theme';

const goBack = () => (router.canGoBack() ? router.back() : router.replace('/courses'));

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
      <View style={styles.safe}>
        <ScreenHead title="코스" backLabel="‹ 뒤로" onBack={goBack} />
        <View style={[CONTENT, styles.body]}>
          <View style={[pxBox(), styles.card]}>
            <Text style={styles.big}>위치를 먼저 정해 주세요</Text>
          </View>
          <Pressable onPress={() => router.replace('/')} style={({ pressed }) => [pxBox(COLOR.red, COLOR.redDark), styles.btn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.btnText}>처음으로</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const weatherText =
    route?.weather.status === 'ok'
      ? `${Math.round(route.weather.apparentTemperatureC ?? route.weather.temperatureC)}℃`
      : null;

  return (
    <View style={styles.safe}>
      {/* 기준 시각 (F-05): 서버 시계의 시(한국) */}
      <ScreenHead
        title={route && !loading ? route.title : '코스'}
        sub={route && !loading ? `날씨에 맞춘 길 · ${route.asOf.hour}시 기준` : undefined}
        backLabel="‹ 뒤로"
        onBack={goBack}
      />
      <ScrollView contentContainerStyle={[CONTENT, styles.body]}>
        {loading && (
          <View style={{ alignItems: 'center', gap: 8, paddingVertical: 12 }}>
            <ActivityIndicator color={COLOR.red} />
            <Text style={styles.sub}>오늘의 길을 확인하는 중이에요...</Text>
          </View>
        )}

        {error && (
          <>
            <View style={[pxBox(), styles.card]}>
              <Text style={styles.big}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>
            </View>
            <Pressable onPress={retry} style={({ pressed }) => [pxBox(COLOR.red, COLOR.redDark), styles.btn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.btnText}>다시 확인</Text>
            </Pressable>
          </>
        )}

        {!loading && route && (
          <>
            {/* 길 정보 칩: 날씨 모드, 소요 시간, 체감 기온 (목업 #crsChips) */}
            <View style={[pxBox(), styles.card, { gap: 8 }]}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                <Tag label={MODE_LABEL[route.mode] ?? route.mode} tone="sage" />
                <Tag label={`약 ${route.durationMin}분`} tone="yellow" />
                {weatherText ? <Tag label={weatherText} tone="blue" /> : null}
              </View>
              {/* 경로 상태 사유. 사유 문장과 하랑이 대사는 [승인 대사 대기] */}
              <Text style={[styles.reason, { color: route.available ? COLOR.ink : COLOR.redDark }]}>
                {REASON_LABEL[route.reason] ?? route.reason}
              </Text>
            </View>

            {!route.available && route.stations.length === 0 && (
              <View style={[pxBox(), styles.card]}>
                <Text style={styles.sub}>지금은 이 길을 안내할 수 없어요. 이따 다시 확인해 주세요.</Text>
              </View>
            )}

            {route.stations.length > 0 && (
              <Text style={styles.h3}>
                걷는 순서 <Text style={styles.h3Sub}>순서는 안내일 뿐이에요 [임시]</Text>
              </Text>
            )}
            {route.stations.map((s) => (
              <View key={s.id} style={[pxBox(), styles.card, !s.open && { backgroundColor: '#ffe1d6' }]}>
                <Text style={styles.title}>
                  {s.order}. {s.name}
                </Text>
                <Text style={styles.sub}>
                  {TYPE_LABEL[s.type] ?? s.type} · {s.open ? '지금 열려 있어요' : '지금은 닫혀 있어요'}
                </Text>
                {s.hoursText && <Text style={styles.line}>운영: {s.hoursText}</Text>}
                {s.closedText && <Text style={styles.line}>휴무: {s.closedText}</Text>}
                {s.caution && <Text style={[styles.line, { color: COLOR.redDark }]}>주의: {s.caution}</Text>}
              </View>
            ))}

            {route.stations.length > 0 && (
              <Text style={styles.sub}>
                첫 곳: {route.stations[0].name} [임시: 추천 순서의 첫 곳. 가장 가까운 곳 기준은 다음 단계]
              </Text>
            )}
            <View style={[pxBox(), styles.card]}>
              <Text style={styles.line}>[승인 대사 대기] 하랑이 안내 문구는 확정 전이에요.</Text>
            </View>

            <Pressable onPress={retry} style={({ pressed }) => [pxBox(), styles.btn, pressed && { opacity: 0.85 }]}>
              <Text style={[styles.btnText, { color: COLOR.ink }]}>다시 확인</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  body: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  card: { paddingVertical: 12, paddingHorizontal: 14, gap: 4 },
  big: { fontSize: 15, fontWeight: '800', color: COLOR.ink },
  title: { fontSize: 15, fontWeight: '800', color: COLOR.ink },
  sub: { fontSize: 12, color: COLOR.muted, lineHeight: 18 },
  line: { fontSize: 13, lineHeight: 19, color: COLOR.ink },
  reason: { fontSize: 14, fontWeight: '800', lineHeight: 21 },
  h3: { fontSize: 14, fontWeight: '800', color: COLOR.ink, marginTop: 4 },
  h3Sub: { fontSize: 12, fontWeight: '400', color: COLOR.muted },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
