/*
 * [index.tsx] 홈 화면 (주소: /)
 *
 * 역할
 *  - 기존 App 화면 위에 "로그아웃" 버튼 줄을 얹는다.
 *  - App.tsx는 고치지 않는다.
 *
 * 동작
 *  - 버튼을 누르면 signOut()을 호출한다.
 *  - 이후 세션이 사라지면 auth_context가 알아채고,
 *    _layout.tsx가 /login 으로 자동 이동시킨다. (여기서 이동하지 않는다)
 *
 * 임시 기능 (현재 위치 읽기 확인용, 나중에 구·군 선택/날씨 조회로 대체)
 *  - "현재 위치 사용" 버튼 → getCurrentLocation() 호출 → 결과를 화면에 표시한다.
 *  - 읽는 동안 로딩 표시, 권한을 다시 물을 수 없으면 "설정 열기" 버튼을 보여 준다.
 *  - 좌표는 이 화면의 state에만 두고 저장·로그하지 않는다.
 */
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import App from '../../App';
import { getCurrentLocation, LocationResult } from '../lib/location';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [location, setLocation] = useState<LocationResult | null>(null);

  const onPressLocation = async () => {
    setLoading(true);
    setLocation(await getCurrentLocation());
    setLoading(false);
  };
  return (
    <View style={{ flex: 1, backgroundColor: '#fbf6ee' }}>
      <Pressable
        style={{ alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 12 }}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={{ color: '#a8242a', fontSize: 14, fontWeight: '600' }}>로그아웃</Text>
      </Pressable>

      {/* 임시: 현재 위치 읽기 확인용 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 6 }}>
        <Pressable
          disabled={loading}
          onPress={onPressLocation}
          style={{ backgroundColor: '#a8242a', paddingVertical: 10, borderRadius: 10, alignItems: 'center', opacity: loading ? 0.6 : 1 }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>현재 위치 사용</Text>
        </Pressable>

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
      </View>

      <App />
    </View>
  );
}