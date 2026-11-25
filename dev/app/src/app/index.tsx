/*
 * [index.tsx] 홈 화면 S-03 (주소: /) — 로그인하면 가장 먼저 보이는 화면
 *
 * 역할
 *  - 목업 storyboard/app_home_mockup_v1.html의 홈과 상태 8종을 옮긴다 (상태표: lib/home_state.ts).
 *  - 흐름: 로그인하면 홈이 첫 화면이다 (2026-11-23 요청). 위치는 기본으로 중구(MVP 지역)를 쓰고,
 *    왼쪽 위 날씨·지역 배지를 누르면 날씨 상세(/weather)가 열리고, 거기서 [지역 바꾸기]로 위치 확인 화면(/location)에 간다.
 *    [확인 필요] 기획 흐름(storyboard/game_flow_story_v1.md 4절)은 위치 → 홈 순서다.
 *
 * 배치 (목업 390 x 844 기준, 화면 폭에 맞춰 배율 k를 곱한다)
 *  - 장면(높이 316): 방 그림(위 56), 날씨·지역 배지(12, 50), 하랑이, 말풍선, [오늘 페이지 ▾] 표시, 아래 알림 띠
 *  - 본문: 큰 버튼 → 빠른 버튼([하랑이와 대화하기] 2칸 + [주머니]) → 오늘 챙길 것
 *  - 하단 탭: 홈 · 장부 · 내 정보
 *
 * 날씨 배지
 *  - 서버 POST /weather로 지금 기온과 기준 시(hour)를 받아 보여 준다. 좌표는 본문으로만 보낸다.
 *  - 체감온도는 서버 계산식이 정해지지 않아 [○]로 둔다 [결정 필요: 체감온도 계산식]
 *  - 날씨를 못 읽으면 "날씨 확인 불가" 상태가 된다 (이전 값으로 추측하지 않음)
 *
 * 개발 중 미리보기: 주소 뒤에 ?state=heat 처럼 붙이면 그 상태로 보인다 (__DEV__일 때만, 배포 앱에서는 무시)
 *  - 이름: none, active, notice, heat, storm, unknown, outside, empty
 *
 * 아직 연결하지 않은 것
 *  - 이어하기 화면 → 지금은 준비 중(/soon). 날씨 상세(/weather), 경로 변경(/reroute)은 연결됨. 쉼터 화면은 만들지 않기로 했다. 주머니(/pouch), 장부(/ledger), 오늘 페이지(/today_page)는 연결됨
 *  - 하랑이 대사: 승인 대사 대기. 목업 자리 표시를 그대로 둔다 [창작, 승인 필요]
 */
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BottomTab } from '../components/bottom_tab';
import { APP_MAX_WIDTH } from '../components/phone_column';
import { PixelSprite } from '../components/pixel_book';
import { findDistrict } from '../lib/districts';
import { BADGE_TONE, HOME_STATES, HomeGo, ROOM_IMAGE, TIP_ICON } from '../lib/home_state';
import { usePlace } from '../lib/place_context';
import { displayName } from '../lib/profile';
import { useProfile } from '../lib/profile_context';
import { COLOR, pxBox } from '../lib/theme';
import { useHomeWeather } from '../lib/use_home_weather';
import { useToday } from '../lib/today_context';

// 하단 탭 높이, 본문 최소 높이(여백 32 + 큰 버튼 68 + 빠른 버튼 64 + 간격 24 + 챙길 것 최소 150)
const TAB_HEIGHT = 84;
const BODY_MIN = 32 + 68 + 64 + 24 + 150;
const TIP_GAP = 12; // 목업 .tiplist 간격 12

