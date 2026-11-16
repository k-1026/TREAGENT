/*
 * [index.tsx] 위치 확인 화면 (주소: /) — 로그인하면 가장 먼저 보이는 화면
 *
 * 역할
 *  - 로그인하면 바로 이 화면이 열린다. (_layout.tsx가 로그인 후 / 로 보낸다)
 *  - 현재 위치를 읽거나, 구·군을 직접 골라 시작 위치를 정한다.
 *
 * 동작
 *  - [현재 위치 사용] → getCurrentLocation() 호출, 읽는 동안 로딩 표시
 *  - [구·군 선택하기]는 위치 버튼 옆에 항상 같이 보인다 (거부·실패를 기다리지 않는다)
 *  - ok          : 좌표와 오차를 표시 (화면 state에만 두고 저장·로그하지 않는다)
 *  - denied      : 안내 + (canAskAgain=false면 [설정 열기])
 *  - unavailable : 안내
 *  - /district에서 돌아오면 district 파라미터로 "선택한 구·군"을 표시한다.
 *  - 위쪽 [로그아웃]은 signOut() 후 _layout.tsx가 /login 으로 보낸다.
 */

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, Text, View } from 'react-native';
import { findDistrict } from '../lib/districts';
import { getCurrentLocation, LocationResult } from '../lib/location';
import { supabase } from '../lib/supabase';

// "구·군 선택하기" 버튼 (구·군 선택 화면으로 이동). 위치 버튼 옆에 항상 같이 보여 준다
function DistrictButton() {
  return (
    <Pressable
      onPress={() => router.push('/district')}
      style={{ flex: 1, borderWidth: 1.5, borderColor: '#a8242a', paddingVertical: 12, borderRadius: 12, alignItems: 'center' }}
    >
      <Text style={{ color: '#a8242a', fontWeight: '600' }}>구·군 선택하기</Text>
    </Pressable>
  );
}

export default function LocationScreen() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationResult | null>(null);
  // /district에서 넘어온 값 (없으면 undefined)
  const { district } = useLocalSearchParams<{ district?: string }>();
  const selectedDistrict = findDistrict(district);

  const onPressLocation = async () => {
    setLoading(true);
    setLocation(await getCurrentLocation());
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf6ee' }}>
      <View style={{ padding: 20, gap: 12 }}>
        <Pressable onPress={() => supabase.auth.signOut()} style={{ alignSelf: 'flex-end'}}>
          <Text style={{ color: '#a8242a', fontSize: 14, fontWeight: '600' }}>로그아웃</Text>
        </Pressable>

        <Text style={{ fontSize: 22, fontWeight: '700', color: '#2b2118' }}>내 위치 확인</Text>
        <Text style={{ color: '#7a6a5a' }}>앱을 쓰는 동안만 현재 위치를 사용하고, 좌표는 저장하지 않아요.</Text>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            disabled={loading}
            onPress={onPressLocation}
            style={{ flex: 1, backgroundColor: '#a8242a', paddingVertical: 12, borderRadius: 12, alignItems: 'center', opacity: loading ? 0.6 : 1 }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>현재 위치 사용</Text>
          </Pressable>
          <DistrictButton />
        </View>

        {loading && <ActivityIndicator color="#a8242a" />}

        {!loading && location?.status === 'ok' && (
          <Text style={{ color: '#2b2118' }}>
            위치 확인됨: {location.latitude.toFixed(3)}, {location.longitude.toFixed(3)}
            {location.accuracy !== null ? ` (오차 약 ${Math.round(location.accuracy)}m)` : ''}
          </Text>
        )}

        {!loading && location?.status === 'denied' && (
          <>
            <Text style={{ color: '#2b2118' }}>위치 권한이 꺼져 있어요.</Text>
            {!location.canAskAgain && (
              <Pressable onPress={() => Linking.openSettings()}>
                <Text style={{ color: '#a8242a', fontWeight: '600' }}>설정 열기</Text>
              </Pressable>
            )}
          </>
        )}

        {!loading && location?.status === 'unavailable' && (
            <Text style={{ color: '#2b2118' }}>위치를 읽지 못했어요. 위치 서비스가 켜져 있는지 확인해 주세요.</Text>
        )}

        {selectedDistrict && (
          <Text style={{ color: '#2b2118' }}>선택한 구·군: {selectedDistrict.name}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}