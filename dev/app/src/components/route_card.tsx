// 후보 길 카드 한 장 (목업의 .card). 개인용 후보 화면과 팀 화면이 같이 쓴다. onPress가 없으면 누를 수 없는 카드다.
import { Pressable, Text, View } from 'react-native';
import { TYPE_LABEL } from '../lib/labels';
import type { TodayRoute } from '../lib/server_api';
import { COLOR, pxBox } from '../lib/theme';
import { Tag } from './chip';

export function RouteCard({ route, index, onPress }: { route: TodayRoute; index: number; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[pxBox(), { flexDirection: 'row', gap: 10, padding: 8, minHeight: 76 }]}
    >
      <View style={{ width: 58, height: 58, backgroundColor: COLOR.cream2, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: COLOR.muted }}>{index + 1}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: COLOR.ink }}>{route.title}</Text>
        <Text style={{ fontSize: 10, color: COLOR.muted }}>
          {route.places.length}곳 · {route.durationMin ? `약 ${route.durationMin}분` : '소요시간 확인 필요'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {[...new Set(route.places.map((p) => p.type))].map((t) => (
            <Tag key={t} label={TYPE_LABEL[t] ?? t} tone={t === 'indoor' || t === 'exhibit' ? 'blue' : 'sage'} />
          ))}
        </View>
        <Text style={{ fontSize: 10, color: COLOR.ink, lineHeight: 14 }}>{route.places.map((p) => p.name).join(' → ')}</Text>
        <Text style={{ fontSize: 10, color: COLOR.redDark }}>{route.reason}</Text>
      </View>
    </Pressable>
  );
}