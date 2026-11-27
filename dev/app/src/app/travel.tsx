// 여행 지도 (주소: /travel) — 목업 "여행 지도 (S-05)" + 길 안내.
// 내 위치는 처음 경로를 받을 때와 "새 경로 보기"를 누를 때만 서버로 보낸다. 걷는 동안의 위치는 기기 안에서만 쓴다.
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { CoursePlacesCard } from '../components/course_places_card';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { TmapView } from '../components/tmap_view';
import { CutSheet, MissionSheet, StampSheet } from '../components/travel_sheets';
import { getStamps } from '../lib/agents_api';
import { getCurrentLocation } from '../lib/location';
import { getWalk, WalkPlace, WalkResult } from '../lib/server_api';
import { BTN_RED, COLOR, pxBox } from '../lib/theme';
import type { MapState } from '../lib/tmap_html';
import { useToday } from '../lib/today_context';
import { useLiveLocation } from '../lib/use_live_location';
import { buildTrack, distM, LatLng, nextStep, passedPath, pointAt, project, remainingPath, turnMark } from '../lib/walk_nav';

const APP_KEY = process.env.EXPO_PUBLIC_TMAP_APP_KEY ?? '';

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

// 첫 완주 컷씬 ②를 이미 띄웠는가 (목업 cutShown). 완주 기록이 서버에 저장되기 전이라 앱을 켜 둔 동안만 기억한다
// [확인 필요: 첫 완주 판정과 앨범 해금은 서버 기록으로 바꾼다 — 재생 시점도 팀 결정 전]
let firstCutShown = false;

