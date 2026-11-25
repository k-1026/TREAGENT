/*
 * [trip_card.tsx] 내 여행 카드 미리보기 (주소: /trip_card?i=번호) — 장부 [내 여행]의 카드를 누르면 열린다
 * 목업: storyboard/app_home_mockup_v1.html의 내 여행 카드 미리보기·전체보기 (.tc-prev, .tc-full)
 *
 * 보이는 것: 9:16 카드(앞면/뒷면 뒤집기) → [저장] [공유] (하랑이 일기 보기 버튼은 팀 요청으로 뺐다, 2026-11-24)
 *  - 카드 오른쪽 아래 ⛶: 전체보기. 전체보기는 화면을 채우고, 평소엔 버튼이 없다. 화면을 누르면 [닫기]와 뒤집기가 나왔다 사라진다.
 *  - [저장], [공유]는 아직 기능이 없다 → 짧은 안내만 보인다 [확인 필요: 앨범 저장, 공유 방식]
 *  - 카드 내용은 예시 자료(trip_card_data.ts)이고 실제 여행 기록이 저장되면 바꾼다.
 *
 * 완주 모드 (주소: /trip_card?done=1&title=길이름&names=장소1|장소2|장소3) — 여행 지도의 [완주 한 장 보기]로 연다
 *  - 목업 app_home_mockup_v1.html의 #v-done(renderDone): 방금 걸은 길로 9:16 카드를 채운다. 머리글은 "완주", 뒤로는 홈.
 *  - 날짜는 오늘, 장소는 걸은 길의 장소 이름. 시각·일기 문단·대사는 기록 저장 전이라 자리표시 [확인 필요]
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { APP_MAX_WIDTH, CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { TripCard } from '../components/trip_card';
import { displayName } from '../lib/profile';
import { useProfile } from '../lib/profile_context';
import { COLOR } from '../lib/theme';
import { doneTrip, SAMPLE_TRIPS } from '../lib/trip_card_data';

export default function TripCardScreen() {
  const params = useLocalSearchParams<{ i?: string; done?: string; title?: string; names?: string }>();
  const isDone = params.done === '1';
  const idx = Math.max(0, Math.min(SAMPLE_TRIPS.length - 1, parseInt(params.i ?? '0', 10) || 0));
  const trip = isDone ? doneTrip(params.title ?? '', (params.names ?? '').split('|').filter(Boolean)) : SAMPLE_TRIPS[idx];
  const { profile } = useProfile();
  const name = displayName(profile);
  const { width: winW, height: winH } = useWindowDimensions();
  const [flipped, setFlipped] = useState(false);
  const [full, setFull] = useState(false);
  const [chrome, setChrome] = useState(false); // 전체보기에서 닫기·뒤집기 버튼 보임
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const say = (text: string) => {
    setToast(`${text} (자리)`);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1800);
  };

  const appW = Math.min(winW, APP_MAX_WIDTH);
  // 미리보기 카드: 머리글(100)과 아래 버튼 영역(약 210)을 빼고 남는 높이에 맞춘다
  const prevW = Math.min(appW - 36, ((winH - 100 - 210) * 9) / 16);
  // 전체보기 카드: 화면을 꽉 채운다 (폭과 높이 중 작은 쪽에 맞춤)
  const fullW = Math.min(appW, (winH * 9) / 16);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/ledger'));
  const home = () => (router.canDismiss() ? router.dismissTo('/') : router.replace('/'));

  return (
    <View style={styles.safe}>
      {isDone ? (
        <ScreenHead title="완주" sub="하랑이와 함께 끝까지 걸었어요" backLabel="‹ 홈" onBack={home} />
      ) : (
        <ScreenHead title="내 여행" sub="지난 여행 한 장" backLabel="‹ 장부" onBack={back} />
      )}
      <View style={[CONTENT, styles.body]}>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <TripCard trip={trip} width={Math.max(160, prevW)} name={name} flipped={flipped} onFlip={() => setFlipped((f) => !f)} onFull={() => { setFull(true); setChrome(false); }} />
        </View>
        <View style={styles.acts}>
          <Pressable onPress={() => say('앨범 daeprica 폴더에 저장')} style={[styles.act, styles.save]}>
            <Text style={[styles.actText, { color: '#fff' }]}>저장</Text>
          </Pressable>
          <Pressable onPress={() => say('SNS 공유 (9:16 카드)')} style={styles.act}>
            <Text style={styles.actText}>공유</Text>
          </Pressable>
        </View>
      </View>

      {full ? (
        <Pressable onPress={() => setChrome((c) => !c)} style={styles.full}>
          <TripCard trip={trip} width={fullW} name={name} flipped={flipped} onFlip={() => setFlipped((f) => !f)} square showFlip={chrome} />
          {chrome ? (
            <Pressable onPress={() => setFull(false)} style={styles.close}>
              <Text style={styles.actText}>닫기</Text>
            </Pressable>
          ) : null}
        </Pressable>
      ) : null}

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  body: { flex: 1, paddingTop: 14, paddingHorizontal: 18, paddingBottom: 16, gap: 12 },
  acts: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  // 저장·공유 버튼: 목업 #264에서 모서리 6으로 다듬음, 아래 4px 그림자
  act: { width: 150, height: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.paper, borderRadius: 6, borderWidth: 1.5, borderColor: COLOR.ink, boxShadow: `0px 4px 0px 0px ${COLOR.shade}` },
  save: { backgroundColor: COLOR.red },
  actText: { fontSize: 16, fontWeight: '800', color: COLOR.ink },

  full: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#2b1814', alignItems: 'center', justifyContent: 'center', zIndex: 70 },
  close: { position: 'absolute', left: 16, top: 14, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: COLOR.paper, borderRadius: 6, borderWidth: 1.5, borderColor: COLOR.ink },
  toast: { position: 'absolute', left: 24, right: 24, bottom: 24, backgroundColor: COLOR.ink, paddingVertical: 12, paddingHorizontal: 14, zIndex: 80 },
  toastText: { color: '#fff8ea', fontSize: 15, textAlign: 'center' },
});
