/*
 * [login.tsx] 로그인 화면 (주소: /login)
 *
 * 역할
 *  - 이메일과 비밀번호를 받아 Supabase에 로그인을 요청한다.
 *  - 모양은 목업(storyboard/app_login_region_mockup_v1.html ②)을 따른다. (auth_ui.tsx 부품 사용)
 *
 * 상태
 *  - email, password : 입력값
 *  - submitting      : 요청 중이면 true (버튼 중복 클릭 방지)
 *  - errorMessage    : 실패했을 때 보여 줄 문구
 *
 * 동작 순서
 *  1) 버튼을 누르면 submitting을 켜고 signInWithPassword를 호출한다.
 *  2) 실패하면 오류 문구를 보여 준다.
 *  3) 성공하면 열쇠 돌리기 연출을 켠다 (목업 ② 로그인 성공, key_overlay.tsx).
 *     화면 이동은 여기서 하지 않는다. session이 바뀌면 _layout.tsx가 홈으로 보낸다.
 *
 * 주의
 *  - 비밀번호와 입력값은 console.log로 출력하지 않는다.
 *  - 오류 문구는 이메일/비밀번호 중 어느 쪽이 틀렸는지 알려 주지 않는다.
 */
import { useState } from 'react';
import { Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLOR } from '../lib/theme';
import { AuthFrame, PxButton, PxInput, PxMessage } from '../components/auth_ui';
import { useKeyOverlay } from '../components/key_overlay';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const keyOverlay = useKeyOverlay();

  const onLogin = async () => {
    setSubmitting(true);
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage('이메일 또는 비밀번호를 확인해 주세요.');
    } else {
      keyOverlay.play();
    }
    setSubmitting(false);
  };

  const disabled = submitting || email.length === 0 || password.length === 0;

  return (
    <AuthFrame title="바람 장부 열기" subtitle="로그인">
      <PxInput
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
      />
      <PxInput
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />

      {errorMessage !== '' && <PxMessage tone="error">{errorMessage}</PxMessage>}

      <PxButton label={submitting ? '로그인 중...' : '로그인'} onPress={onLogin} disabled={disabled} />

      <Link href="/signup" style={styles.link}>
        계정이 없어요
      </Link>

      <Text style={styles.note}>이메일과 비밀번호만 받아요. 입력한 값은 기록하지 않아요.</Text>
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  link: { color: COLOR.redDark, fontWeight: '700', fontSize: 13, textAlign: 'center', padding: 8 },
  note: { fontSize: 11, color: COLOR.muted, lineHeight: 16 },
});
