/*
 * [chat.tsx] 하랑이와 대화하기 (주소: /chat) — 목업 storyboard/chat_harangi_mockup_v1.html
 *
 * 이용자가 묻고 하랑이가 답한다. 답은 서버 에이전트(POST /agents/chat)가 만든다.
 *  - 서버 흐름: 안전 점검(코드) → 분류(LLM) → 근거 조회 → 답변 작성(LLM) → 답변 검증(코드). 실패하면 고정 문장이 온다.
 *  - 근거가 없는 질문에는 "그건 잘 모르겠어요"가 온다 (지어내지 않음). 근거 표시는 서버가 알려 준 종류(kind)로 붙인다.
 *  - 이용자가 쓴 글은 이 화면 안(메모리)에만 있고, 서버는 답을 만든 뒤 질문을 저장하지 않는다 (실행 기록에는 요약만).
 *  - ?placeId=장소id 로 열면 그 장소에 대한 질문에 근거를 붙여 답한다.
 *
 * 배치: 머리글(‹ 뒤로 · 제목 · ⌂ 홈) → 안내 상자 → 대화 목록(스크롤) → 빠른 질문 3개 → 입력칸 + 보내기
 */
import { router, useLocalSearchParams } from 'expo-router';
import { ComponentRef, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CONTENT } from '../components/phone_column';
import { PixelSprite } from '../components/pixel_book';
import { ScreenHead } from '../components/screen_head';
import { COLOR } from '../lib/theme';
import { askHarangi } from '../lib/agents_api';

type Message = { id: number; who: 'me' | 'hara'; text: string; source?: string };

// 서버가 알려 준 답의 종류를 이용자에게 보이는 근거 문구로 바꾼다.
const SOURCE: Record<string, string> = { answer: '장소 자료와 게임 규칙', unknown: '근거 없음 · 추측 안 함', safety: '안전 안내', fixed: '준비된 문장', empty: '' };
// 서버에 닿지 못했을 때의 고정 문장 (창작 임시값, 팀 확정 전)
const OFFLINE = '앗, 지금은 대답하기 어려워요. 잠시 뒤에 다시 물어봐 주세요!';

const CHIPS = ['이 장소 이야기 들려줘', '오늘 뭐 챙길까?', '스탬프는 어떻게 받아요?'];

const GREETING = '무엇이 궁금한가요? 장소 이야기, 오늘 챙길 것, 게임 규칙을 물어보세요.';

// 보내기 버튼의 흰 화살표 (목업의 > 모양을 칸으로 옮김)
const SEND_ARROW = ['KK.....', '.KK....', '..KK...', '...KK..', '..KK...', '.KK....', 'KK.....'];

const goHome = () => router.replace('/');

export default function ChatScreen() {
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ id: 0, who: 'hara', text: GREETING }]);
  const [input, setInput] = useState('');
  const nextId = useRef(1);
  const listRef = useRef<ComponentRef<typeof ScrollView>>(null);

  async function ask(text: string) {
    if (busy) return;
    setMessages((m) => [...m, { id: nextId.current++, who: 'me', text }]);
    setBusy(true);
    const r = await askHarangi(text, typeof placeId === 'string' ? [placeId] : undefined);
    setBusy(false);
    const reply = r.ok ? r.data.reply : OFFLINE;
    const source = r.ok ? SOURCE[r.data.kind] : undefined;
    setMessages((m) => [...m, { id: nextId.current++, who: 'hara', text: reply, ...(source ? { source } : {}) }]);
  }

  function send() {
    const t = input.trim();
    if (!t) return;
    setInput('');
    void ask(t);
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
            <Pressable key={c} onPress={() => void ask(c)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Text style={styles.chipText}>{c}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            onSubmitEditing={send}
            placeholder={busy ? '하랑이가 생각 중이에요…' : '하랑이에게 물어보기'}
            placeholderTextColor={COLOR.muted}
            maxLength={200}
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
    fontSize: 12,
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
