import { Router } from 'express';
import { createRateLimiter } from '../auth/rate_limiter.js';
import { readNicknameOnly, readProfileInput } from '../profile/profile_rules.js';

// 닉네임 확인은 이름을 하나씩 대입해 남의 이름을 알아내는 데 쓰일 수 있어서 횟수를 제한한다. [확인 필요] 임시 값
const NICKNAME_CHECK_LIMIT = Object.freeze({ max: 30, windowMs: 10 * 60 * 1000 });

export function createProfileRouter({
  store,
  verifier,
  now = () => new Date(),
  checkLimiter = createRateLimiter({ ...NICKNAME_CHECK_LIMIT, now: () => now().getTime() }),
}) {
  const router = Router();

  // 로그인 확인: Authorization: Bearer <Supabase access token>. 토큰과 사용자 id는 로그에 남기지 않는다.
  router.use(async (req, res, next) => {
    if (!verifier) {
      res.status(503).json({ error: 'AUTH_NOT_CONFIGURED' });
      return;
    }
    const result = await verifier.verify(req.get('authorization'));
    if (!result.ok) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    req.userId = result.userId;
    next();
  });

  // GET /profile  → 내 프로필. 아직 없으면 404 PROFILE_NOT_FOUND (앱은 첫 만남 화면으로 보낸다)
  router.get('/', async (req, res) => {
    const profile = await store.find(req.userId);
    if (!profile) {
      res.status(404).json({ error: 'PROFILE_NOT_FOUND' });
      return;
    }
    res.json(profile);
  });

  // POST /profile/check  본문: { nickname }  → { available: true | false }
  //   저장하기 전에 이름이 비어 있는지 알려 준다. 저장할 때 DB가 한 번 더 막으므로 이 답은 참고용이다.
  //   닉네임이 주소(URL)에 남지 않게 GET이 아니라 POST 본문으로 받는다.
  router.post('/check', async (req, res) => {
    if (!checkLimiter.allow(req.userId)) {
      res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
      return;
    }
    const nickname = readNicknameOnly(req.body);
    if (!nickname) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    res.json({ available: !(await store.isNicknameTaken(nickname, req.userId)) });
  });

  // PUT /profile  본문: { nickname?, ageGroup }
  //   닉네임은 한 번 정하면 바꿀 수 없다(NICKNAME_LOCKED). 다른 사람이 쓰는 이름이면 NICKNAME_TAKEN.
  router.put('/', async (req, res) => {
    const input = readProfileInput(req.body);
    if (!input) {
      res.status(400).json({ error: 'INVALID_INPUT' }); // 입력값은 되돌려 주지 않는다
      return;
    }
    const current = await store.find(req.userId);
    if (current?.nickname && input.nickname !== null && input.nickname !== current.nickname) {
      res.status(409).json({ error: 'NICKNAME_LOCKED' });
      return;
    }
    try {
      const saved = await store.save({ userId: req.userId, nickname: input.nickname, ageGroup: input.ageGroup });
      res.json(saved);
    } catch (err) {
      if (err?.code !== '23505') throw err; // 닉네임이 겹친 경우만 409로 바꾼다
      res.status(409).json({ error: 'NICKNAME_TAKEN' });
    }
  });

  return router;
}