/*
 * [me.tsx] 내 정보 S-10 (주소: /me) — 하단 탭 [내 정보]로 연다. 목업 storyboard/app_home_mockup_v1.html의 #v-me
 *
 * 순서 (목업): 호칭 → 지역 → 위치 안내 → 알림 → 로그아웃
 *  - 호칭: 닉네임을 정했으면 "잠김" 한 줄 (한 번 정하면 바꿀 수 없음). 아직이면 입력칸과 [중복 확인] (앱 기능, 목업에 없음)
 *  - 나이대와 [저장]: 추천에 쓰는 앱 기능이라 목업에는 없지만 남겨 둔다
 *  - 지역: 지금 위치(기본 중구)와 [변경] → 위치 확인 화면(/location). MVP는 중구만 [결정 필요: 변경 화면을 남길지]
 *  - 알림: 방식 미정 [결정 D-21]
 *  - 로그아웃: 누르면 확인 상자가 나오고 [로그아웃]을 한 번 더 눌러야 나간다 (목업)
 * 문구는 목업의 [임시 문구]를 그대로 쓴다.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomTab } from '../components/bottom_tab';
import { Chip } from '../components/chip';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { findDistrict } from '../lib/districts';
import { AGE_OPTIONS, ERROR_LABEL } from '../lib/labels';
import { usePlace } from '../lib/place_context';
import { checkNickname, DEFAULT_NICKNAME, NICKNAME_MAX, NICKNAME_MIN } from '../lib/profile';
import { useProfile } from '../lib/profile_context';
import type { AgeGroup } from '../lib/server_api';
import { supabase } from '../lib/supabase';
import { COLOR, pxBox } from '../lib/theme';

export default function MeScreen() {
  const { profile, save, check } = useProfile();
  const { place } = usePlace();
  const locked = !!profile?.nickname; // 이미 정한 닉네임은 바꿀 수 없다
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(profile?.ageGroup ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nickNote, setNickNote] = useState<string | null>(null);
  const [confirmOut, setConfirmOut] = useState(false); // 로그아웃 확인 상자

  const areaName = !place ? '중구' : place.kind === 'district' ? (findDistrict(place.code)?.name ?? '선택한 동네') : '현재 위치';

  const checkName = async () => {
    const nick = checkNickname(nickname);
    if (!nick.ok) {
      setNickNote(`닉네임은 한글·영문·숫자·밑줄로 ${NICKNAME_MIN}~${NICKNAME_MAX}자까지 쓸 수 있어요`);
      return;
    }
    if (nick.value === null) {
      setNickNote(`비워 두면 "${DEFAULT_NICKNAME}"로 불러요`);
      return;
    }
    setNickNote('확인하는 중이에요');
    const r = await check(nick.value);
    if (!r.ok) {
      setNickNote(r.error === 'RATE_LIMIT' ? '확인을 너무 자주 했어요. 잠시 뒤 다시 해 주세요' : (ERROR_LABEL[r.error] ?? ERROR_LABEL.SERVER));
      return;
    }
    setNickNote(r.data.available ? '쓸 수 있는 이름이에요' : ERROR_LABEL.NICKNAME_TAKEN);
  };

  const submit = async () => {
    let value = profile?.nickname ?? null;
    if (!locked) {
      const nick = checkNickname(nickname);
      if (!nick.ok) {
        setMessage(`닉네임은 한글·영문·숫자·밑줄로 ${NICKNAME_MIN}~${NICKNAME_MAX}자까지 쓸 수 있어요`);
        return;
      }
      value = nick.value;
    }
    if (!ageGroup) {
      setMessage('나이대를 골라 주세요');
      return;
    }
    setSaving(true);
    setMessage(null);
    const r = await save({ nickname: value, ageGroup });
    setSaving(false);
    setMessage(r.ok ? '저장했어요' : (ERROR_LABEL[r.error] ?? ERROR_LABEL.SERVER));
  };

  return (
    <View style={styles.safe}>
      {/* 하단 탭 화면이라 뒤로 버튼은 없다 (목업 #v-me) */}
      <ScreenHead title="내 정보" sub="계정과 안내" />
      <ScrollView contentContainerStyle={[CONTENT, styles.scroll]}>
        {/* 호칭 */}
        <Text style={styles.h3}>호칭</Text>
        {locked ? (
          <View style={[pxBox(), styles.row]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{profile?.nickname}</Text>
              <Text style={styles.rowSmall}>한 번 정하면 바꿀 수 없어요. 다른 사람과 같은 이름은 못 써요 [임시 문구]</Text>
            </View>
            <Text style={styles.lock}>잠김</Text>
          </View>
        ) : (
          <>
            <Text style={styles.rowSmall}>한 번 정하면 바꿀 수 없어요. 다른 사람과 같은 이름은 못 써요 [임시 문구]</Text>
            <TextInput
              value={nickname}
              onChangeText={(t) => {
                setNickname(t);
                setNickNote(null);
              }}
              placeholder={`건너뛰면 "${DEFAULT_NICKNAME}"로 불러요`}
              placeholderTextColor={COLOR.muted}
              style={[pxBox(), styles.input]}
            />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={checkName} style={[pxBox(), { paddingVertical: 8, paddingHorizontal: 12 }]}>
                <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 12 }}>중복 확인</Text>
              </Pressable>
              {nickNote && <Text style={{ flex: 1, color: COLOR.ink, fontSize: 12 }}>{nickNote}</Text>}
            </View>
          </>
        )}

        {/* 나이대 (앱 기능: 추천에 쓴다) */}
        <Text style={styles.h3}>나이대</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AGE_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={ageGroup === o.value} onPress={() => setAgeGroup(o.value)} />
          ))}
        </View>
        {message && <Text style={{ color: COLOR.ink }}>{message}</Text>}
        <Pressable
          onPress={submit}
          disabled={saving}
          style={({ pressed }) => [pxBox(COLOR.red, COLOR.redDark), styles.btn, { opacity: saving ? 0.6 : pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.btnText, { color: '#fff' }]}>저장</Text>
        </Pressable>

        {/* 지역 */}
        <Text style={styles.h3}>
          지역 <Text style={styles.h3Sub}>MVP는 중구만</Text>
        </Text>
        <View style={[pxBox(), styles.row]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{areaName}</Text>
            <Text style={styles.rowSmall}>지금 이용할 수 있는 곳 (F-23)</Text>
          </View>
          <Pressable onPress={() => router.push('/location')} style={[pxBox(COLOR.cream), { paddingVertical: 8, paddingHorizontal: 12 }]}>
            <Text style={{ color: COLOR.ink, fontWeight: '700', fontSize: 13 }}>변경</Text>
          </Pressable>
        </View>

        {/* 위치 안내 */}
        <Text style={styles.h3}>위치 안내</Text>
        <View style={[pxBox(), styles.row]}>
          <Text style={styles.rowText}>위치는 앱을 쓰는 동안만 써요. 좌표는 저장하지 않아요 [임시 문구, 확인 필요]</Text>
        </View>

        {/* 알림 */}
        <Text style={styles.h3}>
          알림 <Text style={styles.h3Sub}>보류</Text>
        </Text>
        <View style={[pxBox(), styles.row]}>
          <Text style={styles.rowText}>알림 방식은 아직 정하지 않았어요 [결정 D-21]</Text>
        </View>

        {/* 로그아웃: 확인 상자를 한 번 거친다 (목업) */}
        {!confirmOut ? (
          <Pressable onPress={() => setConfirmOut(true)} style={({ pressed }) => [pxBox(), styles.btn, pressed && { opacity: 0.85 }]}>
            <Text style={styles.btnText}>로그아웃</Text>
          </Pressable>
        ) : (
          <>
            <View style={[pxBox(), styles.row]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>로그아웃할까요?</Text>
                <Text style={styles.rowSmall}>다시 들어오려면 로그인해야 해요 [임시 문구]</Text>
              </View>
            </View>
            <Pressable
              onPress={() => supabase.auth.signOut()}
              style={({ pressed }) => [pxBox(COLOR.red, COLOR.redDark), styles.btn, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.btnText, { color: '#fff' }]}>로그아웃</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmOut(false)} style={({ pressed }) => [pxBox(), styles.btn, pressed && { opacity: 0.85 }]}>
              <Text style={styles.btnText}>취소</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <BottomTab current="me" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  scroll: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  h3: { fontSize: 14, fontWeight: '800', color: COLOR.ink, marginTop: 4 },
  h3Sub: { fontSize: 12, fontWeight: '400', color: COLOR.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12 },
  rowTitle: { fontSize: 14, fontWeight: '800', color: COLOR.ink, marginBottom: 4 },
  rowSmall: { fontSize: 12, lineHeight: 18, color: COLOR.muted },
  rowText: { flex: 1, fontSize: 13, lineHeight: 19, color: COLOR.ink },
  lock: { fontSize: 12, fontWeight: '700', color: COLOR.muted },
  input: { padding: 12, color: COLOR.ink, fontSize: 15 },
  btn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 16, fontWeight: '800', color: COLOR.ink },
});
