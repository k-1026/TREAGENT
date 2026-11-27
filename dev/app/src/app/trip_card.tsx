/*
 * [trip_card.tsx] 내 여행 카드 미리보기 (주소: /trip_card?i=번호) — 장부 [내 여행]의 카드를 누르면 열린다
 * 목업: storyboard/app_home_mockup_v1.html의 내 여행 카드 미리보기·전체보기 (.tc-prev, .tc-full)
 *
 * 보이는 것: 9:16 카드(앞면/뒷면 뒤집기) → [저장] [공유] (하랑이 일기 보기 버튼은 팀 요청으로 뺐다, 2026-11-24)
 *  - 카드 오른쪽 아래 ⛶: 전체보기. 전체보기는 화면을 채우고, 평소엔 버튼이 없다. 화면을 누르면 [닫기]와 뒤집기가 나왔다 사라진다.
 *  - [저장]: 보이는 면(앞/뒤) 그대로 카드를 PNG로 저장한다 (lib/save_card.ts). 휴대폰은 사진첩, 웹은 파일 내려받기.
 *    앨범 폴더 이름은 정해지지 않아 폴더 없이 사진첩에 넣는다 [확인 필요]
 *  - [공유]를 누르면 인스타그램·카카오톡·링크 복사 칩이 나온다 (목업 #tcChips).
 *    인스타그램·카카오톡 칩: 카드 PNG를 붙여 휴대폰 기본 공유창을 연다. 앱은 공유창에서 고른다 (lib/save_card.ts).
 *    링크 복사 칩: 카드를 열 수 있는 공개 링크가 아직 없어서 안내만 보인다 [확인 필요: 공유 링크]
 *  - 카드 내용은 예시 자료(trip_card_data.ts)이고 실제 여행 기록이 저장되면 바꾼다.
 *
 * 완주 모드 (주소: /trip_card?done=1&title=길이름&names=장소1|장소2|장소3) — 여행 지도의 [완주 한 장 보기]로 연다
 *  - 목업 app_home_mockup_v1.html의 #v-done(renderDone): 방금 걸은 길로 9:16 카드를 채운다. 머리글은 "완주", 뒤로는 홈.
 *  - 날짜는 오늘, 장소는 걸은 길의 장소 이름. 시각·일기 문단·대사는 기록 저장 전이라 자리표시 [확인 필요]
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { APP_MAX_WIDTH, CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { TripCard } from '../components/trip_card';
import { makeDiary } from '../lib/agents_api';
import { displayName } from '../lib/profile';
import { useProfile } from '../lib/profile_context';
import { SaveResult, saveCardImages, shareCardImage } from '../lib/save_card';
import { COLOR, pxBox } from '../lib/theme';
import { doneTrip, SAMPLE_TRIPS } from '../lib/trip_card_data';

// 공유할 곳 (목업 #tcChips 순서 그대로)
// app: 공유창에서 고를 앱 이름 (안내 문구용). null이면 공유창 없이 안내만 (링크 복사: 공개 링크가 아직 없다)
const SHARE_TO: { label: string; app: string | null }[] = [
  { label: '인스타그램', app: '인스타그램' },
  { label: '카카오톡', app: '카카오톡' },
  { label: '링크 복사', app: null },
];

export default function TripCardScreen() {
  const params = useLocalSearchParams<{ i?: string; done?: string; title?: string; names?: string; ids?: string }>();
  const isDone = params.done === '1';
  const idx = Math.max(0, Math.min(SAMPLE_TRIPS.length - 1, parseInt(params.i ?? '0', 10) || 0));
  // 완주 모드: 서버 기록 정리 에이전트(POST /agents/diary)가 쓴 하랑이 일기를 마무리 문단에 넣는다. 방문 사실은 서버 도장 장부가 정한다.
  const [diary, setDiary] = useState<{ state: 'loading' | 'ok' | 'fail'; text: string }>({ state: 'loading', text: '' });
  useEffect(() => {
    if (!isDone || !params.ids) return;
    let alive = true;
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    makeDiary(params.title ?? '', day, params.ids.split('|').filter(Boolean)).then((r) => {
      if (alive) setDiary(r.ok ? { state: 'ok', text: r.data.text } : { state: 'fail', text: '' });
    });
    return () => { alive = false; };
  }, [isDone, params.ids, params.title]);
  const base = isDone ? doneTrip(params.title ?? '', (params.names ?? '').split('|').filter(Boolean)) : SAMPLE_TRIPS[idx];
  const trip = isDone && params.ids && diary.state !== 'fail'
    ? { ...base, close: diary.state === 'ok' ? diary.text : '하랑이가 일기를 쓰고 있어요…' }
    : base;
  const { profile } = useProfile();
  const name = displayName(profile);
  const { width: winW, height: winH } = useWindowDimensions();
  const [flipped, setFlipped] = useState(false);
  const [full, setFull] = useState(false);
  const [chrome, setChrome] = useState(false); // 전체보기에서 닫기·뒤집기 버튼 보임
  const [toast, setToast] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const show = (text: string) => {
    setToast(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 1800);
  };
  const say = (text: string) => show(`${text} (자리)`);

  // [저장]·공유 칩: 미리보기 카드 칸을 이미지로 찍는다
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const frontRef = useRef<ComponentRef<typeof View>>(null); // 저장용 앞면 (화면에 보이지 않는 복사본)
  const backRef = useRef<ComponentRef<typeof View>>(null); // 저장용 뒷면
  const [busy, setBusy] = useState<'save' | 'share' | null>(null);
  const saving = busy !== null; // 찍는 동안에는 카드 위 버튼(⛶·뒤집기)을 숨겨서 이미지에 안 들어가게 한다
  const hideCardButtons = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 50)));
  const SAVE_MSG: Record<SaveResult, string> = {
    saved: '사진첩에 카드를 저장했어요',
    downloaded: '카드 이미지를 내려받았어요',
    denied: '사진 저장 권한이 없어요. 설정에서 켜 주세요',
    failed: '카드를 저장하지 못했어요. 다시 해 주세요',
  };
  const onSave = async () => {
    if (busy) return;
    setBusy('save');
    await hideCardButtons();
    show(SAVE_MSG[await saveCardImages(frontRef, backRef)]);
    setBusy(null);
  };
  const onShare = async (c: (typeof SHARE_TO)[number]) => {
    if (!c.app) return say('링크 복사');
    if (busy) return;
    setBusy('share');
    await hideCardButtons();
    const r = await shareCardImage(cardRef);
    setBusy(null);
    if (r === 'shared') return;
    if (r === 'unsupported') return show('이 기기에서는 공유창을 열 수 없어요. [저장]으로 받아 주세요');
    if (r === 'failed') show('공유창을 열지 못했어요. 다시 해 주세요');
  };

  const appW = Math.min(winW, APP_MAX_WIDTH);
  // 미리보기 카드: 머리글(100)과 아래 버튼 영역(약 210, 공유 칩이 열리면 약 250)을 빼고 남는 높이에 맞춘다
  const prevW = Math.min(appW - 36, ((winH - 100 - (shareOpen ? 250 : 210)) * 9) / 16);
  // 전체보기 카드: 화면을 꽉 채운다 (폭과 높이 중 작은 쪽에 맞춤)
  const fullW = Math.min(appW, (winH * 9) / 16);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/ledger'));
  const home = () => (router.canDismiss() ? router.dismissTo('/') : router.replace('/'));

  return (
    <View style={styles.safe}>
      {isDone ? (
        <ScreenHead title="완주" sub="하랑이와 함께 끝까지 걸었어요" backLabel="‹ 뒤로" onBack={home} />
      ) : (
        <ScreenHead title="내 여행" sub="지난 여행 한 장" backLabel="‹ 장부" onBack={back} />
      )}
      <View style={[CONTENT, styles.body]}>
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <View ref={cardRef} collapsable={false}>
            <TripCard trip={trip} width={Math.max(160, prevW)} name={name} flipped={flipped} onFlip={() => setFlipped((f) => !f)} onFull={saving ? undefined : () => { setFull(true); setChrome(false); }} showFlip={!saving} />
          </View>
        </View>
        <View style={styles.acts}>
          <Pressable onPress={onSave} disabled={saving} style={[styles.act, styles.save, saving && { opacity: 0.6 }]}>
            <Text style={[styles.actText, { color: '#fff' }]}>{busy === 'save' ? '저장 중…' : '저장'}</Text>
          </Pressable>
          <Pressable onPress={() => setShareOpen((o) => !o)} style={styles.act}>
            <Text style={styles.actText}>공유</Text>
          </Pressable>
        </View>
        {isDone ? (
          <Pressable onPress={() => router.push('/ledger')} style={[pxBox(), { marginTop: 10, height: 48, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 15 }}>장부에서 보기</Text>
          </Pressable>
        ) : null}
        {/* 공유 칩: [공유]를 누르면 나왔다 들어간다 (목업 #tcChips). 인스타그램·카카오톡은 휴대폰 공유창을 연다 */}
        {shareOpen ? (
          <View style={styles.chips}>
            {SHARE_TO.map((c) => (
              <Pressable key={c.label} onPress={() => onShare(c)} disabled={saving} style={[styles.chip, saving && { opacity: 0.6 }]}>
                <Text style={styles.chipText}>{c.label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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

      {/* 저장용 앞뒷면 복사본: 화면 밖에 두고 한 면씩 찍는다 */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -10000, top: 0 }}>
        <TripCard trip={trip} width={360} name={name} flipped={false} onFlip={() => {}} capture="front" rootRef={frontRef} />
        <TripCard trip={trip} width={360} name={name} flipped={false} onFlip={() => {}} capture="back" rootRef={backRef} />
      </View>
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
  // 공유 칩: 목업 .tc-chips span (종이 바탕, 1.5px 테두리, 작은 글자)
  chips: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLOR.paper, borderWidth: 1.5, borderColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 10 },
  chipText: { fontSize: 13, fontWeight: '700', color: COLOR.ink },

  full: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#2b1814', alignItems: 'center', justifyContent: 'center', zIndex: 70 },
  close: { position: 'absolute', left: 16, top: 14, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: COLOR.paper, borderRadius: 6, borderWidth: 1.5, borderColor: COLOR.ink },
  toast: { position: 'absolute', left: 24, right: 24, bottom: 24, backgroundColor: COLOR.ink, paddingVertical: 12, paddingHorizontal: 14, zIndex: 80 },
  toastText: { color: '#fff8ea', fontSize: 15, textAlign: 'center' },
});
