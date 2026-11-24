// 여행 지도 (주소: /travel) — 목업 "여행 지도 (S-05)" + 길 안내.
// 내 위치는 처음 경로를 받을 때와 "새 경로 보기"를 누를 때만 서버로 보낸다. 걷는 동안의 위치는 기기 안에서만 쓴다.
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { CoursePlacesCard } from '../components/course_places_card';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { TmapView } from '../components/tmap_view';
import { getCurrentLocation } from '../lib/location';
import { getWalk, WalkPlace, WalkResult } from '../lib/server_api';
import { BTN_RED, COLOR, pxBox } from '../lib/theme';
import type { MapState } from '../lib/tmap_html';
import { useToday } from '../lib/today_context';
import { useLiveLocation } from '../lib/use_live_location';
import { buildTrack, distM, LatLng, nextStep, pointAt, project, remainingPath, turnMark } from '../lib/walk_nav';

const APP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '';
const STAMP = require('../../assets/stamp_nungeum.webp');

// 아래 기준값은 팀이 정하기 전의 임시 값이다 (dev/CLAUDE.md "결정 필요": 이탈 기준 N미터·M초, 도착 판정).
const OFF_ROUTE_M = 40; // 경로에서 이만큼 벗어나면 이탈 후보
const OFF_ROUTE_SEC = 10; // 이 시간 동안 계속 벗어나 있으면 새 경로를 제안한다
const SNOOZE_SEC = 60; // "그대로 가기"를 누르면 이 시간 동안 다시 묻지 않는다
const ARRIVE_M = 30; // 장소에서 이 거리 안이면 도착으로 본다
const SIM_STEP_M = 15; // 시뮬레이션에서 1초마다 걷는 거리

type Phase =
  | { name: 'loading' }
  | { name: 'error' }
  // all: 처음 받은 장소 전체(핀용), walk: 지금 따라가는 경로, offset: walk가 시작하는 장소 번호(새 경로를 받으면 커진다)
  | { name: 'ready'; all: WalkPlace[]; walk: WalkResult; offset: number };

type Focus = { n: number; index: number | null }; // n은 누를 때마다 늘어난다. null이면 경로 전체

const distText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);
const minText = (sec: number) => `${Math.max(1, Math.round(sec / 60))}분`;

