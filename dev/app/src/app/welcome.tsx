// 첫 만남 화면 (주소: /welcome) — 로그인한 뒤 프로필이 없으면 여기서 닉네임과 나이대를 한 번만 받는다
// 모양과 규칙은 목업(storyboard/app_login_region_mockup_v1.html ⑥)을 따른다. (auth_ui.tsx 부품 사용)
//
// 목업 규칙: 닉네임과 나이대를 꼭 정해야 시작할 수 있다. 닉네임을 비우면 "닉네임을 정해 주세요"로 막는다.
//   [팀 확인 필요] 기존 앱은 닉네임을 건너뛰면 "길동무"로 불렀다 (plan/app_mockup_gap_check_v1.md 1번 표).
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Chip } from '../components/chip';
import { AuthFrame, PxButton, PxInput, PxMessage } from '../components/auth_ui';
import { AGE_OPTIONS, ERROR_LABEL } from '../lib/labels';
import { checkNickname, NICKNAME_MAX, NICKNAME_MIN } from '../lib/profile';
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
      setNickNote(`닉네임은 한글, 영문, 숫자, 밑줄로 ${NICKNAME_MIN}~${NICKNAME_MAX}자까지 쓸 수 있어요.`);
      return;
    }
    if (nick.value === null) {
      setNickNote('닉네임을 먼저 입력해 주세요');
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
      setError(`닉네임은 한글, 영문, 숫자, 밑줄로 ${NICKNAME_MIN}~${NICKNAME_MAX}자까지 쓸 수 있어요.`);
      return;
    }
    if (nick.value === null) {
      setError('닉네임을 정해 주세요.');
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
    <AuthFrame title="처음 만나요" subtitle="프로필 정하기">
      <Text style={styles.lead}>
        하랑이가 뭐라고 부르면 좋을까요? (필수)
      </Text>

      <Text style={styles.note}>한 번 정하면 바꿀 수 없어요. 다른 사람과 같은 이름은 못 써요.</Text>
      {/* 목업 ⑥: 입력칸과 [중복 확인]을 한 줄에 둔다 */}
      <View style={styles.nickRow}>
        <PxInput
          value={nickname}
          onChangeText={(t) => {
            setNickname(t);
            setNickNote(null); // 이름을 고치면 앞의 확인 결과는 지운다
          }}
          placeholder={`${NICKNAME_MIN}~${NICKNAME_MAX}자`}
          maxLength={NICKNAME_MAX}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.nickInput}
        />
        <Pressable onPress={checkName} style={[pxBox(COLOR.paper, COLOR.shade), styles.checkButton]}>
          <Text style={styles.checkText}>중복 확인</Text>
        </Pressable>
      </View>
      {nickNote && <Text style={styles.checkNote}>{nickNote}</Text>}

      <Text style={[styles.label, styles.ageLabel]}>나이대 (필수)</Text>
      <Text style={styles.note}>걷는 시간을 맞추는 데 써요.</Text>
      <View style={styles.chips}>
        {AGE_OPTIONS.map((o) => (
          <Chip
            key={o.value}
            label={o.label}
            selected={ageGroup === o.value}
            onPress={() => setAgeGroup(o.value)}
            style={styles.ageChip}
          />
        ))}
      </View>

      {error && <PxMessage tone="error">{error}</PxMessage>}

      <PxButton label={saving ? '저장하는 중...' : '시작하기'} onPress={submit} disabled={saving} />
    </AuthFrame>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: 13, fontWeight: '800', color: COLOR.ink, lineHeight: 19 }, // 맨 위 문구는 닉네임 라벨을 대신해 볼드로 둔다
  label: { fontSize: 13, fontWeight: '800', color: COLOR.ink },
  ageLabel: { marginTop: 14 }, // 닉네임 입력과 나이대 사이 간격을 넓힘
  note: { fontSize: 11, color: COLOR.muted, lineHeight: 16 },
  nickRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  nickInput: { flex: 1 },
  checkButton: { justifyContent: 'center', paddingHorizontal: 10 },
  checkText: { color: COLOR.ink, fontWeight: '800', fontSize: 12 },
  checkNote: { color: COLOR.ink, fontSize: 12 },
  // 목업 ⑥: 나이대는 3칸씩 두 줄
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  ageChip: { width: '31.5%' },
});
