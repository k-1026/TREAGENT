/*
 * [cutscene.tsx] 고정 컷씬 재생 (주소: /cutscene?cut=c1|c2&mode=first|replay) — 목업 storyboard/cutscene_mockup_v1.html (S-19 앨범 연결)
 *
 * 보이는 것: 어두운 바탕에 일러스트 자리 → 아래 말풍선 상자(탭하면 다음 줄) → 끝나면 "앨범에 넣어 둘게요" 화면
 *  - 컷씬 ①: 두 번째 여행 중반에 처음 재생 (게임 흐름 9-1절 결정), 컷씬 ②: 첫 완주 때 [재생 시점은 팀 결정 전]
 *  - [건너뛰기]를 눌러도 끝 화면으로 간다. 건너뛰어도 앨범에는 담긴다 (목업).
 *  - mode=replay는 앨범에서 다시 보는 길: 끝 문구만 다르다.
 *
 * 아직 연결하지 않은 것
 *  - 일러스트: 목업의 [일러스트 자리] 그대로
 *  - 해금 저장: 계정 기준 해금은 서버 기능이 필요하다 [확인 필요]. 이 화면은 저장하지 않는다 (dev 절대 규칙 3).
 *  - 대사: 창작 후보 초안이다 (컷씬 ①은 게임 흐름 6-6 예문, 컷씬 ②는 9-1절 초안). 확정은 팀이 한다 [창작, 승인 필요].
 *  - 첫 완주 때 컷씬 ②: 여행 지도의 [완주 한 장 보기]에서 한 번 안내한다 (travel.tsx CutSheet, 목업 travel_map_mockup_v1 #cut).
 *    이때는 done·title·names·ids를 함께 받아, 끝 화면에서 [완주 한 장 보기]로 완주 카드(/trip_card?done=1)를 연다.
 *    재생 시점은 팀 결정 전이라 목업대로 연결했다 [확인 필요].
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { COLOR } from '../lib/theme';

type CutKey = 'c1' | 'c2';
const CUTS: Record<CutKey, { tag: string; art: string; lines: string[] }> = {
  c1: {
    tag: '컷씬 ① · 두 번째 여행 중반',
    art: '[컷씬 ① 일러스트 자리 · 그늘 있는 쉼터 한 컷]',
    lines: ['후아, 여기 그늘 좋죠?', '...사실 저, 견습생이 되기 전에 서두르다 한참 앉아 있어야 했거든요.', '아, 아니에요, 그 얘기는 나중에요!'],
  },
  c2: {
    tag: '컷씬 ② · 가게 앞 그늘',
    art: '[컷씬 ② 일러스트 자리 · 가게 앞 그늘, 의자와 물 한 컵]',
    lines: [
      '그때 저, 서두르다 더는 못 걷겠어서 가게 앞 그늘에 털썩 앉았어요.',
      '그런데 거기에 의자랑 물 한 컵이 놓여 있었어요. 아무도 저를 못 봤을 텐데, 누가 쉬어 가라고 내놓은 것 같았죠.',
      '옆에는 납작만두가 천 주머니에 싸여 있었고요. 그 주머니가 지금 제 포쉐트예요, 헤헤.',
      '그날 생각했어요. 나도 누군가를 쉬게 해 주는 도사가 되고 싶다고!',
    ],
  },
};

const goLedger = () => router.replace({ pathname: '/ledger', params: { tab: 'album' } });

// 다시 보기 끝의 하랑이 한마디: 창작 후보 2개 중 무작위 (목업 #244, 확정 전 [확인 필요])
const REPLAY_LINES = ['다시 봐도 좀 쑥스럽네요!', '기억하러 와 줘서 고마워요, 헤헤.'];

export default function CutsceneScreen() {
  const params = useLocalSearchParams<{ cut?: string; mode?: string; done?: string; title?: string; names?: string; ids?: string }>();
  // 여행 지도의 첫 완주에서 왔으면 끝난 뒤 완주 카드로 이어 준다
  const fromDone = params.done === '1';
  const openDone = () =>
    router.replace({ pathname: '/trip_card', params: { done: '1', title: params.title ?? '', names: params.names ?? '', ids: params.ids ?? '' } });
  const cutKey: CutKey = params.cut === 'c2' ? 'c2' : 'c1';
  const replay = params.mode === 'replay';
  const cut = CUTS[cutKey];
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  // 화면을 열 때 한 번만 고른다 (다시 그려질 때마다 바뀌지 않게)
  const [replayLine] = useState(() => REPLAY_LINES[Math.floor(Math.random() * REPLAY_LINES.length)]);

  const next = () => {
    if (idx < cut.lines.length - 1) setIdx(idx + 1);
    else setDone(true);
  };

  return (
    <View style={styles.safe}>
      {/* 일러스트 자리 (목업 .art) */}
      <View style={styles.art}>
        <View style={styles.artBox}>
          <Text style={styles.artText}>{cut.art}</Text>
        </View>
      </View>

      {!done ? (
        <>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{cut.tag}</Text>
          </View>
          <Pressable onPress={() => setDone(true)} style={styles.skip}>
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>

          <View style={styles.bottom}>
            <Pressable onPress={next} style={styles.talk} accessibilityLabel="탭하여 넘기기">
              <Text style={styles.who}>하랑이 [창작 후보 · 승인 대기]</Text>
              <Text style={styles.line}>{cut.lines[idx]}</Text>
              <Text style={styles.more}>{idx < cut.lines.length - 1 ? '탭하여 넘기기 ▸' : '탭하여 끝내기 ▸'}</Text>
            </Pressable>
            <View style={styles.dots}>
              {cut.lines.map((_, i) => (
                <View key={i} style={[styles.dot, i === idx && { backgroundColor: COLOR.red }]} />
              ))}
            </View>
          </View>
        </>
      ) : (
        <View style={styles.end}>
          <View style={styles.card}>
            <Text style={styles.endTitle}>{replay ? '그날 장면을 다시 봤어요' : '이 이야기, 앨범에 넣어 둘게요!'}</Text>
            <Text style={styles.endSub}>
              {replay ? '앨범에서 다시 본 컷씬이에요.' :'장부의 [앨범] 책갈피에 담겨요. 건너뛰었어도 담겨요.'}
            </Text>
          </View>
          <View style={styles.hara}>
            <Text style={styles.haraText}>
              <Text style={styles.haraName}>하랑이 </Text>
              {replay ? replayLine : '앞으로도 많은 길을 함께 걸어요!'}
            </Text>
          </View>
          {!replay ? <Text style={styles.note}>[확인 필요] 해금을 저장하는 건 서버 기능이 생기면 연결해요. 지금은 저장하지 않아요.</Text> : null}
          <View style={styles.row2}>
            {fromDone ? (
              <>
                <Pressable onPress={openDone} style={[styles.btn, styles.primary]}>
                  <Text style={[styles.btnText, { color: '#fff' }]}>완주 한 장 보기</Text>
                </Pressable>
                <Pressable onPress={goLedger} style={styles.btn}>
                  <Text style={styles.btnText}>앨범에서 보기</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={goLedger} style={[styles.btn, styles.primary]}>
                  <Text style={[styles.btnText, { color: '#fff' }]}>앨범에서 보기</Text>
                </Pressable>
                <Pressable onPress={() => (router.canGoBack() ? router.back() : goLedger())} style={styles.btn}>
                  <Text style={styles.btnText}>닫기</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#2b1a16' },
  art: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#46281f', alignItems: 'center', justifyContent: 'center', padding: 24 },
  artBox: { borderWidth: 2, borderColor: '#d9bf98', borderStyle: 'dashed', paddingVertical: 18, paddingHorizontal: 16, backgroundColor: 'rgba(43,26,34,0.55)' },
  artText: { color: '#f3dfc0', fontSize: 14, lineHeight: 22, textAlign: 'center' },

  tag: { position: 'absolute', top: 52, left: 14, zIndex: 5, backgroundColor: COLOR.cream, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 4, paddingHorizontal: 10 },
  tagText: { fontSize: 13, fontWeight: '800', color: COLOR.ink },
  skip: { position: 'absolute', top: 52, right: 14, zIndex: 5, backgroundColor: COLOR.cream, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 6, paddingHorizontal: 12 },
  skipText: { fontSize: 14, fontWeight: '800', color: COLOR.ink },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 4 },
  talk: { marginHorizontal: 14, marginBottom: 46, backgroundColor: COLOR.paper, borderWidth: 3, borderColor: COLOR.ink, paddingVertical: 16, paddingHorizontal: 18, minHeight: 150 },
  who: { fontSize: 14, fontWeight: '800', color: COLOR.beam, marginBottom: 6 },
  line: { fontSize: 17, lineHeight: 29, color: COLOR.ink },
  more: { position: 'absolute', right: 12, bottom: 8, fontSize: 13, color: COLOR.muted },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 20, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, backgroundColor: COLOR.shade, borderWidth: 1, borderColor: COLOR.ink },

  end: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: COLOR.cream, justifyContent: 'center', gap: 16, paddingHorizontal: 24, zIndex: 6 },
  card: { backgroundColor: COLOR.paper, borderWidth: 2, borderColor: COLOR.ink, padding: 18, alignItems: 'center', gap: 6 },
  endTitle: { fontSize: 17, lineHeight: 24, fontWeight: '800', color: COLOR.ink, textAlign: 'center' },
  endSub: { fontSize: 14, lineHeight: 21, color: COLOR.muted, textAlign: 'center' },
  hara: { backgroundColor: COLOR.paper, borderWidth: 2, borderColor: COLOR.ink, paddingVertical: 12, paddingHorizontal: 14 },
  haraText: { fontSize: 15, lineHeight: 24, color: COLOR.ink },
  haraName: { fontWeight: '800', color: COLOR.beam },
  note: { fontSize: 13, lineHeight: 20, color: COLOR.muted },
  row2: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.paper, borderRadius: 6, borderWidth: 1.5, borderColor: COLOR.ink },
  primary: { backgroundColor: COLOR.red },
  btnText: { fontSize: 16, fontWeight: '800', color: COLOR.ink },
});
