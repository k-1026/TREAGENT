/*
 * [travel_sheets.tsx] 여행 지도의 겹쳐 뜨는 창 3개 — 목업 storyboard/travel_map_mockup_v1.html
 *  - StampSheet: [도장 확인] 받은 도장 목록 (목업 #stampsheet)
 *  - MissionSheet: 도착 확인 뒤 [미션 확인하기] 창 (목업 #mission)
 *  - DoneSheet: 모두 걸은 뒤 [완주 한 장 보기] 화면 (목업 #done)
 *
 * 이 파일은 모양만 그린다. 도장·방문 기록은 서버에서만 정해야 해서 (dev 절대 규칙 3) 여기서 저장하거나 계산하지 않고,
 * travel.tsx가 넘겨 주는 "도착한 장소 수"를 그대로 보여 준다 [확인 필요: 방문 기록·도장 서버 기능, TODO(PR F)].
 * 하랑이 대사는 승인 대기 자리표시 그대로다 [창작, 승인 필요].
 */
import { ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { COLOR, pxBox } from '../lib/theme';
import { CONTENT } from './phone_column';
import { ScreenHead } from './screen_head';

const STAMP = require('../../assets/stamp_nungeum.webp');

// 어두운 바탕 + 가운데 종이 창 (목업 .dim, .sheet.center)
function Dialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <View style={styles.dim}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
      <View style={styles.sheet}>{children}</View>
    </View>
  );
}

function Btn({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [primary ? pxBox(COLOR.red, COLOR.redDark) : pxBox(), styles.btn, pressed && { opacity: 0.85 }]}
    >
      <Text style={[styles.btnText, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

function Hara({ text }: { text: string }) {
  return (
    <View style={styles.hara}>
      <Text style={{ fontSize: 13, color: COLOR.ink }}>
        <Text style={{ fontWeight: '800' }}>하랑이 </Text>
        {text}
      </Text>
    </View>
  );
}

// 도장 확인: 장소마다 번호 칸 + 이름 + 상태 + 도장 그림
export function StampSheet({ title, names, reached, onClose }: { title: string; names: string[]; reached: number; onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <Text style={styles.ttl}>{`받은 도장 ${reached}/${names.length}`}</Text>
      <Text style={styles.muted}>{title}</Text>
      <View style={{ marginTop: 10, gap: 8 }}>
        {names.map((n, i) => {
          const done = i < reached;
          const cur = i === reached;
          return (
            <View key={`${n}-${i}`} style={styles.srow}>
              <View style={[styles.sn, done && { backgroundColor: COLOR.sage }, cur && { backgroundColor: COLOR.red }]}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: cur ? '#fff' : COLOR.ink }}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13, lineHeight: 18, color: COLOR.ink }}>{n}</Text>
                <Text style={styles.muted}>{done ? '도장 받음' : cur ? '다음 장소' : '아직'}</Text>
              </View>
              <Image source={STAMP} style={{ width: 44, height: 44, opacity: done ? 1 : 0.35 }} resizeMode="contain" />
            </View>
          );
        })}
      </View>
      <View style={{ marginTop: 4 }}>
        <Btn label="닫기" onPress={onClose} />
      </View>
    </Dialog>
  );
}

// 미션 창: 목업은 [미션 마치기]/[나중에 하기]. 앱은 미션 화면(/mission)으로 이어 준다.
export function MissionSheet({
  placeNo,
  placeName,
  onStart,
  onTemp,
  onLater,
}: {
  placeNo: number;
  placeName: string;
  onStart: () => void;
  onTemp?: () => void; // 개발 중에만: 임시로 다음 장소로 넘어가기 (도장 저장은 서버 기능 전)
  onLater: () => void;
}) {
  return (
    <Dialog onClose={onLater}>
      <Text style={styles.ttl}>{`${placeNo}번 장소 미션`}</Text>
      <Text style={styles.body}>{placeName}</Text>
      <Text style={styles.body}>[미션 종류] · [미션 내용 자리]</Text>
      <Hara text="[승인 대사 대기 · 미션]" />
      <View style={{ gap: 8 }}>
        <Btn label="미션 시작하기" primary onPress={onStart} />
        {onTemp ? <Btn label="임시: 미션 마치기 (개발용)" onPress={onTemp} /> : null}
        <Btn label="나중에 하기" onPress={onLater} />
      </View>
    </Dialog>
  );
}

