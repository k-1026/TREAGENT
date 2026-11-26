/*
 * [live_mission.tsx] 서버 미션 에이전트와 이어진 미션 화면 (mission.tsx가 ?placeId=… 로 열릴 때 쓴다)
 *
 * 흐름: 내 위치를 한 번 읽어 서버에 보낸다(도착 확인은 서버가 계산하고 저장하지 않는다) → 장소 설명과 과제를 받는다
 *   → 퀴즈는 글로 답을 내고(힌트 가능), 판정과 도장은 서버가 한다 → 도장을 받으면 완료 화면.
 *  - 판정은 앱이 하지 않는다 (dev 절대 규칙 3). 앱은 서버가 알려 준 결과만 보여 준다. 정답은 서버만 알고 앱에는 오지 않는다.
 *  - 인증샷은 사진을 찍거나 골라 서버로 보낸다. 서버가 EXIF(위치 정보)를 잘라 낸 뒤에만 판정에 쓴다. 영수증은 가게 이름이 글자로 보이면 인증된다 (결제 정보를 코드가 가리지는 못해서 앱이 가리고 찍으라고 안내한다 [확인 필요]).
 */
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { askHint, Mission, missionErrorText, replayTask, startMission, submitPhoto, submitQuizAnswer } from '../lib/agents_api';
import { getCurrentLocation } from '../lib/location';
import { COLOR } from '../lib/theme';
import { WxButton, WxCard, wxText } from './weather_ui';

const STAMP = require('../../assets/stamp_nungeum.webp');
const KIND_LABEL = { quiz: '퀴즈형', photo: '인증샷형', receipt: '영수증형' } as const;

type Phase =
  | { name: 'loading' }
  | { name: 'error'; text: string }
  | { name: 'ready'; mission: Mission; placeName: string }
  | { name: 'done' }
  | { name: 'held' };

