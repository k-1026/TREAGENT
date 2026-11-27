// 친구와 함께 (주소: /team) — 팀을 만들거나 초대 코드로 들어간다
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { ScreenHead } from '../../components/screen_head';
import { COLOR, pxBox } from '../../lib/theme';
import { CONTENT } from '../../components/phone_column';

export default function TeamHomeScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: COLOR.cream }}>
      {/* 앞 화면이 없으면(주소로 바로 열었을 때) 뒤로가 아무 일도 안 하므로 홈으로 보낸다 */}
      <ScreenHead
        title="친구와 함께"
        sub="같은 길을 함께 걸어요"
        backLabel="‹ 뒤로"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      {/* 내용은 남은 화면 가운데에 둔다 (flexGrow + justifyContent: center) */}
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 12, flexGrow: 1, justifyContent: 'center' }, CONTENT]}>
        <Pressable onPress={() => router.push('/team/create')} style={[pxBox(COLOR.red, COLOR.redDark), { padding: 16, gap: 4 }]}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>팀 만들기</Text>
          <Text style={{ color: '#fff', fontSize: 12 }}>내가 방장이 돼서 후보 길 중에서 골라요</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/team/join')} style={[pxBox(), { padding: 16, gap: 4 }]}>
          <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 16 }}>초대 코드로 들어가기</Text>
          <Text style={{ color: COLOR.muted, fontSize: 12 }}>친구가 알려 준 8글자 코드를 입력해요</Text>
        </Pressable>
        {/* 하랑이 (손 흔드는 그림): 페이지 맨 아래, 버튼 밑에 크게 */}
        <Image
          source={require('../../../assets/harangi_team_wave.png')}
          style={{ width: 200, height: 210, alignSelf: 'center', marginTop: 8 }}
          resizeMode="contain"
          accessibilityLabel="하랑이"
        />
      </ScrollView>
    </View>
  );
}