const nowMs = () => Date.now(); // 이벤트 처리 안에서만 부른다
const distText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`);
const minText = (sec: number) => `${Math.max(1, Math.round(sec / 60))}분`;

export default function TravelScreen() {
  const today = useToday();
  const route = today.chosen !== null ? today.result?.routes?.[today.chosen] : undefined;
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [attempt, setAttempt] = useState(0); // "다시 시도"를 누르면 늘어난다
  const [full, setFull] = useState(false); // 확대(전체 화면) 모드
  const [mode, setMode] = useState<'walk' | 'transit'>('walk'); // 이동 방법: 도보 | 대중교통(버스·지하철, 가까운 구간은 걷기)
  const [missionDismissed, setMissionDismissed] = useState(-1); // [나중에 하기]를 누른 장소 번호 (같은 장소에서 미션 창이 계속 다시 뜨지 않게)
  const [focus, setFocus] = useState<Focus | null>(null);
  const [follow, setFollow] = useState(true); // 걸을 때 지도가 내 위치를 따라간다
  const [reached, setReached] = useState(0); // 도착을 확인한 장소 수 (TODO(PR F): 서버의 방문 기록·도장으로 바꾼다)
  const [arrived, setArrived] = useState(false); // 다음 장소 도착을 확인했는가
  const [offRoute, setOffRoute] = useState(false); // 새 경로를 제안 중인가
  const [rerouting, setRerouting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'stamps' | 'mission' | 'cut' | null>(null); // 겹쳐 뜨는 창 (travel_sheets.tsx)
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

  // 미션 화면에서 돌아오면 서버 도장 장부로 "어디까지 왔는지"를 다시 센다 (앞에서부터 도장이 이어진 만큼). 서버를 못 읽으면 그대로 둔다.
  const routeIds = route?.places.map((p) => p.id).join('|') ?? '';
  useFocusEffect(
    useCallback(() => {
      if (!routeIds) return;
      let alive = true;
      getStamps().then((r) => {
        if (!alive || !r.ok) return;
        const have = new Set(r.data.stamps.map((s) => s.placeId));
        let n = 0;
        for (const id of routeIds.split('|')) {
          if (!have.has(id)) break;
          n += 1;
        }
        setReached((cur) => (n > cur ? n : cur));
        if (n > 0) setArrived(false);
      });
      return () => {
        alive = false;
      };
    }, [routeIds]),
  );

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
        'walk',
      );
      if (!alive) return;
      setMode('walk');
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
    snoozeUntil.current = nowMs() + SNOOZE_SEC * 1000;
  };
  const acceptReroute = async () => {
    if (!all || !me) return;
    setOffRoute(false);
    setRerouting(true);
    // 아직 도착하지 않은 장소들로, 지금 내 위치에서 새 경로를 받는다
    const r = await getWalk(all.slice(reached).map((p) => p.id), { latitude: me.lat, longitude: me.lng }, mode);
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

  // 도착 자동 감지: 다음 장소에서 ARRIVE_M 안이면 도착으로 보고 미션 창을 바로 띄운다 (값을 계산만 하고 상태는 바꾸지 않는다).
  const nearNext = !!me && !!all && reached < all.length && distM(me, all[reached]) <= ARRIVE_M;
  const isArrived = arrived || nearNext;
  const autoMission = nearNext && !sheet && missionDismissed !== reached;

  // 길 안내를 시작할 때 내 위치를 아직 못 읽었다면(첫 장소부터 잡힌 경로), 위치가 잡힌 뒤 한 번 내 위치에서 다시 잡는다.
  const lateTried = useRef(false);
  useEffect(() => { lateTried.current = false; }, [route, attempt]);
  useEffect(() => {
    if (!ready || !all || !me || walk?.startIncluded || lateTried.current) return;
    lateTried.current = true;
    (async () => {
      const r = await getWalk(all.slice(reached).map((p) => p.id), { latitude: me.lat, longitude: me.lng }, mode);
      if (r.ok) setPhase({ name: 'ready', all, walk: r.data, offset: reached });
    })();
  }, [ready, all, me, walk, reached, mode]);

  // 이동 방법 바꾸기: 지금 내 위치(없으면 지금 경로의 시작)에서 남은 장소들까지 새로 받는다. 진행 상황(도착한 장소 수)은 그대로 둔다.
  const switchMode = async (next: 'walk' | 'transit') => {
    if (next === mode || !all || rerouting) return;
    setRerouting(true);
    const r = await getWalk(all.slice(reached).map((p) => p.id), me ? { latitude: me.lat, longitude: me.lng } : undefined, next);
    setRerouting(false);
    if (!r.ok) {
      showToast(next === 'transit' ? '대중교통 경로를 못 찾았어요. 도보로 유지해요' : '도보 경로를 못 찾았어요');
      return;
    }
    setMode(next);
    setPhase({ name: 'ready', all, walk: r.data, offset: reached });
    setFocus((f) => ({ n: (f?.n ?? 0) + 1, index: null }));
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
  // 지나온 경로는 점선(점점점)으로 남긴다. 경로에서 벗어났으면 경로에서 가장 가까운 지점까지만 지나온 것으로 본다.
  const alongNow = prog ? prog.along : 0;
  const passedLine = useMemo(() => (track ? passedPath(track, alongNow) : []), [track, alongNow]);
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
      passed: passedLine,
      full: walk.path,
      along: alongNow,
      steps: walk.steps.map((st) => ({ lat: st.lat, lng: st.lng, turn: st.turn })),
      me,
      follow: followOn,
      focus: focus ? { n: focus.n, target: target ? { lat: target.lat, lng: target.lng } : null, points: walk.path } : undefined,
    };
  }, [all, walk, me, focus, reached, shownPath, passedLine, alongNow, followOn]);

  if (!route) {
    return (
      // 고른 길이 없을 때: 다른 화면과 같은 머리글 + 안내 + 큰 버튼 (홈 목업 갱신본의 머리글·칸 모양)
      <View style={{ flex: 1, backgroundColor: COLOR.cream }}>
        <ScreenHead
          title="여행 지도"
          sub="고른 길이 있어야 지도를 볼 수 있어요"
          backLabel="‹ 뒤로"
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
          const seg = walk.segments?.[walk.startIncluded ? j : j - 1];
          return `${j === 0 && walk.startIncluded ? '내 위치에서' : '앞 장소에서'} ${seg ? (seg.type === 'transit' ? '대중교통' : '도보') : '도보'} 약 ${minText(leg.time)}`;
        })
      : [];

  const goBack = () => {
    if (full) { setFull(false); return; } // 확대 중이면 먼저 줄이기
    if (router.canGoBack()) router.back(); // 이전 화면이 있으면 그곳으로
    else router.replace('/today'); // 없으면 오늘의 길로
  };
  // 작은 버튼: 목업의 칸 모양 (모서리 6, 잉크 1.5px)
  const smallBtn = { backgroundColor: COLOR.paper, borderWidth: 1.5, borderColor: COLOR.ink, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 };
  const placeNames = route.places.map((p) => p.name);
  const nextPlace = route.places[Math.min(reached, route.places.length - 1)]; // 지도 실패 안내에 쓸 다음 장소
  // 완주 한 장(/trip_card?done=1)에 넘길 값: 길 이름과 장소 이름·id만 (좌표는 넘기지 않는다)
  const doneParams = () => ({ done: '1', title: route.title, names: placeNames.join('|'), ids: route.places.map((p) => p.id).join('|') });
  const openDone = () => router.push({ pathname: '/trip_card', params: doneParams() });
  // [완주 한 장 보기]: 첫 완주면 컷씬 ② 안내를 먼저 한 번 띄운다 (목업 #act → #cut → openDone)
  const onFinish = () => (firstCutShown ? openDone() : setSheet('cut'));

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.cream }}>
      {/* 머리글: 다른 화면과 같은 모양 (목업: 뒤로 · 제목+설명 · 홈). 확대 중이면 [‹ 줄이기] */}
      <ScreenHead
        title="여행 지도"
        backLabel={full ? '‹ 줄이기' : '‹ 뒤로'}
        onBack={goBack}
        rightIcon={require('../../assets/tab_home.png')}
        onRight={() => router.dismissTo('/')}
      />

      {/* 지도 영역 (확대하면 남는 공간을 모두 쓴다) */}
      <View
        style={[
          { overflow: 'hidden', backgroundColor: COLOR.cream2 },
          full
            ? { flex: 1 }
            : { height: 270, marginHorizontal: 16, marginTop: 10, ...pxBox(COLOR.cream2) },
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
            <Text style={{ color: COLOR.ink }}>경로를 불러오지 못했어요.</Text>
            {/* 지도 실패 안내 (목업 travel_map_mockup_v1 #fallback, 명세 F-07 수용 기준): 지도 없이도 다음 장소를 찾아가게 주소와 인증 지점을 보여 준다.
                인증 지점 설명은 저장할 곳이 아직 없어 목업 자리표시 그대로다 [확인 필요: 명세 9장 verification_points] */}
            {nextPlace ? (
              <View style={{ alignSelf: 'stretch', backgroundColor: '#fff0b8', borderWidth: 1.5, borderColor: COLOR.ink, padding: 10, gap: 4 }}>
                <Text style={{ color: COLOR.ink, fontSize: 13, lineHeight: 19 }}>지도를 열 수 없어요. 대신 아래 정보로 찾아가 주세요.</Text>
                <Text style={{ color: COLOR.ink, fontSize: 13, lineHeight: 19 }}>
                  <Text style={{ fontWeight: '800' }}>{`${reached + 1}번 장소`}</Text>
                  {`: ${nextPlace.name}`}
                </Text>
                <Text style={{ color: COLOR.ink, fontSize: 13, lineHeight: 19 }}>
                  <Text style={{ fontWeight: '800' }}>주소</Text>
                  {`: ${nextPlace.address ?? '주소 정보가 아직 없어요'}`}
                </Text>
                <Text style={{ color: COLOR.ink, fontSize: 13, lineHeight: 19 }}>
                  <Text style={{ fontWeight: '800' }}>인증 지점</Text>
                  {': [인증 지점 설명 자리]'}
                </Text>
              </View>
            ) : null}
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
            {/* 경로 이탈: 지도 위에서 바로 보이게 한다. 자동으로 바꾸지 않고 [다시 길 찾기]를 누르면 지금 위치에서 새 경로를 받는다 */}
            {offRoute ? (
              <View style={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 6, backgroundColor: '#ffe1d6', borderWidth: 2, borderColor: COLOR.redDark, padding: 10, gap: 8 }}>
                <Text style={{ color: COLOR.redDark, fontWeight: '800', fontSize: 14 }}>경로에서 벗어났어요. 지금 위치에서 다시 길을 찾을까요?</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={acceptReroute} style={[smallBtn, { backgroundColor: COLOR.red, borderColor: COLOR.redDark }]}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>다시 길 찾기</Text>
                  </Pressable>
                  <Pressable onPress={keepRoute} style={smallBtn}>
                    <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 14 }}>그대로 가기</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {/* 길 안내 한 줄: 다음 안내 지점까지 남은 거리와 문장 */}
            {step && !offRoute ? (
              <View
                style={{
                  position: 'absolute', top: 8, left: 8, right: 8, zIndex: 5, backgroundColor: COLOR.paper,
                  paddingVertical: 6, paddingHorizontal: 10,
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
              style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 5, ...pxBox(followOn ? COLOR.red : COLOR.paper), paddingVertical: 5, paddingHorizontal: 8 }}
            >
              <Text style={{ color: followOn ? '#fff' : COLOR.ink, fontWeight: '800', fontSize: 12 }}>
                {followOn ? '내 위치 따라가는 중' : '내 위치 따라가기'}
              </Text>
            </Pressable>
            <Pressable
              onPress={acceptReroute}
              accessibilityLabel="지금 위치에서 다시 길 찾기"
              style={{ position: 'absolute', left: 10, bottom: 46, zIndex: 5, ...pxBox(COLOR.paper), paddingVertical: 5, paddingHorizontal: 8 }}
            >
              <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 12 }}>{rerouting ? '찾는 중…' : '다시 길 찾기'}</Text>
            </Pressable>
            <Pressable
              onPress={() => setFull((v) => !v)}
              style={{ position: 'absolute', right: 10, bottom: 10, zIndex: 5, backgroundColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 9 }}
            >
              <Text style={{ color: '#fff3e0', fontWeight: '800', fontSize: 13 }}>{full ? '⤡ 줄이기' : '⤢ 확대'}</Text>
            </Pressable>
          </>
        ) : null}
        {ready && __DEV__ ? (
            <View style={{ position: 'absolute', left: 10, top: 10, zIndex: 6, flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
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
      </View>

      {/* 안내 영역 (기본 화면만) */}
      {!full ? (
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 0, gap: 8, overflow: 'hidden' }}>
          {rerouting ? <ActivityIndicator color={COLOR.red} /> : null}

          {ready ? (
            <View style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>이동 방법</Text>
                {(['walk', 'transit'] as const).map((m) => (
                  <Pressable key={m} onPress={() => switchMode(m)} accessibilityRole="button" accessibilityState={{ selected: mode === m }}
                    style={[smallBtn, mode === m && { backgroundColor: COLOR.red, borderColor: COLOR.redDark }]}>
                    <Text style={{ color: mode === m ? '#fff' : COLOR.ink, fontWeight: '800', fontSize: 13 }}>{m === 'walk' ? '도보' : '대중교통'}</Text>
                  </Pressable>
                ))}
                {reached < total ? (
                  <Pressable onPress={() => router.push('/reroute')} style={[smallBtn, { marginLeft: 'auto' }]}>
                    <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 13 }}>대체 길 보기</Text>
                  </Pressable>
                ) : null}
              </View>
              {mode === 'transit' && walk?.segments ? (
                <Text style={{ fontSize: 12, color: COLOR.ink, fontWeight: '700' }}>
                  {`대중교통 · 환승 ${walk.segments.reduce((n, sg) => n + sg.transfers, 0)}회${walk.fare ? ` · 요금 약 ${walk.fare.toLocaleString('ko-KR')}원` : ''}`}
                </Text>
              ) : null}
            </View>
          ) : null}

          <CoursePlacesCard
            fill={!!ready}
            reached={reached}
            summary={ready && walk ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: COLOR.muted, flexShrink: 1 }}>
                {remain !== null && remainSec !== null
                  ? `남은 ${distText(remain)} · ${mode === 'transit' ? '대중교통' : '도보'} 약 ${minText(remainSec)}`
                  : `전체 ${distText(walk.distance)} · ${mode === 'transit' ? '대중교통' : '도보'} 약 ${minText(walk.time)}`}
              </Text>
              <Pressable onPress={showAll}>
                <Text style={{ fontSize: 13, color: COLOR.red, fontWeight: '800' }}>전체 경로 보기</Text>
              </Pressable>
            </View>
            ) : undefined}
            route={route}
            selected={focus && typeof focus.index === 'number' ? focus.index : null}
            notes={notes}
            onPlacePress={ready ? pressPlace : undefined}
          />
        </View>
      ) : null}

      {/* 하단 도크: 코스 현황 + 도장 확인 + 도착 확인 (기본·확대 공통) */}
      {ready ? (
        <View style={{ backgroundColor: COLOR.cream, paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => setSheet('stamps')}
              style={[pxBox(), { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' }]}
            >
              <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 15 }}>도장 확인</Text>
            </Pressable>
            {/* 큰 버튼: 도착 확인 → (도착하면) 미션 창 → (모두 걸으면) 완주 한 장 */}
            <Pressable
              onPress={reached >= total ? onFinish : isArrived ? () => setSheet('mission') : onArrive}
              style={[pxBox(BTN_RED, COLOR.redDark), { flex: 1.4, height: 52, alignItems: 'center', justifyContent: 'center' }]}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>
                {reached >= total ? '완주 한 장 보기' : isArrived ? `미션 확인하기 · ${reached + 1}번 장소` : '도착 확인하기'}
              </Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 12, color: COLOR.muted, marginTop: 6, minHeight: 16 }}>
            {denied
              ? '위치 권한이 없어서 길 안내를 쓸 수 없어요.'
              : reached >= total
                ? ''
                : isArrived
                  ? '도착이 확인됐어요. 이 자리에서 미션을 할 수 있어요.'
                  : toNext !== null
                    ? `${reached + 1}번 장소까지 ${distText(toNext)}`
                    : me
                      ? ''
                      : '내 위치를 찾는 중이에요'}
          </Text>
        </View>
      ) : null}

      {/* 겹쳐 뜨는 창: 도장 확인 · 미션 (모양만. 도장 저장은 서버 기능 전). 완주 한 장은 9:16 카드 화면(/trip_card?done=1)으로 연다 */}
      {sheet === 'cut' ? (
        <CutSheet
          onPlay={() => { firstCutShown = true; setSheet(null); router.push({ pathname: '/cutscene', params: { cut: 'c2', mode: 'first', ...doneParams() } }); }}
          onSkip={() => { firstCutShown = true; setSheet(null); openDone(); }}
        />
      ) : null}
      {sheet === 'stamps' ? <StampSheet title={route.title} names={placeNames} reached={reached} onClose={() => setSheet(null)} /> : null}
      {sheet === 'mission' || autoMission ? (
        <MissionSheet
          placeNo={reached + 1}
          placeName={placeNames[reached] ?? ''}
          onStart={() => { setSheet(null); setMissionDismissed(reached); router.push({ pathname: '/mission', params: { placeId: route.places[reached]?.id ?? '', placeName: placeNames[reached] ?? '' } }); }}
          // 개발 중에만: 도장 저장 기능이 생기기 전에 다음 장소로 넘어가 보는 임시 버튼 (기존 동작 그대로)
          onTemp={__DEV__ ? () => { setSheet(null); onArrive(); } : undefined}
          onLater={() => { setSheet(null); setMissionDismissed(reached); }}
        />
      ) : null}

      {/* 토스트 */}
      {toast ? (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 140, alignItems: 'center' }} pointerEvents="none">
          <Text style={{ backgroundColor: COLOR.ink, color: '#fff3e0', paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, fontWeight: '700' }}>
            {toast}
          </Text>
        </View>
      ) : null}
    </View>
  );
}