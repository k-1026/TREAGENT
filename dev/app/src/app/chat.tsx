/*
 * [chat.tsx] 하랑이와 대화하기 (주소: /chat) — 목업 storyboard/chat_harangi_mockup_v1.html
 *
 * 역할: 이용자가 궁금한 것을 물으면 하랑이가 답하는 채팅 화면의 "모양"만 만든다.
 *  - 기획 근거: plan/spec/treagent_tech_spec_v1.md F-14 (P1), D-09 (시연 범위 미정) — 목업 설명 기준 [확인 필요]
 *  - 지금은 서버·AI를 부르지 않는다. 답변은 목업의 자리표시 문장을 그대로 보여 준다 [승인 대기].
 *  - 질문 분류도 목업처럼 앱 안의 낱말 맞추기(classify)로 흉내만 낸다. 실제 분류는 나중에 서버가 한다.
 *  - 이용자가 쓴 글은 이 화면 안(메모리)에만 있고, 저장하거나 서버로 보내지 않는다.
 *
 * 배치: 머리글(‹ 뒤로 · 제목 · ⌂ 홈) → 안내 상자 → 대화 목록(스크롤) → 빠른 질문 3개 → 입력칸 + 보내기
 */
import { router } from 'expo-router';
import { ComponentRef, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CONTENT } from '../components/phone_column';
import { PixelSprite } from '../components/pixel_book';
import { ScreenHead } from '../components/screen_head';
import { COLOR } from '../lib/theme';

type QuestionKind = 'progress' | 'place' | 'weather' | 'unknown';
type Message = { id: number; who: 'me' | 'hara'; text: string; source?: string };

// 답변 자리표시 (목업 ANS). 실제 문장은 창작 후보 검토 후 팀이 정한다 [승인 대기]
const ANSWERS: Record<QuestionKind, { text: string; source: string }> = {
  progress: { text: '[진행 답변 · 승인 대기] [여행 이름] 중 [장소 수] 중 [진행 수] 완료 [임시 예시]', source: '내 진행 조회' },
  place: { text: '[장소 이야기 · 승인 대기] 이 장소에 대해 검수된 설명 한 줄이 들어갈 자리예요.', source: '검수된 장소 자료' },
  weather: { text: '[날씨 답변 · 승인 대기] 기준 시각과 함께 챙길 것을 알려 드릴게요.', source: '날씨 기준 시각 표기' },
  unknown: {
    text: '[확인 불가 안내 · 승인 대기] 그건 제가 확인할 수 없어요. 대신 오늘의 길이나 장소 이야기를 물어봐 주세요.',
    source: '근거 없음 · 추측 안 함',
  },
};

const CHIPS: { label: string; kind: QuestionKind }[] = [
  { label: '내 진행 어디까지?', kind: 'progress' },
  { label: '이 장소 이야기 들려줘', kind: 'place' },
  { label: '오늘 뭐 챙길까?', kind: 'weather' },
];

const GREETING = '[하랑이 인사 · 승인 대기] 무엇이 궁금한가요? 진행 상황, 장소 이야기, 오늘 챙길 것 중에서 골라 보세요.';

// 보내기 버튼의 흰 화살표 (목업의 > 모양을 칸으로 옮김)
const SEND_ARROW = ['KK.....', '.KK....', '..KK...', '...KK..', '..KK...', '.KK....', 'KK.....'];

// 목업용 낱말 맞추기. 실제 질문 분류는 서버에서 한다
function classify(text: string): QuestionKind {
  if (/진행|어디|남은/.test(text)) return 'progress';
  if (/장소|이야기|역사|건물|골목/.test(text)) return 'place';
  if (/날씨|챙|더워|비|우산|준비/.test(text)) return 'weather';
  return 'unknown';
}

