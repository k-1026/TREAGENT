// 친구와 함께 (주소: /team) — 팀을 만들거나 초대 코드로 들어간다
import { router } from 'expo-router';
import { Pressable, SafeAreaView, ScrollView, Text } from 'react-native';
import { ScreenHead } from '../../components/screen_head';
import { COLOR, pxBox } from '../../lib/theme';

export default function TeamHomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScreenHead title="친구와 함께" sub="같은 길을 함께 걸어요" backLabel="‹ 홈" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Pressable onPress={() => router.push('/team/create')} style={[pxBox(COLOR.red, COLOR.redDark), { padding: 16, gap: 4 }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>팀 만들기</Text>
          <Text style={{ color: '#fff', fontSize: 12 }}>내가 방장이 돼서 후보 길 중에서 골라요</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/team/join')} style={[pxBox(), { padding: 16, gap: 4 }]}>
          <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 16 }}>초대 코드로 들어가기</Text>
          <Text style={{ color: COLOR.muted, fontSize: 12 }}>친구가 알려 준 8글자 코드를 입력해요</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}