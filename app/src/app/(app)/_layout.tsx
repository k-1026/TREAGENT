import { Redirect, Stack } from 'expo-router';
import { useAuth } from '../../auth/AuthProvider';

// 로그인 후 화면 묶음. 세션이 없으면 로그인으로 보낸다 (spec F-12: 로그아웃 후 보호 화면 접근 시 로그인으로).
// 화면 숨김은 편의일 뿐이며 데이터 접근 제한은 서버의 RLS 정책이 한다.
export default function AppLayout() {
  const { session } = useAuth();
  if (!session) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
