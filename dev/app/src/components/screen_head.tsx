import { Pressable, Text, View } from 'react-native';
import { COLOR } from '../lib/theme';

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
  );
}