// 관리자 화면. 서버에서 온 값은 모두 글자(text node)와 setAttribute로만 넣는다.
// HTML 문자열을 만들어 넣는 방식은 쓰지 않는다 (LLM 출력 같은 글이 스크립트로 실행되지 않게).

const POLL_MS = 1500;

const state = {
  auth: 'checking', // 'checking' | 'login'(로그인 화면) | 'ok' | 'closed'(서버에 관리자 계정 설정이 없음)
  loginError: null,
  loginBusy: false,
  loginUser: '',
  graphs: null, limits: null, scenarios: [],
  runs: [], health: null, presence: null, error: null,
  runId: null, detail: null, check: null, busy: false,
  userId: null, // ① 접속 현황에서 누른 사람 (그 사람이 쓰는 에이전트를 아래에 보여 준다)
};
let lastSig = '';

// ---------- 작은 도우미 ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}
function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString('ko-KR') : '-');
const fmtMs = (ms) => (ms == null ? '-' : ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);
const runMs = (r) => (r.endedAt ? Date.parse(r.endedAt) - Date.parse(r.startedAt) : null);
function ago(iso) {
  const sec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (sec < 10) return '방금';
  if (sec < 60) return `${sec}초 전`;
  return `${Math.floor(sec / 60)}분 전`;
}
const KIND = { llm: 'LLM', code: '코드', human: '사람' };
const titleOf = (key) => state.graphs?.[key]?.title ?? key;

// 로그인 쿠키는 브라우저가 알아서 보낸다 (같은 주소로 요청하면 자동). 화면은 비밀번호나 세션 값을 저장하지 않는다.
async function api(path, options = {}) {
  const res = await fetch(`api/${path}`, options);
  if (!res.ok) {
    const err = new Error(String(res.status));
    err.status = res.status;
    err.body = await res.json().catch(() => null);
    throw err;
  }
  return res.json();
}
function explain(err) {
  if (err.status === 403) return '이 요청은 허용되지 않았습니다.';
  return `서버에 연결하지 못했습니다 (${err.status ?? '네트워크'}).`;
}
// 로그인이 필요하거나(401) 서버에 관리자 설정이 없으면(503) 알맞은 화면으로 바꾼다. 처리했으면 true.
function needLogin(err) {
  if (err.status === 401) state.auth = 'login';
  else if (err.status === 503) state.auth = 'closed';
  else return false;
  return true;
}

// ---------- 로그인 ----------
function pageLogin() {
  const username = h('input', { name: 'username', type: 'text', autocomplete: 'username', required: true, maxlength: 200, value: state.loginUser });
  const password = h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true, maxlength: 200 });
  const submit = async (e) => {
    e.preventDefault();
    state.loginUser = username.value; // 실패해도 아이디는 남겨 둔다 (비밀번호는 남기지 않는다)
    state.loginBusy = true;
    state.loginError = null;
    render(true);
    try {
      await api('login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.value, password: password.value }) });
      state.auth = 'checking';
      state.loginBusy = false;
      await load();
    } catch (err) {
      state.loginBusy = false;
      state.loginError = err.status === 401 ? '아이디 또는 비밀번호가 맞지 않습니다.'
        : err.status === 429 ? `시도가 너무 많습니다. ${Math.ceil((err.body?.retryAfterS ?? 900) / 60)}분 뒤에 다시 하세요.`
        : err.status === 503 ? '서버에 관리자 계정이 설정돼 있지 않습니다.'
        : explain(err);
      if (err.status === 503) state.auth = 'closed';
      render(true);
    }
  };
  return h('form', { class: 'card login', onsubmit: submit },
    h('h2', {}, '관리자 로그인'),
    h('label', {}, '아이디', username),
    h('label', {}, '비밀번호', password),
    state.loginError ? h('p', { class: 'notice' }, state.loginError) : null,
    h('button', { type: 'submit', class: 'primary', disabled: state.loginBusy }, state.loginBusy ? '확인 중…' : '로그인'));
}
function pageClosed() {
  return h('div', { class: 'notice' },
    '서버에 관리자 계정이 설정돼 있지 않아 관리자 화면이 닫혀 있습니다. 서버 변수 ADMIN_USERNAME, ADMIN_PASSWORD_HASH, ADMIN_SESSION_SECRET을 넣어 주세요. 로컬에서 확인할 때는 서버를 ADMIN_DEV_OPEN=true로 켜면 로그인 없이 열립니다.');
}
async function logout() {
  await api('logout', { method: 'POST' }).catch(() => {});
  location.reload();
}