// 말풍선 꼬리 7x7 (K 잉크 테두리, F 종이색 속)
const BUBBLE_TAIL = ['KFFFFFK', 'KFFFFK.', 'KFFFK..', 'KFFK...', 'KFK....', 'KK.....', 'K......'];
// 출발 연출 (목업 .walker 옆모습 걷기 4프레임, .exitarrow 노란 화살표)
const WALK_FRAMES = [
  require('../../assets/harangi_walk_side_01.png'),
  require('../../assets/harangi_walk_side_02.png'),
  require('../../assets/harangi_walk_side_03.png'),
  require('../../assets/harangi_walk_side_04.png'),
];
// 출발 화살표 (56 기준 칸). 픽셀 칸이 아니라 삼각형·사각형으로 그린다.
// 테두리 2.5px: 바깥 잉크 도형 위에 안쪽 노랑 도형을 올린다. 안쪽 좌표는 바깥 변을 2.5px 안으로 민 값
// (빗변: 중심선 기준 안쪽 교차점 x=28±18.56, 꼭짓점 y=3.84, 촉 밑변 y=25.5, 기둥 x=20.5~35.5, 아래 y=53.5)으로 계산했다.
const ARROW_INK = COLOR.ink;
const ARROW_YELLOW = '#f5b82e';
function DepartArrow({ s }: { s: number }) {
  const u = (v: number) => v * s;
  return (
    <View style={{ width: u(56), height: u(56) }}>
      {/* 화살촉: 바깥(잉크) → 안쪽(노랑) */}
      <View style={{ position: 'absolute', left: u(4), top: 0, width: 0, height: 0, borderLeftWidth: u(24), borderRightWidth: u(24), borderBottomWidth: u(28), borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: ARROW_INK }} />
      <View style={{ position: 'absolute', left: u(9.44), top: u(3.84), width: 0, height: 0, borderLeftWidth: u(18.56), borderRightWidth: u(18.56), borderBottomWidth: u(21.66), borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: ARROW_YELLOW }} />
      {/* 기둥: 바깥(잉크) → 안쪽(노랑) */}
      <View style={{ position: 'absolute', left: u(18), top: u(28), width: u(20), height: u(28), backgroundColor: ARROW_INK }} />
      <View style={{ position: 'absolute', left: u(20.5), top: u(25.5), width: u(15), height: u(28), backgroundColor: ARROW_YELLOW }} />
    </View>
  );
}

// 하랑이 숨쉬기: 위아래 4px (위치 확인 화면과 같은 움직임)
function createBob() {
  const value = new Animated.Value(0);
  return { value, y: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) };
}

const soon = (what: string) => router.push({ pathname: '/soon', params: { what } });

// 큰 버튼·알림 띠가 갈 곳. 화면이 아직 없는 곳은 준비 중으로 보낸다.
function go(target: HomeGo | undefined) {
  if (!target) return; // 누르는 곳이 없는 안내 문구
  if (target === 'today') router.push('/today');
  else if (target === 'courses') router.push('/courses');
  else if (target === 'region') router.push('/location');
  else if (target === 'reroute') router.push('/reroute');
  else soon('이어하기'); // travel: 진행 중인 여행이 저장되지 않아 아직 이어 갈 수 없다
}

