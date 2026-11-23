import { Pressable, Text, View } from 'react-native';
import { COLOR } from '../lib/theme';
import { CONTENT } from './phone_column';

export function ScreenHead({
  title,
  sub,
  backLabel,
  onBack,
}: {
  title: string;
  sub?: string;
  backLabel: string;
  onBack: () => void;
}) {
  return (
    <View style={{ height: 104, backgroundColor: COLOR.beam, borderBottomWidth: 3, borderBottomColor: COLOR.ink }}>
      {/* 제목과 버튼은 화면 내용과 같은 폭(CONTENT) 안에 둔다. 넓은 웹 화면에서도 아래 내용과 줄이 맞는다. */}
      <View style={[CONTENT, { flex: 1 }]}>
      {sub ? (
        <Text style={{ position: 'absolute', left: 18, bottom: 46, color: '#fff3e0', fontSize: 11 }}>{sub}</Text>
      ) : null}
      <Text
        style={{
          position: 'absolute',
          left: 18,
          bottom: 12,
          color: '#fff',
          fontSize: 22,
          fontWeight: '800',
          textShadowColor: COLOR.ink,
          textShadowOffset: { width: 2, height: 2 },
          textShadowRadius: 0,
        }}
      >
        {title}
      </Text>
      <Pressable
        onPress={onBack}
        style={{ position: 'absolute', right: 14, bottom: 12, backgroundColor: COLOR.cream, paddingVertical: 5, paddingHorizontal: 10 }}
      >
        <Text style={{ color: COLOR.ink, fontSize: 12, fontWeight: '700' }}>{backLabel}</Text>
      </Pressable>
      </View>
    </View>
  );
}