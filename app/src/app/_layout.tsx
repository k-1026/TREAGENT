import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../auth/AuthProvider';

function RootNavigator() {
  const { loading } = useAuth();

  // 저장된 세션을 확인하는 동안에는 로그인 화면을 보여 주지 않는다 (재실행 후 깜박임 방지)
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbf6ee' }}>
        <ActivityIndicator color="#a8242a" />
      </View>
    );
  }

  // 로그인 여부에 따른 이동은 (app)/_layout.tsx, (auth)/_layout.tsx 가 한다.
  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </AuthProvider>
  );
}
