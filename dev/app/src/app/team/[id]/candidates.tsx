// 팀 후보 길 (주소: /team/ID/candidates, 방장만) — 후보 3개 중 하나를 골라 팀의 길로 정한다
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { RouteCard } from '../../../components/route_card';
import { ScreenHead } from '../../../components/screen_head';
import { useAuth } from '../../../lib/auth_context';
import { ERROR_LABEL, REASON_LABEL } from '../../../lib/labels';
import { usePlace } from '../../../lib/place_context';
import { choosePartyRoute, getPartyCandidates, PartyCandidates } from '../../../lib/server_api';
import { COLOR, pxBox } from '../../../lib/theme';
import { CONTENT } from '../../../components/phone_column';

export default function TeamCandidatesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.access_token;
  const { place } = usePlace();
  const [data, setData] = useState<PartyCandidates | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); // 다른 길 받기·고르기 요청 중

  // 후보를 받는다. 이미 받은 후보가 있으면 서버가 같은 묶음을 돌려준다. more가 true면 새 묶음을 받는다.
  const fetchSet = useCallback(
    async (more: boolean) => {
      if (!token || !id || !place) return;
      const r = await getPartyCandidates(token, id, place.latitude, place.longitude, more);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      if (more && !r.data.refreshed) setNotice('다른 길이 더 없어요. 지금 길 중에서 골라 주세요.');
      setData(r.data);
    },
    [token, id, place],
  );

  // 처음 열 때 후보를 받는다. 이미 받은 후보가 있으면 서버가 같은 묶음을 돌려준다.
  useEffect(() => {
    if (!token || !id || !place) return;
    let cancelled = false;
    const load = async () => {
      const r = await getPartyCandidates(token, id, place.latitude, place.longitude, false);
      if (cancelled) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setData(r.data);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [token, id, place]);

  const more = async () => {
    setBusy(true);
    setNotice(null);
    await fetchSet(true);
    setBusy(false);
  };

  const choose = async (index: number) => {
    if (!token || !id || !data) return;
    setBusy(true);
    setError(null);
    const r = await choosePartyRoute(token, id, { mode: data.mode, setNo: data.setNo, index });
    if (!r.ok) {
      if (r.error === 'STALE_CANDIDATES') {
        setNotice(ERROR_LABEL.STALE_CANDIDATES);
        await fetchSet(false); // 화면이 오래됐으면 최신 묶음을 다시 불러온다
      } else {
        setError(r.error);
      }
      setBusy(false);
      return;
    }
    setBusy(false);
    router.back(); // 대기실이 몇 초 안에 고른 길을 보여 준다
  };

  const loading = data === null && error === null;

  return (
    <View style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScreenHead
        title="팀 후보 길"
        sub={data ? `후보 ${data.routes.length}개 · ${data.setNo}번째 묶음` : '후보를 불러오는 중이에요'}
        backLabel="‹ 팀"
        onBack={() => router.back()}
      />
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 12 }, CONTENT]}>
        {!place && <Text style={{ color: COLOR.ink }}>위치를 먼저 정해 주세요.</Text>}
        {(loading || busy) && <ActivityIndicator color={COLOR.red} />}
        {loading && <Text style={{ color: COLOR.muted, fontSize: 12 }}>하랑이가 후보 길을 고르는 중이에요. 조금 걸릴 수 있어요.</Text>}
        {error && <Text style={{ color: COLOR.ink }}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>}
        {notice && <Text style={{ color: COLOR.muted, fontSize: 12 }}>{notice}</Text>}

        {data && data.routes.length === 0 && (
          <Text style={{ color: COLOR.ink }}>{REASON_LABEL[data.routeReason ?? ''] ?? '오늘은 길을 만들지 못했어요'}</Text>
        )}

        {data?.routes.map((r, i) => (
          <RouteCard key={`${data.setNo}-${i}`} route={r} index={i} onPress={busy ? undefined : () => choose(i)} />
        ))}

        {data && data.routes.length > 0 && (
          <Pressable onPress={more} disabled={busy} style={[pxBox(), { padding: 12, alignItems: 'center', opacity: busy ? 0.5 : 1 }]}>
            <Text style={{ color: COLOR.ink, fontWeight: '800', fontSize: 12 }}>마음에 드는 길이 없어요 · 다른 길 새로 받기</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}