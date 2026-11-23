/*
 * [_layout.tsx] 모든 화면의 입구 (화면 보호)
 *
 * 역할
 *  - 앱 전체를 <AuthProvider>로 감싸 로그인 상태를 공유한다.
 *  - 로그인 여부에 따라 /login 과 홈 사이를 자동으로 이동시킨다.
 *
 * 판단 규칙 (Gate)
 *  1) loading 중이면 아무것도 그리지 않는다.
 *  2) 로그인 안 했는데 로그인 화면이 아니면 -> /login 으로 이동
 *  3) 로그인 했는데 로그인 화면이면          -> / (홈) 으로 이동
 *  4) 그 외에는 그대로 화면을 보여 준다.
 *
 * 왜 Gate를 따로 두나
 *  - useAuth()는 <AuthProvider> 안쪽 컴포넌트에서만 쓸 수 있다.
 */
import { Redirect, Stack, useSegments } from 'expo-router';
import { Pressable, SafeAreaView, Text } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth_context';
import { PlaceProvider } from '../lib/place_context';
import { ProfileProvider, useProfile } from '../lib/profile_context';
import { supabase } from '../lib/supabase';
import { COLOR } from '../lib/theme';
import { PhoneColumn } from '../components/phone_column';
import { KeyOverlayProvider } from '../components/key_overlay';
import { TodayProvider } from '../lib/today_context';

// 프로필을 불러오지 못했을 때. 첫 만남 화면으로 보내면 이미 있는 프로필을 덮어쓸 수 있어서, 다시 해 보기만 준다.
function ProfileError({ onRetry }: { onRetry: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream, padding: 20, gap: 12 }}>
      <Text style={{ color: COLOR.ink }}>내 정보를 불러오지 못했어요.</Text>
      <Pressable onPress={onRetry}>
        <Text style={{ color: COLOR.red, fontWeight: '700' }}>다시 해 보기</Text>
      </Pressable>
      <Pressable onPress={() => supabase.auth.signOut()}>
        <Text style={{ color: COLOR.muted }}>로그아웃</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  const { status, retry } = useProfile();
  const segments = useSegments();

  if (loading) return null;

  // 로그인 전 화면: 타이틀, 로그인, 가입
  const onAuthScreen = segments[0] === 'title' || segments[0] === 'login' || segments[0] === 'signup';
  const onWelcome = segments[0] === 'welcome';

  if (session && status === 'loading') return null;
  if (session && status === 'error') return <ProfileError onRetry={retry} />;

  return (
    <>
      {!session && !onAuthScreen && <Redirect href="/title" />}
      {session && onAuthScreen && <Redirect href={status === 'ready' ? '/' : '/welcome'} />}
      {session && !onAuthScreen && status === 'none' && !onWelcome && <Redirect href="/welcome" />}
      {session && status === 'ready' && onWelcome && <Redirect href="/" />}
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <PlaceProvider>
          <TodayProvider>
            <PhoneColumn>
              {/* 로그인 성공 열쇠 연출은 모든 화면 위에 그린다 (key_overlay.tsx) */}
              <KeyOverlayProvider>
                <Gate />
              </KeyOverlayProvider>
            </PhoneColumn>
          </TodayProvider>
        </PlaceProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}