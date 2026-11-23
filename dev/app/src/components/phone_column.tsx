/*
 * [phone_column.tsx] 화면 폭 맞추기
 *
 * 역할
 *  - 앱(휴대폰)에서는 화면 전체 폭을 그대로 쓴다.
 *  - 웹에서 넓은 화면이면 앱 폭(최대 430px)으로 가운데에 맞춘다. 바깥은 목업의 회색 배경이다.
 *
 * 쓰는 곳: _layout.tsx (모든 화면을 감싼다)
 */
import { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { COLOR } from '../lib/theme';

export const APP_MAX_WIDTH = 430;

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
  full: { flex: 1 },
  webOuter: { flex: 1, alignItems: 'center', backgroundColor: '#e9e4dc' },
  webInner: { flex: 1, width: '100%', maxWidth: APP_MAX_WIDTH, overflow: 'hidden', backgroundColor: COLOR.cream },
});
