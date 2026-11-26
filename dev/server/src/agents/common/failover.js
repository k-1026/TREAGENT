// AI 키·모델 전환 풀: 키 여러 개와 모델 여러 개를 짝지어 두고, 호출이 실패하면 다음 짝으로 넘어간다.
// 쿼터 초과(429), 인증 오류, 모델 과부하(5xx), 네트워크 오류 등 어떤 이유로든 한 짝이 실패하면 그 짝을 잠시 쉬게 하고(cooldown) 다음 짝으로 다시 부른다.
// 환경 변수 (서버 .env와 Railway Variables에만 둔다. 쉼표로 여러 개):
//   GOOGLE_API_KEYS=키1,키2      (하나뿐이면 예전 이름 GOOGLE_API_KEY도 된다)
//   GEMINI_MODELS=모델1,모델2    (하나뿐이면 GEMINI_MODEL도 된다)
//   짝 순서: 키 순서대로, 각 키 안에서 모델 순서대로. 앞 짝이 살아 있으면 항상 앞 짝을 쓴다.
// 키 값은 상태 화면·로그·실행 기록에 절대 내보내지 않는다. 이름은 "키 #번호"로만 보인다.
// 모델 이름은 API 이름(gemini-3.1-flash-lite)이어야 한다. 화면 이름("Gemini 3.1 Flash Lite")으로 적었어도 소문자와 하이픈으로 바꿔 읽는다.
export const normalizeModel = (m) => String(m).trim().toLowerCase().replace(/\s+/g, '-');
const split = (v) => String(v ?? '').split(',').map((x) => x.trim()).filter(Boolean);

export function readEntries(env = process.env) {
  const keys = split(env.GOOGLE_API_KEYS ?? env.GOOGLE_API_KEY);
  const models = split(env.GEMINI_MODELS ?? env.GEMINI_MODEL).map(normalizeModel);
  const entries = [];
  keys.forEach((apiKey, ki) => models.forEach((model) => entries.push({ apiKey, model, keyNo: ki + 1 })));
  return entries;
}

export function createFailoverPool({ entries, cooldownMs = 60_000, now = Date.now }) {
  const state = entries.map(() => ({ until: 0, failures: 0, successes: 0, lastCode: null, lastMessage: null }));
  const label = (i) => `키 #${entries[i].keyNo} / ${entries[i].model}`;
  let lastUsed = 0;

  const errorCode = (err) => (typeof err?.status === 'number' ? `HTTP_${err.status}` : typeof err?.code === 'string' ? err.code : 'ERROR');

  return {
    size: entries.length,
    currentModel: () => entries[lastUsed]?.model ?? null,
    // fn(entry, index)를 앞 짝부터 시도한다. 쉬는 중인 짝은 건너뛰되, 전부 쉬는 중이면 쉬는 순서대로 모두 시도한다.
    async run(fn, { signal } = {}) {
      if (entries.length === 0) throw Object.assign(new Error('NO_AI_KEY'), { code: 'NO_AI_KEY' });
      const t = now();
      const live = entries.map((_, i) => i).filter((i) => state[i].until <= t);
      const order = live.length > 0 ? live : entries.map((_, i) => i).sort((a, b) => state[a].until - state[b].until);
      let lastErr;
      for (const i of order) {
        if (signal?.aborted) break;
        try {
          const out = await fn(entries[i], i);
          state[i].successes += 1;
          lastUsed = i;
          return out;
        } catch (err) {
          lastErr = err;
          state[i].failures += 1;
          state[i].lastCode = errorCode(err);
          // 진단용 짧은 문구. 키처럼 보이는 글자는 가리고, 길이를 줄인다 (관리자 화면에서만 보인다).
          state[i].lastMessage = String(err?.message ?? '').replace(/AIza[\w-]+/g, '[KEY]').replace(/\s+/g, ' ').slice(0, 200);
          state[i].until = now() + cooldownMs;
        }
      }
      throw lastErr ?? Object.assign(new Error('ABORTED'), { code: 'ABORTED' });
    },
    // 관리자 화면용 상태 (키 값은 없다)
    status() {
      const t = now();
      return entries.map((e, i) => ({
        label: label(i),
        model: e.model,
        keyNo: e.keyNo,
        state: state[i].until > t ? 'cooling' : 'ready',
        coolingMs: Math.max(0, state[i].until - t),
        failures: state[i].failures,
        successes: state[i].successes,
        lastCode: state[i].lastCode,
        lastMessage: state[i].lastMessage,
        inUse: i === lastUsed,
      }));
    },
    // 쉬는 중인 짝을 바로 풀어 준다 (관리자가 키를 바꾼 뒤 확인할 때)
    reset() {
      for (const s of state) s.until = 0;
    },
  };
}

export const createPoolFromEnv = (env = process.env, opts = {}) => {
  const entries = readEntries(env);
  return entries.length > 0 ? createFailoverPool({ entries, ...opts }) : null;
};
