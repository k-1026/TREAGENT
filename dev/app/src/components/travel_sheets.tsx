/*
 * [travel_sheets.tsx] 여행 지도의 겹쳐 뜨는 창 2개 — 목업 storyboard/travel_map_mockup_v1.html
 *  - StampSheet: [도장 확인] 받은 도장 목록 (목업 #stampsheet)
 *  - MissionSheet: 도착 확인 뒤 [미션 확인하기] 창 (목업 #mission)
 *  - CutSheet: 첫 완주 때 [완주 한 장 보기] 앞에 한 번 뜨는 컷씬 ② 안내 (목업 #cut)
 *  - (완주 한 장은 9:16 카드 화면 app/trip_card.tsx?done=1로 옮겼다 — 목업 app_home_mockup_v1.html #v-done)
 *
 * 이 파일은 모양만 그린다. 도장·방문 기록은 서버에서만 정해야 해서 (dev 절대 규칙 3) 여기서 저장하거나 계산하지 않고,
 * travel.tsx가 넘겨 주는 "도착한 장소 수"를 그대로 보여 준다 [확인 필요: 방문 기록·도장 서버 기능, TODO(PR F)].
 * 하랑이 대사는 승인 대기 자리표시 그대로다 [창작, 승인 필요].
 */
import { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLOR, pxBox } from '../lib/theme';

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

// 첫 완주 컷씬 ② 안내: [컷씬 ② 보기] 또는 [건너뛰기] (목업 #cut). 바깥을 눌러도 건너뛰기와 같다.
export function CutSheet({ onPlay, onSkip }: { onPlay: () => void; onSkip: () => void }) {
  return (
    <Dialog onClose={onSkip}>
      <Text style={[styles.ttl, { textAlign: 'center' }]}>컷씬 ② 보기</Text>
      <Text style={[styles.body, { textAlign: 'center' }]}>첫 완주일 때 한 번 나와요. 건너뛰어도 앨범에 저장돼요.</Text>
      <View style={{ gap: 8, marginTop: 4 }}>
        <Btn label="컷씬 ② 보기" primary onPress={onPlay} />
        <Btn label="건너뛰기" onPress={onSkip} />
      </View>
    </Dialog>
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
});