export default function HomeScreen() {
  const { place } = usePlace();
  const { profile } = useProfile();
  const name = displayName(profile);
  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const k = Math.min(winWidth, APP_MAX_WIDTH) / 390; // 목업 좌표 → 화면 좌표 배율

  // 스크롤 없이 한 화면에 다 보이게 한다.
  //  - 본문에 꼭 필요한 높이(BODY_MIN)와 하단 탭(84)을 먼저 빼고, 모자라면 장면 위쪽을 잘라 낸다 (그림은 키우거나 줄이지 않는다).
  //  - 자르는 양은 최대 120 x k (천장 쪽). 하랑이·말풍선은 장면 아래쪽 기준이라 그대로 보인다.
  const sceneFull = 316 * k;
  const crop = Math.min(Math.max(sceneFull + TAB_HEIGHT + BODY_MIN - winHeight, 0), 120 * k);
  const sceneH = sceneFull - crop;
  // 오늘 챙길 것 아이콘: 카드에 남은 높이에 맞춰 28~48px
  const [tipsAreaH, setTipsAreaH] = useState(0);
  // 장면 위쪽을 잘라 내면 말풍선이 날씨 배지를 덮을 수 있다. 말풍선 높이를 재서 배지 아래로 내린다.
  const badgeTop = Math.max(8, 50 * k - crop);
  const [bubbleH, setBubbleH] = useState(0);
  const BADGE_H = 44;
  const bubbleBottom = Math.min(118 * k, sceneH - (badgeTop + BADGE_H + 6) - bubbleH);
  const iconSize = tipsAreaH > 0 ? Math.max(24, Math.min(48, (tipsAreaH - 2 * TIP_GAP) / 3)) : 48;
  const [bob] = useState(createBob);
  // 오늘 페이지 라벨의 뜨기 (목업 bob 1s steps(2): 0.5초마다 위·아래)
  const [markUp, setMarkUp] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setMarkUp((v) => !v), 500);
    return () => clearInterval(id);
  }, []);

  // 출발 연출: 현관문을 누르면 목업 .going과 같은 순서로 움직인다 (ms: 몸 돌리기 900, 걷기 1300~2800, 말풍선 끝 2600, 지도 버튼 2900)
  const today = useToday();
  const route = today.chosen !== null ? today.result?.routes?.[today.chosen] : undefined;
  const [depart, setDepart] = useState<'idle' | 'going'>('idle');
  const [turned, setTurned] = useState(false); // 몸 돌리기가 끝나 정면 그림을 숨겼는가
  const [walking, setWalking] = useState(false); // 옆모습 걷기 중인가
  const [walkFrame, setWalkFrame] = useState(0);
  const [bubbleGone, setBubbleGone] = useState(false);
  const [nextShown, setNextShown] = useState(false);
  const [readyOff, setReadyOff] = useState(false); // '나가지 않기'를 누르면 출발 준비를 접는다 (목업 cancelready)
  const ready = depart === 'idle' && !!route && !readyOff; // 출발 준비 상태: 현관문 화살표와 출발 대사가 보인다
  const turn = useRef(new Animated.Value(1)).current; // 정면 그림 가로 배율 1 → 0.1
  const walk = useRef(new Animated.Value(0)).current; // 걷기 진행 0 → 1 (1.5초)
  const departTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => departTimers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!walking) return;
    const id = setInterval(() => setWalkFrame((f) => (f + 1) % 4), 140); // 프레임 한 장 0.14초
    return () => clearInterval(id);
  }, [walking]);

  const startDepart = () => {
    if (depart !== 'idle') return;
    setDepart('going');
    Animated.timing(turn, { toValue: 0.1, duration: 270, delay: 900, easing: Easing.linear, useNativeDriver: true }).start();
    Animated.timing(walk, { toValue: 1, duration: 1500, delay: 1300, easing: Easing.linear, useNativeDriver: true }).start();
    const at = (ms: number, fn: () => void) => departTimers.current.push(setTimeout(fn, ms));
    at(1170, () => setTurned(true));
    at(1300, () => setWalking(true));
    at(2600, () => setBubbleGone(true));
    at(2800, () => setWalking(false));
    at(2900, () => setNextShown(true));
  };

  // 개발용: 출발 모션을 처음부터 다시 본다 (타이머와 값을 원래대로)
  const resetDepart = () => {
    departTimers.current.forEach(clearTimeout);
    departTimers.current = [];
    turn.setValue(1);
    walk.setValue(0);
    setDepart('idle');
    setTurned(false);
    setWalking(false);
    setBubbleGone(false);
    setNextShown(false);
    setReadyOff(false);
  };

  // 말풍선은 한 칸을 돌려 쓴다: 출발 전에는 출발 대사, 걷는 동안 잠깐 같은 칸에 걸으러 가는 대사, 그다음에는 숨김 (기본 말풍선과 겹치지 않음)
  const bubbleMode: 'main' | 'depart' | 'none' =
    depart === 'idle' ? (ready ? 'depart' : 'main') : bubbleGone ? 'none' : 'depart';
  const departText =
    depart === 'idle' ? `오늘은 ${route?.title ?? '오늘의'} 길로 가 볼까요?` : '자, 이제 오늘의 길을 걸으러 가요!';

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob.value, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob.value, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  // 지금 위치의 날씨와 상태 (좌표는 요청 본문으로만 보낸다, 개발 중 ?state= 미리보기 포함)
  const hw = useHomeWeather();
  const s = HOME_STATES[hw.stateKey];
  const tone = BADGE_TONE[s.tone];

  const areaName = !place ? '중구' : place.kind === 'district' ? (findDistrict(place.code)?.name ?? '선택한 동네') : '현재 위치';
  const live = s.live && hw.temp !== null && hw.hour !== null;
  const temp = live ? String(Math.round(hw.temp!)) : '[○]';
  const base = live ? `${hw.hour}시` : hw.loading && !hw.preview ? '확인 중' : '[기준 시각]';
  const badgeMain = s.badgeMain.replace('{temp}', temp);
  const badgeSub = s.badgeSub.replace('{area}', areaName).replace('{base}', base);
  const tipRows = s.tips.map((label) => ({ label, icon: TIP_ICON[label] }));

  return (
    <View style={styles.safe}>
      {/* 장면: 방 그림 · 배지 · 하랑이 · 말풍선 · 알림 띠 */}
      <View style={[styles.scene, { height: sceneH }]}>
        <Image
          source={ROOM_IMAGE[s.room]}
          style={{ position: 'absolute', left: 0, top: 56 * k - crop, width: 390 * k, height: 260 * k }}
          resizeMode="cover"
        />

        {/* 날씨·지역 배지 (목업 .badge). 누르면 날씨 상세(/weather). 지역은 날씨 상세의 [지역 바꾸기]에서 바꾼다 */}
        <Pressable
          onPress={() => router.push('/weather')}
          style={[styles.badge, { ...pxBox(tone.bg, tone.shade), borderWidth: 2.5, left: 12 * k, top: badgeTop }]}
        >
          <View style={[styles.badgeDot, { backgroundColor: tone.dot }]} />
          <View>
            <Text style={styles.badgeMain}>{badgeMain}</Text>
            <Text style={styles.badgeSub}>{badgeSub}</Text>
          </View>
        </Pressable>

        {/* 오늘 페이지: 책(아래 영역)을 눌러 연다. 라벨은 목업처럼 0.5초마다 3px씩 뜬다 (steps(2)) */}
        <Pressable
          onPress={() => router.push('/today_page')}
          accessibilityLabel="오늘 페이지 열기"
          style={{ position: 'absolute', left: 232 * k, top: 180 * k - crop, width: 80 * k, height: 44 * k }}
        />
        {/* 라벨: 책(버튼 영역)의 가운데에 맞춘다. 목업보다 조금 위 */}
        <View pointerEvents="none" style={{ position: 'absolute', left: 232 * k - 5, width: 80 * k, top: 160 * k - crop, alignItems: 'center' }}>
          <View style={[styles.mark, { position: 'relative', transform: [{ translateY: markUp ? -3 : 0 }] }]}>
            <Text style={styles.markText}>오늘 페이지 ▾</Text>
          </View>
        </View>

        {/* 말풍선 (목업 .bubble: 왼쪽 40, 아래에서 118, 폭 172) */}
        {bubbleMode !== 'none' ? (
          <View
            style={[styles.bubble, { left: 40 * k, bottom: bubbleBottom, width: 172 * k }]}
            onLayout={(e) => setBubbleH(e.nativeEvent.layout.height)}
          >
            {bubbleMode === 'depart' ? (
              <>
                <Text style={styles.bubbleText}>{departText}</Text>
                <Text style={styles.bubbleMuted}>[승인 대사 대기 · 창작 후보 A]</Text>
              </>
            ) : (
              <>
                <Text style={styles.bubbleText}>{s.bubble.replace('{name}', name)}</Text>
                <Text style={styles.bubbleMuted}>[승인 대사 대기]</Text>
                {s.bubbleAlert ? <Text style={styles.bubbleAlert}>오늘 비어 있는 장소가 있어요 [임시]</Text> : null}
              </>
            )}
            {/* 말풍선 꼬리 (목업 .tail: 왼쪽 120, 계단 모양) */}
            <View style={[styles.tail, { left: 120 * k - 3 }]}>
              <PixelSprite grid={BUBBLE_TAIL} cell={3} />
            </View>
          </View>
        ) : null}

        <Animated.Image
          source={require('../../assets/harangi_pixel_idle_transparent.png')}
          style={{
            position: 'absolute',
            left: 70 * k,
            top: 208 * k - crop, // 기본 하랑이 위치 (기존 210에서 5px 위, 다시 3px 아래)
            width: 92 * k,
            height: 95 * k,
            opacity: turned ? 0 : 1,
            transform: [{ translateY: bob.y }, { scaleX: turn }],
          }}
          resizeMode="contain"
        />

        {/* 출발 준비: 현관문(누르면 출발)과 노란 화살표 (목업 .door-hot, .exitarrow: 0.5초마다 8px 뜸) */}
        {ready ? (
          <>
            <Pressable
              onPress={startDepart}
              accessibilityLabel="현관문으로 나가기"
              style={{ position: 'absolute', left: 8 * k, top: 116 * k - crop, width: 72 * k, height: 124 * k, zIndex: 6 }}
            />
            <Pressable
              onPress={startDepart}
              accessibilityLabel="나가기"
              style={{ position: 'absolute', left: 14 * k, top: 246 * k - crop, zIndex: 6, transform: [{ translateY: markUp ? -8 : 0 }] }}
            >
              <DepartArrow s={k} />
            </Pressable>
          </>
        ) : null}

        {/* 나가지 않기 (목업 .backbtn: 출발 준비 상태에서만, 오른쪽 위 268) */}
        {ready ? (
          <Pressable
            onPress={() => setReadyOff(true)}
            style={{ position: 'absolute', right: 12 * k, top: 268 * k - crop, zIndex: 7, backgroundColor: COLOR.paper, paddingVertical: 7, paddingHorizontal: 10 }}
          >
            <Text style={{ fontSize: 12, fontWeight: '800', color: COLOR.ink }}>나가지 않기</Text>
          </Pressable>
        ) : null}

        {/* 옆모습 걷기 4프레임 (목업 .walker: 왼쪽 문 쪽으로 1.5초, 끝에서 흐려짐) */}
        {walking ? (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 69 * k,
              top: 196 * k - crop,
              width: 117 * k,
              height: 121 * k,
              zIndex: 3,
              opacity: walk.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: walk.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, -52 * k, -66 * k] }) },
                { scaleX: -1 },
              ],
            }}
          >
            <Image source={WALK_FRAMES[walkFrame]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          </Animated.View>
        ) : null}

        {/* 개발용 버튼: 출발 모션 보기 / 다시 보기 (배포 빌드에는 나오지 않음) */}
        {__DEV__ ? (
          <Pressable
            onPress={depart === 'idle' ? startDepart : resetDepart}
            style={{ position: 'absolute', left: 12 * k, bottom: 6 * k, zIndex: 7, backgroundColor: '#fff3e0', borderWidth: 1.5, borderColor: COLOR.ink, paddingVertical: 4, paddingHorizontal: 8 }}
          >
            <Text style={{ fontSize: 11, fontWeight: '800', color: COLOR.ink }}>{depart === 'idle' ? '[개발] 출발 모션 보기' : '[개발] 다시 보기'}</Text>
          </Pressable>
        ) : null}

        {/* 지도로 가기 (목업 .nextgo: 오른쪽 아래, 출발 후 나타남) */}
        {nextShown ? (
          <Pressable
            onPress={() => router.push('/travel')}
            style={[pxBox(COLOR.red, COLOR.redDark), { borderWidth: 2.5, boxShadow: 'none', position: 'absolute', right: 12 * k, bottom: 50 * k, zIndex: 7, paddingVertical: 8, paddingHorizontal: 12 }]}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800' }}>여행 지도 보기 ›</Text>
          </Pressable>
        ) : null}

        {/* 알림 띠 (목업 .sbanner: 장면 맨 아래, 경고는 분홍, 알림은 노랑) */}
        {s.banner ? (
          <Pressable
            onPress={() => go(s.banner!.go)}
            style={[styles.banner, { backgroundColor: s.banner.kind === 'warn' ? '#ffe1d6' : COLOR.yellow }]}
          >
            <Text style={[styles.bannerText, s.banner.kind === 'warn' && { color: COLOR.redDark }]}>{s.banner.text}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* 본문 (목업 .body: 위쪽 잉크색 6px 선, 안쪽 여백 16, 간격 12) */}
      <View style={styles.body}>
        {s.cta.go ? (
          <Pressable onPress={() => go(s.cta.go)} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
            <Text style={styles.ctaMain}>{s.cta.title}</Text>
            {s.cta.sub ? <Text style={styles.ctaSub}>{s.cta.sub}</Text> : null}
          </Pressable>
        ) : (
          // 누를 곳이 없는 안내 상자 (큰 버튼과 같은 높이)
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{s.cta.title}</Text>
          </View>
        )}

        {/* 빠른 버튼 (목업 .quick: 3칸 격자, [하랑이와 대화하기]가 2칸, [주머니]가 1칸) */}
        <View style={styles.quick}>
          <Pressable onPress={() => router.push('/chat')} style={({ pressed }) => [styles.quickButton, styles.chatButton, pressed && styles.pressed]}>
            <Image source={require('../../assets/harangi_face_v2.webp')} style={styles.chatFace} resizeMode="contain" />
            <Text style={[styles.quickText, styles.chatText]}>하랑이와 대화하기</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/pouch')} style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}>
            <Image source={require('../../assets/icon_pouch.png')} style={{ width: 20, height: 18 }} />
            <Text style={styles.quickText}>주머니</Text>
          </Pressable>
        </View>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>오늘 챙길 것</Text>
          {/* 남은 높이에 줄을 고르게 놓는다. 아이콘이 없는 항목(안내 문장)은 글만 보인다 */}
          <View style={styles.tipRows} onLayout={(e) => setTipsAreaH(e.nativeEvent.layout.height)}>
            {tipRows.map((t) => (
              <View key={t.label} style={styles.tipRow}>
                {t.icon ? <Image source={t.icon} style={{ width: iconSize, height: iconSize }} /> : null}
                <Text style={styles.tipText} numberOfLines={1}>{t.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <BottomTab current="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },

  // 장면 (목업 .scene 바탕 #a85a24)
  scene: { backgroundColor: '#a85a24', overflow: 'hidden' },

  // 배지·말풍선도 목업에서 .px 칸이다. 배지 바탕·그림자 색은 상태마다 다르다 (BADGE_TONE)
  badge: {
    position: 'absolute',
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
    maxWidth: 250,
  },
  badgeDot: { width: 11, height: 11, borderWidth: 2, borderColor: COLOR.ink },
  badgeMain: { fontSize: 12, fontWeight: '700', color: COLOR.ink },
  badgeSub: { fontSize: 12, color: COLOR.muted },

  mark: { position: 'absolute', zIndex: 6, paddingVertical: 1, paddingHorizontal: 5, backgroundColor: COLOR.cream, borderWidth: 2, borderColor: COLOR.ink },
  markText: { fontSize: 12, fontWeight: '800', color: COLOR.ink },

  // 테두리 3px: 꼬리(픽셀 3칸짜리 계단)와 두께를 맞춘다 (목업 .px는 1.5px였음)
  bubble: { ...pxBox(COLOR.paper), borderWidth: 2.5, boxShadow: 'none', position: 'absolute', zIndex: 4, paddingVertical: 7, paddingHorizontal: 8 },
  bubbleText: { fontSize: 12, lineHeight: 16, color: COLOR.ink },
  tail: { position: 'absolute', top: '100%' },
  bubbleMuted: { fontSize: 12, color: COLOR.muted, marginTop: 3 },
  bubbleAlert: {
    fontSize: 12,
    color: COLOR.redDark,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#b9825a',
    borderStyle: 'dotted',
  },

  // 알림 띠 (목업 .sbanner: 위쪽 잉크색 3px 선, 글씨 12 굵게)
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 3,
    borderTopColor: COLOR.ink,
  },
  bannerText: { fontSize: 12, lineHeight: 16, fontWeight: '700', color: COLOR.ink },

  // 본문
  // 스크롤 없는 본문: 남은 높이를 모두 쓰고, 넘치면 잘리지 않게 챙길 것 카드가 줄어든다
  body: { flex: 1, backgroundColor: COLOR.cream, borderTopWidth: 6, borderTopColor: COLOR.ink, paddingTop: 8, paddingHorizontal: 16, paddingBottom: 16, gap: 0, overflow: 'hidden' }, // 위 여백 8 (버튼을 올려 준비물 칸을 넓힘)
  pressed: { opacity: 0.85 },

  // 큰 버튼 (목업 .cta: 높이 68, 왼쪽 정렬)
  cta: { ...pxBox(COLOR.red, COLOR.redDark), height: 68, paddingHorizontal: 14, justifyContent: 'center', marginTop: 2, marginBottom: 8 }, // 칸 사이 간격을 늘려 화면을 채움 (목업 2/4보다 넓게)
  ctaMain: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ctaSub: { color: '#fff', fontSize: 12, opacity: 0.92, marginTop: 3 },

  // 안내 상자: 큰 버튼 자리에서 누를 곳이 없을 때 (종이색 바탕)
  notice: { ...pxBox(COLOR.paper), height: 68, paddingHorizontal: 14, justifyContent: 'center', marginTop: 2, marginBottom: 8 },
  noticeText: { color: COLOR.ink, fontSize: 15, fontWeight: '800' },

  // 빠른 버튼 (목업 .quick: 높이 64, 간격 10, 글씨 14 굵게)
  quick: { flexDirection: 'row', gap: 10, marginBottom: 8 }, // 칸 사이 간격 확대 (기존 4)
  quickButton: { ...pxBox(COLOR.paper), flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 5 },
  // 하랑이와 대화하기: 2칸 폭, 얼굴 그림(58px) + 글씨를 가로로 놓는다
  chatButton: { flex: 2, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 14, backgroundColor: '#ffe1d6' }, // 대화하기 창의 코랄 연분홍 (chat.tsx와 같은 값)
  chatFace: { width: 58, height: 58 },
  quickText: { fontSize: 16, fontWeight: '800', color: COLOR.ink }, // 주머니·하랑이와 대화하기 (기존 14)
  chatText: { fontSize: 16 }, // 하랑이와 대화하기 글자만 키움 (기존 14)

  // 오늘 챙길 것 (목업 .wxcard: 남은 높이를 채운다)
  tips: { ...pxBox(COLOR.paper), flex: 1, paddingVertical: 10, paddingHorizontal: 16, gap: 8 }, // 목업 .wxcard: 안쪽 14/16, 간격 10 (남은 높이를 모두 쓴다)
  tipRows: { flex: 1, justifyContent: 'space-evenly', gap: TIP_GAP },
  tipsTitle: { fontSize: 16, fontWeight: '800', color: COLOR.ink }, // 기존 15
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipText: { fontSize: 17, color: COLOR.ink }, // 준비물 글자 (기존 15)
});