// ---------- 구조도 ----------
// 노드는 한 줄에 5개씩 놓는다. 되돌이 화살표는 줄마다 높이를 달리해서 서로 겹치지 않게 하고,
// 글자에는 배경(윤곽선)을 깔아서 화살표·노드 위에 올라가도 읽히게 한다.
let graphSeq = 0;
function renderGraph(graph, view) {
  const COLS = 5, W = 116, H = 44, GX = 28, GY = 124, PAD = 16, TOP = 64, BOTTOM = 64;
  const rows = Math.ceil(graph.nodes.length / COLS);
  const width = PAD * 2 + COLS * (W + GX) - GX;
  const height = TOP + rows * (H + GY) - GY + BOTTOM;
  const pos = new Map(graph.nodes.map((n, i) => [n.id, { x: PAD + (i % COLS) * (W + GX), y: TOP + Math.floor(i / COLS) * (H + GY), row: Math.floor(i / COLS) }]));
  const stats = view?.nodeStats ?? {};
  const current = new Set(view?.currentNodes ?? []);
  const markerId = `arrow${(graphSeq += 1)}`;
  const label = (id) => graph.nodes.find((n) => n.id === id)?.label ?? id;

  const svg = s('svg', { class: 'graph', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '에이전트 구조도' });
  svg.append(s('defs', {}, s('marker', { id: markerId, viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, s('path', { class: 'arrow-fill', d: 'M0,0 L8,4 L0,8 z' }))));

  // 흐름 화살표 (도움말 노드는 화살표가 없다)
  for (const e of graph.edges) {
    const a = pos.get(e.from), b = pos.get(e.to);
    const d = a.row === b.row
      ? `M${a.x + W},${a.y + H / 2} L${b.x},${b.y + H / 2}`
      : `M${a.x + W / 2},${a.y + H} C${a.x + W / 2},${a.y + H + 40} ${b.x + W / 2},${b.y - 40} ${b.x + W / 2},${b.y}`;
    svg.append(s('path', { class: 'edge', d, 'marker-end': `url(#${markerId})` }));
  }

  // 되돌이: 같은 줄에서 시작하는 것끼리 높이(lane)를 다르게 한다
  const lanes = {};
  const laneOf = (loop) => {
    const row = pos.get(loop.from).row;
    lanes[row] = (lanes[row] ?? -1) + 1;
    return lanes[row];
  };
  const loopLanes = graph.loops.map(laneOf);
  const exhaustLanes = {};
  view?.loopHits.forEach((hit, i) => {
    const l = graph.loops[i];
    const a = pos.get(l.from), b = pos.get(l.to);
    const x1 = a.x + W / 2, x2 = b.x + W / 2;
    const sameRow = a.row === b.row;
    const hgt = 30 + loopLanes[i] * 18; // 곡선 높이
    const d = sameRow
      ? `M${x1},${a.y} C${x1},${a.y - hgt} ${x2},${b.y - hgt} ${x2},${b.y}`
      : `M${x1},${a.y} C${x1},${a.y - 44} ${x2},${b.y + H + 44} ${x2},${b.y + H}`;
    const cls = hit.count > 0 ? 'loop hit' : 'loop';
    svg.append(s('path', { class: cls, d, 'marker-end': `url(#${markerId})` }, s('title', {}, `${label(l.from)} 실패 → ${label(l.to)} (${l.label})`)));
    if (hit.count > 0) {
      const lx = (x1 + x2) / 2;
      const ly = sameRow ? a.y - hgt * 0.75 - 6 : (a.y + b.y + H) / 2;
      svg.append(s('text', { class: 'loop-label hit', x: lx, y: ly }, `↩ ${l.label} ×${hit.count}`));
    }
    if (hit.exhausted) {
      // 상한을 다 쓴 경우: 실패한 노드에서 소진 노드(대체 코스·폴백)로 가는 빨간 화살표
      const e = pos.get(l.exhaustTo);
      const lane = (exhaustLanes[l.from] = (exhaustLanes[l.from] ?? -1) + 1);
      const ex = e.x + W / 2;
      const d2 = e.row === a.row
        ? `M${x1},${a.y + H} C${x1},${a.y + H + 34 + lane * 12} ${ex},${e.y + H + 34 + lane * 12} ${ex},${e.y + H}`
        : `M${x1},${a.y + H} C${x1},${a.y + H + 46} ${ex},${e.y - 46} ${ex},${e.y}`;
      svg.append(s('path', { class: 'loop exhausted', d: d2, 'marker-end': `url(#${markerId})` }, s('title', {}, `상한을 다 씀 → ${label(l.exhaustTo)}`)));
      const my = e.row === a.row ? a.y + H + (34 + lane * 12) * 0.75 + 12 : (a.y + H + e.y) / 2;
      svg.append(s('text', { class: 'loop-label exhaust', x: (x1 + ex) / 2, y: my }, `소진 → ${label(l.exhaustTo)}`));
    }
  });

  graph.nodes.forEach((n) => {
    const p = pos.get(n.id);
    const st = stats[n.id];
    const cls = ['node', `kind-${n.kind}`, n.optional ? 'optional' : '', current.has(n.id) ? 'current' : '', st?.fails ? 'failed' : st?.runs ? 'done' : ''].filter(Boolean).join(' ');
    svg.append(s('g', { class: cls },
      s('rect', { x: p.x, y: p.y, width: W, height: H, rx: 8 }),
      s('text', { x: p.x + W / 2, y: p.y + 19 }, n.label),
      s('text', { class: 'kind', x: p.x + W / 2, y: p.y + 35 }, `${KIND[n.kind]}${n.optional ? ' · 요청 시' : ''}`),
      st?.fails ? s('text', { class: 'badge', x: p.x + W - 12, y: p.y - 5 }, `✖×${st.fails}`) : null,
      s('title', {}, `${n.label} (${KIND[n.kind]})${n.note ? ` — ${n.note}` : ''}${st ? ` · 실행 ${st.runs}회, 실패 ${st.fails}회${st.lastReason ? `, 사유 ${st.lastReason}` : ''}` : ''}`),
    ));
  });
  return svg;
}

// ---------- 공통 조각 ----------
function statusChip(run) {
  const st = run.view?.status ?? run.status;
  if (st === 'running') return h('span', { class: 'chip running' }, h('span', { class: 'dot' }), '진행 중');
  if (st === 'stale') return h('span', { class: 'chip warn' }, '중단됨');
  const label = { normal: '정상', substitute: '대체', fallback: '폴백' }[run.outcome] ?? '끝남';
  return h('span', { class: `chip ${run.outcome === 'normal' ? 'ok' : 'fail'}` }, label);
}

// 실행 목록. detailed면 에이전트 상세용으로 번호·유저·LLM 호출·토큰·되돌이까지 보여 준다. 행을 누르면 그 실행의 상세가 열린다.
function runTable(runs, { detailed = false } = {}) {
  if (!runs.length) return h('p', { class: 'muted' }, '아직 실행이 없습니다. [테스트] 페이지에서 시나리오를 돌려 보세요.');
  const loops = (r) => r.view?.loopHits.reduce((a, l) => a + l.count, 0) ?? 0;
  const heads = detailed
    ? ['번호', '시작', '유저', '상태', '단계', '소요', 'LLM 호출', '토큰 합', '되돌이', '폴백 사유']
    : ['시작', '상태', '단계', '소요', '폴백 사유', ''];
  const cells = (r, i) => (detailed
    ? [`#${runs.length - i}`, fmtTime(r.startedAt), r.demo ? h('span', { class: 'chip' }, '시연') : '-', statusChip(r), String(r.stepCount),
      fmtMs(runMs(r)), String(r.totals?.llmCalls ?? 0), r.totals?.totalTokens == null ? '-' : String(r.totals.totalTokens), `${loops(r)}회`, r.fallbackReason ?? '-']
    : [fmtTime(r.startedAt), statusChip(r), String(r.stepCount), fmtMs(runMs(r)), r.fallbackReason ?? '-', r.demo ? h('span', { class: 'chip' }, '시연') : '']);
  return h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, heads.map((t) => h('th', {}, t)))),
    h('tbody', {}, runs.map((r, i) => h('tr', { class: `clickable${r.id === state.runId ? ' picked' : ''}`, onclick: () => selectRun(r.id) },
      cells(r, i).map((c) => h('td', {}, c)))))));
}

