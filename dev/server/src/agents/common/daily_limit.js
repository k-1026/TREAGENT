import { KST_OFFSET_MS } from './config.js';
import { createBudget } from './budget.js';

// 일일 한도 미들웨어: 로그인한 이용자(req.userId)별로 하루(한국 시간) 요청 수를 제한한다.
// requireLogin 뒤에 끼운다. userId는 메모리 카운터의 키로만 쓰고 로그·실행 기록에는 넘기지 않는다.
// 서버 메모리에만 기억하므로 재시작하면 초기화되고, 서버가 여러 대면 합쳐지지 않는다 (createRateLimiter와 같은 한계) [확인 필요].
export function createDailyLimit({ max, now = Date.now }) {
  const dayOf = () => Math.floor((now() + KST_OFFSET_MS) / 86400000);
  let today = dayOf();
  const counts = new Map(); // userId → 오늘 횟수

  return function dailyLimit(req, res, next) {
    const day = dayOf();
    if (day !== today) {
      today = day;
      counts.clear(); // 날짜가 바뀌면 전부 초기화한다 (옛 키가 쌓이지 않는다)
    }
    const key = req.userId;
    if (!key) {
      res.status(401).json({ error: 'UNAUTHORIZED' }); // 로그인 검사 없이 끼우면 닫는다
      return;
    }
    const n = counts.get(key) ?? 0;
    if (n >= max) {
      res.status(429).json({ error: 'DAILY_LIMIT' });
      return;
    }
    counts.set(key, n + 1);
    next();
  };
}

// 요청마다 새 호출 예산을 만들어 req.agentBudget에 붙인다.
//   limits: { maxLlmCalls, deadlineMs } (config.js의 AGENT_LIMITS)
export function createAttachBudget(limits, now = Date.now) {
  return function attachBudget(req, res, next) {
    req.agentBudget = createBudget({ maxCalls: limits.maxLlmCalls, deadlineMs: limits.deadlineMs, now });
    next();
  };
}