export function LiveMission({ placeId, placeName }: { placeId: string; placeName?: string }) {
  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [answer, setAnswer] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stamp] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let alive = true;
    (async () => {
      const loc = await getCurrentLocation();
      if (!alive) return;
      if (loc.status !== 'ok') return setPhase({ name: 'error', text: missionErrorText('NO_POSITION') });
      const r = await startMission(placeId, { latitude: loc.latitude, longitude: loc.longitude });
      if (!alive) return;
      if (!r.ok) return setPhase({ name: 'error', text: missionErrorText(r.code) });
      setPhase({ name: 'ready', mission: r.data.mission, placeName: r.data.place.name });
    })();
    return () => {
      alive = false;
    };
  }, [placeId, attempt]);

  useEffect(() => {
    if (phase.name !== 'done') return;
    stamp.setValue(0);
    Animated.timing(stamp, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [phase.name, stamp]);

  if (phase.name === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLOR.ink} />
        <Text style={wxText.small}>하랑이가 미션을 준비하고 있어요…</Text>
      </View>
    );
  }

  if (phase.name === 'error') {
    return (
      <>
        <View style={[styles.banner, { backgroundColor: '#ffe1d6' }]}>
          <Text style={[styles.bannerText, { color: COLOR.redDark }]}>{phase.text}</Text>
        </View>
        <WxButton label="다시 시도" primary onPress={() => {
            setPhase({ name: 'loading' });
            setAttempt((n) => n + 1);
          }} />
        <WxButton label="지도로 돌아가기" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </>
    );
  }

  if (phase.name === 'done') {
    return (
      <>
        <Animated.View style={[styles.stamp, { opacity: stamp, transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }] }]}>
          <Image source={STAMP} style={styles.stampImg} resizeMode="contain" />
        </Animated.View>
        <WxCard>
          <Text style={[wxText.big, { textAlign: 'center' }]}>도장을 받았어요</Text>
          <Text style={[wxText.small, { textAlign: 'center' }]}>도장은 서버 장부에 기록됐어요.</Text>
        </WxCard>
        <WxButton label="지도로 돌아가기" primary onPress={() => (router.canGoBack() ? router.back() : router.replace('/travel'))} />
      </>
    );
  }

  if (phase.name === 'held') {
    return (
      <>
        <View style={[styles.banner, { backgroundColor: '#e6e1da' }]}>
          <Text style={[styles.bannerText, { color: COLOR.ink }]}>이번에는 도장을 보류했어요. 나중에 다시 도전할 수 있어요.</Text>
        </View>
        <WxButton label="지도로 돌아가기" primary onPress={() => (router.canGoBack() ? router.back() : router.replace('/travel'))} />
      </>
    );
  }

  const { mission } = phase;
  const submit = async () => {
    const a = answer.trim();
    if (!a || busy) return;
    setBusy(true);
    setNote(null);
    const loc = await getCurrentLocation();
    const r = await submitQuizAnswer(mission.ticketId, a, loc.status === 'ok' ? { latitude: loc.latitude, longitude: loc.longitude } : undefined);
    setBusy(false);
    if (!r.ok) return setNote(missionErrorText(r.code));
    if (r.data.status === 'stamped') return setPhase({ name: 'done' });
    if (r.data.status === 'held') return setPhase({ name: 'held' });
    setAnswer('');
    setNote(r.data.code === 'GPS_OUT' ? missionErrorText('GPS_OUT') : r.data.code === 'ALREADY_STAMPED' ? missionErrorText('ALREADY_STAMPED') : `아쉬워요. 다시 해 봐요. (남은 기회 ${r.data.submitsLeft ?? 0}번)`);
  };
  const hint = async () => {
    const r = await askHint(mission.ticketId);
    setNote(r.ok ? `힌트: ${r.data.hint}` : r.code === 'HINT_LIMIT' ? '힌트는 두 번까지 볼 수 있어요.' : missionErrorText(r.code));
  };
  const again = async () => {
    const r = await replayTask(mission.ticketId);
    setNote(r.ok ? `과제: ${r.data.task}` : missionErrorText(r.code));
  };

  // 사진 인증: 카메라(또는 갤러리)에서 한 장을 받아 서버로 보낸다. 원본은 앱에도 남기지 않는다 (메모리에서만 쓴다).
  const sendPhoto = async (from: 'camera' | 'library') => {
    if (busy) return;
    setNote(null);
    const perm = from === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return setNote('사진 권한이 없어요. 설정에서 허용해 주세요.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.5, exif: false, allowsEditing: false };
    const picked = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    const b64 = picked.canceled ? null : picked.assets?.[0]?.base64;
    if (!b64) return;
    setBusy(true);
    const loc = await getCurrentLocation();
    const r = await submitPhoto(mission.ticketId, b64, loc.status === 'ok' ? { latitude: loc.latitude, longitude: loc.longitude } : undefined);
    setBusy(false);
    if (!r.ok) return setNote(missionErrorText(r.code));
    if (r.data.status === 'stamped') return setPhase({ name: 'done' });
    if (r.data.status === 'held') return setPhase({ name: 'held' });
    const code = r.data.code ?? '';
    setNote(
      code === 'JUDGE_REJECTED' && mission.kind === 'receipt' ? '영수증에서 장소 이름을 찾지 못했어요. 가게 이름이 보이게 다시 찍어 주세요.'
        : code === 'IMAGE_FORMAT' ? missionErrorText('IMAGE_FORMAT')
        : code === 'DUPLICATE' ? '이미 낸 사진이에요. 다른 사진으로 다시 해 봐요.'
        : code === 'GPS_OUT' || code === 'ALREADY_STAMPED' ? missionErrorText(code)
        : `아쉬워요. 다시 해 봐요. (남은 기회 ${r.data.submitsLeft ?? 0}번)`,
    );
  };
  return (
    <>
      <View style={styles.tag}>
        <Text style={styles.tagText}>{KIND_LABEL[mission.kind]}</Text>
      </View>
      <WxCard>
        <Text style={wxText.big}>{phase.placeName || placeName}</Text>
        <Text style={wxText.small}>{mission.explanation}</Text>
      </WxCard>
      <View style={styles.hara}>
        <Text style={styles.haraText}>
          <Text style={styles.haraName}>하랑이 </Text>
          {mission.task}
        </Text>
      </View>

      {mission.kind === 'quiz' ? (
        <>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            onSubmitEditing={submit}
            placeholder="답을 적어 주세요"
            placeholderTextColor={COLOR.muted}
            maxLength={100}
            returnKeyType="send"
            accessibilityLabel="퀴즈 답"
            style={styles.input}
          />
          <WxButton label={busy ? '확인하는 중…' : '답 내기'} primary onPress={submit} />
          <WxButton label="힌트 보기" onPress={hint} />
        </>
      ) : (
        <>
          {mission.kind === 'receipt' ? (
            <View style={[styles.banner, { backgroundColor: '#e6e1da' }]}>
              <Text style={[styles.bannerText, { color: COLOR.ink }]}>영수증에 가게 이름이 보이면 인증돼요. 카드 번호는 손으로 가리고 찍어 주세요. 사진은 저장하지 않아요.</Text>
            </View>
          ) : null}
          <WxButton label={busy ? '확인하는 중…' : '사진 찍기'} primary onPress={() => sendPhoto('camera')} />
          <WxButton label="갤러리에서 고르기" onPress={() => sendPhoto('library')} />
          <WxButton label="과제 다시 보기" onPress={again} />
        </>
      )}

      {note ? (
        <View style={[styles.banner, { backgroundColor: '#e6e1da' }]}>
          <Text style={[styles.bannerText, { color: COLOR.ink }]}>{note}</Text>
        </View>
      ) : null}
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Text style={styles.foot}>{`나중에 하기 · 남은 제출 ${mission.submitsLeft}번`}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  tag: { alignSelf: 'flex-start', backgroundColor: COLOR.cream2, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 4, paddingHorizontal: 10 },
  tagText: { fontSize: 13, fontWeight: '800', color: COLOR.ink },
  hara: { backgroundColor: COLOR.paper, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 12, paddingHorizontal: 14 },
  haraText: { fontSize: 15, lineHeight: 22, color: COLOR.ink },
  haraName: { fontWeight: '800', color: COLOR.beam },
  banner: { paddingVertical: 14, paddingHorizontal: 16, borderWidth: 2, borderColor: COLOR.ink },
  bannerText: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  input: { height: 52, paddingHorizontal: 12, fontSize: 16, color: COLOR.ink, backgroundColor: COLOR.paper, borderWidth: 2, borderColor: COLOR.ink },
  foot: { fontSize: 13, lineHeight: 20, color: COLOR.muted },
  stamp: { width: 160, height: 160, alignSelf: 'center', marginTop: 12 },
  stampImg: { width: '100%', height: '100%' },
});