// 완주 한 장: 오늘 걸은 길의 장소와 도장을 한 장으로 (목업 #done). 날짜·시각·마무리 대사는 자리표시.
export function DoneSheet({
  title,
  names,
  reached,
  onClose,
  onHome,
}: {
  title: string;
  names: string[];
  reached: number;
  onClose: () => void;
  onHome: () => void;
}) {
  return (
    <View style={styles.full}>
      <ScreenHead title="완주" sub="하랑이와 함께 끝까지 걸었어요" backLabel="‹ 지도" onBack={onClose} rightLabel="⌂ 홈" onRight={onHome} />
      <ScrollView contentContainerStyle={[CONTENT, { padding: 16, gap: 14 }]}>
        <View style={styles.snap}>
          <View style={styles.snapHead}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: COLOR.ink }}>{title}</Text>
            <Text style={styles.muted}>[완주 날짜]</Text>
          </View>
          <Text style={[styles.muted, { marginBottom: 6 }]}>[지난 날씨 기록]</Text>
          {names.map((n, i) => (
            <View key={`${n}-${i}`} style={styles.snapRow}>
              <Text style={styles.snapTime}>[시각]</Text>
              <Text style={{ flex: 1, fontSize: 14, color: COLOR.ink }}>{n}</Text>
              <Image source={STAMP} style={{ width: 40, height: 40, opacity: i < reached ? 1 : 0.35 }} resizeMode="contain" />
            </View>
          ))}
          <View style={styles.snapFoot}>
            <Text style={[styles.muted, { flex: 1 }]}>[하랑이 마무리 대사 · 승인 대기]</Text>
            <Text style={styles.muted}>{`도장 ${reached}/${names.length}`}</Text>
          </View>
        </View>
        <Text style={styles.muted}>[확인 필요] 완주 기록 저장은 서버 기능이 생기면 연결해요. 지금은 이 화면에서만 보여 줘요.</Text>
        <Btn label="홈으로" primary onPress={onHome} />
        <Btn label="지도로 돌아가기" onPress={onClose} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(60,40,20,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 30 },
  sheet: { width: 330, maxWidth: '92%', backgroundColor: COLOR.paper, borderWidth: 3, borderColor: COLOR.ink, padding: 16, gap: 8 },
  ttl: { fontSize: 17, fontWeight: '800', color: COLOR.ink },
  body: { fontSize: 14, lineHeight: 21, color: COLOR.ink },
  muted: { fontSize: 12, color: COLOR.muted },
  hara: { backgroundColor: COLOR.cream, paddingVertical: 8, paddingHorizontal: 10 },
  srow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLOR.cream, paddingVertical: 8, paddingHorizontal: 10 },
  sn: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.paper, borderWidth: 2, borderColor: COLOR.ink },
  btn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 15, fontWeight: '800', color: COLOR.ink },

  full: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: COLOR.cream, zIndex: 60 },
  snap: { backgroundColor: COLOR.paper, borderWidth: 3, borderColor: COLOR.ink, padding: 14 },
  snapHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, borderBottomWidth: 2, borderBottomColor: COLOR.cream2, paddingBottom: 8, marginBottom: 8 },
  snapRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  snapTime: { width: 48, fontSize: 13, fontWeight: '800', color: COLOR.muted },
  snapFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, borderTopWidth: 2, borderTopColor: COLOR.cream2, paddingTop: 8 },
});