const json = (v) => JSON.stringify(v);
function textDetails(value, pretty) {
  if (value == null) return '-';
  const text = json(value);
  return h('details', {}, h('summary', {}, text.length > 40 ? `${text.slice(0, 40)}…` : text), h('pre', {}, pretty ? JSON.stringify(value, null, 2) : text));
}
// LLM에 보낸 프롬프트 원문 (시스템 + 사용자 메시지). 글자로만 보여 준다.
function promptCell(step) {
  if (step.prompt == null) return '-';
  const text = typeof step.prompt === 'string' ? step.prompt : `[system]\n${step.prompt.system ?? ''}\n\n[user]\n${step.prompt.user ?? ''}`;
  return h('details', {}, h('summary', {}, '보기'), h('pre', {}, text));
}

function totalsOf(run) {
  const sum = (f) => run.steps.reduce((a, st) => a + (st[f] ?? 0), 0);
  const hasTokens = run.steps.some((st) => st.totalTokens != null);
  return {
    ms: run.endedAt ? runMs(run) : sum('durationMs'),
    llmCalls: sum('llmCalls'),
    tokens: hasTokens ? `${sum('inputTokens')} / ${sum('outputTokens')} / ${sum('totalTokens')}` : '-',
    fails: run.steps.filter((st) => st.verdict !== 'pass').length,
    loops: run.view?.loopHits.reduce((a, l) => a + l.count, 0) ?? 0,
  };
}

