import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { authLines } from '../../content/lines';
import { isSupabaseConfigured } from '../../lib/supabase';

const RED = '#a8242a';
const BG = '#fbf6ee';

type Mode = 'signIn' | 'signUp';

// 서버 설정 기본값(6자). 대시보드에서 바꾸면 여기도 맞춘다 [확인 필요]
const MIN_PASSWORD = 6;

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const submit = async () => {
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setIsError(true);
      setMessage(authLines.emailInvalid);
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setIsError(true);
      setMessage(authLines.passwordShort);
      return;
    }

    setBusy(true);
    setMessage(null);
    const result = mode === 'signIn' ? await signIn(trimmed, password) : await signUp(trimmed, password);
    setBusy(false);

    // 성공하면 세션이 생겨 루트 레이아웃이 홈으로 보낸다. 실패·메일 확인 안내만 여기서 보여 준다.
    if (!result.ok) {
      setIsError(true);
      setMessage(result.message ?? authLines.unknown);
    } else if (result.needsConfirm) {
      setIsError(false);
      setMessage(result.message ?? null);
      setMode('signIn');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.tag}>대프리카 히든 퀘스트</Text>
            <Text style={styles.title}>{mode === 'signIn' ? '로그인' : '가입하기'}</Text>
            <Text style={styles.body}>하랑이: {authLines.welcome}</Text>

            {!isSupabaseConfigured && <Text style={styles.warn}>{authLines.setupNeeded}</Text>}

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="이메일"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!busy}
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호"
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'}
              textContentType={mode === 'signIn' ? 'password' : 'newPassword'}
              editable={!busy}
              onSubmitEditing={submit}
            />

            {message !== null && <Text style={isError ? styles.error : styles.info}>{message}</Text>}

            <Pressable
              style={[styles.button, (busy || !isSupabaseConfigured) && styles.buttonOff]}
              onPress={submit}
              disabled={busy || !isSupabaseConfigured}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{mode === 'signIn' ? '로그인' : '가입하기'}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => {
                setMode(mode === 'signIn' ? 'signUp' : 'signIn');
                setMessage(null);
              }}
              disabled={busy}
            >
              <Text style={styles.link}>
                {mode === 'signIn' ? '처음이라면 가입하기' : '이미 가입했다면 로그인'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  tag: { color: RED, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#2b2118' },
  body: { fontSize: 16, lineHeight: 24, color: '#2b2118' },
  input: { borderWidth: 1.5, borderColor: '#e6dccd', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#2b2118' },
  error: { color: RED, fontSize: 14, lineHeight: 20 },
  info: { color: '#2b2118', fontSize: 14, lineHeight: 20, backgroundColor: BG, borderRadius: 8, padding: 10 },
  warn: { color: '#7a4a00', fontSize: 13, lineHeight: 19, backgroundColor: '#fff4dc', borderRadius: 8, padding: 10 },
  button: { backgroundColor: RED, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  buttonOff: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: RED, fontSize: 14, textAlign: 'center', paddingVertical: 6 },
});
