// 첫 만남 화면 (주소: /welcome) — 로그인한 뒤 프로필이 없으면 여기서 닉네임(건너뛰기 가능)과 나이대를 한 번만 받는다
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { Chip } from '../components/chip';
import { AGE_OPTIONS, ERROR_LABEL } from '../lib/labels';
import { checkNickname, DEFAULT_NICKNAME, NICKNAME_MAX, NICKNAME_MIN } from '../lib/profile';
import { useProfile } from '../lib/profile_context';
import type { AgeGroup } from '../lib/server_api';
import { COLOR, pxBox } from '../lib/theme';

export default function WelcomeScreen() {
  const { save, check  } = useProfile();
  const [nickname, setNickname] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nickNote, setNickNote] = useState<string | null>(null); // 중복 확인 결과 안내

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
    const nick = checkNickname(nickname);
    if (!nick.ok) {
      setError(`닉네임은 한글·영문·숫자·밑줄로 ${NICKNAME_MIN}~${NICKNAME_MAX}자까지 쓸 수 있어요`);
      return;
    }
    if (!ageGroup) {
      setError('나이대를 골라 주세요');
      return;
    }
    setSaving(true);
    setError(null);
    const r = await save({ nickname: nick.value, ageGroup });
    setSaving(false);
    if (!r.ok) setError(ERROR_LABEL[r.error] ?? ERROR_LABEL.SERVER);
    // 저장되면 로그인 정보가 바뀌고, _layout.tsx의 Gate가 알아서 홈으로 보낸다
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLOR.ink }}>처음 만나요</Text>
        <Text style={{ color: COLOR.muted, lineHeight: 20 }}>
          하랑이가 뭐라고 부르면 좋을까요? 건너뛰면 {`"${DEFAULT_NICKNAME}"`}로 불러요. [임시 문구]        </Text>
        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>닉네임 (선택)</Text>
        <Text style={{ color: COLOR.muted, fontSize: 12 }}>한 번 정하면 바꿀 수 없어요. 다른 사람과 같은 이름은 못 써요. [임시 문구]</Text>
        <TextInput
          value={nickname}
          onChangeText={(t) => {
            setNickname(t);
            setNickNote(null); // 이름을 고치면 앞의 확인 결과는 지운다
          }}
          placeholder={`${NICKNAME_MAX}자까지`}
          placeholderTextColor={COLOR.muted}
          style={[pxBox(), { padding: 12, color: COLOR.ink, fontSize: 15 }]}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={checkName} style={[pxBox(), { paddingVertical: 8, paddingHorizontal: 12 }]}>
            <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 12 }}>중복 확인</Text>
          </Pressable>
          {nickNote && <Text style={{ flex: 1, color: COLOR.ink, fontSize: 12 }}>{nickNote}</Text>}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>나이대</Text>
        <Text style={{ color: COLOR.muted, fontSize: 12 }}>걷는 시간을 맞추는 데 써요. 한 번만 받아요. [임시 문구]</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {AGE_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={ageGroup === o.value} onPress={() => setAgeGroup(o.value)} />
          ))}
        </View>

        {error && <Text style={{ color: COLOR.redDark }}>{error}</Text>}

        <Pressable
          onPress={submit}
          disabled={saving}
          style={[pxBox(COLOR.red, COLOR.redDark), { padding: 16, opacity: saving ? 0.6 : 1, marginTop: 8 }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>시작하기</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}