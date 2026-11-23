/*
 * [index.tsx] 위치 확인 화면 (주소: /) — 로그인하면 가장 먼저 보이는 화면
 *
 * 역할
 *  - 로그인하면 바로 이 화면이 열린다. (_layout.tsx가 로그인 후 / 로 보낸다)
 *  - 현재 위치를 읽거나, 구·군을 직접 골라 시작 위치를 정한다.
 *  - 모양은 목업(storyboard/app_login_region_mockup_v1.html ④ 위치 확인)을 따른다.
 *    위쪽 장면(방 그림, 하랑이, 말풍선) + 아래쪽 패널(버튼과 상태 문구).
 *
 * 동작
 *  - [현재 위치 사용] → getCurrentLocation() 호출, 읽는 동안 로딩 표시
 *  - [구·군 선택하기]는 위치 버튼 옆에 항상 같이 보인다 (거부·실패를 기다리지 않는다)
 *  - ok          : 좌표와 오차를 표시 (화면 state에만 두고 저장·로그하지 않는다)
 *  - denied      : 안내 + (canAskAgain=false면 [설정 열기])
 *  - unavailable : 안내
 *  - /district에서 돌아오면 district 파라미터로 "선택한 구·군"을 표시한다.
 *
 * 목업과 맞춘 것
 *  - 위치를 읽어도 좌표는 화면에 보이지 않는다 (목업 ④ "위치 확인됨" 상태).
 *  - 위치를 읽지 못하면 말풍선이 "구·군을 골라 줄래요?"로 바뀐다 (목업 ④ "위치를 읽지 못함" 상태).
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Image, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { findDistrict } from '../lib/districts';
import { getCurrentLocation, LocationResult } from '../lib/location';
import { usePlace } from '../lib/place_context';
import { useProfile } from '../lib/profile_context';
import { displayName } from '../lib/profile';
import { BTN_RED, COLOR } from '../lib/theme';
import { PxButton, PxMessage } from '../components/auth_ui';
import { APP_MAX_WIDTH, CONTENT, CONTENT_MAX_WIDTH } from '../components/phone_column';

// 하랑이 숨쉬기: 위아래로 4px을 0.9초마다 오간다. 화면을 떠나면 멈춘다.
function createBob() {
  const value = new Animated.Value(0);
  return { value, y: value.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) };
}

export default function LocationScreen() {
  const { profile } = useProfile();
  const name = displayName(profile);
  const [bob] = useState(createBob);
  const [loading, setLoading] = useState(false);
  // 장면 크기: 목업(390 x 316)을 화면 폭에 맞춘다. 그림을 확대·자르지 않는다 (2026-11-23 요청).
  //  - 배율 k = 화면 폭 / 390. 휴대폰 폭이 390보다 좁으면 조금 줄고, 넓으면(웹 최대 430) 조금 는다.
  const { width: winWidth } = useWindowDimensions();
  const sceneW = Math.min(winWidth, APP_MAX_WIDTH);
  const k = sceneW / 390;

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
  const [location, setLocation] = useState<LocationResult | null>(null);
  // /district에서 넘어온 값 (없으면 undefined)
  const { district } = useLocalSearchParams<{ district?: string }>();
  const selectedDistrict = findDistrict(district);
  const { setPlace } = usePlace();
  // 위치를 읽었으면 그 좌표, 아니면 구·군 기준점(코스가 있는 지역만)을 쓴다.
  const canGoCourses = location?.status === 'ok' || !!selectedDistrict?.center;

  const goWithPlace = (path: '/today' | '/team') => {
    if (location?.status === 'ok') {
      setPlace({ kind: 'gps', latitude: location.latitude, longitude: location.longitude });
    } else if (selectedDistrict?.center) {
      setPlace({ kind: 'district', code: selectedDistrict.code, ...selectedDistrict.center });
    } else {
      return;
    }
    router.push(path);
  };
  const onPressLocation = async () => {
    setLoading(true);
    setLocation(await getCurrentLocation());
    setLoading(false);
  };

  return (
    <View style={styles.safe}>
      {/* 위쪽 장면: 방 그림, 하랑이, 말풍선 */}
      <View style={[styles.scene, { height: 316 * k }]}>
        {/* 방 그림: 목업 위치(위 56) 그대로, 화면 폭에 맞춘 크기 */}
        <Image
          source={require('../../assets/home_room_day_v1.webp')}
          style={[styles.room, { left: 0, top: 56 * k, width: 390 * k, height: 260 * k }]}
          resizeMode="cover"
        />

        {/* 말풍선과 하랑이: 목업 좌표(말풍선 104,92 / 하랑이 84,222)에 배율 k를 곱한다 */}
        <View style={[styles.bubble, { left: 104 * k, top: 92 * k, width: 210 * k }]}>
          <Text style={styles.bubbleText}>
            {location?.status === 'unavailable'
              ? '어라, 위치를 못 읽었어요... 구·군을 골라 줄래요?'
              : '오늘의 길을 고르려면 어디쯤인지 알아야 해요. 위치는 앱 쓰는 동안만 쓰고 저장은 안 해요!'}
          </Text>
        </View>

        <Animated.Image
          source={require('../../assets/harangi_pixel_idle_transparent.png')}
          style={[
            styles.harangi,
            { left: 84 * k, top: 222 * k, width: 92 * k, height: 95 * k, transform: [{ translateY: bob.y }] },
          ]}
          resizeMode="contain"
        />

        {/* 인사말과 내 정보 버튼은 화면 폭 전체 기준으로 양끝에 둔다 (내용 최대 폭 안에서) */}
        <View style={styles.topRow}>
          <Text style={styles.hello}>{name} 님, 안녕하세요</Text>
          <Pressable onPress={() => router.push('/me')} style={styles.myPage}>
            <Text style={styles.myPageText}>내 정보</Text>
          </Pressable>
        </View>
      </View>

      {/* 아래쪽 패널: 제목, 안내, 버튼, 상태 문구 */}
      <ScrollView style={styles.panel} contentContainerStyle={[styles.panelContent, CONTENT]}>
        {/* 패널은 세 묶음(① 제목·안내 ② 위치 고르기·상태 ③ 출발 버튼)을 위에서부터 붙여 쌓는다 */}
        <View style={styles.block}>
          <Text style={styles.title}>어디서 시작할까요?</Text>
          <Text style={styles.note}>위치는 앱을 쓰는 동안만 써요. 좌표는 저장하지 않고 화면에도 보이지 않아요.</Text>
        </View>

        <View style={styles.block}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <PxButton label="현재 위치 사용" onPress={onPressLocation} disabled={loading} />
            </View>
            <View style={styles.flex}>
              <PxButton label="구·군 선택하기" variant="sub" onPress={() => router.push('/district')} />
            </View>
          </View>

          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator color={BTN_RED} />
              <Text style={styles.note}>위치를 읽는 중이에요...</Text>
            </View>
          )}

          {!loading && location?.status === 'ok' && (
            <PxMessage tone="ok">현재 위치로 안내해요 (좌표는 보이지 않아요)</PxMessage>
          )}

          {!loading && location?.status === 'denied' && (
            <PxMessage tone="info">위치 권한이 꺼져 있어요. 구·군을 골라도 괜찮아요.</PxMessage>
          )}
          {!loading && location?.status === 'denied' && !location.canAskAgain && (
            <Pressable onPress={() => Linking.openSettings()}>
              <Text style={styles.link}>설정 열기</Text>
            </Pressable>
          )}

          {!loading && location?.status === 'unavailable' && (
            <PxMessage tone="error">위치를 읽지 못했어요. 구·군을 골라 주세요.</PxMessage>
          )}

          {selectedDistrict && (
            <PxMessage tone="ok">{`선택한 동네: ${selectedDistrict.name}`}</PxMessage>
          )}
          {selectedDistrict && !selectedDistrict.center && location?.status !== 'ok' && (
            <Text style={styles.note}>아직 준비 중이에요. 지금은 중구만 갈 수 있어요.</Text>
          )}
        </View>

        <View style={styles.goBox}>
          <PxButton label="AI 오늘의 길 받기" onPress={() => goWithPlace('/today')} disabled={!canGoCourses} />
          <PxButton label="친구와 함께" variant="sub" onPress={() => goWithPlace('/team')} disabled={!canGoCourses} />
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },

  // 위쪽 장면 (목업 .scene: 높이 316, 주황 바탕)
  scene: { backgroundColor: COLOR.beam, overflow: 'hidden' },
  room: { position: 'absolute' },
  topRow: { position: 'absolute', top: 56, zIndex: 2, width: '100%', maxWidth: CONTENT_MAX_WIDTH, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // 인사말: 방 그림 위에서도 읽히도록 종이색 칸에 넣는다 (내 정보 버튼과 같은 모양)
  hello: { backgroundColor: COLOR.paper, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 2, borderColor: COLOR.ink, color: COLOR.ink, fontSize: 12, fontWeight: '800' },
  myPage: { backgroundColor: COLOR.paper, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 2, borderColor: COLOR.ink },
  myPageText: { color: COLOR.ink, fontSize: 12, fontWeight: '800' },

  // 말풍선 (목업 .bubble)
  bubble: {
    position: 'absolute',
    backgroundColor: COLOR.paper,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 3,
    borderColor: COLOR.ink,
  },
  bubbleText: { fontSize: 11, lineHeight: 16, color: COLOR.ink },

  // 하랑이 (목업 .spr: 92x95, 왼쪽 84 / 위 222)
  harangi: { position: 'absolute' },

  // 아래쪽 패널 (목업 .panel: 위쪽 잉크색 선)
  panel: { flex: 1, backgroundColor: COLOR.cream, borderTopWidth: 6, borderTopColor: COLOR.ink },
  // 목업 .panel처럼 위에서부터 차례로 붙여 쌓는다 (묶음 사이를 벌리지 않는다)
  panelContent: { paddingTop: 18, paddingHorizontal: 20, paddingBottom: 28, gap: 14 },
  block: { gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: COLOR.ink },
  note: { fontSize: 11, color: COLOR.muted, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { color: COLOR.redDark, fontWeight: '700', fontSize: 13, padding: 6 },
  goBox: { gap: 10 },
});
