/*
 * [_layout.tsx] 모든 화면의 입구 (화면 보호)
 *
 * 역할
 *  - 앱 전체를 <AuthProvider>로 감싸 로그인 상태를 공유한다.
 *  - 로그인 여부에 따라 /login 과 홈 사이를 자동으로 이동시킨다.
 *
 * 판단 규칙 (Gate)
 *  1) loading 중이면 아무것도 그리지 않는다.
 *  2) 로그인 안 했는데 로그인 전 화면(title, login, signup)이 아니면 -> /title 로 이동
 *  3) 로그인 했는데 로그인 전 화면이면                              -> 홈(또는 첫 만남)으로 이동
 *  4) 그 외에는 그대로 화면을 보여 준다.
 *
 * 왜 Gate를 따로 두나
 *  - useAuth()는 <AuthProvider> 안쪽 컴포넌트에서만 쓸 수 있다.
 *
 * 왜 <Redirect>와 <Stack>을 같이 그리나
 *  - 루트 레이아웃이 마운트되기 전에 이동하면 오류가 나서, <Stack>은 항상 그린다.
 *  - 대신 이동해야 하는 동안에는 screenLayout으로 각 화면의 내용을 비운다.
 *    (로그인 없이 주소를 직접 열었을 때 보호 화면이 한 프레임 그려져 서버 호출이 나가는 것을 막는다.)
 *  - 이것은 화면 표시용 가드다. 진짜 보호는 서버가 한다 (dev/server/src/auth/require_login.js).
 */
import { Redirect, Stack, useSegments } from 'expo-router';
import type { Href } from 'expo-router';
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

  // 지금 화면이 맞지 않으면 이동할 곳을 정한다. 맞으면 null (서로 겹치지 않는 경우만 있다).
  let redirectTo: Href | null = null;
  if (!session) {
    if (!onAuthScreen) redirectTo = '/title';
  } else if (onAuthScreen) {
    redirectTo = status === 'ready' ? '/' : '/welcome';
  } else if (status === 'none' && !onWelcome) {
    redirectTo = '/welcome';
  } else if (status === 'ready' && onWelcome) {
    redirectTo = '/';
  }

  return (
    <>
      {redirectTo && <Redirect href={redirectTo} />}
      <Stack
        screenOptions={{ headerShown: false }}
        // 이동하는 동안에는 화면 내용을 그리지 않는다 (화면 안의 서버 호출이 실행되지 않게).
        screenLayout={({ children }) => (redirectTo ? <></> : children)}
      />
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