const goHome = () => router.replace('/');

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([{ id: 0, who: 'hara', text: GREETING }]);
  const [input, setInput] = useState('');
  const nextId = useRef(1);
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);

  function ask(label: string, kind: QuestionKind) {
    setMessages((m) => [...m, { id: nextId.current++, who: 'me', text: label }]);
    // 목업처럼 잠깐 뒤에 답한다 (0.4초)
    setTimeout(() => {
      const a = ANSWERS[kind];
      setMessages((m) => [...m, { id: nextId.current++, who: 'hara', text: a.text, source: a.source }]);
    }, 400);
  }

  function send() {
    const t = input.trim();
    if (!t) return;
    setInput('');
    ask(t, classify(t));
  }

  return (
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHead
        title="하랑이와 대화하기"
        sub="궁금한 걸 물어보세요"
        backLabel="‹ 뒤로"
        onBack={() => (router.canGoBack() ? router.back() : goHome())}
        rightLabel="⌂ 홈"
        onRight={goHome}
      />

      <View style={[CONTENT, styles.column]}>
        <View style={styles.notice}>
          <Text style={styles.noticeText}>P1 기능 목업입니다. 시연 범위는 D-09 결정 전이라 모든 답변 문장은 [확인 필요] 자리표시입니다.</Text>
        </View>

        <ScrollView
          ref={listRef}
          style={styles.log}
          contentContainerStyle={styles.logInner}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) =>
            m.who === 'me' ? (
              <View key={m.id} style={[styles.msg, styles.msgMe]}>
                <View style={[styles.bubble, styles.bubbleMe]}>
                  <Text style={styles.bubbleText}>{m.text}</Text>
                </View>
              </View>
            ) : (
              <View key={m.id} style={styles.msg}>
                <Image source={require('../../assets/harangi_face_v1.png')} style={styles.avatar} resizeMode="cover" />
                <View style={styles.haraCol}>
                  <View style={[styles.bubble, styles.bubbleHara]}>
                    <Text style={styles.bubbleText}>{m.text}</Text>
                  </View>
                  {m.source ? <Text style={styles.source}>{`근거: ${m.source}`}</Text> : null}
                </View>
              </View>
            ),
          )}
        </ScrollView>

        <View style={styles.chips}>
          {CHIPS.map((c) => (
            <Pressable key={c.kind} onPress={() => ask(c.label, c.kind)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Text style={styles.chipText}>{c.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            placeholder="하랑이에게 물어보기"
            placeholderTextColor={COLOR.muted}
            maxLength={80}
            returnKeyType="send"
            accessibilityLabel="질문 입력"
            style={styles.input}
          />
          <Pressable onPress={send} accessibilityLabel="보내기" style={({ pressed }) => [styles.send, pressed && styles.pressed]}>
            <PixelSprite grid={SEND_ARROW} cell={3} tint="#fff" />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// 칸 모양 공통: 모서리 6, 잉크색 1.5px 테두리 (목업 border-radius:6px, box-shadow 0 0 0 1.5px)
const OUTLINE = { borderRadius: 6, borderWidth: 1.5, borderColor: COLOR.ink } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLOR.cream },
  column: { flex: 1 },
  pressed: { opacity: 0.85 },

  notice: { ...OUTLINE, marginTop: 10, marginHorizontal: 12, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#ffe1d6' },
  noticeText: { fontSize: 12, lineHeight: 17, color: COLOR.redDark },

  log: { flex: 1 },
  logInner: { paddingTop: 12, paddingHorizontal: 12, paddingBottom: 6, gap: 10 },
  msg: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgMe: { justifyContent: 'flex-end' },
  avatar: { ...OUTLINE, width: 36, height: 36, backgroundColor: COLOR.paper },
  haraCol: { flexShrink: 1, alignItems: 'flex-start' },
  bubble: { ...OUTLINE, maxWidth: 270, paddingVertical: 9, paddingHorizontal: 11 },
  bubbleHara: { backgroundColor: COLOR.paper },
  bubbleMe: { backgroundColor: '#ffe1d6' },
  bubbleText: { fontSize: 14, lineHeight: 21, color: COLOR.ink },
  source: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '800',
    color: COLOR.muted,
    backgroundColor: '#fff',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLOR.shade,
    overflow: 'hidden',
  },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: COLOR.cream2,
    borderTopWidth: 2,
    borderTopColor: COLOR.ink,
  },
  chip: { ...OUTLINE, backgroundColor: '#ffe1d6', paddingVertical: 7, paddingHorizontal: 10 },
  chipText: { fontSize: 13, fontWeight: '800', color: COLOR.ink },

  inputBar: { flexDirection: 'row', gap: 8, paddingTop: 10, paddingHorizontal: 12, paddingBottom: 14, backgroundColor: COLOR.cream },
  input: { ...OUTLINE, flex: 1, minWidth: 0, height: 46, paddingHorizontal: 12, fontSize: 15, color: COLOR.ink, backgroundColor: COLOR.paper },
  send: { ...OUTLINE, width: 46, height: 46, backgroundColor: COLOR.red, alignItems: 'center', justifyContent: 'center' },
});
