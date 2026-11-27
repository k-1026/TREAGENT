import { Pressable, Text, TextStyle, ViewStyle } from 'react-native';
import { COLOR } from '../lib/theme';

export function Chip({
  label,
  selected,
  onPress,
  style,
  textStyle,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle; // 글자 크기 등을 칸마다 바꿀 때 (기본 12)
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 14,
        // 칸 모양은 pxBox와 같이 모서리 6, 잉크색 1.5px 테두리 (홈 목업 갱신본 .px)
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: COLOR.ink,
        backgroundColor: selected ? COLOR.ink : COLOR.paper,
        alignItems: 'center',
        ...style,
      }}
    >
      <Text style={[{ color: selected ? '#fff' : COLOR.muted, fontWeight: '700', fontSize: 12 }, textStyle]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, tone = 'sage' }: { label: string; tone?: 'sage' | 'blue' | 'yellow' }) {
  const bg = tone === 'blue' ? COLOR.blue : tone === 'yellow' ? COLOR.yellow : COLOR.sage;
  const fg = tone === 'blue' ? COLOR.blueInk : tone === 'yellow' ? COLOR.ink : COLOR.sageInk;
  return (
    <Text
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        color: fg,
        fontSize: 12,
        fontWeight: '700',
        paddingVertical: 1,
        paddingHorizontal: 5,
        overflow: 'hidden',
      }}
    >
      {label}
    </Text>
  );
}