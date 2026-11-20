// 코스 브리핑 (주소: /today/route/0~2) — 목업 "코스 브리핑". 고른 길을 하랑이가 짧게 소개한다.
import { router, useLocalSearchParams } from 'expo-router';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { Tag } from '../../../components/chip';
import { MODE_LABEL, TYPE_LABEL } from '../../../lib/labels';
import { COLOR, pxBox } from '../../../lib/theme';
import { useToday } from '../../../lib/today_context';

const HARANGI = require('../../../../assets/harangi_expressions.webp');
const STAMP = require('../../../../assets/stamp_nungeum.webp');
const FRAME = 180; // 하랑이 표정 그림은 가로로 3칸이고, 가운데 칸(기본 표정)만 잘라서 보여 준다

export default function RouteBriefScreen() {
  const { n } = useLocalSearchParams<{ n: string }>();
  const today = useToday();
  const index = Number(n);
  const route = today.result?.routes?.[index];

  if (!route) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream, padding: 20, gap: 12 }}>
        <Text style={{ color: COLOR.ink }}>길을 찾을 수 없어요.</Text>
        <Pressable onPress={() => router.replace('/today')}>
          <Text style={{ color: COLOR.red, fontWeight: '700' }}>오늘의 길 받으러 가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const w = today.result?.weather;
  const modeText = MODE_LABEL[today.result?.mode ?? ''] ?? '';
  const weatherText = w?.status === 'ok' ? `${modeText} · ${Math.round(w.temperatureC)}°` : modeText;
  // 하랑이 말풍선: 서버가 만든 브리핑이 있으면 그것, 없으면 길을 고른 이유(규칙 문장)
  const line = route.briefing?.text ?? route.reason;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={{ paddingHorizontal: 8, gap: 4 }}>
          <Text style={{ fontSize: 13, color: COLOR.muted, fontWeight: '700' }}>하랑이가 알려 줄게요</Text>
          {weatherText ? (
            <Text style={{ fontSize: 15, color: COLOR.ink, fontWeight: '700' }}>현재 날씨 · {weatherText}</Text>
          ) : null}
        </View>

        <View style={pxBox()}>
          <View style={{ padding: 16, gap: 8, borderBottomWidth: 2, borderBottomColor: COLOR.ink }}>
            <Text style={{ fontSize: 22, lineHeight: 30, fontWeight: '800', color: COLOR.ink }}>{route.title}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {[...new Set(route.places.map((p) => p.type))].map((t) => (
                <Tag key={t} label={TYPE_LABEL[t] ?? t} tone={t === 'indoor' || t === 'exhibit' ? 'blue' : 'sage'} />
              ))}
              <Tag label={route.durationMin ? `${route.durationMin}분` : '시간 확인 필요'} tone="yellow" />
            </View>
          </View>
          <View style={{ padding: 16, gap: 18 }}>
            <View style={{ position: 'absolute', left: 35, top: 40, bottom: 40, width: 4, backgroundColor: '#d42a2a' }} />
            {route.places.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <Image source={STAMP} style={{ width: 40, height: 40 }} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 17, fontWeight: '800', color: COLOR.ink }}>
                    {i + 1}. {p.name}
                  </Text>
                  <Text style={{ fontSize: 13, color: COLOR.muted }}>
                    {TYPE_LABEL[p.type] ?? p.type}
                    {p.hoursText ? ` · 운영 ${p.hoursText}` : ''}
                  </Text>
                  {p.caution ? <Text style={{ fontSize: 12, color: COLOR.redDark }}>주의 {p.caution}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[pxBox(), { padding: 14 }]}>
          <Text style={{ fontSize: 15, lineHeight: 24, color: COLOR.ink }}>{line}</Text>
        </View>

        <View style={{ height: FRAME, overflow: 'hidden', alignItems: 'center' }}>
          <View style={{ width: FRAME, height: FRAME, overflow: 'hidden' }}>
            <Image source={HARANGI} style={{ width: FRAME * 3, height: FRAME, marginLeft: -FRAME }} resizeMode="stretch" />
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={() => router.back()}
            style={[pxBox(), { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' }]}
          >
            <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 16 }}>이전으로</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              today.choose(index); // 고른 길을 기억해 둔다 (출발·여행 화면은 아직 없다)
              router.dismissTo('/');
            }}
            style={[pxBox(COLOR.red, COLOR.redDark), { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' }]}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>확인</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}