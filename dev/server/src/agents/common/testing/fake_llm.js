// 테스트용 가짜 LLM. 정해 둔 답을 차례로 돌려준다 (마지막 답은 반복).
//   LLM 함수의 약속: async (input, { signal }) => ({ value, usage })
//     usage: { inputTokens, outputTokens, totalTokens } 또는 null (토큰 수를 모르면 null, 0이 아니다)
//   replies의 각 항목: 값 → { value: 값, usage: null } / reply(값, usage) → 토큰 수까지 / Error → 던짐 / 'hang' → 영원히 대기
//   .calls: 호출마다 { input, signal }을 남긴다.
class FakeReply {
  constructor(value, usage) {
    this.value = value;
    this.usage = usage;
  }
}

export const reply = (value, usage = null) => new FakeReply(value, usage);

export function createFakeLlm(replies) {
  const calls = [];
  const fn = async (input, { signal } = {}) => {
    calls.push({ input, signal });
    const r = replies[Math.min(calls.length - 1, replies.length - 1)];
    if (r === 'hang') return new Promise(() => {});
    if (r instanceof Error) throw r;
    return r instanceof FakeReply ? { value: r.value, usage: r.usage } : { value: r, usage: null };
  };
  fn.calls = calls;
  return fn;
}
