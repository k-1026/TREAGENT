/*
 * [auth_ui.tsx] 로그인·가입 화면 공통 부품 (목업 storyboard/app_login_region_mockup_v1.html)
 *
 * 들어 있는 것
 *  - AuthFrame  : 위쪽 주황 헤더(장부 그림 + 제목) + 아래쪽 크림 바탕 입력 영역
 *  - PxInput    : 잉크색 테두리 입력칸
 *  - PxButton   : 빨간 버튼 (목업 .btn.px). 누를 수 없을 때는 흐리게 보인다.
 *  - PxMessage  : 오류(분홍) 또는 안내(연두) 문구 상자
 *
 * 색 규칙
 *  - 버튼 빨강은 BTN_RED(#d03a2f). contrast_compare_v1.html의 권장값이다.
 *    앱 전체 빨강(COLOR.red)은 팀 결정 전까지 그대로 둔다.
 */
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { BTN_RED, COLOR, pxBox } from '../lib/theme';
import { PixelBook } from './pixel_book';
import { CONTENT } from './phone_column';

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <View style={styles.safe}>
      <View style={styles.art}>
        <View style={styles.artBook}>
          <PixelBook cell={3} />
        </View>
        <View style={styles.artTitleBox}>
          <Text style={styles.artTitle}>{title}</Text>
          <Text style={styles.artSub}>{subtitle}</Text>
        </View>
      </View>
      <ScrollView style={styles.form} contentContainerStyle={[styles.formContent, CONTENT]} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

export function PxInput(props: TextInputProps) {
  return <TextInput placeholderTextColor={COLOR.muted} {...props} style={[styles.input, props.style]} />;
}

// variant: primary = 빨간 버튼, sub = 종이색 버튼 (목업 .btn.sub)
export function PxButton({
  label,
  onPress,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'sub';
}) {
  const isSub = variant === 'sub';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        isSub ? pxBox(COLOR.paper, COLOR.shade) : pxBox(BTN_RED, COLOR.redDark),
        disabled && styles.buttonOff,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonText, isSub && { color: COLOR.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function PxMessage({ tone = 'error', children }: { tone?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const box =
    tone === 'ok'
      ? pxBox('#e4efd9', '#a8bd96')
      : tone === 'info'
        ? pxBox(COLOR.paper, COLOR.shade)
        : pxBox('#ffe1d6', '#c58a7a');
  return (
    <View style={[styles.message, box]}>
      <Text style={styles.messageText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },

  // 위쪽 헤더 (목업 .art: 높이 190, 주황 바탕, 아래 잉크색 선)
  art: { height: 190, backgroundColor: COLOR.beam, borderBottomWidth: 3, borderBottomColor: COLOR.ink },
  artBook: { position: 'absolute', top: 40, left: 0, right: 0, alignItems: 'center' },
  artTitleBox: { position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' },
  artTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textShadowColor: COLOR.ink,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  artSub: { color: '#fff3e0', fontSize: 11, marginTop: 2 },

  // 아래쪽 입력 영역 (목업 .form: 크림 바탕)
  form: { flex: 1, backgroundColor: COLOR.cream },
  formContent: { padding: 26, paddingHorizontal: 24, gap: 12 },

  input: {
    ...pxBox(COLOR.paper, COLOR.shade),
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    color: COLOR.ink,
  },

  button: { paddingVertical: 14, alignItems: 'center' },
  // 누를 수 없을 때도 글씨가 읽히도록 흐리기를 약하게 한다
  buttonOff: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  message: { paddingVertical: 9, paddingHorizontal: 11 },
  messageText: { color: COLOR.ink, fontSize: 12, lineHeight: 18 },
});
