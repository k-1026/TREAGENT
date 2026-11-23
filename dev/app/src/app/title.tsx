/*
 * [title.tsx] 타이틀 화면 (주소: /title) — 로그인하지 않은 사용자가 처음 보는 화면
 *
 * 역할
 *  - 목업(storyboard/app_login_region_mockup_v1.html)의 ① 타이틀을 옮긴다.
 *  - 두 버튼으로 로그인(/login)과 가입(/signup)으로 간다.
 *
 * 배치 (위에서 아래로)
 *  - 장면: 가운데 장부. 능금은 장부 오른쪽 바닥 옆으로 굴러와 멈춘다.
 *  - 제목: 대프리카 / 히든 퀘스트 / (가칭), 그 아래 한 줄 소개
 *  - 버튼: 아래쪽에 두 개 (바람 장부 열기 / 처음이에요)
 *
 * 연출 (한 번만 재생하고 멈춘다)
 *  - 바람선 세 줄이 지나가며 사라진다.
 *  - 능금이 오른쪽에서 몸을 돌리며 굴러오고, 도착하면 한 번 통통 튄다.
 *
 * 그림
 *  - 장부·능금은 임시 도형이다. 실제 그림은 따로 만든다. (pixel_book.tsx)
 *  - 꼬리는 없앴다 (사용자 요청).
 *
 * 버튼 문구
 *  - 목업 후보 A를 기본으로 쓴다: [바람 장부 열기] 로그인 / [처음이에요] 가입.
 *  - 후보 B([로그인]/[시작하기])는 아직 고르지 않았다 (결정 필요).
 */
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { BTN_RED, COLOR, pxBox } from '../lib/theme';
import { PixelBook } from '../components/pixel_book';

// 장부 칸 한 개 = 7px → 168x210 (목업 .book 크기). 능금은 참고 그림에 맞춰 칸 3px → 45x45 (장부보다 작게).
const CELL = 7;
// 능금 그림(assets/apple_pixel.png)은 원본 그대로 쓴다. 화면에서의 크기만 여기서 정한다.
const APPLE_SIZE = 54;

// 애니메이션 값은 화면이 처음 그려질 때 한 번만 만든다 (렌더 중 ref 접근을 피한다).
function createMotion() {
  const winds = [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)];
  const apple = new Animated.Value(0); // 0 = 굴러오는 중 (오른쪽), 1 = 제자리
  const bounce = new Animated.Value(0); // 도착 후 통통 (0 → 1 → 0)
  return {
    winds,
    apple,
    bounce,
    // 바람선: 왼쪽 밖(-200)에서 오른쪽 밖(420)으로. 끝에서 사라진다.
    windX: winds.map((v) => v.interpolate({ inputRange: [0, 1], outputRange: [-200, 420] })),
    windOpacity: winds.map((v) => v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [0.9, 0.9, 0] })),
    // 능금: 화면 오른쪽 끝에서 제자리로 굴러온다.
    // 반지름 약 27px → 둘레 약 170px. 두 바퀴(약 339px)를 가면 도착할 때 똑바로 선다.
    appleX: apple.interpolate({ inputRange: [0, 1], outputRange: [339, 0] }),
    appleRot: apple.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-720deg'] }),
    appleY: bounce.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -10, 0] }),
  };
}