// 실행 한 건의 결과를 전부 보여 준다: 요약, 구조도, 단계별 표(입력 요약·프롬프트·출력·판정·시간·토큰), 최종 결과물
function runDetail(run, { withGraph = true } = {}) {
  const graph = state.graphs[run.agent];
  const steps = run.steps;
  const running = run.view?.status === 'running';
  const t = totalsOf(run);
  const lastOutput = [...steps].reverse().find((st) => st.output != null);
  const rows = steps.map((st) => h('tr', {},
    h('td', {}, String(st.seq)), h('td', {}, graph?.nodes.find((n) => n.id === st.node)?.label ?? st.node),
    h('td', {}, KIND[st.kind] ?? st.kind), h('td', {}, String(st.attempt)),
    h('td', { class: `verdict-${st.verdict}` }, st.verdict), h('td', {}, st.reasonCode ?? '-'),
    h('td', {}, fmtMs(st.durationMs)),
    h('td', {}, st.totalTokens == null ? '-' : `${st.inputTokens ?? '?'} / ${st.outputTokens ?? '?'} / ${st.totalTokens}`),
    h('td', {}, textDetails(st.inputSummary)), h('td', {}, promptCell(st)), h('td', {}, textDetails(st.output, true))));
  if (running && run.view.currentNodes.length) {
    rows.push(h('tr', { class: 'running-row' }, h('td', {}, ''), h('td', { colspan: 10 }, h('span', { class: 'dot' }),
      `진행 중: ${run.view.currentNodes.map((id) => graph?.nodes.find((n) => n.id === id)?.label ?? id).join(', ')}`)));
  }
  const check = state.check?.runId === run.id ? state.check : null;
  return h('div', { class: 'card detail' },
    h('div', { class: 'card-head' }, h('h3', {}, `${graph?.title ?? run.agent} 실행 상세`), statusChip(run), run.demo ? h('span', { class: 'chip' }, '시연') : null,
      h('span', { class: 'muted' }, `${fmtTime(run.startedAt)}${run.fallbackReason ? ` · 사유 ${run.fallbackReason}` : ''}`)),
    h('div', { class: 'summary' },
      [['총 소요', fmtMs(t.ms)], ['단계', String(steps.length)], ['LLM 호출', String(t.llmCalls)], ['토큰 입/출/합', t.tokens], ['되돌이', `${t.loops}회`], ['통과 못 한 단계', String(t.fails)]]
        .map(([k, v]) => h('div', { class: 'stat' }, h('div', { class: 'muted' }, k), h('strong', {}, v)))),
    graph && withGraph ? renderGraph(graph, run.view) : null,
    run.view?.unknownNodes.length ? h('p', { class: 'notice' }, `구조도와 다름: 구조도에 없는 노드 ${run.view.unknownNodes.join(', ')}`) : null,
    h('div', { class: 'table-wrap' }, h('table', {},
      h('thead', {}, h('tr', {}, ['#', '노드', '종류', '시도', '판정', '사유', '시간', '토큰 입/출/합', '입력 요약', '프롬프트', '출력'].map((x) => h('th', {}, x)))),
      h('tbody', {}, rows))),
    lastOutput ? h('div', {}, h('strong', {}, '최종 결과물 (마지막 출력)'), textDetails(lastOutput.output, true)) : null,
    h('p', {}, h('button', { type: 'button', disabled: running || state.busy, onclick: () => runCheck(run.id) }, '저장 일치 검사'),
      check ? checkResult(check) : null));
}

