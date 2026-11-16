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
 * 임시 링크
 *  - "위치 확인"을 누르면 위치 확인 화면(/location)으로 이동한다.
 */


import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import App from '../../App';
import { supabase } from '../lib/supabase';

export default function Home() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fbf6ee' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 }}>
        <Pressable onPress={() => router.push('/location')}>
          <Text style={{ color: '#a8242a', fontSize: 14, fontWeight: '600' }}>위치 확인</Text>
        </Pressable>
        <Pressable onPress={() => supabase.auth.signOut()}>
          <Text style={{ color: '#a8242a', fontSize: 14, fontWeight: '600' }}>로그아웃</Text>
        </Pressable>
      </View>
      <App />
    </View>
  );
}