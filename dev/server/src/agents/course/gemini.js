import { z } from 'zod';
import { createGeminiLlmsWithPool } from '../common/gemini.js';

// 코스 설계 에이전트의 LLM 4개(연구자·기획자·작성자·평가자). 키·모델 전환은 공통 풀(common/failover.js)이 맡는다.
// 출력 모양이 틀려도 코드(확인자·검증)가 거부하므로 여기서 더 막지 않는다.
export const COURSE_SCHEMAS = {
  researcher: z.object({ evidence: z.array(z.object({ placeId: z.string(), summary: z.string() })) }),
  planner: z.object({ placeIds: z.array(z.string()) }),
  writer: z.object({ keyword: z.string(), reason: z.string(), evidenceIds: z.array(z.string()) }),
  judge: z.object({ pass: z.boolean(), reason: z.string() }),
};

export const createCourseLlms = (pool) => createGeminiLlmsWithPool(COURSE_SCHEMAS, pool);
