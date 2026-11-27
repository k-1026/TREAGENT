// 초대 코드로 들어가기 (주소: /team/join)
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ScreenHead } from '../../components/screen_head';
import { useAuth } from '../../lib/auth_context';
import { ERROR_LABEL } from '../../lib/labels';
import { useProfile } from '../../lib/profile_context';
import { joinParty } from '../../lib/server_api';
import { COLOR, pxBox } from '../../lib/theme';
import { CONTENT } from '../../components/phone_column';

// 들어가기 실패 문구. 코드를 못 찾는 경우(NOT_FOUND)는 코스 화면의 문구와 달라서 따로 안내한다.
function joinMessage(error: string): string {
  if (error === 'NOT_FOUND') return '초대 코드를 찾을 수 없어요';
  if (error === 'INVALID') return '초대 코드는 8글자예요';
  if (error === 'RATE_LIMIT') return '너무 자주 시도했어요. 잠시 뒤 다시 해 주세요';
  return ERROR_LABEL[error] ?? ERROR_LABEL.SERVER;
}

export default function TeamJoinScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const token = session?.access_token;
  const ageGroup = profile?.ageGroup;
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const join = async () => {
    if (!token || !ageGroup) return;
    setLoading(true);
    setMessage(null);
    const r = await joinParty(token, code, ageGroup);
    setLoading(false);
    if (!r.ok) {
      setMessage(joinMessage(r.error));
      return;
    }
    router.replace(`/team/${r.data.partyId}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScreenHead title="초대 코드" sub="친구가 알려 준 코드를 입력해요" backLabel="‹ 뒤로" onBack={() => router.back()} />
      {/* 내용은 남은 화면 가운데에 둔다 (flexGrow + justifyContent: center) */}
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 12, flexGrow: 1, justifyContent: 'center' }, CONTENT]}>
        <TextInput
          value={code}
          onChangeText={(t) => {
            setCode(t);
            setMessage(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="예: AB12CD34"
          placeholderTextColor={COLOR.muted}
          style={[pxBox(), { padding: 12, color: COLOR.ink, fontSize: 18, letterSpacing: 2 }]}
        />

        {message && <Text style={{ color: COLOR.ink }}>{message}</Text>}
        {loading && <ActivityIndicator color={COLOR.red} />}

        <Pressable
          onPress={join}
          disabled={loading || !ageGroup || code.trim().length === 0}
          style={[
            pxBox(COLOR.red, COLOR.redDark),
            { padding: 16, opacity: loading || !ageGroup || code.trim().length === 0 ? 0.6 : 1 },
          ]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>들어가기</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}