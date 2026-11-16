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
import { AuthProvider, useAuth } from '../lib/auth_context';

function Gate() {
  const { session, loading } = useAuth();
  const segments = useSegments();

  if (loading) return null;

  const onLoginScreen = segments[0] === 'login' || segments[0] === 'signup';

  return (
    <>
      {!session && !onLoginScreen && <Redirect href="/login" />}
      {session && onLoginScreen && <Redirect href="/" />}
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}