function checkResult(c) {
  const note = c.store === 'memory' ? ' (메모리 저장소라 DB 확인은 아닙니다)' : '';
  if (c.ok) return h('span', { class: 'chip ok' }, `✔ 저장 일치${note}`);
  return h('div', {}, h('span', { class: 'chip fail' }, `✖ 불일치 ${c.diffs.length}건${note}`),
    h('table', {}, h('tbody', {}, c.diffs.map((d) => h('tr', {}, h('td', {}, d.field), h('td', {}, `보내려던 값: ${json(d.expected)}`), h('td', {}, `저장된 값: ${json(d.actual)}`))))));
}

function healthLine() {
  const hl = state.health;
  if (!hl) return null;
  return h('p', { class: 'muted' }, `저장소: ${hl.store === 'db' ? 'DB' : '메모리 (DB 아님)'} · 기록 실패 ${hl.recorderFailures}건 · 진행 중 시나리오 ${hl.activeRuns}개`);
}

// ---------- 접속 현황 ----------
function userState(u) {
  const names = u.agents.map(titleOf).join(', ');
  if (u.state === 'using') return h('span', { class: 'chip running' }, h('span', { class: 'dot' }), `에이전트 사용 중: ${names}`);
  if (u.state === 'recent') return h('span', { class: 'chip ok' }, `최근 사용: ${names}`);
  return h('span', { class: 'chip' }, '미사용 (접속만 함)');
}

const selectedUser = () => state.presence?.users.find((u) => u.id === state.userId) ?? null;

// ①에서 사람을 누르면 그 사람이 쓰는 에이전트를 이름만 보여 준다. 지금 쓰는 중이면 깜빡인다. 이름을 누르면 상세로 간다.
function userAgentsPanel() {
  const u = selectedUser();
  if (!u) return h('p', { class: 'muted' }, '사람을 누르면 그 사람이 쓰는 에이전트가 여기에 나옵니다.');
  const using = u.state === 'using';
  const title = using ? '지금 쓰는 에이전트' : u.state === 'recent' ? '최근 쓴 에이전트' : '쓰는 에이전트 없음 (접속만 함)';
  return h('div', { class: 'user-agents' }, h('strong', {}, `${u.label} · ${title}`),
    u.agents.length
      ? h('div', {}, u.agents.map((k) => h('a', { class: `name-chip${using ? ' live' : ''}`, href: `#/agents/${k}` }, using ? h('span', { class: 'dot' }) : null, titleOf(k))))
      : null);
}

function presenceSection() {
  const p = state.presence;
  if (!p) return h('p', { class: 'muted' }, '불러오는 중…');
  const c = p.counts;
  const minutes = Math.round(p.windowMs / 60000);
  return h('div', { class: 'card' },
    h('div', { class: 'card-head' },
      h('span', { class: 'chip' }, `접속 ${c.connected}명`),
      h('span', { class: `chip ${c.using ? 'running' : ''}` }, `에이전트 사용 중 ${c.using}명`),
      h('span', { class: 'chip' }, `최근 사용 ${c.recent}명`), h('span', { class: 'chip' }, `미사용 ${c.idle}명`)),
    h('p', { class: 'muted' }, `최근 ${minutes}분 안에 서버를 쓴 사람 기준입니다. 앱이 서버를 부를 때만 기록됩니다. 서버를 다시 켜면 접속 목록은 비워지지만, 최근에 에이전트를 쓴 사람은 실행 기록에서 다시 채워집니다("기록에서 복원"). 이름 대신 해시 키 앞부분만 보입니다.${p.stable ? '' : ' (RUN_KEY_SECRET이 없어 임시 키를 씁니다. 서버를 다시 켜면 키가 바뀌어서 실제 사용자는 복원되지 않습니다.)'}`),
    p.users.length
      ? h('div', { class: 'table-wrap' }, h('table', {},
        h('thead', {}, h('tr', {}, ['유저', '마지막 활동', '지금 상태'].map((x) => h('th', {}, x)))),
        h('tbody', {}, p.users.map((u) => h('tr', { class: `clickable${u.id === state.userId ? ' picked' : ''}`, onclick: () => { state.userId = u.id === state.userId ? null : u.id; render(true); } }, h('td', {}, u.label, u.demo ? h('span', { class: 'chip' }, '시연(가짜)') : null, u.restored ? h('span', { class: 'chip' }, '기록에서 복원') : null), h('td', {}, ago(u.lastSeenAt)), h('td', {}, userState(u)))))))
      : h('p', { class: 'muted' }, '지금 접속한 사람이 없습니다. [테스트] 페이지에서 시나리오를 돌리면 시연 유저가 나타납니다.'),
    p.users.length ? userAgentsPanel() : null);
}

