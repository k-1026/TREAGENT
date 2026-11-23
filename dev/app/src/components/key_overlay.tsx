/*
 * [key_overlay.tsx] 로그인 성공 연출 — "열쇠 돌리기" (목업 storyboard/app_login_region_mockup_v1.html ② 로그인 성공 상태)
 *
 * 역할
 *  - 로그인에 성공하면 화면 위에 어두운 막을 씌우고, 열쇠가 90도 돌아간 뒤 "열렸어요" 문구가 나타난다.
 *  - 약 1.6초 뒤 저절로 사라진다.
 *
 * 왜 화면(login.tsx) 안이 아니라 여기(_layout.tsx 쪽)에 두나
 *  - 로그인에 성공하면 _layout.tsx가 바로 다음 화면으로 보낸다. 그러면 로그인 화면이 사라져서 연출도 같이 끊긴다.
 *  - 그래서 연출을 모든 화면 위 한 층에 두고, 로그인 화면은 "보여 줘"라고 부르기만 한다 (useKeyOverlay().play()).
 *
 * 문구: "열쇠가 돌아가요... ○월 ○일에 열렸어요" [임시 문구]
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { PixelKey } from './pixel_book';

const SHOW_MS = 1600;

const KeyOverlayContext = createContext<{ play: () => void }>({ play: () => {} });

export function useKeyOverlay() {
  return useContext(KeyOverlayContext);
}

export function KeyOverlayProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const play = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), SHOW_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return (
    <KeyOverlayContext.Provider value={{ play }}>
      {children}
      {visible && <KeyOverlay />}
    </KeyOverlayContext.Provider>
  );
}

function KeyOverlay() {
  // 애니메이션 값은 처음 그릴 때 한 번만 만든다
  const [turn] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = Animated.parallel([
      // 열쇠: 0.9초 동안 90도. 목업처럼 6단계로 끊어 돌린다 (도트 느낌)
      Animated.timing(turn, {
        toValue: 1,
        duration: 900,
        easing: (t) => Math.floor(t * 6) / 6,
        useNativeDriver: true,
      }),
      // 문구: 0.6초 뒤 0.5초 동안 나타난다
      Animated.timing(fade, { toValue: 1, duration: 500, delay: 600, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [turn, fade]);

  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const now = new Date();

  return (
    <View style={styles.dim} pointerEvents="auto">
      <Animated.View style={{ transform: [{ rotate }] }}>
        <PixelKey cell={6} />
      </Animated.View>
      <Animated.Text style={[styles.text, { opacity: fade }]}>
        {`열쇠가 돌아가요... ${now.getMonth() + 1}월 ${now.getDate()}일에 열렸어요`}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // 목업 .key: 화면 전체를 덮는 어두운 막, 가운데 정렬
  dim: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    backgroundColor: 'rgba(43,24,20,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  text: { color: '#fff', fontSize: 13 },
});
