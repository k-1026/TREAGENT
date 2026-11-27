/*
 * [trip_card.tsx] 내 여행 카드 (인스타 스토리 9:16) — 목업 storyboard/app_home_mockup_v1.html의 .tc-card
 *
 * - TripCard: 앞면(그림 자리·날짜·제목·도장·하랑이 한마디)과 뒷면(하랑이의 일기: 날씨·장소별 기록·마무리·도장·호칭)
 *   목업은 글자 크기를 cqw(카드 폭의 1%)로 정해서 미리보기와 전체보기가 같은 비율로 커진다. 여기서는 width / 100을 곱해 같게 한다.
 * - TripMini: 장부 목록의 작은 카드 (날짜만 보임)
 * 문구는 trip_card_data.ts의 자리표시 그대로다. 호칭은 닉네임으로 바꿔 보인다 (호칭 규칙 F-02).
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentRef, Ref } from 'react';
import { COLOR } from '../lib/theme';
import type { Trip } from '../lib/trip_card_data';

const STAMP = require('../../assets/stamp_nungeum.webp');
const FACE = require('../../assets/harangi_face_v2.webp');

const call = (s: string, name: string) => s.replace('{이름}', name).replace('[이름]', name);

export function TripCard({
  trip,
  width,
  name,
  flipped,
  onFlip,
  onFull,
  square,
  showFlip = true,
  capture,
  rootRef,
}: {
  trip: Trip;
  width: number;
  name: string;
  flipped: boolean;
  onFlip: () => void;
  onFull?: () => void; // 없으면 전체보기 버튼을 그리지 않는다
  square?: boolean; // true면 테두리를 없애고 모서리를 각지게 (전체보기)
  showFlip?: boolean; // false면 뒤집기 버튼을 숨긴다 (전체보기는 화면을 눌렀을 때만 보임)
  capture?: 'front' | 'back'; // 저장용: 이 면만 보이게 하고 뒤집기 움직임을 쓰지 않는다
  rootRef?: Ref<ComponentRef<typeof View>>; // 저장용 캡처 대상
}) {
  const u = width / 100; // 목업의 1cqw
  const btn = Math.max(30, 10 * u); // 목업 #264: 10cqw (최소 30)
  const face = [styles.face, { paddingVertical: 5.5 * u, paddingHorizontal: 5 * u }, square && { borderWidth: 0, borderRadius: 0 }];

  // 뒤집기: 0 → 1로 가면 카드가 세로축(Y)을 따라 180도 돈다 (목업 .tc-inner rotateY(180deg))
  const spin = useRef(new Animated.Value(flipped ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(spin, { toValue: flipped ? 1 : 0, duration: 600, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
  }, [flipped, spin]);
  const frontTurn = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backTurn = spin.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  // 저장용 캡처일 때는 면을 움직이지 않고, 보여 줄 면만 보이게 한다
  const Wrap = (capture ? View : Animated.View) as typeof Animated.View;
  const sideStyle = (turn: Animated.AnimatedInterpolation<string | number>, show: boolean) =>
    capture
      ? [StyleSheet.absoluteFill, { display: show ? ('flex' as const) : ('none' as const) }]
      : [StyleSheet.absoluteFill, { transform: [{ perspective: 1000 }, { rotateY: turn }], backfaceVisibility: 'hidden' as const }];

  return (
    <View ref={rootRef} collapsable={false} style={{ width, height: (width * 16) / 9 }}>
      <Wrap style={sideStyle(frontTurn, capture !== 'back')}>
        <View style={face}>
          <View style={[styles.pic, { padding: 3 * u }]}>
            <Text style={{ fontSize: 3 * u, color: COLOR.muted, textAlign: 'center' }}>[장소 그림 자리 · 창작 후보]</Text>
          </View>
          {/* 날짜와 날씨 한 줄 (목업: 날짜 옆에 날씨를 같은 줄로 둔다) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 3 * u }}>
            <Text style={{ fontSize: 3.1 * u, color: COLOR.muted }}>{trip.date}</Text>
            <Text style={{ flexShrink: 1, fontSize: 3.1 * u, color: COLOR.muted, textAlign: 'right' }}>{trip.wx}</Text>
          </View>
          <Text style={{ fontSize: 5.6 * u, fontWeight: '800', color: COLOR.ink, marginTop: 1 * u, marginBottom: 2.5 * u, lineHeight: 5.6 * u * 1.3 }}>
            {trip.title}
          </Text>
          <View style={{ flexDirection: 'row', gap: 1.5 * u }}>
            {[0, 1, 2].map((i) => (
              <Image key={i} source={STAMP} style={{ width: 10 * u, height: 10 * u }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 1 * u, marginTop: 2.5 * u, paddingRight: 25 * u }}>
            <Image source={FACE} style={{ width: 11 * u, height: 11 * u }} resizeMode="contain" />
            <Text style={{ flex: 1, fontSize: 3.4 * u, lineHeight: 3.4 * u * 1.4, color: COLOR.ink }}>{trip.say}</Text>
          </View>
        </View>
      </Wrap>
      <Wrap style={sideStyle(backTurn, capture === 'back')}>
        <View style={face}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
            <Text style={{ fontSize: 3.1 * u, color: COLOR.muted }}>하랑이의 일기</Text>
            <Text style={{ fontSize: 3.1 * u, color: COLOR.muted }}>{trip.date}</Text>
          </View>
          <Text style={{ fontSize: 5.6 * u, fontWeight: '800', color: COLOR.ink, marginTop: 2 * u, marginBottom: 3 * u, lineHeight: 5.6 * u * 1.3 }}>
            {trip.title}
          </Text>
          <Text style={{ fontSize: 3.1 * u, color: COLOR.muted, marginBottom: 2 * u }}>{trip.wx}</Text>
          {trip.ents.map((e) => (
            <View
              key={e.rec}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 3 * u,
                paddingVertical: 2.5 * u,
                paddingLeft: 3 * u,
                borderLeftWidth: 1.2 * u,
                borderLeftColor: COLOR.shade,
                marginBottom: 3 * u,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 3.7 * u, fontWeight: '700', lineHeight: 3.7 * u * 1.45, color: COLOR.ink }}>{`${e.t} ${e.p}`}</Text>
                <Text style={{ fontSize: 3.3 * u, lineHeight: 3.3 * u * 1.55, marginTop: 1 * u, color: COLOR.ink }}>{e.fact}</Text>
                <Text style={{ fontSize: 3 * u, color: COLOR.muted, marginTop: 1 * u }}>{e.rec}</Text>
              </View>
              <Image source={STAMP} style={{ width: 12 * u, height: 12 * u }} />
            </View>
          ))}
          <View style={{ marginTop: 'auto', borderTopWidth: 0.5 * u, borderTopColor: COLOR.shade, borderStyle: 'dashed', paddingTop: 3 * u }}>
            <Text style={{ fontSize: 3.7 * u, lineHeight: 3.7 * u * 1.5, color: COLOR.ink }}>{call(trip.close, name)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2.5 * u, marginTop: 3 * u }}>
            <Image source={STAMP} style={{ width: 8 * u, height: 8 * u }} />
            <Text style={{ flex: 1, fontSize: 3.1 * u, color: COLOR.muted }}>{`도장 3/3 · 이름은 ${call(trip.name, name)} 님 (호칭 규칙)`}</Text>
          </View>
        </View>
      </Wrap>

      {/* 뒤집기·전체보기: 카드 오른쪽 아래 동그란 버튼 (카드 위 따로 놓인 층) */}
      {showFlip && !capture ? (
        <Pressable onPress={onFlip} accessibilityLabel="카드 뒤집기" style={[styles.round, { width: btn, height: btn, right: 3 * u, bottom: 3.5 * u }]}>
          <Text style={[styles.roundText, { fontSize: 5 * u }]}>↻</Text>
        </Pressable>
      ) : null}
      {onFull ? (
        <Pressable onPress={onFull} accessibilityLabel="전체보기" style={[styles.round, { width: btn, height: btn, right: 3 * u + 12 * u, bottom: 3.5 * u }]}>
          <Text style={[styles.roundText, { fontSize: 4.2 * u }]}>⛶</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// 장부 목록의 작은 카드 (목업 .tc-mini): 날짜만 보이고 아래에 도장
export function TripMini({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.thumb}>
      <View style={styles.mini}>
        <Text style={{ fontSize: 12, color: COLOR.muted }}>{trip.date}</Text>
        <View style={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
          {[0, 1, 2].map((i) => (
            <Image key={i} source={STAMP} style={{ width: 17, height: 17 }} />
          ))}
        </View>
      </View>
      <Text numberOfLines={1} style={styles.thumbTitle}>{trip.title}</Text>
      <Text numberOfLines={1} style={styles.thumbSub}>3곳 · 도장 3/3 · 완주</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  face: {
    flex: 1,
    backgroundColor: COLOR.paper,
    borderWidth: 3,
    borderColor: COLOR.ink,
    borderRadius: 10,
    overflow: 'hidden',
  },
  pic: { flex: 1, minHeight: 0, backgroundColor: '#ecdcbf', alignItems: 'center', justifyContent: 'center' },
  round: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: COLOR.paper,
    borderWidth: 2,
    borderColor: COLOR.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundText: { fontSize: 18, fontWeight: '800', color: COLOR.ink },

  thumb: { flex: 1, minWidth: 0 },
  mini: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: COLOR.paper,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLOR.ink,
    paddingVertical: 8,
    paddingHorizontal: 7,
    justifyContent: 'space-between',
    boxShadow: `0px 4px 0px 0px ${COLOR.shade}`,
  },
  thumbTitle: { fontSize: 12, fontWeight: '800', color: COLOR.ink, marginTop: 6 },
  thumbSub: { fontSize: 12, color: COLOR.muted },
});
