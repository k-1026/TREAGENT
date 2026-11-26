/*
 * [signup.tsx] 회원가입 화면 (주소: /signup)
 *
 * 역할
 *  - 이메일과 비밀번호로 새 계정을 만든다. (supabase.auth.signUp)
 *  - 모양은 목업(storyboard/app_login_region_mockup_v1.html ③)을 따른다. (auth_ui.tsx 부품 사용)
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
import { StyleSheet } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLOR } from '../lib/theme';
import { AuthFrame, PxButton, PxInput, PxMessage } from '../components/auth_ui';

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

  // 메일 안내(세션 없음)는 연두색 안내 상자, 나머지 오류는 분홍 상자
  const isMailNotice = message.startsWith('가입 메일을 보냈어요');

  return (
    <AuthFrame title="처음이에요" subtitle="가입">
      <PxInput
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
      />
      <PxInput
        placeholder={`비밀번호 (${MIN_PASSWORD}자 이상)`}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />
      <PxInput
        placeholder="비밀번호 확인"
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoCapitalize="none"
      />

      {message !== '' && <PxMessage tone={isMailNotice ? 'ok' : 'error'}>{message}</PxMessage>}

      <PxButton label={submitting ? '가입 중...' : '가입하기'} onPress={onSignup} disabled={disabled} />

      <Link href="/login" style={styles.link}>
        이미 계정이 있어요
      </Link>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  link: { color: COLOR.redDark, fontWeight: '700', fontSize: 13, textAlign: 'center', padding: 8 },
});
