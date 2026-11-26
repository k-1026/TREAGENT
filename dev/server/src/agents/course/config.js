// 코스 설계 에이전트 설정표. 숫자는 모두 임시값이다. [결정 필요] 팀이 정하면 이 파일만 고친다.
export const COURSE_LIMITS = Object.freeze({
  maxSegmentWalkMin: 25, // 장소 사이 구간 도보 시간 상한(분)
  maxTotalWalkMin: 60, // 코스 전체 도보 시간 상한(분)
  evidenceMaxChars: 160, // 근거 한 줄의 최대 길이
});

// 프롬프트 버전. 실행 기록에 남는다. 프롬프트를 바꾸면 올린다.
export const PROMPT_VERSION = 'course-v1';

// 에이전트 스위치. COURSE_AGENT=on일 때만 켠다 (기본 꺼짐). [결정 필요] 기본값은 팀이 정한다.
export const isCourseAgentOn = (env = process.env) => env.COURSE_AGENT === 'on';
