import test from 'node:test';
import assert from 'node:assert/strict';
import { GRAPHS } from '../src/admin/agent_graphs.js';

test('에이전트 구조도 8개가 있다 (미션은 퀴즈·인증샷·영수증 3종)', () => {
  assert.deepEqual(Object.keys(GRAPHS).sort(), ['card', 'chat', 'course', 'diary', 'mission_photo', 'mission_quiz', 'mission_receipt', 'place_db']);
});

test('모든 화살표와 되돌이가 같은 그래프의 노드를 가리킨다', () => {
  for (const [key, g] of Object.entries(GRAPHS)) {
    const ids = new Set(g.nodes.map((node) => node.id));
    assert.equal(ids.size, g.nodes.length, `${key}: 노드 id 중복`);
    for (const e of g.edges) assert.ok(ids.has(e.from) && ids.has(e.to), `${key}: 화살표 ${e.from}→${e.to}`);
    for (const l of g.loops) {
      assert.ok(ids.has(l.from) && ids.has(l.to) && ids.has(l.exhaustTo), `${key}: 되돌이 ${l.from}→${l.to}`);
    }
  }
});

test('노드 종류는 llm, code, human 중 하나다', () => {
  for (const g of Object.values(GRAPHS)) {
    for (const node of g.nodes) assert.ok(['llm', 'code', 'human'].includes(node.kind), node.id);
  }
});

test('코스 설계는 노드 9개와 되돌이 3개를 갖는다 (course_agent_design_v1.md 4-2장)', () => {
  const g = GRAPHS.course;
  assert.equal(g.nodes.length, 9);
  assert.deepEqual(g.loops.map((l) => `${l.from}→${l.to}`), ['checker→planner', 'validator→writer', 'judge→writer']);
  assert.ok(g.loops.every((l) => l.exhaustTo === 'substitute'));
});

test('되돌이의 from은 항상 되돌아갈 to보다 뒤에 있는 노드다 (앞으로 돌아간다)', () => {
  for (const [key, g] of Object.entries(GRAPHS)) {
    const order = g.nodes.map((node) => node.id);
    for (const l of g.loops) {
      assert.ok(order.indexOf(l.to) < order.indexOf(l.from), `${key}: ${l.from}→${l.to}`);
    }
  }
});

test('모든 노드는 화살표로 이어지거나, 되돌이의 소진 노드이거나, 도움말(optional)이다', () => {
  for (const [key, g] of Object.entries(GRAPHS)) {
    const reachable = new Set([g.nodes[0].id, ...g.edges.map((e) => e.to), ...g.loops.map((l) => l.exhaustTo)]);
    for (const node of g.nodes) assert.ok(reachable.has(node.id) || node.optional, `${key}: ${node.id}`);
  }
});

const MISSION = ['mission_quiz', 'mission_photo', 'mission_receipt'];

test('미션 3종은 앞부분(도착 확인 ~ 종류 고르기)이 같다', () => {
  const front = (k) => GRAPHS[k].nodes.slice(0, 5).map((n) => n.id);
  assert.deepEqual(front('mission_quiz'), ['arrive', 'explain', 'explain_check', 'explain_review', 'pick_kind']);
  for (const k of MISSION) assert.deepEqual(front(k), front('mission_quiz'), k);
});

test('미션 3종은 한 묶음(미션)이고, 다른 에이전트는 묶음이 없다', () => {
  for (const k of MISSION) assert.equal(GRAPHS[k].group, '미션', k);
  for (const k of ['course', 'chat', 'diary', 'card', 'place_db']) assert.equal(GRAPHS[k].group, undefined, k);
});

test('도움말: 퀴즈는 힌트(LLM), 인증샷·영수증은 다시 보기(코드, LLM 호출 없음)이고 흐름 화살표에는 없다', () => {
  const helpOf = (k) => GRAPHS[k].nodes.filter((n) => n.optional);
  assert.deepEqual(helpOf('mission_quiz').map((n) => [n.id, n.kind]), [['hint', 'llm']]);
  for (const k of ['mission_photo', 'mission_receipt']) assert.deepEqual(helpOf(k).map((n) => [n.id, n.kind]), [['replay', 'code']], k);
  for (const k of MISSION) {
    const [help] = helpOf(k);
    assert.ok(GRAPHS[k].edges.every((e) => e.from !== help.id && e.to !== help.id), k);
  }
});

test('종류마다 제출 점검과 판정 설명이 다르다 (EXIF 제거, 결제 정보 가림, 글 채점)', () => {
  const note = (k, id) => GRAPHS[k].nodes.find((n) => n.id === id).note;
  assert.match(note('mission_photo', 'submit_check'), /EXIF/);
  assert.match(note('mission_receipt', 'submit_check'), /결제 정보/);
  assert.match(note('mission_quiz', 'judge'), /채점/);
  assert.match(note('mission_photo', 'judge'), /이미지/);
  assert.match(note('mission_receipt', 'judge'), /이미지/);
});

test('미션의 되돌이는 모두 폴백으로 소진되고, 판정 확인 불통과는 다시 제출로 돌아간다', () => {
  for (const k of MISSION) {
    assert.ok(GRAPHS[k].loops.every((l) => l.exhaustTo === 'fallback'), k);
    const jc = GRAPHS[k].loops.find((l) => l.from === 'judge_check');
    assert.equal(jc.to, 'submit', k);
  }
});
