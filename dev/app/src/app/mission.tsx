/*
 * [mission.tsx] 미션 흐름 S-15~S-18 (주소: /mission) — 목업 storyboard/mission_flow_mockup_v1.html
 *
 * 한 화면 안에서 단계가 바뀐다: 미션 안내(g) → 영수증 인증(r) 또는 퀴즈(q) → 미션 완료(d)
 *  - 장소 종류(kind): receipt 식당·카페(영수증형), quiz 박물관·공원(퀴즈형). 정해지지 않으면 영수증형 [확인 필요: 장소 종류는 서버 자료]
 *  - 영수증 인증 실패가 3번 쌓이면 쉬운 퀴즈로 바꾼다. [영수증 없이 하기]는 기본 퀴즈로 간다.
 *
 * 판정은 앱이 하지 않는다 (dev 절대 규칙 3: 돈·점수·스탬프는 서버에서만)
 *  - 영수증 글자 인식과 상호명·날짜 확인은 서버 기능이 필요하다 [확인 필요]. 그래서 실제 앱에서는 [영수증 찍기]가 준비 중(/soon)으로 간다.
 *  - 개발 중(__DEV__)에만 ?result=ok|store|date|read|retake 로 검증 결과 화면을 미리 본다. 주소에 scr=g|r|q|d 도 붙이면 그 단계부터 시작한다.
 *  - 퀴즈 문제·정답은 출처 있는 사실 확인표가 정해져야 채운다 [확인 필요]. 지금은 목업 자리표시이고, 정답은 목업의 임시 값이다.
 *  - 미션 완료의 도장 그림은 보여 주기만 한다. 도장을 저장하지 않고 오늘 페이지 도장 수도 바꾸지 않는다.
 *  - 하랑이 대사는 승인 대기 자리표시 그대로 둔다 [창작, 승인 필요].
 */
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CONTENT } from '../components/phone_column';
import { ScreenHead } from '../components/screen_head';
import { LiveMission } from '../components/live_mission';
import { WxButton, WxCard, wxText } from '../components/weather_ui';
import { COLOR, pxBox } from '../lib/theme';

type Step = 'g' | 'r' | 'q' | 'd';
type Result = 'ok' | 'store' | 'date' | 'read' | 'retake';
type Quiz = { t: string; o: string[]; a: number; h: string };

const TITLE: Record<Step, string> = { g: '미션', r: '영수증 인증', q: '퀴즈', d: '미션 완료' };

// 영수증 검증 실패 안내 (목업)
const FAIL_MSG: Record<Exclude<Result, 'ok'>, string> = {
  store: '상호명이 맞지 않아요. 가게 이름이 보이게 다시 찍어요.',
  date: '날짜가 맞지 않아요. 방문한 날 영수증인지 확인해요.',
  read: '글자를 읽지 못했어요. 밝은 곳에서 다시 찍어요.',
  retake: '사진이 흐려요. 영수증이 화면에 들어오게 다시 찍어요.',
};

// 퀴즈 자리표시 (목업 Q_BASIC, Q_EASY). 정답은 확인표가 정해진 뒤 채운다
const Q_BASIC: Quiz[] = [
  { t: '[문제 1 자리]', o: ['[보기 A]', '[보기 B]', '[보기 C]'], a: 0, h: '[힌트 1 자리]' },
  { t: '[문제 2 자리]', o: ['[보기 A]', '[보기 B]', '[보기 C]'], a: 1, h: '[힌트 2 자리]' },
];
const Q_EASY: Quiz[] = [{ t: '[쉬운 문제 자리]', o: ['[보기 A]', '[보기 B]'], a: 0, h: '[힌트 자리]' }];

const STAMP = require('../../assets/stamp_nungeum.webp');
const isStep = (v: unknown): v is Step => v === 'g' || v === 'r' || v === 'q' || v === 'd';
const isResult = (v: unknown): v is Result => v === 'ok' || v === 'store' || v === 'date' || v === 'read' || v === 'retake';

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

