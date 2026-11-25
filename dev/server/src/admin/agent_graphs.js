// 에이전트 구조도 데이터. 관리자 화면이 이 데이터로 카드(구조도)를 그린다.
// 구조는 plan/spec/agent_architecture_v2.md 1장·4장, 되돌이는 plan/spec/course_agent_design_v1.md 4-2장 표를 따른다.
//   nodes: { id, label, kind, note?, optional? }   kind: 'llm' | 'code' | 'human'
//          optional: 흐름에 들어가지 않고 요청할 때만 도는 도움말 노드 (점선으로 그린다)
//   edges: { from, to }          통과했을 때 다음 노드
//   loops: { from, to, on, label, exhaustTo }
//          from 노드가 실패하면 to 노드로 되돌아간다. 시도 횟수를 다 쓰면 exhaustTo로 간다 (상한 숫자는 설정에서 읽는다).
//   group: 같은 묶음으로 보여 줄 이름 (미션 3종)
// 주의: 실행 기록의 node 이름은 여기의 노드 id와 같아야 한다 (시나리오 테스트가 검사한다).

const n = (id, label, kind, extra = {}) => ({ id, label, kind, ...extra });
const chain = (...ids) => ids.slice(1).map((to, i) => ({ from: ids[i], to }));
const loop = (from, to, label, exhaustTo) => ({ from, to, on: 'fail', label, exhaustTo });

// 미션은 앞부분(도착 확인 ~ 종류 고르기)이 같고, 종류를 고른 뒤 퀴즈·인증샷·영수증 에이전트로 갈라진다 (4-2장).
// 종류마다 제출 점검과 판정의 내용, 도움말(힌트 / 다시 보기)이 다르다.
function mission(title, { submitNote, judgeNote, help }) {
  return {
    title,
    group: '미션',
    nodes: [
      n('arrive', '도착 확인', 'code', { note: '서버가 GPS 반경 안인지 계산' }),
      n('explain', '장소 설명', 'llm'),
      n('explain_check', '설명 검증', 'code', { note: '근거 id·금칙어·길이' }),
      n('explain_review', '설명 검토', 'llm'),
      n('pick_kind', '종류 고르기', 'llm', { note: '퀴즈·인증샷·영수증 중 하나 (허용 종류만 코드가 남김)' }),
      n('generate', '출제', 'llm'),
      n('generate_check', '출제 검증', 'code'),
      n('generate_review', '출제 검토', 'llm'),
      n('submit', '제출', 'human'),
      n('submit_check', '제출 점검', 'code', { note: submitNote }),
      n('judge', '판정', 'llm', { note: judgeNote }),
      n('judge_check', '판정 확인', 'code', { note: 'GPS 반경·중복 제출·한 장소 한 번만 도장 (코드가 거부권)' }),
      n('stamp', '도장 기록', 'code'),
      n('fallback', '폴백', 'code', { note: '고정 설명·준비된 과제로 내려가거나 도장을 보류' }),
      help,
    ],
    edges: chain(
      'arrive', 'explain', 'explain_check', 'explain_review', 'pick_kind', 'generate',
      'generate_check', 'generate_review', 'submit', 'submit_check', 'judge', 'judge_check', 'stamp',
    ),
    loops: [
      loop('explain_check', 'explain', '다시 설명', 'fallback'),
      loop('explain_review', 'explain', '다시 설명', 'fallback'),
      loop('generate_check', 'generate', '다시 출제', 'fallback'),
      loop('generate_review', 'generate', '다시 출제', 'fallback'),
      loop('submit_check', 'submit', '다시 제출', 'fallback'),
      loop('judge_check', 'submit', '다시 제출', 'fallback'),
    ],
  };
}

