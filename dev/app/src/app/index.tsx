/*
 * [index.tsx] 홈 화면 S-03 (주소: /) — 로그인하면 가장 먼저 보이는 화면
 *
 * 역할
 *  - 목업 storyboard/app_home_mockup_v1.html의 홈과 상태 8종을 옮긴다 (상태표: lib/home_state.ts).
 *  - 흐름: 로그인하면 홈이 첫 화면이다 (2026-11-23 요청). 위치는 기본으로 중구(MVP 지역)를 쓰고,
 *    왼쪽 위 날씨·지역 배지를 누르면 위치 확인 화면(/location)에서 바꾼다.
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
 *  - 쉼터·경로 변경·이어하기·주머니·장부·오늘 페이지 화면 → 지금은 준비 중(/soon)
 *  - 하랑이 대사: 승인 대사 대기. 목업 자리 표시를 그대로 둔다 [창작, 승인 필요]
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { BottomTab } from '../components/bottom_tab';
import { APP_MAX_WIDTH } from '../components/phone_column';
import { PixelSprite } from '../components/pixel_book';
import { PixelIcon } from '../components/pixel_icons';
import { DISTRICTS, findDistrict } from '../lib/districts';
import { BADGE_TONE, HOME_STATES, HomeGo, isHomeStateKey, pickHomeState, ROOM_IMAGE, TIP_ICON } from '../lib/home_state';
import { usePlace } from '../lib/place_context';
import { displayName } from '../lib/profile';
import { useProfile } from '../lib/profile_context';
import { getWeatherNow } from '../lib/server_api';
import { COLOR, pxBox } from '../lib/theme';

// 하단 탭 높이, 본문 최소 높이(여백 32 + 큰 버튼 68 + 빠른 버튼 64 + 간격 24 + 챙길 것 최소 150)
const TAB_HEIGHT = 84;
const BODY_MIN = 32 + 68 + 64 + 24 + 150;
const TIP_GAP = 8;

// 말풍선 꼬리 7x7 (K 잉크 테두리, F 종이색 속)
const BUBBLE_TAIL = ['KFFFFFK', 'KFFFFK.', 'KFFFK..', 'KFFK...', 'KFK....', 'KK.....', 'K......'];

// 하랑이 숨쉬기: 위아래 4px (위치 확인 화면과 같은 움직임)
function createBob() {
  const value = new Animated.Value(0);
  return { value, y: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) };
}

const soon = (what: string) => router.push({ pathname: '/soon', params: { what } });

// 큰 버튼·알림 띠가 갈 곳. 화면이 아직 없는 곳은 준비 중으로 보낸다.
function go(target: HomeGo) {
  if (target === 'today') router.push('/today');
  else if (target === 'courses') router.push('/courses');
  else if (target === 'region') router.push('/location');
  else if (target === 'shelter') soon('가까운 쉼터');
  else if (target === 'reroute') soon('경로 변경');
  else soon('이어하기'); // travel: 진행 중인 여행이 저장되지 않아 아직 이어 갈 수 없다
}

// 받은 날씨. key는 어느 위치로 받은 값인지 표시한다 (위치가 바뀌면 다시 "확인 중"이 된다)
type WeatherView = { key: string; status: 'ok'; temp: number; hour: number } | { key: string; status: 'unavailable' };

export default function HomeScreen() {
  const { place, setPlace } = usePlace();
  const { profile } = useProfile();
  const name = displayName(profile);
  const params = useLocalSearchParams<{ state?: string }>();
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
  const iconSize = tipsAreaH > 0 ? Math.max(28, Math.min(48, (tipsAreaH - 2 * TIP_GAP) / 3)) : 48;
  const [bob] = useState(createBob);
  const [weather, setWeather] = useState<WeatherView | null>(null);

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

  // 위치를 아직 정하지 않았으면 기본 지역(중구 기준점)을 쓴다. MVP는 중구만 안내한다 (districts.ts).
  useEffect(() => {
    const jung = DISTRICTS.find((d) => d.code === 'jung');
    if (!place && jung?.center) setPlace({ kind: 'district', code: jung.code, ...jung.center });
  }, [place, setPlace]);

  // 지금 위치의 날씨를 받는다. 좌표는 요청 본문으로만 보내고, 화면이나 로그에 남기지 않는다.
  const lat = place?.latitude;
  const lng = place?.longitude;
  const placeKey = lat !== undefined && lng !== undefined ? `${lat},${lng}` : '';
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    const key = `${lat},${lng}`;
    let alive = true;
    getWeatherNow(lat, lng).then((r) => {
      if (!alive) return;
      if (r.ok && r.data.status === 'ok') setWeather({ key, status: 'ok', temp: r.data.temperatureC, hour: r.data.hour });
      else setWeather({ key, status: 'unavailable' });
    });
    return () => {
      alive = false;
    };
  }, [lat, lng]);

  const current = weather && weather.key === placeKey ? weather : null; // 지금 위치의 값만 쓴다
  const weatherState = !current ? 'loading' : current.status;
  // 개발 중에만 ?state=이름 으로 다른 상태를 미리 본다
  const previewKey = __DEV__ && isHomeStateKey(params.state) ? params.state : null;
  const stateKey = previewKey ?? pickHomeState(weatherState);
  const s = HOME_STATES[stateKey];
  const tone = BADGE_TONE[s.tone];

  const areaName = !place ? '중구' : place.kind === 'district' ? (findDistrict(place.code)?.name ?? '선택한 동네') : '현재 위치';
  const live = s.live && current?.status === 'ok';
  const temp = live ? String(Math.round(current.temp)) : '[○]';
  const base = live ? `${current.hour}시` : weatherState === 'loading' && !previewKey ? '확인 중' : '[기준 시각]';
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

        {/* 날씨·지역 배지 (목업 .badge). 누르면 위치를 다시 고른다 */}
        <Pressable
          onPress={() => router.push('/location')}
          style={[styles.badge, { ...pxBox(tone.bg, tone.shade), left: 12 * k, top: badgeTop }]}
        >
          <View style={[styles.badgeDot, { backgroundColor: tone.dot }]} />
          <View>
            <Text style={styles.badgeMain}>{badgeMain}</Text>
            <Text style={styles.badgeSub}>{badgeSub}</Text>
          </View>
        </Pressable>

        {/* 오늘 페이지 표시 (책상 위 장부) */}
        <Pressable onPress={() => soon('오늘 페이지')} style={[styles.mark, { left: 222 * k, top: 166 * k - crop }]}>
          <Text style={styles.markText}>오늘 페이지 ▾</Text>
        </Pressable>

        {/* 말풍선 (목업 .bubble: 왼쪽 40, 아래에서 118, 폭 172) */}
        <View
          style={[styles.bubble, { left: 40 * k, bottom: bubbleBottom, width: 172 * k }]}
          onLayout={(e) => setBubbleH(e.nativeEvent.layout.height)}
        >
          <Text style={styles.bubbleText}>{s.bubble.replace('{name}', name)}</Text>
          <Text style={styles.bubbleMuted}>[승인 대사 대기]</Text>
          {s.bubbleAlert ? <Text style={styles.bubbleAlert}>오늘 비어 있는 장소가 있어요 [임시]</Text> : null}
          {/* 말풍선 꼬리 (목업 .tail: 왼쪽 120, 계단 모양) */}
          <View style={[styles.tail, { left: 120 * k - 3 }]}>
            <PixelSprite grid={BUBBLE_TAIL} cell={3} />
          </View>
        </View>

        <Animated.Image
          source={require('../../assets/harangi_pixel_idle_transparent.png')}
          style={{
            position: 'absolute',
            left: 70 * k,
            top: 210 * k - crop,
            width: 92 * k,
            height: 95 * k,
            transform: [{ translateY: bob.y }],
          }}
          resizeMode="contain"
        />

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
        <Pressable onPress={() => go(s.cta.go)} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
          <Text style={styles.ctaMain}>{s.cta.title}</Text>
          <Text style={styles.ctaSub}>{s.cta.sub}</Text>
        </Pressable>

        {/* 빠른 버튼 (목업 .quick: 3칸 격자, [하랑이와 대화하기]가 2칸, [주머니]가 1칸) */}
        <View style={styles.quick}>
          <Pressable onPress={() => router.push('/chat')} style={({ pressed }) => [styles.quickButton, styles.chatButton, pressed && styles.pressed]}>
            <Image source={require('../../assets/harangi_chat_btn_v1.png')} style={styles.chatFace} resizeMode="contain" />
            <Text style={styles.quickText}>하랑이와 대화하기</Text>
          </Pressable>
          <Pressable onPress={() => soon('주머니')} style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}>
            <PixelIcon name="pouch" color={COLOR.ink} />
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
                <Text style={styles.tipText}>{t.label}</Text>
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

  bubble: { ...pxBox(COLOR.paper), position: 'absolute', zIndex: 4, paddingVertical: 7, paddingHorizontal: 8 },
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
  body: { flex: 1, backgroundColor: COLOR.cream, borderTopWidth: 6, borderTopColor: COLOR.ink, padding: 16, gap: 12, overflow: 'hidden' },
  pressed: { opacity: 0.85 },

  // 큰 버튼 (목업 .cta: 높이 68, 왼쪽 정렬)
  cta: { ...pxBox(COLOR.red, COLOR.redDark), height: 68, paddingHorizontal: 14, justifyContent: 'center' },
  ctaMain: { color: '#fff', fontSize: 17, fontWeight: '800' },
  ctaSub: { color: '#fff', fontSize: 12, opacity: 0.92, marginTop: 3 },

  // 빠른 버튼 (목업 .quick: 높이 64, 간격 10, 글씨 14 굵게)
  quick: { flexDirection: 'row', gap: 10 },
  quickButton: { ...pxBox(COLOR.paper), flex: 1, height: 64, alignItems: 'center', justifyContent: 'center', gap: 5 },
  // 하랑이와 대화하기: 2칸 폭, 얼굴 그림(58px) + 글씨를 가로로 놓는다
  chatButton: { flex: 2, flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 14 },
  chatFace: { width: 58, height: 58 },
  quickText: { fontSize: 14, fontWeight: '800', color: COLOR.ink },

  // 오늘 챙길 것 (목업 .wxcard: 남은 높이를 채운다)
  tips: { ...pxBox(COLOR.paper), flex: 1, paddingVertical: 12, paddingHorizontal: 16, gap: 8 },
  tipRows: { flex: 1, justifyContent: 'space-evenly', gap: TIP_GAP },
  tipsTitle: { fontSize: 15, fontWeight: '800', color: COLOR.ink },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tipText: { fontSize: 15, color: COLOR.ink },
});