export default function TitleScreen() {
  const [motion] = useState(createMotion);

  useEffect(() => {
    // 바람선: 한 번 지나감. 줄마다 0.2초씩 늦게 시작한다.
    const winds = motion.winds.map((v, i) =>
      Animated.timing(v, {
        toValue: 1,
        duration: 1600,
        delay: i * 200,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    );

    // 능금: 0.5초 뒤 오른쪽 끝에서 굴러오기 시작해 2.2초 동안 굴러 들어온다. 도착하면 한 번 통통 튄다.
    // 이동과 회전이 같은 값(apple)을 쓰므로, 굴러가는 거리와 도는 각도가 항상 맞는다.
    const roll = Animated.timing(motion.apple, {
      toValue: 1,
      duration: 2200,
      delay: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    const landing = Animated.sequence([
      Animated.timing(motion.bounce, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(motion.bounce, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);

    const anim = Animated.parallel([...winds, Animated.sequence([roll, landing])]);
    anim.start();
    return () => anim.stop();
  }, [motion]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* 바람선 층: 화면 전체를 덮고, 밖으로 나간 부분은 잘린다 */}
      <View style={styles.windLayer} pointerEvents="none">
        {motion.windX.map((x, i) => (
          <Animated.View
            key={i}
            style={[
              styles.wind,
              { top: 90 + i * 90, width: i === 2 ? 190 : i === 1 ? 110 : 160, opacity: motion.windOpacity[i] },
              { transform: [{ translateX: x }] },
            ]}
          />
        ))}
      </View>

      <View style={styles.scene}>
        <View style={styles.bookWrap}>
          <PixelBook cell={CELL} />
          <Animated.View
            style={[
              styles.applePos,
              {
                transform: [{ translateX: motion.appleX }, { rotate: motion.appleRot }, { translateY: motion.appleY }],
              },
            ]}
          >
            <Image source={require('../../assets/apple_pixel.png')} style={{ width: APPLE_SIZE, height: APPLE_SIZE }} resizeMode="contain" />
          </Animated.View>
        </View>
      </View>

      <View style={styles.info}>
        <Text style={styles.logoMain}>대프리카</Text>
        <Text style={styles.logoSub}>히든 퀘스트</Text>
        <Text style={styles.logoNote}>(가칭)</Text>
        <Text style={styles.catch}>하랑이와 함께 오늘 날씨에 맞는 길을 찾아 걸어요.</Text>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.button, pxBox(BTN_RED, COLOR.redDark), pressed && styles.pressed]}
        >
          <Text style={styles.buttonMain}>바람 장부 열기</Text>
          <Text style={styles.buttonSmall}>로그인</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/signup')}
          style={({ pressed }) => [styles.button, pxBox(COLOR.paper, COLOR.shade), pressed && styles.pressed]}
        >
          <Text style={[styles.buttonMain, { color: COLOR.ink }]}>처음이에요</Text>
          <Text style={[styles.buttonSmall, { color: COLOR.ink }]}>가입</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },

  windLayer: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  // 바람선: 목업 .wind (흰색 3px 줄)
  wind: { position: 'absolute', left: 0, height: 3, backgroundColor: '#fff' },

  // 장면: 남은 세로 공간의 가운데에 장부를 둔다
  scene: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bookWrap: { width: 24 * CELL, height: 30 * CELL },
  // 능금: 장부 오른쪽 바닥 모서리에 살짝 걸쳐 멈춘다. 굴러올 때는 오른쪽에서 들어온다.
  applePos: { position: 'absolute', left: 24 * CELL - 16, bottom: 0 },

  // 제목과 소개
  info: { alignItems: 'center', paddingHorizontal: 30, gap: 2 },
  logoMain: { fontSize: 34, fontWeight: '800', letterSpacing: 2, color: COLOR.ink },
  logoSub: { fontSize: 26, fontWeight: '800', color: COLOR.redDark, letterSpacing: 1 },
  logoNote: { fontSize: 11, color: COLOR.muted, marginTop: 2 },
  catch: { marginTop: 18, textAlign: 'center', fontSize: 13, lineHeight: 20, color: COLOR.ink },

  // 버튼 (아래쪽 고정)
  actions: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, gap: 14 },
  button: { paddingVertical: 13, paddingHorizontal: 14, alignItems: 'center' },
  pressed: { opacity: 0.85 },
  buttonMain: { color: '#fff', fontSize: 16, fontWeight: '800' },
  buttonSmall: { color: '#fff', fontSize: 11, marginTop: 2 },
});