export const GRAPHS = Object.freeze({
  course: {
    title: '코스 설계',
    nodes: [
      n('gate', '테마 관문', 'code'),
      n('researcher', '연구자', 'llm'),
      n('merge', '근거 합치기', 'code'),
      n('planner', '기획자', 'llm'),
      n('checker', '확인자', 'code'),
      n('writer', '작성자', 'llm'),
      n('validator', '검증', 'code'),
      n('judge', '평가자', 'llm'),
      n('substitute', '대체 코스', 'code'),
    ],
    edges: chain('gate', 'researcher', 'merge', 'planner', 'checker', 'writer', 'validator', 'judge'),
    loops: [
      loop('checker', 'planner', '장소 교체', 'substitute'),
      loop('validator', 'writer', '다시 쓰기', 'substitute'),
      loop('judge', 'writer', '다시 쓰기', 'substitute'),
    ],
  },
  mission_quiz: mission('미션 · 퀴즈', {
    submitNote: '형식·시도 횟수',
    judgeNote: 'Gemini 글 채점 (정답 근거와 대조)',
    help: n('hint', '힌트', 'llm', { optional: true, note: '제출 전에 요청 (퀴즈만). 정답 문자열은 입력에서 뺀다' }),
  }),
  mission_photo: mission('미션 · 인증샷', {
    submitNote: 'GPS 반경·중복·EXIF 제거',
    judgeNote: 'Gemini 이미지 판정 (과제와 맞는지, 부적절한지)',
    help: n('replay', '다시 보기', 'code', { optional: true, note: '출제 안내문을 다시 보여 줌 (LLM 호출 없음)' }),
  }),
  mission_receipt: mission('미션 · 영수증', {
    submitNote: '결제 정보 가림·중복',
    judgeNote: 'Gemini 이미지 판정 (장소·날짜가 맞는지)',
    help: n('replay', '다시 보기', 'code', { optional: true, note: '구매 조건을 다시 보여 줌 (LLM 호출 없음)' }),
  }),
  chat: {
    title: '하랑이와 이야기하기',
    nodes: [
      n('safety', '안전 점검', 'code'),
      n('classify', '분류', 'llm'),
      n('lookup', '근거 조회', 'code'),
      n('answer', '답변 작성', 'llm'),
      n('check', '답변 검증', 'code'),
      n('fixed', '고정 문장', 'code'),
    ],
    edges: chain('safety', 'classify', 'lookup', 'answer', 'check'),
    loops: [loop('check', 'answer', '다시 쓰기', 'fixed')],
  },
  diary: {
    title: '기록 정리',
    nodes: [
      n('facts', '사실 묶음', 'code'),
      n('write', '일기 작성', 'llm'),
      n('check', '검증', 'code'),
      n('save', '일기 저장', 'code'),
      n('template', '틀 일기', 'code'),
    ],
    edges: chain('facts', 'write', 'check', 'save'),
    loops: [loop('check', 'write', '다시 쓰기', 'template')],
  },
  card: {
    title: '하랑이 카드',
    nodes: [
      n('facts', '사실 묶음', 'code'),
      n('prompt', '프롬프트 작성', 'llm'),
      n('image', '이미지 생성', 'llm'),
      n('image_check', '이미지 검증', 'code'),
      n('image_review', '이미지 검토', 'llm'),
      n('assemble', '카드 조립', 'code'),
      n('save', '카드 저장', 'code'),
      n('fixed_card', '고정 카드 틀', 'code'),
    ],
    edges: chain('facts', 'prompt', 'image', 'image_check', 'image_review', 'assemble', 'save'),
    loops: [
      loop('image_check', 'prompt', '다시 작성', 'fixed_card'),
      loop('image_review', 'prompt', '다시 작성', 'fixed_card'),
    ],
  },
  place_db: {
    title: '장소 DB 갱신',
    nodes: [
      n('discover', '후보 발굴', 'llm'),
      n('planner', '기획자', 'llm'),
      n('checker', '확인자', 'code'),
      n('store', '후보 보관', 'code'),
      n('approve', '사람 승인', 'human'),
      n('apply', 'DB 반영', 'code'),
      n('discard', '폐기', 'code'),
    ],
    edges: chain('discover', 'planner', 'checker', 'store', 'approve', 'apply'),
    loops: [loop('checker', 'planner', '후보 교체', 'discard')],
  },
});
