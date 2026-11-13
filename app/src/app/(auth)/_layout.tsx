import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../auth/AuthProvider';

// 로그인 전 화면 묶음. 이미 로그인했으면 홈으로 보낸다.
export default function AuthLayout() {
  const { session } = useAuth();
  if (session) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
