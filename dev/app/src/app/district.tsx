/*
 * [district.tsx] 구·군 선택 화면 (주소: /district)
 *
 * 역할
 *  - 위치 권한을 거부했거나 위치를 읽지 못했을 때, 구·군을 직접 고르게 한다.
 *
 * 동작
 *  - DISTRICTS 목록을 버튼으로 보여 준다.
  *  - 하나를 누르면 위치 확인 화면(/)으로 돌아가며, 선택한 코드를 district 파라미터로 넘긴다.
 *  - "닫기"는 선택 없이 이전 화면으로 돌아간다.
 *
 * 규칙: 좌표는 다루지 않는다. 선택값은 저장하지 않는다 (앱을 다시 켜면 사라진다).
 */
import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';
import { DISTRICTS } from '../lib/districts';

export default function DistrictScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf6ee' }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#2b2118' }}>어느 동네에서 시작할까요?</Text>

        {DISTRICTS.map((d) => (
          <Pressable
            key={d.code}
            onPress={() => router.navigate({ pathname: '/', params: { district: d.code } })}
            style={{ backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e6dccd', borderRadius: 12, padding: 14 }}
          >
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#2b2118' }}>{d.name}</Text>
          </Pressable>
        ))}

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center', padding: 12 }}>
          <Text style={{ color: '#a8242a', fontWeight: '600' }}>닫기</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}