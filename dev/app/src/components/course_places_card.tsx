// 코스 장소 카드: 제목 + 태그 + 1·2·3 장소 목록 (여행 지도 안내 영역용). 장소를 누를 수 있다.
import { Image, Pressable, Text, View } from 'react-native';
import { TYPE_LABEL } from '../lib/labels';
import type { TodayRoute } from '../lib/server_api';
import { COLOR, pxBox } from '../lib/theme';
import { Tag } from './chip';

const STAMP = require('../../assets/stamp_nungeum.webp');

type Props = {
  route: TodayRoute;
  selected?: number | null; // 지도에서 보고 있는 장소 (0부터)
  notes?: (string | undefined)[]; // 장소별 덧붙임 한 줄 (예: 도보 시간)
  onPlacePress?: (index: number) => void;
};

export function CoursePlacesCard({ route, selected = null, notes = [], onPlacePress }: Props) {
  return (
    <View style={pxBox()}>
      <View style={{ padding: 16, gap: 8, borderBottomWidth: 2, borderBottomColor: COLOR.ink }}>
        <Text style={{ fontSize: 22, lineHeight: 30, fontWeight: '800', color: COLOR.ink }}>{route.title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {[...new Set(route.places.map((p) => p.type))].map((t) => (
            <Tag key={t} label={TYPE_LABEL[t] ?? t} tone={t === 'indoor' || t === 'exhibit' ? 'blue' : 'sage'} />
          ))}
          <Tag label={route.durationMin ? `${route.durationMin}분` : '시간 확인 필요'} tone="yellow" />
        </View>
      </View>
      <View style={{ padding: 16, gap: 18 }}>
        <View style={{ position: 'absolute', left: 35, top: 40, bottom: 40, width: 4, backgroundColor: '#d42a2a' }} />
        {route.places.map((p, i) => (
          <Pressable
            key={p.id}
            onPress={onPlacePress ? () => onPlacePress(i) : undefined}
            style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}
          >
            <Image source={STAMP} style={{ width: 40, height: 40 }} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: selected === i ? COLOR.red : COLOR.ink }}>
                {i + 1}. {p.name}
              </Text>
              <Text style={{ fontSize: 13, color: COLOR.muted }}>
                {TYPE_LABEL[p.type] ?? p.type}
                {p.hoursText ? ` · 운영 ${p.hoursText}` : ''}
              </Text>
              {notes[i] ? <Text style={{ fontSize: 12, color: COLOR.muted }}>{notes[i]}</Text> : null}
              {p.caution ? <Text style={{ fontSize: 12, color: COLOR.redDark }}>주의 {p.caution}</Text> : null}
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}