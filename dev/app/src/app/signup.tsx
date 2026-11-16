/*
 * [signup.tsx] 회원가입 화면 (주소: /signup)
 *
 * 역할
 *  - 이메일과 비밀번호로 새 계정을 만든다. (supabase.auth.signUp)
 *
 * 상태
 *  - email, password, confirm : 입력값 (confirm은 비밀번호 확인)
 *  - submitting               : 요청 중이면 true
 *  - message                  : 오류 또는 안내 문구
 *
 * 동작 순서
 *  1) 비밀번호 길이와 확인값 일치를 먼저 검사한다. (서버에 보내기 전)
 *  2) signUp()을 호출한다.
 *  3) 오류가 있으면 문구를 보여 준다.
 *  4) 세션이 바로 생기면(이메일 확인이 꺼진 경우) _layout.tsx가 홈으로 보낸다.
 *  5) 세션이 없으면(이메일 확인이 켜진 경우) "메일을 확인해 달라"고 안내한다.
 *
 * 주의
 *  - 비밀번호와 입력값은 console.log로 출력하지 않는다.
 */
import { useState } from 'react';
import { Link } from 'expo-router';
import { Pressable, SafeAreaView, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

const MIN_PASSWORD = 8; // 우리 앱의 최소 길이 규칙

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const onSignup = async () => {
    if (password.length < MIN_PASSWORD) {
      setMessage(`비밀번호는 ${MIN_PASSWORD}자 이상으로 입력해 주세요.`);
      return;
    }
    if (password !== confirm) {
      setMessage('비밀번호가 서로 달라요.');
      return;
    }

    setSubmitting(true);
    setMessage('');

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setMessage('가입하지 못했어요. 입력한 내용을 확인해 주세요.');
    } else if (!data.session) {
      setMessage('가입 메일을 보냈어요. 메일의 확인 링크를 누른 뒤 로그인해 주세요.');
    }
    setSubmitting(false);
  };

  const disabled = submitting || email.length === 0 || password.length === 0 || confirm.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fbf6ee', justifyContent: 'center', padding: 20 }}>
      <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: '#2b2118' }}>회원가입</Text>

        <TextInput
          style={{ borderWidth: 1.5, borderColor: '#e6dccd', borderRadius: 12, padding: 14, fontSize: 16 }}
          placeholder="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <TextInput
          style={{ borderWidth: 1.5, borderColor: '#e6dccd', borderRadius: 12, padding: 14, fontSize: 16 }}
          placeholder={`비밀번호 (${MIN_PASSWORD}자 이상)`}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />
        <TextInput
          style={{ borderWidth: 1.5, borderColor: '#e6dccd', borderRadius: 12, padding: 14, fontSize: 16 }}
          placeholder="비밀번호 확인"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
        />

        {message !== '' && <Text style={{ color: '#a8242a', fontSize: 14 }}>{message}</Text>}

        <Pressable
          style={{ backgroundColor: '#a8242a', paddingVertical: 14, borderRadius: 12, alignItems: 'center', opacity: disabled ? 0.5 : 1 }}
          onPress={onSignup}
          disabled={disabled}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
            {submitting ? '가입 중...' : '가입하기'}
          </Text>
        </Pressable>

        <Link href="/login" style={{ color: '#a8242a', textAlign: 'center' }}>
          이미 계정이 있어요
        </Link>
      </View>
    </SafeAreaView>
  );
}