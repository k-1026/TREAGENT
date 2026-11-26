import { randomUUID } from 'node:crypto';
import { RECORD_MAX_CHARS, RECORD_PROMPT_MAX_CHARS } from './config.js';
import { sanitize } from './sanitize.js';

// 기록기: 모든 노드의 결과·판정을 실행 기록에 추가만 한다 (insert-only). 쓰는 시점은 세 번이다.
//   run_start → 실행이 시작될 때 한 줄
//   step      → 노드 결과가 나올 때마다 한 줄 (시작 시각·소요 시간·입력 요약·프롬프트·출력·판정·토큰이 모두 들어간다)
//   run_end   → 실행이 끝날 때 한 줄 (정상·대체·폴백)
//   "지금 도는 노드"는 DB에 없다. 관리자 화면이 마지막으로 끝난 노드의 결과와 구조도 화살표로 계산한다.
//   store.append(event): 이벤트 한 건을 저장한다.
//   onRecordError: 'ignore'(기본) 저장이 실패해도 요청을 막지 않고 failures만 센다 / 'throw' flush()에서 첫 실패를 던진다.
//     [결정 필요] 기록 실패 시 요청을 막을지는 팀이 정한다.
// 주의: 요청을 처리하는 코드에서 finish()나 flush()를 await하지 않는다. 밀린 쓰기가 끝날 때까지 이용자 응답이 늦어진다.
//   기다리는 곳은 테스트와 서버 종료뿐이다.
const KINDS = ['llm', 'code', 'human'];
const OUTCOMES = ['normal', 'substitute', 'fallback'];

// DB의 check 제약(0 이상)에 걸리면 줄 전체가 저장되지 않으므로, 잘못된 숫자는 null로 바꾼다.
const count = (n) => (Number.isInteger(n) && n >= 0 ? n : null);

export function createRecorder({
  store,
  now = Date.now,
  newId = randomUUID,
  maxChars = RECORD_MAX_CHARS,
  promptMaxChars = RECORD_PROMPT_MAX_CHARS,
  onRecordError = 'ignore',
}) {
  const iso = (ms) => new Date(ms).toISOString();
  const clean = (v) => sanitize(v, { maxChars });
  const cleanPrompt = (v) => sanitize(v, { maxChars: promptMaxChars }); // 프롬프트는 요약보다 길게 남긴다
  const recorder = { failures: 0 };

  // actorKey: 이용자를 가리키는 해시 키 (actor_key.js). 원본 계정 id는 이 함수에 들어오지 않는다. 없으면 null.
  recorder.startRun = ({ agent, actorKey = null }) => {
    const id = newId();
    let seq = 0;
    let ended = false;
    let firstError = null;
    let line = Promise.resolve(); // 쓰기 순서를 지키는 줄. 앞의 쓰기가 끝나야 다음 쓰기를 한다.

    // 이벤트를 줄 끝에 붙인다. DB를 기다리지 않는다 (에이전트가 기록 때문에 느려지지 않게).
    const write = (event) => {
      line = line
        .then(() => store.append(event))
        .catch((err) => {
          recorder.failures += 1;
          firstError ??= err;
        });
    };

    // 줄에 쌓인 쓰기가 모두 끝날 때까지 기다린다. 테스트와 서버 종료 때 쓴다.
    const flush = async () => {
      await line;
      if (onRecordError === 'throw' && firstError) throw firstError;
    };

    write({ type: 'run_start', runId: id, agent, actorKey, startedAt: iso(now()) });

    return {
      id,
      flush,
      // meta: { node, kind, attempt = 1, summary, prompt, toRecord }
      //   prompt: LLM에 보낸 프롬프트 { system, user } (LLM 단계만). 개인정보를 거른 뒤 저장한다. 실패한 단계에도 남는다.
      //   toRecord(value) → { verdict, reasonCode, output, llmCalls, model, promptVersion,
      //                       inputTokens, outputTokens, totalTokens } (선택)
      async step(meta, fn) {
        if (!KINDS.includes(meta.kind)) throw new TypeError(`kind는 ${KINDS.join('|')} 중 하나여야 한다`);
        if (ended) return fn(); // 끝난 실행에는 더 쓰지 않는다
        seq += 1; // 순서 번호는 시작할 때 매긴다 (동시에 도는 단계도 서로 다른 번호)
        const mySeq = seq;
        // startedAtMs·durationMs: 이미 끝난 단계를 나중에 옮겨 적을 때만 쓴다 (미션이 종류를 고른 뒤 앞 단계를 기록할 때).
        const startMs = Number.isFinite(meta.startedAtMs) ? meta.startedAtMs : now();
        const inputSummary = clean(meta.summary ?? null);
        const prompt = cleanPrompt(meta.prompt ?? null);

        // 결과가 나온 뒤에 한 줄만 쓴다.
        const record = (extra) =>
          write({
            type: 'step',
            runId: id,
            seq: mySeq,
            node: meta.node,
            kind: meta.kind,
            attempt: meta.attempt ?? 1,
            startedAt: iso(startMs),
            durationMs: Number.isFinite(meta.durationMs) ? Math.max(0, meta.durationMs) : Math.max(0, now() - startMs),
            inputSummary,
            prompt,
            model: null,
            promptVersion: null,
            output: null,
            reasonCode: null,
            llmCalls: null,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            ...extra,
          });
        try {
          const value = await fn();
          let rec = {};
          try {
            rec = meta.toRecord ? (meta.toRecord(value) ?? {}) : {};
          } catch {
            rec = {}; // 기록용 변환이 실패해도 본 작업 결과는 그대로 쓴다
          }
          record({
            verdict: rec.verdict ?? 'pass',
            reasonCode: rec.reasonCode ?? null,
            output: clean(rec.output ?? null),
            llmCalls: count(rec.llmCalls),
            model: rec.model ?? null,
            promptVersion: rec.promptVersion ?? null,
            inputTokens: count(rec.inputTokens),
            outputTokens: count(rec.outputTokens),
            totalTokens: count(rec.totalTokens),
          });
          return value;
        } catch (err) {
          // 에러 메시지는 저장하지 않는다. 코드만 남긴다.
          record({ verdict: 'error', reasonCode: typeof err?.code === 'string' ? err.code : 'ERROR' });
          throw err;
        }
      },
      // 실행을 끝낸다. 두 번 불러도 run_end는 한 번만 쓴다. 반환값(Promise)을 요청 처리에서 기다리지 않는다.
      finish({ outcome, fallbackReason = null }) {
        if (!OUTCOMES.includes(outcome)) throw new TypeError(`outcome은 ${OUTCOMES.join('|')} 중 하나여야 한다`);
        if (!ended) {
          ended = true;
          write({
            type: 'run_end',
            runId: id,
            endedAt: iso(now()),
            outcome,
            fallbackReason: fallbackReason == null ? null : clean(String(fallbackReason)),
          });
        }
        return flush();
      },
    };
  };

  return recorder;
}