// ---------- 페이지 ----------
function pageDashboard() {
  const total = state.runs.length;
  const running = state.runs.filter((r) => r.view?.status === 'running').length;
  const notNormal = state.runs.filter((r) => r.view?.status === 'ended' && r.outcome !== 'normal').length;
  const c = state.presence?.counts;
  return h('div', {}, h('h2', {}, '대시보드'),
    h('div', { class: 'cols' },
      h('div', { class: 'card' }, h('h3', {}, '최근 실행 (이 화면 기준)'), h('p', {}, `전체 ${total}건 · 진행 중 ${running}건 · 정상 외 ${notNormal}건`), h('p', { class: 'muted' }, '통계(성공률, 소요 시간, 토큰 합계, 실패 사유)는 다음 단계에서 들어옵니다.')),
      h('div', { class: 'card' }, h('h3', {}, '접속 현황'), c ? h('p', {}, `접속 ${c.connected}명 · 사용 중 ${c.using}명 · 최근 사용 ${c.recent}명 · 미사용 ${c.idle}명`) : h('p', { class: 'muted' }, '-'), h('p', { class: 'muted' }, '사람별 보기는 [에이전트] 페이지에 있습니다.')),
      h('div', { class: 'card' }, h('h3', {}, '저장 상태'), healthLine() ?? h('p', { class: 'muted' }, '-'))));
}

function agentCard(key) {
  const graph = state.graphs[key];
  const runs = state.runs.filter((r) => r.agent === key);
  const running = runs.filter((r) => r.view?.status === 'running').length;
  const bad = runs.filter((r) => r.view?.status === 'ended' && r.outcome !== 'normal').length;
  const users = state.presence?.perAgent?.[key] ?? 0;
  const live = running > 0 || users > 0; // 지금 움직이는 에이전트는 카드가 깜빡인다
  const mine = selectedUser()?.agents.includes(key); // ①에서 누른 사람이 쓰는 에이전트는 테두리로 표시한다
  // 카드에는 이름과 숫자만 보인다. 구조도는 카드를 눌러 들어간 상세(③)에서 본다.
  return h('a', { class: `card card-link agent-name${live ? ' live' : ''}${mine ? ' mine' : ''}`, href: `#/agents/${key}` },
    h('div', { class: 'card-head' }, live ? h('span', { class: 'dot' }) : null, h('h3', {}, graph.title)),
    h('div', {},
      users ? h('span', { class: 'chip running' }, `지금 ${users}명 사용 중`) : null,
      running ? h('span', { class: 'chip running' }, `진행 중 ${running}`) : null,
      h('span', { class: 'chip' }, `실행 ${runs.length}`),
      bad ? h('span', { class: 'chip fail' }, `정상 외 ${bad}`) : null));
}

// 에이전트 첫 화면: ① 지금 접속한 사람 → ② 어느 에이전트가 움직이나 → (카드를 누르면) ③ 에이전트 상세
function pageAgents() {
  const keys = Object.keys(state.graphs);
  const blocks = [];
  const doneGroups = new Set();
  for (const key of keys) {
    const group = state.graphs[key].group;
    if (!group) blocks.push(agentCard(key));
    else if (!doneGroups.has(group)) {
      doneGroups.add(group);
      blocks.push(h('div', { class: 'group' }, h('h3', {}, group), h('div', { class: 'grid names' }, keys.filter((k) => state.graphs[k].group === group).map(agentCard))));
    }
  }
  return h('div', {}, h('h2', {}, '에이전트'),
    h('h3', { class: 'section' }, '① 지금 접속한 사람'), presenceSection(),
    h('h3', { class: 'section' }, '② 어느 에이전트가 움직이나'),
    h('p', { class: 'muted' }, '깜빡이는 카드가 지금 움직이는 에이전트입니다. 카드를 누르면 구조도와 실행 결과를 자세히 봅니다.'),
    h('div', { class: 'grid names' }, blocks));
}

