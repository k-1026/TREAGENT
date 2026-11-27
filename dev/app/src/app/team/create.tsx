// 팀 만들기 (주소: /team/create) — 테마와 동행을 고르면 팀이 만들어지고, 대기실에서 초대 코드를 받는다
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View  } from 'react-native';
import { Chip } from '../../components/chip';
import { ScreenHead } from '../../components/screen_head';
import { useAuth } from '../../lib/auth_context';
import { COMPANION_OPTIONS, ERROR_LABEL, THEME_OPTIONS } from '../../lib/labels';
import { useProfile } from '../../lib/profile_context';
import { Companion, createParty, Theme } from '../../lib/server_api';
import { COLOR, pxBox } from '../../lib/theme';
import { CONTENT } from '../../components/phone_column';

export default function TeamCreateScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const token = session?.access_token;
  const ageGroup = profile?.ageGroup; // 처음 만날 때 정한 나이대
  const [theme, setTheme] = useState<Theme>('history');
  const [companion, setCompanion] = useState<Companion>('friends');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!token || !ageGroup) return;
    setLoading(true);
    setError(null);
    const r = await createParty(token, { ageGroup, theme, companion });
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    router.replace(`/team/${r.data.partyId}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScreenHead title="팀 만들기" sub="테마와 동행을 골라요" backLabel="‹ 뒤로" onBack={() => router.back()} />
      {/* 내용은 남은 화면 가운데에 둔다 (flexGrow + justifyContent: center) */}
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 12, flexGrow: 1, justifyContent: 'center' }, CONTENT]}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>테마</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {THEME_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={theme === o.value} onPress={() => setTheme(o.value)} />
          ))}
        </View>

        <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>누구와 가나요</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COMPANION_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} selected={companion === o.value} onPress={() => setCompanion(o.value)} />
          ))}
        </View>

        {error && <Text style={{ color: COLOR.ink }}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>}
        {loading && <ActivityIndicator color={COLOR.red} />}

        <Pressable
          onPress={create}
          disabled={loading || !ageGroup}
          style={[pxBox(COLOR.red, COLOR.redDark), { padding: 16, opacity: loading || !ageGroup ? 0.6 : 1 }]}
        >
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>팀 만들기</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}