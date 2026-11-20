// 첫 만남 화면 (주소: /welcome) — 로그인한 뒤 프로필이 없으면 여기서 닉네임(건너뛰기 가능)과 나이대를 한 번만 받는다
// 모양은 목업(storyboard/app_login_region_mockup_v1.html ⑥)을 따른다. (auth_ui.tsx 부품 사용)
//
// 확인 필요 [결정 필요]: 목업은 닉네임과 나이대를 "꼭 정해야 시작할 수 있다"고 적었다.
//   기존 화면은 닉네임을 선택으로 두고 건너뛰게 한다. 이번에는 기존 동작을 그대로 두었다.
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../components/chip';
import { AuthFrame, PxButton, PxInput, PxMessage } from '../components/auth_ui';
import { AGE_OPTIONS, ERROR_LABEL } from '../lib/labels';
import { checkNickname, DEFAULT_NICKNAME, NICKNAME_MAX, NICKNAME_MIN } from '../lib/profile';
import { useProfile } from '../lib/profile_context';
import type { AgeGroup } from '../lib/server_api';
import { COLOR, pxBox } from '../lib/theme';

export default function WelcomeScreen() {
  const { save, check } = useProfile();
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
    <AuthFrame title="처음 만나요" subtitle="프로필 한 번 정하기">
      <Text style={styles.lead}>
        하랑이가 뭐라고 부르면 좋을까요? 건너뛰면 {`"${DEFAULT_NICKNAME}"`}로 불러요.
      </Text>

      <Text style={styles.label}>닉네임 (선택)</Text>
      <Text style={styles.note}>한 번 정하면 바꿀 수 없어요. 다른 사람과 같은 이름은 못 써요.</Text>
      <PxInput
        value={nickname}
        onChangeText={(t) => {
          setNickname(t);
          setNickNote(null); // 이름을 고치면 앞의 확인 결과는 지운다
        }}
        placeholder={`${NICKNAME_MAX}자까지`}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <View style={styles.checkRow}>
        <Pressable onPress={checkName} style={[pxBox(COLOR.paper, COLOR.shade), styles.checkButton]}>
          <Text style={styles.checkText}>중복 확인</Text>
        </Pressable>
        {nickNote && <Text style={styles.checkNote}>{nickNote}</Text>}
      </View>

      <Text style={styles.label}>나이대</Text>
      <Text style={styles.note}>걷는 시간을 맞추는 데 써요. 한 번만 받아요.</Text>
      <View style={styles.chips}>
        {AGE_OPTIONS.map((o) => (
          <Chip key={o.value} label={o.label} selected={ageGroup === o.value} onPress={() => setAgeGroup(o.value)} />
        ))}
      </View>

      {error && <PxMessage tone="error">{error}</PxMessage>}

      <PxButton label={saving ? '저장하는 중...' : '시작하기'} onPress={submit} disabled={saving} />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 13, color: COLOR.ink, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: '800', color: COLOR.ink },
  note: { fontSize: 11, color: COLOR.muted, lineHeight: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkButton: { paddingVertical: 8, paddingHorizontal: 12 },
  checkText: { color: COLOR.ink, fontWeight: '800', fontSize: 12 },
  checkNote: { flex: 1, color: COLOR.ink, fontSize: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