// 그동안의 실행(view)을 합쳐서 구조도에 그릴 "노드 상태"를 만든다. runs는 최근 순이다.
//   노드별 실행·실패 횟수는 더하고, 되돌이 횟수도 더하고, 지금 진행 중인 실행이 있으면 그 노드들이 도는 중으로 본다.
function aggregateView(runs, graph) {
  const nodeStats = {};
  const loopHits = graph.loops.map((l) => ({ from: l.from, to: l.to, count: 0, exhausted: false }));
  const current = new Set();
  const unknown = new Set();
  for (const r of runs) {
    const v = r.view;
    if (!v) continue;
    for (const [id, st] of Object.entries(v.nodeStats)) {
      const agg = (nodeStats[id] ??= { runs: 0, fails: 0, lastReason: null });
      agg.runs += st.runs;
      agg.fails += st.fails;
      if (st.lastReason && !agg.lastReason) agg.lastReason = st.lastReason; // 가장 최근 실패 사유
    }
    v.loopHits.forEach((hit, i) => {
      loopHits[i].count += hit.count;
      loopHits[i].exhausted = loopHits[i].exhausted || hit.exhausted;
    });
    if (v.status === 'running') for (const n of v.currentNodes) current.add(n);
    for (const n of v.unknownNodes) unknown.add(n);
  }
  return { status: current.size ? 'running' : 'ended', currentNodes: [...current], nodeStats, loopHits, unknownNodes: [...unknown] };
}

// ③ 에이전트 상세: 노드 상태(구조도) → 그동안의 실행 목록 → 목록에서 누른 실행의 자세한 결과
function pageAgentDetail(key) {
  const graph = state.graphs[key];
  const runs = state.runs.filter((r) => r.agent === key);
  const users = state.presence?.perAgent?.[key] ?? 0;
  const picked = state.detail?.agent === key ? state.detail : null;
  const clear = () => { state.runId = null; state.detail = null; state.check = null; render(true); };
  return h('div', {}, h('p', {}, h('a', { href: '#/agents' }, '← 에이전트 목록')),
    h('div', { class: 'card-head' }, h('h2', {}, graph.title),
      users ? h('span', { class: 'chip running' }, h('span', { class: 'dot' }), `지금 ${users}명 사용 중`) : null,
      h('span', { class: 'chip' }, `실행 ${runs.length}번`)),
    h('h3', { class: 'section' }, '노드 상태'),
    h('div', { class: 'card' },
      h('div', { class: 'card-head' },
        picked
          ? [h('strong', {}, `선택한 실행 (${fmtTime(picked.startedAt)})의 노드 상태`), h('button', { type: 'button', onclick: clear }, '전체 보기')]
          : h('span', { class: 'muted' }, runs.length ? `최근 ${runs.length}번 실행을 합친 상태입니다. 깜빡이는 노드가 지금 도는 곳, 빨간 테두리가 실패한 곳, 점선 화살표가 되돌이입니다.` : '아직 실행이 없어서 구조만 보입니다.')),
      renderGraph(graph, picked ? picked.view : aggregateView(runs, graph))),
    h('h3', { class: 'section' }, `실행 목록 (${runs.length}번)`),
    runs.length ? h('p', { class: 'muted' }, '실행을 누르면 아래에 시간, 토큰, 프롬프트, 출력, 판정이 전부 나옵니다.') : null,
    runTable(runs, { detailed: true }),
    picked ? [h('h3', { class: 'section' }, '실행 상세'), runDetail(picked, { withGraph: false })] : null);
}

function pageDb() {
  return h('div', {}, h('h2', {}, 'DB'),
    h('div', { class: 'card' }, h('p', { class: 'muted' }, '장소 목록, 장소 직접 추가, 에이전트가 낸 후보의 승인 대기는 다음 단계에서 들어옵니다.')));
}

function pageTest() {
  return h('div', {}, h('h2', {}, '테스트 (시나리오 실행)'),
    h('p', { class: 'muted' }, '가짜 LLM으로 구조도를 따라 도는 시연입니다. 실제 LLM은 부르지 않고 비용은 0원입니다. 토큰 수와 프롬프트도 가짜입니다. 실행하면 시연 유저(가짜)가 에이전트를 쓰는 것으로 기록됩니다.'),
    healthLine(),
    h('div', { class: 'card' }, state.scenarios.map((sc) => h('div', { class: 'scenario' },
      h('div', {}, h('strong', {}, sc.title), h('div', { class: 'muted' }, sc.description)),
      h('button', { type: 'button', class: 'primary', disabled: state.busy, onclick: () => startScenario(sc.name) }, '실행')))),
    h('h3', {}, '최근 실행'), runTable(state.runs.slice(0, 8)),
    state.detail ? runDetail(state.detail) : null);
}

