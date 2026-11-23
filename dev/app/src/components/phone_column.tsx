/*
 * [phone_column.tsx] 화면 폭 맞추기 — 앱 기준
 *
 * 역할
 *  - 화면은 앱(휴대폰) 기준으로 만든다. 목업(storyboard/app_login_region_mockup_v1.html)의 390 x 844 화면이 기준이다.
 *  - 앱(휴대폰)에서는 화면 전체 폭을 그대로 쓴다.
 *  - 웹에서 넓은 화면이면 앱 폭(최대 430px)으로 가운데에 맞추고, 바깥은 목업의 회색 배경으로 둔다.
 *  - CONTENT: 각 화면의 내용 영역 스타일. 앱 폭 안에서는 화면 폭을 그대로 채운다.
 *
 * 쓰는 곳: _layout.tsx (모든 화면을 감싼다), 각 화면의 ScrollView 내용 영역 (CONTENT)
 */
import { ReactNode } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { COLOR } from '../lib/theme';

export const APP_MAX_WIDTH = 430;
export const CONTENT_MAX_WIDTH = APP_MAX_WIDTH;

// 내용 영역: 앱 폭을 넘지 않고 가운데에 둔다
export const CONTENT: ViewStyle = { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' };

export function PhoneColumn({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') {
    return <View style={styles.full}>{children}</View>;
  }
  return (
    <View style={styles.webOuter}>
      <View style={styles.webInner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { flex: 1, backgroundColor: COLOR.cream },
  webOuter: { flex: 1, alignItems: 'center', backgroundColor: '#e9e4dc' },
  webInner: { flex: 1, width: '100%', maxWidth: APP_MAX_WIDTH, overflow: 'hidden', backgroundColor: COLOR.cream },
});
