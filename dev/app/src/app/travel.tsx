// 여행 지도 (주소: /travel) — 목업 "여행 지도 (S-05)".
// 기본 화면: 헤더 + 지도 + 안내(코스 카드) + 하단 도크. 확대하면 지도가 넓어지고 안내가 숨는다.
// 내 위치는 경로 계산 때 서버로 보내고(저장·로그하지 않음), 지도에는 기기에서 읽은 값을 쓴다.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { CoursePlacesCard } from '../components/course_places_card';
import { TmapView } from '../components/tmap_view';
import { getCurrentLocation } from '../lib/location';
import { getWalk, WalkResult } from '../lib/server_api';
import { BTN_RED, COLOR, pxBox } from '../lib/theme';
import type { MapState } from '../lib/tmap_html';
import { useToday } from '../lib/today_context';

const APP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '';
const STAMP = require('../../assets/stamp_nungeum.webp');
const STAMPS_DONE = 0; // TODO(PR F): 받은 도장 수는 방문 기록(서버)에서 가져온다

type Phase =
  | { name: 'loading' }
  | { name: 'error' }
  | { name: 'ready'; walk: WalkResult; me: { lat: number; lng: number } | null };

const distText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`);
const minText = (sec: number) => `${Math.max(1, Math.round(sec / 60))}분`;

export default function TravelScreen() {
  const today = useToday();
  const route = today.chosen !== null ? today.result?.routes?.[today.chosen] : undefined;
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [attempt, setAttempt] = useState(0); // "다시 시도"를 누르면 늘어난다
  const [full, setFull] = useState(false); // 확대(전체 화면) 모드
  // 장소를 눌렀을 때의 지시. n은 누를 때마다 늘어서, 같은 장소를 다시 눌러도 지도가 움직인다. index가 null이면 경로 전체.
  const [focus, setFocus] = useState<{ n: number; index: number | null } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    if (!route) return;
    let alive = true; // 화면을 떠난 뒤 늦게 온 응답은 버린다
    setPhase({ name: 'loading' });
    setFocus(null);
    (async () => {
      const loc = await getCurrentLocation();
      const me = loc.status === 'ok' ? { lat: loc.latitude, lng: loc.longitude } : null;
      const r = await getWalk(
        route.places.map((p) => p.id),
        me ? { latitude: me.lat, longitude: me.lng } : undefined, // 위치를 못 읽으면 첫 장소부터 경로를 잡는다
      );
      if (!alive) return;
      setPhase(r.ok ? { name: 'ready', walk: r.data, me } : { name: 'error' });
    })();
    return () => { alive = false; };
  }, [route, attempt]);

  // state를 useMemo로 고정해야 렌더마다 지도를 다시 그리지 않는다. 핀 색은 도장 수로 정한다 (완료·다음·예정).
  const state = useMemo<MapState | null>(() => {
    if (phase.name !== 'ready') return null;
    const target = focus && focus.index !== null ? phase.walk.places[focus.index] : undefined;
    return {
      places: phase.walk.places.map(({ id, name, lat, lng }, i) => ({
        id, name, lat, lng,
        status: i < STAMPS_DONE ? ('done' as const) : i === STAMPS_DONE ? ('next' as const) : ('todo' as const),
      })),
      path: phase.walk.path,
      me: phase.me,
      focus: focus ? { n: focus.n, target: target ? { lat: target.lat, lng: target.lng } : null } : undefined,
    };
  }, [phase, focus]);

  if (!route) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream, padding: 20, gap: 12 }}>
        <Text style={{ color: COLOR.ink }}>고른 길이 없어요.</Text>
        <Pressable onPress={() => router.replace('/today')}>
          <Text style={{ color: COLOR.red, fontWeight: '700' }}>오늘의 길 받으러 가기</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const total = route.places.length;
  const done = STAMPS_DONE;
  const pressPlace = (i: number) => setFocus((f) => ({ n: (f?.n ?? 0) + 1, index: i }));
  const showAll = () => setFocus((f) => ({ n: (f?.n ?? 0) + 1, index: null }));

  // 장소별 도보 시간 한 줄. 내 위치를 보냈으면 legs[0]이 "내 위치 → 첫 장소", 아니면 legs[i-1]이 "앞 장소 → i번 장소"다.
  // TODO: 걷는 중에는 "지금 내 위치 → 다음 장소"로 다시 계산해야 한다 (이탈·재경로 단계).
  const notes =
    phase.name === 'ready'
      ? route.places.map((_, i) => {
          const leg = phase.walk.startIncluded ? phase.walk.legs[i] : phase.walk.legs[i - 1];
          if (!leg) return undefined;
          return `${i === 0 && phase.walk.startIncluded ? '내 위치에서' : '앞 장소에서'} 도보 약 ${minText(leg.time)}`;
        })
      : [];

  const navBtn = { backgroundColor: COLOR.cream, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 11 };

  const goBack = () => {
    if (full) { setFull(false); return; } // 확대 중이면 먼저 줄이기
    if (router.canGoBack()) router.back(); // 이전 화면이 있으면 그곳으로
    else router.replace('/today'); // 없으면 오늘의 길로
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream }}>
      {/* 헤더 */}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLOR.beam,
          borderBottomWidth: 3, borderBottomColor: COLOR.ink,
        }}
      >
        <Pressable onPress={goBack} style={navBtn}>
          <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 14 }}>‹ 뒤로</Text>
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 6 }}>
          <Text
            style={{
              color: '#fff', fontWeight: '800', fontSize: 17,
              textShadowColor: COLOR.ink, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0,
            }}
          >
            여행 지도
          </Text>
          <Text numberOfLines={1} style={{ color: '#fff3e0', fontSize: 12 }}>
            {route.title} · 도장 {done}/{total}
          </Text>
        </View>
        <Pressable onPress={() => router.dismissTo('/')} style={navBtn}>
          <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 14 }}>⌂ 홈</Text>
        </Pressable>
      </View>

      {/* 지도 영역 (확대하면 남는 공간을 모두 쓴다) */}
      <View
        style={[
          { overflow: 'hidden', backgroundColor: COLOR.cream2 },
          full
            ? { flex: 1 }
            : { height: 290, marginHorizontal: 16, marginTop: 12, borderWidth: 3, borderColor: COLOR.ink },
        ]}
      >
        {phase.name === 'loading' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <ActivityIndicator color={COLOR.red} />
            <Text style={{ color: COLOR.muted }}>도보 경로를 찾고 있어요</Text>
          </View>
        ) : null}
        {phase.name === 'error' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 }}>
            <Text style={{ color: COLOR.ink }}>도보 경로를 불러오지 못했어요.</Text>
            <Pressable
              onPress={() => setAttempt((n) => n + 1)}
              style={[pxBox(BTN_RED, COLOR.redDark), { paddingVertical: 10, paddingHorizontal: 20 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}
        {phase.name === 'ready' && state ? (
          <>
            <TmapView appKey={APP_KEY} center={phase.walk.places[0]} state={state} />
            <Pressable
              onPress={() => setFull((v) => !v)}
              style={{ position: 'absolute', right: 10, bottom: 10, zIndex: 5, backgroundColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 9 }}
            >
              <Text style={{ color: '#fff3e0', fontWeight: '800', fontSize: 13 }}>{full ? '⤡ 줄이기' : '⤢ 확대'}</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {/* 안내 영역: 코스 카드. 장소(1·2·3)를 누르면 지도가 그 장소로 확대된다 (기본 화면만) */}
      {!full ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 14, gap: 10 }}>
          {phase.name === 'ready' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: COLOR.muted }}>
                전체 {distText(phase.walk.distance)} · 도보 약 {minText(phase.walk.time)}
              </Text>
              <Pressable onPress={showAll}>
                <Text style={{ fontSize: 13, color: COLOR.red, fontWeight: '800' }}>전체 경로 보기</Text>
              </Pressable>
            </View>
          ) : null}
          <CoursePlacesCard
            route={route}
            selected={focus?.index ?? null}
            notes={notes}
            onPlacePress={phase.name === 'ready' ? pressPlace : undefined}
          />
          {phase.name === 'ready' ? (
            <Text style={{ fontSize: 12, color: COLOR.muted }}>장소를 누르면 지도에서 그 장소를 크게 볼 수 있어요.</Text>
          ) : null}
        </ScrollView>
      ) : null}

      {/* 하단 도크: 코스 현황 + 도장 확인 + 도착 확인 (기본·확대 공통) */}
      {phase.name === 'ready' ? (
        <View style={{ backgroundColor: COLOR.cream, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLOR.ink, marginRight: 2 }}>코스</Text>
            {route.places.map((p, i) => (
              <Image key={p.id} source={STAMP} style={{ width: 34, height: 34, opacity: i < done ? 1 : 0.35 }} resizeMode="contain" />
            ))}
            <Text numberOfLines={1} style={{ marginLeft: 'auto', fontSize: 13, color: COLOR.redDark, fontWeight: '800', flexShrink: 1 }}>
              {done >= total ? '모두 완료' : `지금 ${done + 1}번 장소`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => showToast('도장 확인은 준비 중이에요')}
              style={[pxBox(), { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' }]}
            >
              <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 15 }}>도장 확인</Text>
            </Pressable>
            <Pressable
              onPress={() => showToast('도착 확인은 준비 중이에요')}
              style={[pxBox(BTN_RED, COLOR.redDark), { flex: 1.4, height: 52, alignItems: 'center', justifyContent: 'center' }]}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                {done >= total ? '완주 한 장 보기' : '도착 확인하기'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* 토스트 */}
      {toast ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 130, alignItems: 'center' }} pointerEvents="none">
          <Text style={{ backgroundColor: COLOR.ink, color: '#fff3e0', paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, fontWeight: '700' }}>
            {toast}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}