function route() {
  const [page, key] = location.hash.replace(/^#\/?/, '').split('/');
  const known = ['dashboard', 'agents', 'db', 'test'].includes(page) ? page : 'agents';
  return { page: known, key: known === 'agents' && key && state.graphs?.[key] ? key : null };
}

function render(force = false) {
  const { page, key } = route();
  const tick = page === 'agents' && !key ? Math.floor(Date.now() / 5000) : 0; // "n분 전" 글자를 가끔 새로 그린다
  const sig = JSON.stringify([page, key, tick, state.runs, state.health, state.presence, state.detail, state.check, state.error, state.runId, state.busy, state.userId, state.auth, state.loginError, state.loginBusy]);
  if (!force && sig === lastSig) return;
  lastSig = sig;
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('active', a.dataset.page === page);
  document.getElementById('logout-btn').hidden = state.auth !== 'ok';
  const main = document.getElementById('main');
  let content;
  if (state.auth === 'login') content = pageLogin();
  else if (state.auth === 'closed') content = pageClosed();
  else if (state.error) content = h('p', { class: 'notice' }, state.error);
  else if (!state.graphs) content = h('p', { class: 'muted' }, '불러오는 중…');
  else content = page === 'agents' ? (key ? pageAgentDetail(key) : pageAgents()) : { dashboard: pageDashboard, db: pageDb, test: pageTest }[page]();
  main.replaceChildren(content);
}

// ---------- 동작 ----------
async function selectRun(id) {
  state.runId = id;
  state.check = null;
  state.detail = (await api(`runs/${id}`).catch(() => null))?.run ?? null;
  render(true);
}
async function startScenario(name) {
  state.busy = true;
  render(true);
  try {
    const { runId } = await api(`scenarios/${name}/run`, { method: 'POST' });
    state.runId = runId;
    state.check = null;
    await poll();
  } catch (err) {
    state.error = err.status === 429 ? '동시에 도는 시나리오가 너무 많습니다. 잠시 뒤에 다시 하세요.' : explain(err);
  }
  state.busy = false;
  render(true);
}
async function runCheck(id) {
  state.busy = true;
  render(true);
  try {
    state.check = { runId: id, ...(await api(`runs/${id}/check`, { method: 'POST' })) };
    state.error = null;
  } catch (err) {
    state.error = err.status === 409 ? '실행이 아직 끝나지 않았습니다.' : explain(err);
  }
  state.busy = false;
  render(true);
}

async function poll() {
  try {
    const [runs, health, presence] = await Promise.all([api('runs?limit=60'), api('health'), api('presence')]);
    state.runs = runs.runs;
    state.health = health;
    state.presence = presence;
    if (state.userId && !presence.users.some((u) => u.id === state.userId)) state.userId = null; // 접속 목록에서 사라진 사람은 선택을 푼다
    if (state.runId) state.detail = (await api(`runs/${state.runId}`).catch(() => null))?.run ?? null;
    if (state.error && state.error.startsWith('서버')) state.error = null;
  } catch (err) {
    if (!needLogin(err)) state.error = explain(err); // 쿠키가 만료되면 로그인 화면으로 돌아간다
  }
  render();
}

// 구조도·시나리오 목록을 받고 첫 조회를 한다. 처음 열 때와 로그인 직후에 부른다.
async function load() {
  try {
    const [g, sc] = await Promise.all([api('graphs'), api('scenarios')]);
    state.graphs = g.graphs;
    state.limits = g.limits;
    state.scenarios = sc.scenarios;
    state.error = null;
    state.auth = 'ok';
  } catch (err) {
    if (!needLogin(err)) state.error = explain(err);
  }
  if (state.auth === 'ok') await poll();
  render(true);
}

async function boot() {
  document.getElementById('logout-btn').addEventListener('click', logout);
  window.addEventListener('hashchange', () => {
    state.runId = null;
    state.detail = null;
    state.check = null;
    render(true);
  });
  await load();
  setInterval(() => { if (!document.hidden && state.auth === 'ok') poll(); }, POLL_MS);
}
boot();
