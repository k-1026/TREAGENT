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
 * 확인 필요
 *  - 목업은 "좌표는 보이지 않아요"이지만, 기존 화면은 좌표를 보여 준다. 이번에는 기존 동작을 그대로 두었다. [결정 필요]
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { findDistrict } from '../lib/districts';
import { getCurrentLocation, LocationResult } from '../lib/location';
import { usePlace } from '../lib/place_context';
import { useProfile } from '../lib/profile_context';
import { displayName } from '../lib/profile';
import { BTN_RED, COLOR } from '../lib/theme';
import { PxButton, PxMessage } from '../components/auth_ui';

export default function LocationScreen() {
  const { profile } = useProfile();
  const name = displayName(profile);
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationResult | null>(null);
  // /district에서 넘어온 값 (없으면 undefined)
  const { district } = useLocalSearchParams<{ district?: string }>();
  const selectedDistrict = findDistrict(district);
  const { setPlace } = usePlace();
  // 위치를 읽었으면 그 좌표, 아니면 구·군 기준점(코스가 있는 지역만)을 쓴다.
  const canGoCourses = location?.status === 'ok' || !!selectedDistrict?.center;

  const goWithPlace = (path: '/courses' | '/today' | '/team') => {
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
      <View style={styles.scene}>
        <Image source={require('../../assets/home_room_day_v1.webp')} style={styles.room} resizeMode="cover" />

        <View style={styles.topRow}>
          <Text style={styles.hello}>{name} 님, 안녕하세요</Text>
          <Pressable onPress={() => router.push('/me')} style={styles.myPage}>
            <Text style={styles.myPageText}>내 정보</Text>
          </Pressable>
        </View>

        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>오늘의 길을 고르려면 어디쯤인지 알아야 해요. 위치는 앱 쓰는 동안만 쓰고 저장은 안 해요!</Text>
        </View>

        <Image source={require('../../assets/harangi_pixel_idle_transparent.png')} style={styles.harangi} resizeMode="contain" />
      </View>

      {/* 아래쪽 패널: 제목, 안내, 버튼, 상태 문구 */}
      <ScrollView style={styles.panel} contentContainerStyle={styles.panelContent}>
        <Text style={styles.title}>어디서 시작할까요?</Text>
        <Text style={styles.note}>앱을 쓰는 동안만 현재 위치를 사용하고, 좌표는 저장하지 않아요.</Text>

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
          <PxMessage tone="ok">
            {`현재 위치로 안내해요. 위치 확인됨: ${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}${
              location.accuracy !== null ? ` (오차 약 ${Math.round(location.accuracy)}m)` : ''
            }`}
          </PxMessage>
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
          <PxMessage tone="error">위치를 읽지 못했어요. 위치 서비스가 켜져 있는지 확인해 주세요.</PxMessage>
        )}

        {selectedDistrict && (
          <PxMessage tone="ok">{`선택한 구·군: ${selectedDistrict.name}`}</PxMessage>
        )}
        {selectedDistrict && !selectedDistrict.center && location?.status !== 'ok' && (
          <Text style={styles.note}>아직 준비 중이에요. 지금은 중구만 갈 수 있어요.</Text>
        )}

        <View style={styles.goBox}>
          <PxButton label="오늘의 길 보기" onPress={() => goWithPlace('/courses')} disabled={!canGoCourses} />
          <PxButton label="AI 오늘의 길 받기" variant="sub" onPress={() => goWithPlace('/today')} disabled={!canGoCourses} />
          <PxButton label="친구와 함께" variant="sub" onPress={() => goWithPlace('/team')} disabled={!canGoCourses} />
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },

  // 위쪽 장면 (목업 .scene: 높이 316, 주황 바탕)
  scene: { height: 300, backgroundColor: COLOR.beam, overflow: 'hidden', borderBottomWidth: 0 },
  room: { position: 'absolute', left: 0, right: 0, top: 40, height: 260 },
  topRow: { position: 'absolute', left: 16, right: 16, top: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hello: { color: '#fff3e0', fontSize: 13, fontWeight: '700' },
  myPage: { backgroundColor: COLOR.paper, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 2, borderColor: COLOR.ink },
  myPageText: { color: COLOR.ink, fontSize: 12, fontWeight: '800' },

  // 말풍선 (목업 .bubble)
  bubble: {
    position: 'absolute',
    left: 104,
    top: 110,
    width: 210,
    backgroundColor: COLOR.paper,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 3,
    borderColor: COLOR.ink,
  },
  bubbleText: { fontSize: 11, lineHeight: 16, color: COLOR.ink },

  // 하랑이 (목업 .spr: 92x95, 왼쪽 84 / 위 222)
  harangi: { position: 'absolute', left: 84, top: 200, width: 92, height: 95 },

  // 아래쪽 패널 (목업 .panel: 위쪽 잉크색 선)
  panel: { flex: 1, backgroundColor: COLOR.cream, borderTopWidth: 6, borderTopColor: COLOR.ink },
  panelContent: { padding: 18, paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '800', color: COLOR.ink },
  note: { fontSize: 11, color: COLOR.muted, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { color: COLOR.redDark, fontWeight: '700', fontSize: 13, padding: 6 },
  goBox: { gap: 10, marginTop: 6 },
});
