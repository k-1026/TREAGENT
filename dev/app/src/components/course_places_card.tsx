// 코스 장소 카드: 제목 + 태그 + 1·2·3 장소 목록 (여행 지도 안내 영역용). 장소를 누를 수 있다.
import type { ReactNode } from 'react';
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
  fill?: boolean; // 부모 칸을 끝까지 채운다 (장소 사이 간격을 고르게 편다)
  reached?: number; // 다녀온 장소 수. 이 번호 앞까지만 도장이 찍힌 색으로 보인다
  summary?: ReactNode; // 헤더 안의 전체 거리·시간 줄 (있으면 소요 태그 대신 쓴다)
};

export function CoursePlacesCard({ route, selected = null, notes = [], onPlacePress, summary, reached, fill = false }: Props) {
  return (
    <View style={[pxBox(), fill ? { flex: 1 } : null]}>
      <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6, borderBottomWidth: 2, borderBottomColor: COLOR.ink }}>
        <Text style={{ fontSize: 18, lineHeight: 24, fontWeight: '800', color: COLOR.ink }}>{route.title}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {[...new Set(route.places.map((p) => p.type))].map((t) => (
            <Tag key={t} label={TYPE_LABEL[t] ?? t} tone={t === 'indoor' || t === 'exhibit' ? 'blue' : 'sage'} />
          ))}
          {summary ? null : <Tag label={route.durationMin ? `${route.durationMin}분` : '시간 확인 필요'} tone="yellow" />}
        </View>
        {summary ? <View>{summary}</View> : null}
      </View>
      <View style={[{ paddingHorizontal: 14, paddingVertical: 10, gap: fill ? 18 : 10 }, fill ? { flex: 1, justifyContent: 'space-evenly' } : null]}>
        {route.places.map((p, i) => (
          <Pressable
            key={p.id}
            onPress={onPlacePress ? () => onPlacePress(i) : undefined}
            style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
          >
            <View style={{ width: 32, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
              {/* 빨간 선: 위 도장에서 내려오고 아래 도장으로 이어진다. 첫·마지막 도장에서는 한쪽만 그린다 */}
              {i > 0 ? <View style={{ position: 'absolute', left: 14, width: 4, top: -20, bottom: '50%', backgroundColor: '#d42a2a' }} /> : null}
              {i < route.places.length - 1 ? <View style={{ position: 'absolute', left: 14, width: 4, top: '50%', bottom: -20, backgroundColor: '#d42a2a' }} /> : null}
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: COLOR.paper, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={STAMP} style={{ width: 32, height: 32, opacity: reached === undefined || i < reached ? 1 : 0.35 }} resizeMode="contain" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: selected === i ? COLOR.red : COLOR.ink }}>
                {i + 1}. {p.name}
              </Text>
              <Text style={{ fontSize: 12, color: COLOR.muted }}>
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