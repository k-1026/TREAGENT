import { Router } from 'express';
import { isValidCoordinate } from './weather.js';
import { koreaClock, readOptions, composeSafely, briefingFor } from './recommend.js';
import { decideMode } from '../rules/decide_mode.js';
import { readRouteOptions } from '../ai/read_route_options.js';
import { AGE_GROUPS } from '../ai/route_options.js';
import { rankCandidates } from '../ai/pick_by_rules.js';
import { orderPlaces } from '../ai/order_places.js';
import { estimateDurationMin } from '../ai/estimate_duration.js';
import { toPublicPlace } from '../ai/compose_route.js';
import { generateInviteCode, normalizeInviteCode } from '../party/invite_code.js';
import {
  PARTY_MAX_MEMBERS,
  PARTY_REFRESH_LIMIT,
  PARTY_TTL_MS,
  JOIN_LIMIT,
  strictestAge,
  isExpired,
} from '../party/party_rules.js';
import { createRateLimiter } from '../auth/rate_limiter.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RETRIES = 5; // 초대 코드가 겹치면 새 코드로 다시 시도하는 최대 횟수

// 일행 설정으로 추천 선택 입력(prefs)을 만든다. 나이대는 구성원 중 가장 엄격한 기준을 쓴다.
function prefsOf(party, members) {
  return {
    ageGroup: strictestAge(members.map((m) => m.ageGroup)),
    companion: party.companion ?? undefined,
    theme: party.theme ?? undefined,
    zone: party.zone ?? undefined,
    variant: party.variant ?? 'B',
  };
}

const sameSet = (a, b) => a.length === b.length && a.every((id) => b.includes(id));

