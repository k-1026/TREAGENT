// 내 정보 (주소: /me) — 닉네임·나이대를 보고 고친다. 닉네임은 한 번 정하면 바꿀 수 없다. 로그아웃도 여기서 한다.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { Chip } from '../components/chip';
import { ScreenHead } from '../components/screen_head';
import { AGE_OPTIONS, ERROR_LABEL } from '../lib/labels';
import { checkNickname, DEFAULT_NICKNAME, NICKNAME_MAX, NICKNAME_MIN } from '../lib/profile';
import { useProfile } from '../lib/profile_context';
import type { AgeGroup } from '../lib/server_api';
import { supabase } from '../lib/supabase';
import { COLOR, pxBox } from '../lib/theme';
import { CONTENT } from '../components/phone_column';

export default function MeScreen() {
  const { profile, save, check } = useProfile();
  const locked = !!profile?.nickname; // 이미 정한 닉네임은 바꿀 수 없다
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(profile?.ageGroup ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nickNote, setNickNote ] = useState<string | null>(null);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScreenHead title="내 정보" sub="한 번 정하면 계속 불러와요" backLabel="‹ 홈" onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 12 }, CONTENT]}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>닉네임</Text>
        <Text style={{ color: COLOR.muted, fontSize: 12 }}>
          {locked ? '정한 닉네임은 바꿀 수 없어요.' : '한 번 정하면 바꿀 수 없어요. 다른 사람과 같은 이름은 못 써요.'} [임시 문구]
        </Text>
        <TextInput
          value={nickname}
          onChangeText={(t) => {
            setNickname(t);
            setNickNote(null);
          }}
          editable={!locked}
          placeholder={`건너뛰면 "${DEFAULT_NICKNAME}"로 불러요`}
          placeholderTextColor={COLOR.muted}
          style={[pxBox(), { padding: 12, color: COLOR.ink, fontSize: 15, opacity: locked ? 0.6 : 1 }]}
        />
        {!locked && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable onPress={checkName} style={[pxBox(), { paddingVertical: 8, paddingHorizontal: 12 }]}>
              <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 12 }}>중복 확인</Text>
            </Pressable>
            {nickNote && <Text style={{ flex: 1, color: COLOR.ink, fontSize: 12 }}>{nickNote}</Text>}
          </View>
        )}

        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>나이대</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AGE_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={ageGroup === o.value} onPress={() => setAgeGroup(o.value)} />
          ))}
        </View>

        {message && <Text style={{ color: COLOR.ink }}>{message}</Text>}
        <Pressable
          onPress={submit}
          disabled={saving}
          style={[pxBox(COLOR.red, COLOR.redDark), { padding: 14, opacity: saving ? 0.6 : 1 }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>저장</Text>
        </Pressable>

        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink, marginTop: 8 }}>위치 안내</Text>
        <View style={[pxBox(), { padding: 12 }]}>
          <Text style={{ color: COLOR.ink, fontSize: 12, lineHeight: 18 }}>
            위치는 앱을 쓰는 동안만 써요. 좌표는 저장하지 않아요. [임시 문구, 확인 필요]
          </Text>
        </View>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={[pxBox(), { padding: 14, alignItems: 'center', marginTop: 8 }]}
        >
          <Text style={{ color: COLOR.ink, fontWeight: '800' }}>로그아웃</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}