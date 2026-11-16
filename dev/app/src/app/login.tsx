/*
 * [login.tsx] 로그인 화면 (주소: /login)
 *
 * 역할
 *  - 이메일과 비밀번호를 받아 Supabase에 로그인을 요청한다.
 *
 * 상태
 *  - email, password : 입력값
 *  - submitting      : 요청 중이면 true (버튼 중복 클릭 방지)
 *  - errorMessage    : 실패했을 때 보여 줄 문구
 *
 * 동작 순서
 *  1) 버튼을 누르면 submitting을 켜고 signInWithPassword를 호출한다.
 *  2) 실패하면 오류 문구를 보여 준다.
 *  3) 성공하면 여기서 이동하지 않는다.
 *     session이 바뀌면 _layout.tsx가 홈으로 보낸다.
 *
 * 주의
 *  - 비밀번호와 입력값은 console.log로 출력하지 않는다.
 *  - 오류 문구는 이메일/비밀번호 중 어느 쪽이 틀렸는지 알려 주지 않는다.
 */
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { Link } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const onLogin = async () => {
    setSubmitting(true);
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage('이메일 또는 비밀번호를 확인해 주세요.');
    }
    setSubmitting(false);
  };

  const disabled = submitting || email.length === 0 || password.length === 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <Text style={styles.title}>로그인</Text>

        <TextInput
          style={styles.input}
          placeholder="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        {errorMessage !== '' && <Text style={styles.error}>{errorMessage}</Text>}

        <Pressable
          style={[styles.button, disabled && styles.buttonOff]}
          onPress={onLogin}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>{submitting ? '로그인 중...' : '로그인'}</Text>
        </Pressable>

        <Link href="/signup" style={{ color: '#a8242a', textAlign: 'center' }}>
          계정이 없어요
        </Link>
      </View>
    </SafeAreaView>
  );
}

const RED = '#a8242a';
const BG = '#fbf6ee';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: '#2b2118' },
  input: { borderWidth: 1.5, borderColor: '#e6dccd', borderRadius: 12, padding: 14, fontSize: 16 },
  error: { color: RED, fontSize: 14 },
  button: { backgroundColor: RED, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonOff: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});