export default function TravelScreen() {
  const today = useToday();
  const route = today.chosen !== null ? today.result?.routes?.[today.chosen] : undefined;
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [attempt, setAttempt] = useState(0); // "다시 시도"를 누르면 늘어난다
  const [full, setFull] = useState(false); // 확대(전체 화면) 모드
  const [focus, setFocus] = useState<Focus | null>(null);
  const [follow, setFollow] = useState(true); // 걸을 때 지도가 내 위치를 따라간다
  const [reached, setReached] = useState(0); // 도착을 확인한 장소 수 (TODO(PR F): 서버의 방문 기록·도장으로 바꾼다)
  const [arrived, setArrived] = useState(false); // 다음 장소 도착을 확인했는가
  const [offRoute, setOffRoute] = useState(false); // 새 경로를 제안 중인가
  const [rerouting, setRerouting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 개발용 시뮬레이션 (컴퓨터에서 걸어 볼 수 없어서)
  const [sim, setSim] = useState(false);
  const [simAlong, setSimAlong] = useState(0);
  const [simOff, setSimOff] = useState(false);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // 처음 경로 받기: 내 위치를 한 번 읽어 서버에 보낸다. 위치를 못 읽으면 첫 장소부터 경로를 잡는다.
  useEffect(() => {
    if (!route) return;
    let alive = true; // 화면을 떠난 뒤 늦게 온 응답은 버린다
    setPhase({ name: 'loading' });
    setFocus(null); setReached(0); setArrived(false); setOffRoute(false); setSim(false); setFollow(true);
    (async () => {
      const loc = await getCurrentLocation();
      const r = await getWalk(
        route.places.map((p) => p.id),
        loc.status === 'ok' ? { latitude: loc.latitude, longitude: loc.longitude } : undefined,
      );
      if (!alive) return;
      setPhase(r.ok ? { name: 'ready', all: r.data.places, walk: r.data, offset: 0 } : { name: 'error' });
      if (r.ok) setFocus({ n: 1, index: null }); // 경로 전체가 보이게 한 번 맞춘다
    })();
    return () => { alive = false; };
  }, [route, attempt]);

  const ready = phase.name === 'ready' ? phase : null;
  const walk = ready?.walk ?? null;
  const all = ready?.all ?? null;
  const offset = ready?.offset ?? 0;
  const track = useMemo(() => (walk ? buildTrack(walk.path) : null), [walk]);

  // 내 위치: 시뮬레이션 중이면 경로 위를 걷는 가짜 위치, 아니면 실제 위치
  const { pos: gps, denied } = useLiveLocation(phase.name === 'ready');
  const me = useMemo<LatLng | null>(() => {
    if (sim && track) {
      const p = pointAt(track, simAlong);
      return simOff ? { lat: p.lat + 0.0007, lng: p.lng + 0.0007 } : p; // 벗어나기: 약 100m 옆
    }
    return gps ? { lat: gps.lat, lng: gps.lng } : null;
  }, [sim, simAlong, simOff, track, gps]);
  useEffect(() => {
    if (!sim || !track) return;
    const id = setInterval(() => setSimAlong((a) => Math.min(track.total, a + SIM_STEP_M)), 1000);
    return () => clearInterval(id);
  }, [sim, track]);

  // 경로 위 진행: 남은 거리, 다음 안내, 이탈
  const lastAlong = useRef(0);
  const prog = useMemo(() => (track && me ? project(track, me, Math.max(0, lastAlong.current - 60)) : null), [track, me]);
  useEffect(() => { if (prog) lastAlong.current = prog.along; }, [prog]);
  useEffect(() => { lastAlong.current = 0; }, [walk]); // 새 경로면 처음부터 다시 잰다

  const k = reached - offset; // 지금 경로 안에서 다음 장소까지의 구간 번호
  const endAlong = walk && track && k >= 0 && k < walk.legEnds.length ? track.cum[Math.min(walk.legEnds[k], track.cum.length - 1)] : null;
  const toNext = prog && endAlong !== null ? Math.max(0, endAlong - prog.along) : null; // 다음 장소까지(m)
  const remain = prog && track ? Math.max(0, track.total - prog.along) : null; // 마지막 장소까지(m)
  const remainSec = remain !== null && track && walk && track.total > 0 ? walk.time * (remain / track.total) : null;
  const step = walk && track && prog ? nextStep(walk.steps, track, prog.along) : null;

  // 이탈 감지: OFF_ROUTE_M보다 멀리 OFF_ROUTE_SEC 동안 벗어나 있으면 새 경로를 제안한다. 자동으로 바꾸지 않는다.
  const offSince = useRef<number | null>(null);
  const snoozeUntil = useRef(0);
  useEffect(() => {
    if (!prog) return;
    if (prog.off <= OFF_ROUTE_M) {
      offSince.current = null;
      setOffRoute(false);
      return;
    }
    const now = Date.now();
    offSince.current ??= now;
    if (now - offSince.current >= OFF_ROUTE_SEC * 1000 && now > snoozeUntil.current) setOffRoute(true);
  }, [prog]);

  const keepRoute = () => {
    setOffRoute(false);
    offSince.current = null;
    snoozeUntil.current = Date.now() + SNOOZE_SEC * 1000;
  };
  const acceptReroute = async () => {
    if (!all || !me) return;
    setOffRoute(false);
    setRerouting(true);
    // 아직 도착하지 않은 장소들로, 지금 내 위치에서 새 경로를 받는다
    const r = await getWalk(all.slice(reached).map((p) => p.id), { latitude: me.lat, longitude: me.lng });
    setRerouting(false);
    if (!r.ok) {
      showToast('새 경로를 못 찾았어요. 지금 경로를 유지해요');
      keepRoute();
      return;
    }
    setPhase({ name: 'ready', all, walk: r.data, offset: reached });
    setFocus((f) => ({ n: (f?.n ?? 0) + 1, index: null })); // 새 경로가 다 보이게 맞춘다
    setSimOff(false);
    setSimAlong(0);
    offSince.current = null;
  };

  // 도착 확인: 기기에서 내 위치와 장소의 거리를 잰다. 이미 확인했으면 다음 단계(미션 자리)로 넘어간다.
  const onArrive = () => {
    if (!all || reached >= all.length) return;
    if (arrived) {
      // TODO(PR F): 미션을 마치고 서버에 방문을 기록해 도장을 받는다. 지금은 화면 상태만 바꾸고 저장하지 않는다.
      setReached((n) => n + 1);
      setArrived(false);
      showToast('임시: 다음 장소로 넘어가요 (도장 저장은 PR F)');
      return;
    }
    if (!me) {
      showToast('내 위치를 아직 못 읽었어요');
      return;
    }
    const d = distM(me, all[reached]);
    if (d <= ARRIVE_M) {
      setArrived(true);
      showToast('도착 확인됨 · 이제 미션을 할 수 있어요');
    } else {
      showToast(`아직 ${Math.round(d)}m 남았어요`);
    }
  };

  // 지도에 그릴 경로선: 걸으면서 지나온 부분은 뺀다. 경로에서 많이 벗어났으면 마지막 위치 기준으로 둔다.
  const shownPath = useMemo(
    () => (track ? remainingPath(track, prog && prog.off <= OFF_ROUTE_M ? prog.along : lastAlong.current) : []),
    [track, prog],
  );
  // 걸을 때 지도가 내 위치를 따라간다. 위치 정확도가 낮으면(컴퓨터 브라우저 등) 따라가지 않는다.
  const followOn = follow && !!me && (sim || (gps?.accuracy ?? Infinity) <= 100);

  // state를 useMemo로 고정해야 렌더마다 지도를 다시 그리지 않는다. 핀 색은 도착한 수로 정한다 (완료·다음·예정).
  const state = useMemo<MapState | null>(() => {
    if (!all || !walk) return null;
    const target = focus && focus.index !== null ? all[focus.index] : null;
    return {
      places: all.map(({ id, name, lat, lng }, i) => ({
        id, name, lat, lng,
        status: i < reached ? ('done' as const) : i === reached ? ('next' as const) : ('todo' as const),
      })),
      path: shownPath,
      me,
      follow: followOn,
      focus: focus ? { n: focus.n, target: target ? { lat: target.lat, lng: target.lng } : null, points: walk.path } : undefined,
    };
  }, [all, walk, me, focus, reached, shownPath, followOn]);

  if (!route) {
    return (
      // 고른 길이 없을 때: 다른 화면과 같은 머리글 + 안내 + 큰 버튼 (홈 목업 갱신본의 머리글·칸 모양)
      <View style={{ flex: 1, backgroundColor: COLOR.cream }}>
        <ScreenHead
          title="여행 지도"
          sub="고른 길이 있어야 지도를 볼 수 있어요"
          backLabel="‹ 홈"
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
        <View style={[CONTENT, { padding: 18, gap: 14 }]}>
          <View style={[pxBox(), { padding: 16 }]}>
            <Text style={{ color: COLOR.ink, fontSize: 17, fontWeight: '800' }}>고른 길이 없어요</Text>
            <Text style={{ color: COLOR.muted, fontSize: 14, lineHeight: 21, marginTop: 6 }}>
              오늘의 길을 먼저 고르면 지도에서 걸을 길을 볼 수 있어요.
            </Text>
          </View>
          <Pressable
            onPress={() => router.replace('/today')}
            style={({ pressed }) => [pxBox(COLOR.red, COLOR.redDark), { height: 56, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.85 }]}
          >
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>오늘의 길 받으러 가기</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const total = route.places.length;
  const pressPlace = (i: number) => {
    setFollow(false); // 장소를 크게 볼 때는 내 위치를 따라가지 않는다
    setFocus((f) => ({ n: (f?.n ?? 0) + 1, index: i }));
  };
  const showAll = () => {
    setFollow(false);
    setFocus((f) => ({ n: (f?.n ?? 0) + 1, index: null }));
  };
  const toggleFollow = () => {
    if (!follow && !(sim || (gps?.accuracy ?? Infinity) <= 100)) {
      showToast('위치 정확도가 낮아서 따라가기를 쓸 수 없어요');
      return;
    }
    setFollow((v) => !v);
  };

  // 장소별 도보 시간 한 줄. 지금 경로(walk)는 offset번 장소부터라서 번호를 맞춘다.
  const notes =
    walk
      ? route.places.map((_, i) => {
          if (i < reached) return '도착했어요';
          const j = i - offset;
          const leg = walk.startIncluded ? walk.legs[j] : walk.legs[j - 1];
          if (j < 0 || !leg) return undefined;
          return `${j === 0 && walk.startIncluded ? '내 위치에서' : '앞 장소에서'} 도보 약 ${minText(leg.time)}`;
        })
      : [];

  const goBack = () => {
    if (full) { setFull(false); return; } // 확대 중이면 먼저 줄이기
    if (router.canGoBack()) router.back(); // 이전 화면이 있으면 그곳으로
    else router.replace('/today'); // 없으면 오늘의 길로
  };
  const navBtn = { backgroundColor: COLOR.cream, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 11 };
  const smallBtn = { backgroundColor: COLOR.paper, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 10 };

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
          <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 14 }}>{full ? '‹ 줄이기' : '‹ 뒤로'}</Text>
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
            {route.title} · 도장 {reached}/{total}
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
        {ready && state && all ? (
          <>
            <TmapView appKey={APP_KEY} center={all[0]} state={state} />
            {/* 길 안내 한 줄: 다음 안내 지점까지 남은 거리와 문장 */}
            {step ? (
              <View
                style={{
                  position: 'absolute', top: 8, left: 8, right: 8, zIndex: 5, backgroundColor: COLOR.paper,
                  borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 10,
                }}
                pointerEvents="none"
              >
                <Text numberOfLines={2} style={{ color: COLOR.ink, fontWeight: '800', fontSize: 13 }}>
                  {turnMark(step.step.turn)} {step.distance >= 5 ? `${Math.round(step.distance)}m 앞 · ` : ''}
                  {step.step.text}
                </Text>
              </View>
            ) : null}
            <Pressable
              onPress={toggleFollow}
              style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 5, backgroundColor: followOn ? COLOR.red : COLOR.paper, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 5, paddingHorizontal: 8 }}
            >
              <Text style={{ color: followOn ? '#fff' : COLOR.ink, fontWeight: '800', fontSize: 12 }}>
                {followOn ? '내 위치 따라가는 중' : '내 위치 따라가기'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setFull((v) => !v)}
              style={{ position: 'absolute', right: 10, bottom: 10, zIndex: 5, backgroundColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 9 }}
            >
              <Text style={{ color: '#fff3e0', fontWeight: '800', fontSize: 13 }}>{full ? '⤡ 줄이기' : '⤢ 확대'}</Text>
            </Pressable>
          </>
        ) : null}
      </View>

      {/* 안내 영역 (기본 화면만) */}
      {!full ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 14, gap: 10 }}>
          {offRoute ? (
            <View style={{ backgroundColor: '#ffe1d6', padding: 10, gap: 6 }}>
              <Text style={{ color: COLOR.redDark, fontWeight: '700', fontSize: 13 }}>
                경로에서 벗어났어요. 지금 위치에서 새 경로를 찾을까요?
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable onPress={acceptReroute} style={smallBtn}>
                  <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 13 }}>새 경로 보기</Text>
                </Pressable>
                <Pressable onPress={keepRoute} style={smallBtn}>
                  <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 13 }}>그대로 가기</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {rerouting ? <ActivityIndicator color={COLOR.red} /> : null}

          {ready && __DEV__ ? (
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Pressable onPress={() => { setSimAlong(prog?.along ?? 0); setSimOff(false); setFollow(true); setSim((v) => !v); }} style={smallBtn}>
                <Text style={{ color: COLOR.ink, fontSize: 12, fontWeight: '800' }}>{sim ? '■ 시뮬레이션 끄기' : '▶ 걷기 시뮬레이션 (개발용)'}</Text>
              </Pressable>
              {sim ? (
                <Pressable onPress={() => setSimOff((v) => !v)} style={smallBtn}>
                  <Text style={{ color: COLOR.ink, fontSize: 12, fontWeight: '800' }}>{simOff ? '경로로 돌아가기' : '경로 벗어나기'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {ready && walk ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: COLOR.muted, flexShrink: 1 }}>
                {remain !== null && remainSec !== null
                  ? `남은 ${distText(remain)} · 도보 약 ${minText(remainSec)}`
                  : `전체 ${distText(walk.distance)} · 도보 약 ${minText(walk.time)}`}
              </Text>
              <Pressable onPress={showAll}>
                <Text style={{ fontSize: 13, color: COLOR.red, fontWeight: '800' }}>전체 경로 보기</Text>
              </Pressable>
            </View>
          ) : null}
          <CoursePlacesCard
            route={route}
            selected={focus && typeof focus.index === 'number' ? focus.index : null}
            notes={notes}
            onPlacePress={ready ? pressPlace : undefined}
          />
          {ready ? (
            <Text style={{ fontSize: 12, color: COLOR.muted }}>장소를 누르면 지도에서 그 장소를 크게 볼 수 있어요.</Text>
          ) : null}
        </ScrollView>
      ) : null}

      {/* 하단 도크: 코스 현황 + 도장 확인 + 도착 확인 (기본·확대 공통) */}
      {ready ? (
        <View style={{ backgroundColor: COLOR.cream, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: COLOR.ink, marginRight: 2 }}>코스</Text>
            {route.places.map((p, i) => (
              <Image key={p.id} source={STAMP} style={{ width: 34, height: 34, opacity: i < reached ? 1 : 0.35 }} resizeMode="contain" />
            ))}
            <Text numberOfLines={1} style={{ marginLeft: 'auto', fontSize: 13, color: COLOR.redDark, fontWeight: '800', flexShrink: 1 }}>
              {reached >= total ? '모두 완료' : `지금 ${reached + 1}번 장소`}
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
              onPress={onArrive}
              disabled={reached >= total}
              style={[pxBox(BTN_RED, COLOR.redDark), { flex: 1.4, height: 52, alignItems: 'center', justifyContent: 'center', opacity: reached >= total ? 0.5 : 1 }]}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                {reached >= total ? '완주 한 장 보기' : arrived ? `미션 확인하기 · ${reached + 1}번 장소` : '도착 확인하기'}
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, color: COLOR.muted, marginTop: 6, minHeight: 16 }}>
            {denied
              ? '위치 권한이 없어서 길 안내를 쓸 수 없어요.'
              : reached >= total
                ? ''
                : arrived
                  ? '도착이 확인됐어요. 이 자리에서 미션을 할 수 있어요.'
                  : toNext !== null
                    ? `${reached + 1}번 장소까지 ${distText(toNext)}`
                    : me
                      ? ''
                      : '내 위치를 찾는 중이에요'}
          </Text>
        </View>
      ) : null}

      {/* 토스트 */}
      {toast ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 140, alignItems: 'center' }} pointerEvents="none">
          <Text style={{ backgroundColor: COLOR.ink, color: '#fff3e0', paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, fontWeight: '700' }}>
            {toast}
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}