function Hara({ text }: { text: string }) {
  return (
    <View style={styles.hara}>
      <Text style={styles.haraText}>
        <Text style={styles.haraName}>하랑이 </Text>
        {text}
      </Text>
    </View>
  );
}

function Frame({ children }: { children: string }) {
  return (
    <View style={styles.frame}>
      <Text style={styles.frameText}>{children}</Text>
    </View>
  );
}

// 작은 버튼 두 개를 나란히 놓을 때 쓰는 높이 52 버튼 (목업 .row2 .btn)
function Half({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.half, primary && styles.halfPrimary, pressed && { opacity: 0.85 }]}>
      <Text style={[styles.halfText, primary && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  );
}

export default function MissionScreen() {
  const params = useLocalSearchParams<{ kind?: string; result?: string; scr?: string; placeId?: string; placeName?: string }>();
  const live = typeof params.placeId === 'string' && params.placeId.length > 0; // 장소 id가 있으면 서버 미션 에이전트와 이어진 화면
  const kind = params.kind === 'quiz' ? 'quiz' : 'receipt';
  const preview = __DEV__;
  const previewResult: Result = preview && isResult(params.result) ? params.result : 'ok';
  const [step, setStep] = useState<Step>(preview && isStep(params.scr) ? params.scr : 'g');
  const [failN, setFailN] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [receiptMsg, setReceiptMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [easy, setEasy] = useState(false);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<{ i: number; right: boolean } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [stamp] = useState(() => new Animated.Value(0));

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  // 도장 그림: 미션 완료에 들어올 때마다 다시 찍힌다 (목업 slam)
  useEffect(() => {
    if (step !== 'd') return;
    stamp.setValue(0);
    Animated.timing(stamp, { toValue: 1, duration: 450, useNativeDriver: true }).start();
  }, [step, stamp]);

  const quizList = easy ? Q_EASY : Q_BASIC;
  const q = quizList[qi] ?? quizList[0];

  const flash = (text: string, ms = 1600) => {
    setToast(text);
    later(() => setToast(null), ms);
  };
  const startQuiz = (e: boolean) => {
    setEasy(e);
    setQi(0);
    setPicked(null);
    setHint(null);
    setStep('q');
  };

  const shoot = () => {
    // 영수증 글자 인식은 서버 기능이 필요하다. 개발 중 미리보기에서만 결과를 흉내 낸다.
    if (!preview) {
      router.push({ pathname: '/soon', params: { what: '영수증 인증' } });
      return;
    }
    setVerifying(true);
    setReceiptMsg(null);
    later(() => {
      setVerifying(false);
      if (previewResult === 'ok') {
        setReceiptMsg({ ok: true, text: '확인됐어요. 도장을 찍어 드릴게요.' });
        later(() => setStep('d'), 700);
        return;
      }
      const n = failN + 1;
      setFailN(n);
      setReceiptMsg({ ok: false, text: FAIL_MSG[previewResult] });
      if (n >= 3) {
        later(() => {
          flash('실패가 3번 쌓여서 쉬운 퀴즈로 바꿔 드릴게요');
          startQuiz(true);
        }, 900);
      }
    }, 700);
  };

  const choose = (i: number) => {
    if (picked?.right) return;
    if (i === q.a) {
      setPicked({ i, right: true });
      flash('맞았어요', 800);
      later(() => {
        if (qi + 1 >= quizList.length) setStep('d');
        else {
          setQi(qi + 1);
          setPicked(null);
          setHint(null);
        }
      }, 800);
    } else {
      setPicked({ i, right: false });
      setHint('아쉬워요. 힌트를 보고 다시 골라 봐요.');
    }
  };

  const back = () => {
    if (step === 'r' || step === 'q') setStep('g');
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={styles.safe}>
      <ScreenHead title={live ? '미션' : TITLE[step]} backLabel="‹ 뒤로" onBack={back} rightIcon={require('../../assets/tab_home.png')} onRight={() => router.replace('/')} />
      <ScrollView contentContainerStyle={[CONTENT, styles.scroll]}>
        {live ? <LiveMission placeId={params.placeId as string} placeName={params.placeName} /> : null}
        {!live && step === 'g' ? (
          <>
            <Frame>{'[장소 사진 자리]\n인증 지점 설명은 S-06과 같음'}</Frame>
            <Tag label={kind === 'receipt' ? '영수증형' : '퀴즈형'} />
            <WxCard>
              <Text style={wxText.big}>[장소 이름 자리]</Text>
              <Text style={wxText.small}>미션 종류와 내용을 확인하고 시작해요. 하랑이 대사는 승인 후 채워요.</Text>
            </WxCard>
            <Hara text="[승인 대사 대기 · S-15]" />
            <WxButton label="미션 시작" primary onPress={() => (kind === 'receipt' ? setStep('r') : startQuiz(false))} />
            <View style={styles.row2}>
              <Half label="미션 내용 보기" onPress={() => router.push({ pathname: '/soon', params: { what: '미션 내용 보기' } })} />
              <Half
                label="나중에 하기"
                onPress={() => {
                  flash('지도로 돌아가요. 여행 지도에 "미션 대기"가 표시돼요.', 900);
                  later(() => router.replace('/travel'), 900);
                }}
              />
            </View>
          </>
        ) : null}

        {!live && step === 'r' ? (
          <>
            <View style={[styles.banner, { backgroundColor: '#e6e1da' }]}>
              <Text style={[styles.bannerText, { color: COLOR.ink }]}>카드 번호와 금액은 가리면 더 좋아요. 가리지 않아도 인증할 수 있어요.</Text>
            </View>
            <Frame>{'[영수증 사진 자리]\n카메라로 찍거나 갤러리에서 고를 수 있어요'}</Frame>
            {receiptMsg ? (
              <View style={[styles.banner, { backgroundColor: receiptMsg.ok ? '#e4ecd9' : '#ffe1d6' }]}>
                <Text style={[styles.bannerText, { color: receiptMsg.ok ? '#2e4a1f' : COLOR.redDark }]}>{receiptMsg.text}</Text>
              </View>
            ) : null}
            {verifying ? (
              <WxCard>
                <Text style={wxText.big}>검증 중…</Text>
                <Text style={wxText.small}>상호명과 날짜를 확인하고 있어요.</Text>
              </WxCard>
            ) : null}
            <View style={styles.row2}>
              <Half label="영수증 찍기" primary onPress={shoot} />
              <Half label="갤러리에서 고르기" onPress={shoot} />
            </View>
            <WxButton label="영수증 없이 하기" onPress={() => startQuiz(false)} />
            <Text style={styles.foot}>{`실패 ${failN}번. 3번 실패하면 쉬운 퀴즈로 바꿔요.`}</Text>
          </>
        ) : null}

        {!live && step === 'q' ? (
          <>
            <Tag label={easy ? '쉬움' : '기본'} />
            <WxCard>
              <Text style={wxText.big}>{q.t}</Text>
              <Text style={wxText.small}>출처 있는 사실 확인표에서 만든 문제만 넣어요 [확인 필요]</Text>
            </WxCard>
            <View style={{ gap: 10 }}>
              {q.o.map((o, i) => {
                const mine = picked?.i === i;
                return (
                  <Pressable
                    key={o}
                    onPress={() => choose(i)}
                    style={[styles.opt, mine && (picked?.right ? styles.optRight : styles.optWrong)]}
                  >
                    <Text style={styles.optText}>{o}</Text>
                  </Pressable>
                );
              })}
            </View>
            {hint ? (
              <View style={[styles.banner, { backgroundColor: picked && !picked.right && hint.startsWith('아쉬') ? '#ffe1d6' : '#e6e1da' }]}>
                <Text style={[styles.bannerText, { color: hint.startsWith('아쉬') ? COLOR.redDark : COLOR.ink }]}>{hint}</Text>
              </View>
            ) : null}
            {/* 목업처럼 힌트 버튼은 늘 보이고, 오답일 때 [다시 풀기]가 더해진다 */}
            <WxButton label="힌트 보기" onPress={() => setHint(`힌트: ${q.h}`)} />
            {picked && !picked.right ? (
              <WxButton
                label="다시 풀기"
                onPress={() => {
                  setPicked(null);
                  setHint(null);
                }}
              />
            ) : null}
            <Text style={styles.foot}>{`${qi + 1} / ${quizList.length} 문제`}</Text>
          </>
        ) : null}

        {!live && step === 'd' ? (
          <>
            <Animated.View
              style={[
                styles.stamp,
                { opacity: stamp, transform: [{ scale: stamp.interpolate({ inputRange: [0, 1], outputRange: [1.6, 1] }) }] },
              ]}
            >
              <Image source={STAMP} style={styles.stampImg} resizeMode="contain" />
            </Animated.View>
            <WxCard>
              <Text style={[wxText.big, { textAlign: 'center' }]}>도장을 받았어요</Text>
              <Text style={[wxText.small, { textAlign: 'center' }]}>스탬프 문양은 모든 장소가 같아요.</Text>
            </WxCard>
            <Hara text="[승인 대사 대기 · S-18]" />
            <View style={styles.row2}>
              <Half label="오늘 페이지 보기" primary onPress={() => router.replace('/today_page')} />
              <Half label="홈으로" onPress={() => router.replace('/')} />
            </View>
            <Text style={styles.foot}>[확인 필요] 도장 저장은 서버 기능이 생기면 연결해요. 지금은 그림만 보여 줘요.</Text>
          </>
        ) : null}
      </ScrollView>

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  scroll: { paddingTop: 16, paddingHorizontal: 18, paddingBottom: 28, gap: 14 },

  frame: { height: 200, ...pxBox(COLOR.cream2), alignItems: 'center', justifyContent: 'center', padding: 10 },
  frameText: { fontSize: 14, lineHeight: 21, color: COLOR.muted, textAlign: 'center' },
  tag: { alignSelf: 'flex-start', ...pxBox(COLOR.cream2), paddingVertical: 4, paddingHorizontal: 10 },
  tagText: { fontSize: 13, fontWeight: '800', color: COLOR.ink },
  hara: { ...pxBox(COLOR.paper), paddingVertical: 12, paddingHorizontal: 14 },
  haraText: { fontSize: 15, lineHeight: 22, color: COLOR.ink },
  haraName: { fontWeight: '800', color: COLOR.beam },
  banner: { paddingVertical: 14, paddingHorizontal: 16, ...pxBox() },
  bannerText: { fontSize: 16, lineHeight: 24, fontWeight: '700' },

  row2: { flexDirection: 'row', gap: 12 },
  half: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR.paper, borderRadius: 6, borderWidth: 1.5, borderColor: COLOR.ink },
  halfPrimary: { backgroundColor: COLOR.red },
  halfText: { fontSize: 16, fontWeight: '800', color: COLOR.ink },
  foot: { fontSize: 13, lineHeight: 20, color: COLOR.muted },

  // 퀴즈 보기 (목업 .opt)
  opt: { minHeight: 52, justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 14, ...pxBox(COLOR.paper) },
  optRight: { backgroundColor: '#e4ecd9' },
  optWrong: { backgroundColor: '#ffe1d6' },
  optText: { fontSize: 16, fontWeight: '700', color: COLOR.ink },

  // 도장 (목업 .stamp 160px)
  stamp: { width: 160, height: 160, alignSelf: 'center', marginTop: 12 },
  stampImg: { width: '100%', height: '100%' },

  toast: { position: 'absolute', left: 24, right: 24, bottom: 24, backgroundColor: COLOR.ink, paddingVertical: 12, paddingHorizontal: 14 },
  toastText: { color: '#fff8ea', fontSize: 15, textAlign: 'center' },
});