export function createPartiesRouter({
  store,
  verifier,
  weatherService,
  placeLoader,
  composeRoute,
  harangiLine = null,
  now = () => new Date(),
  joinLimiter = createRateLimiter({ ...JOIN_LIMIT, now: () => now().getTime() }),
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

  // :id의 일행을 읽고 요청한 사람이 구성원인지 확인한다. 실패하면 응답을 보내고 null.
  // 구성원이 아니면 일행이 있는지도 알려 주지 않으려고 404로 답한다.
  async function memberContext(req, res) {
    const { id } = req.params;
    if (!UUID_PATTERN.test(id)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return null;
    }
    const party = await store.findById(id);
    const members = party ? await store.listMembers(party.id) : [];
    const me = members.find((m) => m.userId === req.userId);
    if (!party || !me) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return null;
    }
    if (isExpired(party, now().getTime())) {
      res.status(410).json({ error: 'PARTY_EXPIRED' });
      return null;
    }
    return { party, members, me };
  }

  // 날씨 → 모드, 장소 불러오기. 실패하면 응답을 보내고 null.
  async function weatherAndPlaces(body, options, res) {
    const weather = await weatherService.getWeather({ latitude: body.latitude, longitude: body.longitude });
    const decision = decideMode(weather, { previousMode: options.previousMode });
    const loaded = await placeLoader();
    if (!loaded.ok) {
      res.status(503).json({ error: loaded.reason, mode: decision.mode });
      return null;
    }
    return { weather, decision, places: loaded.places };
  }

  // 저장된 길을 응답 모양으로 만든다. 방문 순서와 소요시간은 요청 때마다 코드가 다시 계산한다.
  async function present({ route, places, start, prefs, mode, hour, temperatureC, wantBriefing }) {
    const byId = new Map(places.map((p) => [p.id, p]));
    const ordered = orderPlaces(route.placeIds.map((id) => byId.get(id)).filter(Boolean), { start });
    const duration = estimateDurationMin(ordered.places, { ageGroup: prefs.ageGroup });
    const publicPlaces = ordered.places.map(toPublicPlace);
    const out = {
      picker: route.picker,
      title: route.title,
      reason: route.reason,
      places: publicPlaces,
      orderBasis: ordered.basis,
      durationMin: duration.minutes,
      durationBasis: duration.basis,
    };
    if (wantBriefing && harangiLine) {
      out.briefing = await briefingFor(harangiLine, {
        mode,
        hour,
        temperatureC,
        theme: prefs.theme,
        route: { title: route.title, durationMin: duration.minutes, places: publicPlaces },
      });
    }
    return out;
  }

  // POST /parties  본문: { ageGroup, companion?, theme?, zone?, variant? }  → 일행을 만들고 초대 코드를 돌려준다
  router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const routeOptions = readRouteOptions(body);
    if (!routeOptions || !AGE_GROUPS.includes(body.ageGroup)) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const expiresAt = new Date(now().getTime() + PARTY_TTL_MS);
    for (let attempt = 0; attempt < CODE_RETRIES; attempt += 1) {
      try {
        const created = await store.createParty({
          hostUserId: req.userId,
          inviteCode: generateInviteCode(),
          ageGroup: body.ageGroup,
          companion: routeOptions.companion,
          theme: routeOptions.theme,
          zone: routeOptions.zone,
          variant: routeOptions.variant,
          expiresAt,
        });
        res.status(201).json({ partyId: created.id, inviteCode: created.inviteCode, expiresAt: created.expiresAt });
        return;
      } catch (err) {
        if (err?.code !== '23505') throw err; // 초대 코드가 겹친 경우만 다시 시도한다
      }
    }
    res.status(503).json({ error: 'CODE_GENERATION_FAILED' });
  });

  // POST /parties/join  본문: { inviteCode, ageGroup }  → 초대 코드로 참여한다
  router.post('/join', async (req, res) => {
    // 코드를 무작정 대입하는 것을 막으려고, 입력이 맞든 틀리든 시도 횟수를 센다.
    if (!joinLimiter.allow(req.userId)) {
      res.status(429).json({ error: 'TOO_MANY_ATTEMPTS' });
      return;
    }
    const body = req.body ?? {};
    const code = normalizeInviteCode(body.inviteCode);
    if (!code || !AGE_GROUPS.includes(body.ageGroup)) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const party = await store.findByCode(code);
    if (!party) {
      res.status(404).json({ error: 'CODE_NOT_FOUND' });
      return;
    }
    if (isExpired(party, now().getTime())) {
      res.status(410).json({ error: 'PARTY_EXPIRED' });
      return;
    }
    if (party.startedAt) {
      res.status(409).json({ error: 'ALREADY_STARTED' });
      return;
    }
    const status = await store.addMember({
      partyId: party.id,
      userId: req.userId,
      ageGroup: body.ageGroup,
      maxMembers: PARTY_MAX_MEMBERS,
    });
    if (status === 'FULL') {
      res.status(409).json({ error: 'PARTY_FULL' });
      return;
    }
    res.json({ partyId: party.id, joined: status === 'JOINED' });
  });

  // GET /parties/:id  → 일행 정보. 다른 구성원의 id는 알려 주지 않고, 초대 코드는 host에게만 보여 준다.
  router.get('/:id', async (req, res) => {
    const ctx = await memberContext(req, res);
    if (!ctx) return;
    const { party, members, me } = ctx;
    res.json({
      partyId: party.id,
      companion: party.companion ?? null,
      theme: party.theme ?? null,
      zone: party.zone ?? null,
      variant: party.variant,
      startedAt: party.startedAt ?? null,
      expiresAt: party.expiresAt,
      memberCount: members.length,
      ageGroups: members.map((m) => m.ageGroup).sort(),
      myRole: me.role,
      ...(me.role === 'host' ? { inviteCode: party.inviteCode } : {}),
    });
  });

  // POST /parties/:id/recommend  본문: { latitude, longitude, district?, previousMode?, briefing? }
  //   같은 일행이 같은 모드로 요청하면 저장된 같은 길을 돌려준다. 저장된 장소가 닫히면 새 버전을 만든다.
  //   briefing: true면 하랑이 "오늘의 길" 브리핑도 함께 돌려준다.
  router.post('/:id/recommend', async (req, res) => {
    const ctx = await memberContext(req, res);
    if (!ctx) return;
    const body = req.body ?? {};
    const options = readOptions(body);
    if (!isValidCoordinate(body.latitude, body.longitude) || !options || (body.briefing !== undefined && typeof body.briefing !== 'boolean')) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const prep = await weatherAndPlaces(body, options, res);
    if (!prep) return;

    const { party, members } = ctx;
    const { weather, decision, places } = prep;
    const mode = decision.mode;
    const context = { ...koreaClock(now()), district: options.district };
    const prefs = prefsOf(party, members);
    const temperatureC = weather.status === 'ok' ? (weather.apparentTemperatureC ?? weather.temperatureC) : undefined;
    const start = { latitude: body.latitude, longitude: body.longitude };
    const ranked = rankCandidates(mode, places, context, prefs);
    if (ranked.reason !== 'OK') {
      res.json({ mode, route: null, routeReason: ranked.reason });
      return;
    }
    const candidateIds = new Set(ranked.places.map((p) => p.id));

    // 1) 저장된 길이 있고 장소가 지금도 갈 수 있으면 그대로 쓴다.
    let route = await store.latestRoute(party.id, mode);
    if (!route || !route.placeIds.every((id) => candidateIds.has(id))) {
      // 2) 없거나 장소가 닫혔으면 새로 구성해서 다음 버전으로 저장한다.
      const previous = route;
      const composed = await composeSafely(composeRoute, { mode, places, context, prefs, start, temperatureC });
      if (!composed.ok) {
        res.json({ mode, route: null, routeReason: composed.reason });
        return;
      }
      const next = {
        version: (previous?.version ?? 0) + 1,
        title: composed.title,
        reason: composed.reason,
        picker: composed.picker,
        placeIds: composed.places.map((p) => p.id),
      };
      const saved = await store.saveRoute({ partyId: party.id, mode, ...next });
      // 다른 구성원이 거의 동시에 먼저 저장했다면, 저장된 길을 따른다. (일행이 같은 길을 보게 하려고)
      const winner = saved ? next : await store.latestRoute(party.id, mode);
      route = winner ?? next;
    }

    res.json({
      mode,
      routeVersion: route.version,
      route: await present({ route, places, start, prefs, mode, hour: context.hour, temperatureC, wantBriefing: body.briefing === true }),
    });
  });

  // POST /parties/:id/start  → 시작 처리(host만). 이후에는 새로고침하거나 새로 참여할 수 없다.
  router.post('/:id/start', async (req, res) => {
    const ctx = await memberContext(req, res);
    if (!ctx) return;
    if (ctx.me.role !== 'host') {
      res.status(403).json({ error: 'NOT_HOST' });
      return;
    }
    const startedAt = await store.markStarted(ctx.party.id);
    res.json({ partyId: ctx.party.id, startedAt });
  });

  // POST /parties/:id/refresh  (host만, 시작 전만)
  //   본문: { latitude, longitude, routeVersion, district?, previousMode?, briefing? }
  //   지금 길이 마음에 들지 않을 때 새 길을 받는다. 장소를 하나씩 직접 고치는 기능은 없다.
  //   새 길은 지금 길의 장소를 뺀 조합이고, 새 버전으로 저장되어 일행 모두가 같은 새 길을 본다.
  //   routeVersion이 서버의 최신 버전과 다르면 409 STALE_ROUTE (오래된 화면에서 온 요청), 횟수 상한을 넘으면 409 REFRESH_LIMIT
  router.post('/:id/refresh', async (req, res) => {
    const ctx = await memberContext(req, res);
    if (!ctx) return;
    if (ctx.me.role !== 'host') {
      res.status(403).json({ error: 'NOT_HOST' });
      return;
    }
    if (ctx.party.startedAt) {
      res.status(409).json({ error: 'ALREADY_STARTED' });
      return;
    }
    const body = req.body ?? {};
    const options = readOptions(body);
    if (
      !isValidCoordinate(body.latitude, body.longitude) ||
      !options ||
      !Number.isInteger(body.routeVersion) ||
      body.routeVersion < 1 ||
      (body.briefing !== undefined && typeof body.briefing !== 'boolean')
    ) {
      res.status(400).json({ error: 'INVALID_INPUT' });
      return;
    }
    const prep = await weatherAndPlaces(body, options, res);
    if (!prep) return;

    const { party, members } = ctx;
    const { weather, decision, places } = prep;
    const mode = decision.mode;
    const saved = await store.latestRoute(party.id, mode);
    if (!saved) {
      res.status(409).json({ error: 'NO_ROUTE' });
      return;
    }
    if (saved.version !== body.routeVersion) {
      res.status(409).json({ error: 'STALE_ROUTE', latestVersion: saved.version });
      return;
    }
    if (saved.version >= 1 + PARTY_REFRESH_LIMIT) {
      res.status(409).json({ error: 'REFRESH_LIMIT' });
      return;
    }

    const context = { ...koreaClock(now()), district: options.district };
    const prefs = prefsOf(party, members);
    const temperatureC = weather.status === 'ok' ? (weather.apparentTemperatureC ?? weather.temperatureC) : undefined;
    const start = { latitude: body.latitude, longitude: body.longitude };
    const composed = await composeSafely(composeRoute, {
      mode,
      places,
      context,
      prefs,
      start,
      temperatureC,
      refresh: true,
      exclude: saved.placeIds,
    });
    if (!composed.ok) {
      res.json({ mode, route: null, routeReason: composed.reason });
      return;
    }
    const newIds = composed.places.map((p) => p.id);
    const wantBriefing = body.briefing === true;

    // 새 조합이 없으면(후보가 부족해 같은 장소로만 구성됨) 새 버전을 만들지 않고 지금 길을 그대로 돌려준다.
    if (sameSet(newIds, saved.placeIds)) {
      res.json({
        mode,
        refreshed: false,
        routeVersion: saved.version,
        route: await present({ route: saved, places, start, prefs, mode, hour: context.hour, temperatureC, wantBriefing }),
      });
      return;
    }

    const next = {
      version: saved.version + 1,
      title: composed.title,
      reason: composed.reason,
      picker: composed.picker,
      placeIds: newIds,
    };
    const inserted = await store.saveRoute({ partyId: party.id, mode, ...next });
    if (!inserted) {
      const latest = await store.latestRoute(party.id, mode);
      res.status(409).json({ error: 'STALE_ROUTE', latestVersion: latest?.version ?? null });
      return;
    }
    res.json({
      mode,
      refreshed: true,
      routeVersion: next.version,
      route: await present({ route: next, places, start, prefs, mode, hour: context.hour, temperatureC, wantBriefing }),
    });
  });

  return router;
}