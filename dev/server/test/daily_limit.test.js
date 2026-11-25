import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { createDailyLimit, createAttachBudget } from '../src/agents/common/daily_limit.js';

// 가짜 로그인(헤더의 x-user를 userId로) → 일일 한도 → 예산 → 응답
async function start({ max, now }) {
  const app = express();
  app.use((req, res, next) => { req.userId = req.get('x-user'); next(); });
  app.use(createDailyLimit({ max, now }));
  app.use(createAttachBudget({ maxLlmCalls: 3, deadlineMs: 1000 }, now));
  app.get('/x', (req, res) => res.json({ remaining: req.agentBudget.remaining() }));
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (user) => {
    const r = await fetch(`${base}/x`, { headers: user ? { 'x-user': user } : {} });
    return { status: r.status, body: await r.json() };
  };
  return { get, close: () => new Promise((r) => server.close(r)) };
}

const KST_DAY_START = Date.UTC(2026, 10, 24, 15, 0, 0); // 한국 시간 2026-11-25 00:00

test('한도까지 통과하고 초과하면 429 DAILY_LIMIT', async () => {
  const s = await start({ max: 2, now: () => KST_DAY_START + 1000 });
  try {
    assert.equal((await s.get('a')).status, 200);
    assert.equal((await s.get('a')).status, 200);
    const third = await s.get('a');
    assert.equal(third.status, 429);
    assert.deepEqual(third.body, { error: 'DAILY_LIMIT' });
  } finally { await s.close(); }
});

test('이용자별로 따로 센다', async () => {
  const s = await start({ max: 1, now: () => KST_DAY_START + 1000 });
  try {
    assert.equal((await s.get('a')).status, 200);
    assert.equal((await s.get('b')).status, 200);
    assert.equal((await s.get('a')).status, 429);
  } finally { await s.close(); }
});

test('한국 시간 자정이 지나면 초기화된다 (UTC 자정이 아니다)', async () => {
  let t = KST_DAY_START - 1000; // 한국 시간 전날 23:59:59
  const s = await start({ max: 1, now: () => t });
  try {
    assert.equal((await s.get('a')).status, 200);
    assert.equal((await s.get('a')).status, 429);
    t = KST_DAY_START + 1000; // 한국 시간 다음 날 00:00:01
    assert.equal((await s.get('a')).status, 200);
  } finally { await s.close(); }
});

test('같은 시각에 몰려도 한도를 넘기지 않는다', async () => {
  const s = await start({ max: 3, now: () => KST_DAY_START + 1000 });
  try {
    const results = await Promise.all(Array.from({ length: 8 }, () => s.get('a')));
    assert.equal(results.filter((r) => r.status === 200).length, 3);
  } finally { await s.close(); }
});

test('로그인 정보가 없으면 401로 닫는다', async () => {
  const s = await start({ max: 5, now: () => KST_DAY_START });
  try {
    assert.equal((await s.get(undefined)).status, 401);
  } finally { await s.close(); }
});

test('요청마다 새 호출 예산이 붙는다', async () => {
  const s = await start({ max: 5, now: () => KST_DAY_START });
  try {
    assert.equal((await s.get('a')).body.remaining, 3);
  } finally { await s.close(); }
});
