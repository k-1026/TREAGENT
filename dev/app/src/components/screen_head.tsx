/*
 * [screen_head.tsx] 화면 머리글 (홈 목업 storyboard/app_home_mockup_v1.html의 .head, design_system_v1.md 머리글 규칙)
 *
 * 모양: 높이 100 (상태 막대 40 + 제목 줄 60), 주황 바탕, 아래 잉크색 3px 선.
 *       제목은 가운데(18px), 작은 설명은 제목 아래 가운데, 뒤로 버튼은 왼쪽.
 * 오른쪽 버튼(rightLabel, onRight)은 필요할 때만 넣는다 (예: 하랑이와 대화하기의 ⌂ 홈).
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLOR } from '../lib/theme';
import { CONTENT } from './phone_column';

export function ScreenHead({
  title,
  sub,
  backLabel,
  onBack,
  rightLabel,
  onRight,
}: {
  title: string;
  sub?: string;
  backLabel?: string; // 없으면 뒤로 버튼을 그리지 않는다 (예: 하단 탭으로 여는 장부)
  onBack?: () => void;
  rightLabel?: string;
  onRight?: () => void;
}) {
  return (
    <View style={styles.head}>
      {/* 제목과 버튼은 화면 내용과 같은 폭(CONTENT) 안에 둔다. 넓은 웹 화면에서도 아래 내용과 줄이 맞는다. */}
      <View style={[CONTENT, { flex: 1 }]}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
        {backLabel && onBack ? (
          <Pressable onPress={onBack} style={[styles.navButton, { left: 12 }]}>
            <Text style={styles.navText}>{backLabel}</Text>
          </Pressable>
        ) : null}
        {rightLabel && onRight ? (
          <Pressable onPress={onRight} style={[styles.navButton, { right: 12 }]}>
            <Text style={styles.navText}>{rightLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { height: 100, backgroundColor: COLOR.beam, borderBottomWidth: 3, borderBottomColor: COLOR.ink },
  // 제목·설명은 양쪽 버튼 자리(84px)를 비워 두고 가운데 정렬한다
  title: {
    position: 'absolute',
    left: 84,
    right: 84,
    top: 44,
    textAlign: 'center',
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textShadowColor: COLOR.ink,
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 0,
  },
  sub: { position: 'absolute', left: 84, right: 84, top: 70, textAlign: 'center', color: '#fff3e0', fontSize: 12 },
  navButton: {
    position: 'absolute',
    top: 50,
    backgroundColor: COLOR.cream,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: COLOR.ink,
  },
  navText: { color: COLOR.ink, fontSize: 14, fontWeight: '800' },
});
