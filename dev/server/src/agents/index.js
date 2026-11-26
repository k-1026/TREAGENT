import { createCourseAgent } from './course/agent.js';
import { COURSE_SCHEMAS } from './course/gemini.js';
import { createWalkTime } from './course/walk_time.js';
import { createChatAgent, CHAT_SCHEMAS } from './chat/agent.js';
import { createDiaryAgent, DIARY_SCHEMAS } from './diary/agent.js';
import { createMissionAgent, MISSION_SCHEMAS } from './mission/agent.js';
import { createCardAgent, CARD_SCHEMAS } from './card/agent.js';
import { createPlaceDbAgent, PLACE_DB_SCHEMAS } from './place_db/agent.js';
import { createGeminiLlmsWithPool } from './common/gemini.js';
import { AGENT_LIMITS } from './common/config.js';

// 에이전트 6개를 한곳에서 만든다. 키·모델 전환 풀(pool) 하나를 모든 에이전트가 같이 쓴다.
// 키가 없으면(pool이 null) LLM이 필요한 에이전트는 null이다 (라우트가 503 AGENT_OFF로 답한다). 장소 DB 갱신의 수동 등록은 LLM 없이도 된다.
//   courseOn: COURSE_AGENT=on 일 때만 코스 설계 에이전트를 켠다 (기본 꺼짐).
//   llmsFor: (스키마 목록) => llms | null. 테스트에서는 가짜 LLM을 돌려주는 함수를 넣는다.
export function createAgents({ pool = null, stores, recorder, courseOn = false, fixedCard = null, prepareImage, imageGen = null, llmsFor = (defs) => createGeminiLlmsWithPool(defs, pool) }) {
  const out = { pool, course: null, mission: null, chat: null, diary: null, card: null, placeDb: null };

  const course = llmsFor(COURSE_SCHEMAS);
  if (courseOn && course) out.course = createCourseAgent({ llms: course, walkTime: createWalkTime(), recorder });

  const chat = llmsFor(CHAT_SCHEMAS);
  if (chat) out.chat = createChatAgent({ llms: chat, recorder });

  // 일기 저장은 라우트가 한다 (이용자 id가 필요해서). 에이전트의 saveDiary는 쓰지 않는다.
  const diary = llmsFor(DIARY_SCHEMAS);
  if (diary) out.diary = createDiaryAgent({ llms: diary, recorder });

  const mission = llmsFor(MISSION_SCHEMAS);
  if (mission) out.mission = createMissionAgent({ llms: mission, store: stores.stamp, prepareImage, recorder });

  // 카드: imageGen(Gemini 이미지 모델)이 있으면 그림을 만들고, 없으면 image 노드가 항상 실패해서 고정 카드 틀로 내려간다.
  const card = llmsFor({ prompt: CARD_SCHEMAS.prompt, image_review: CARD_SCHEMAS.image_review });
  if (card) {
    const image = imageGen ?? (async () => { throw Object.assign(new Error('IMAGE_GEN_NOT_CONFIGURED'), { code: 'IMAGE_GEN_NOT_CONFIGURED' }); });
    // 이미지 생성은 글보다 오래 걸려서 카드 에이전트만 시간 상한을 더 준다 [결정 D-19 임시값].
    out.card = createCardAgent({ llms: { ...card, image }, fixedCard, recorder, limits: { ...AGENT_LIMITS, llmTimeoutMs: 45000, deadlineMs: 120000 } });
  }

  out.placeDb = createPlaceDbAgent({ llms: llmsFor(PLACE_DB_SCHEMAS) ?? {}, candidateStore: stores.candidates, applyToPlaces: stores.applyToPlaces, recorder });
  return out;
}
