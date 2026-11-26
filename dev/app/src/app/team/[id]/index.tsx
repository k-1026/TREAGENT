// 팀 대기실 (주소: /team/ID) — 구성원, 초대 코드(방장), 팀이 정한 길, 출발
// 실시간 알림이 없어서 몇 초마다 서버에서 다시 읽는다.
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { RouteCard } from '../../../components/route_card';
import { ScreenHead } from '../../../components/screen_head';
import { useAuth } from '../../../lib/auth_context';
import { ERROR_LABEL } from '../../../lib/labels';
import { usePlace } from '../../../lib/place_context';
import { DEFAULT_NICKNAME } from '../../../lib/profile';
import { getParty, getPartyRoute, PartyInfo, startParty, TodayRoute } from '../../../lib/server_api';
import { COLOR, pxBox } from '../../../lib/theme';
import { CONTENT } from '../../../components/phone_column';

const POLL_MS = 6000; // [확인 필요] 임시 값

export default function TeamLobbyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const token = session?.access_token;
  const { place } = usePlace();
  const [info, setInfo] = useState<PartyInfo | null>(null);
  const [route, setRoute] = useState<TodayRoute | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    const load = async () => {
      const r = await getParty(token, id);
      if (cancelled) return;
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setError(null);
      setInfo(r.data);
      // 방장이 길을 골랐으면 그 길을 읽는다. 좌표는 날씨와 방문 순서 계산에만 쓰이고 저장되지 않는다.
      if (r.data.routeChosen && place) {
        const rr = await getPartyRoute(token, id, place.latitude, place.longitude);
        if (!cancelled && rr.ok) setRoute(rr.data.route);
      }
    };
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, id, place]);

  const start = async () => {
    if (!token || !id) return;
    setStarting(true);
    setError(null);
    const r = await startParty(token, id);
    setStarting(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setInfo((prev) => (prev ? { ...prev, startedAt: r.data.startedAt } : prev));
  };

  const isHost = info?.myRole === 'host';
  const line = route ? (route.briefing?.text ?? route.reason) : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLOR.cream }}>
      <ScreenHead
        title="우리 팀"
        sub={info ? `${info.memberCount}명이 모였어요` : '팀 정보를 불러오는 중이에요'}
        backLabel="‹ 뒤로"
        onBack={() => (router.canGoBack() ? router.back() : router.dismissTo('/'))}
      />
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 12 }, CONTENT]}>
        {error && <Text style={{ color: COLOR.ink }}>{ERROR_LABEL[error] ?? ERROR_LABEL.SERVER}</Text>}
        {!place && (
          <Pressable onPress={() => router.replace('/')}>
            <Text style={{ color: COLOR.red, fontWeight: '700' }}>위치를 먼저 정해 주세요 (홈으로)</Text>
          </Pressable>
        )}

        {info && (
          <>
            {isHost && info.inviteCode && (
              <View style={[pxBox(), { padding: 14, gap: 4 }]}>
                <Text style={{ fontSize: 12, color: COLOR.muted }}>친구에게 이 코드를 알려 주세요</Text>
                <Text style={{ fontSize: 26, fontWeight: '800', color: COLOR.ink, letterSpacing: 3 }}>{info.inviteCode}</Text>
              </View>
            )}

            <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>함께하는 사람</Text>
            <View style={[pxBox(), { padding: 12, gap: 6 }]}>
              {info.members.map((m, i) => (
                <Text key={i} style={{ color: COLOR.ink, fontSize: 14 }}>
                  {m.nickname ?? DEFAULT_NICKNAME}
                  {m.role === 'host' ? ' · 방장' : ''}
                  {m.isMe ? ' (나)' : ''}
                </Text>
              ))}
            </View>

            <Text style={{ fontSize: 13, fontWeight: '800', color: COLOR.ink }}>오늘의 길</Text>
            {route ? (
              <>
                <RouteCard route={route} index={0} />
                {line && (
                  <View style={[pxBox(), { padding: 12 }]}>
                    <Text style={{ color: COLOR.ink, fontSize: 14, lineHeight: 22 }}>{line}</Text>
                  </View>
                )}
              </>
            ) : (
              <Text style={{ color: COLOR.muted }}>
                {isHost ? '후보 길을 받아서 하나 골라 주세요.' : '방장이 길을 고르는 중이에요.'}
              </Text>
            )}

            {info.startedAt ? (
              <Text style={{ color: COLOR.ink, fontWeight: '700' }}>출발했어요. 길 안내 화면은 아직 없어요.</Text>
            ) : (
              isHost && (
                <>
                  <Pressable
                    onPress={() => router.push(`/team/${id}/candidates`)}
                    disabled={!place}
                    style={[pxBox(), { padding: 14, alignItems: 'center', opacity: place ? 1 : 0.5 }]}
                  >
                    <Text style={{ color: COLOR.ink, fontWeight: '800' }}>
                      {info.routeChosen ? '다른 길 고르기' : '후보 길 받기'}
                    </Text>
                  </Pressable>
                  {info.routeChosen && (
                    <Pressable
                      onPress={start}
                      disabled={starting}
                      style={[pxBox(COLOR.red, COLOR.redDark), { padding: 16, opacity: starting ? 0.6 : 1 }]}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>이 길로 출발</Text>
                    </Pressable>
                  )}
                </>
              )
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}