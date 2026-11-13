import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { course, routes, stations, Weather, weatherLabel } from './src/data/courseA';

const RED = '#a8242a';
const BG = '#fbf6ee';

type Step = 'start' | 'weather' | 'station' | 'done';

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [step, setStep] = useState<Step>('start');
  const [weather, setWeather] = useState<Weather>('normal');
  const [index, setIndex] = useState(0);

  const route = routes[weather];
  const station = stations[route[index]];

  const reset = () => {
    setIndex(0);
    setStep('start');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        {step === 'start' && (
          <View style={styles.card}>
            <Text style={styles.tag}>대프리카 히든 퀘스트</Text>
            <Text style={styles.title}>{course.title}</Text>
            <Text style={styles.sub}>{course.subtitle}</Text>
            <Text style={styles.body}>하랑이: {course.story}</Text>
            <Button label="시작하기" onPress={() => setStep('weather')} />
          </View>
        )}

        {step === 'weather' && (
          <View style={styles.card}>
            <Text style={styles.title}>오늘 날씨는 어때요?</Text>
            {(['normal', 'hot'] as Weather[]).map((w) => (
              <Pressable
                key={w}
                style={[styles.option, weather === w && styles.optionOn]}
                onPress={() => setWeather(w)}
              >
                <Text style={styles.optionTitle}>{weatherLabel[w].title}</Text>
                <Text style={styles.body}>{weatherLabel[w].desc}</Text>
              </Pressable>
            ))}
            <Button
              label="퀘스트 열기"
              onPress={() => {
                setIndex(0);
                setStep('station');
              }}
            />
          </View>
        )}

        {step === 'station' && (
          <View style={styles.card}>
            <Text style={styles.tag}>
              {index + 1} / {route.length} · {station.indoor ? '실내' : '야외'}
            </Text>
            <Text style={styles.title}>{station.name}</Text>
            <Text style={styles.body}>하랑이: {station.clue}</Text>
            <View style={styles.mission}>
              <Text style={styles.optionTitle}>미션</Text>
              <Text style={styles.body}>{station.mission}</Text>
            </View>
            <Text style={styles.note}>{station.note}</Text>
            <Button
              label={index + 1 < route.length ? '미션 완료, 다음 장소로' : '미션 완료'}
              onPress={() => (index + 1 < route.length ? setIndex(index + 1) : setStep('done'))}
            />
          </View>
        )}

        {step === 'done' && (
          <View style={styles.card}>
            <Text style={styles.tag}>종점</Text>
            <Text style={styles.title}>배지를 얻었어요</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>비밀 레시피{'\n'}발견</Text>
            </View>
            <Text style={styles.body}>
              하랑이: 한 입만 먼저 찾아본다더니, 레시피를 다 찾았네요.
            </Text>
            <Button label="처음으로" onPress={reset} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12, maxWidth: 480, width: '100%', alignSelf: 'center' },
  tag: { color: RED, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '700', color: '#2b2118' },
  sub: { color: '#7a6a5a' },
  body: { fontSize: 16, lineHeight: 24, color: '#2b2118' },
  note: { fontSize: 12, color: '#9a8a7a' },
  button: { backgroundColor: RED, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  option: { borderWidth: 1.5, borderColor: '#e6dccd', borderRadius: 12, padding: 14, gap: 4 },
  optionOn: { borderColor: RED, backgroundColor: '#fdf0ee' },
  optionTitle: { fontSize: 16, fontWeight: '700', color: '#2b2118' },
  mission: { backgroundColor: BG, borderRadius: 12, padding: 14, gap: 4 },
  badge: { alignSelf: 'center', width: 140, height: 140, borderRadius: 70, backgroundColor: RED, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
});
