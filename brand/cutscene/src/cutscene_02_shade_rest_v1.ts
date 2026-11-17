// 컷씬 ② "그늘 아래, 숨 고르기" — 납작만두 가게 앞 그늘에서 하랑이가 숨을 고르는 회상 장면 (창작 시안 v1)
// 근거: brand/worldview.md 3-5절 (컷씬 ②, 후보 A), brand/character/profile/harangi_character.md 6절
// 견습생이 되기 전의 일이라 부채·후드 조끼·포쉐트가 없다. 주머니는 가게 주인이 걸어 두는 선물이다.
import { el, pen, shape, blot, paint, limb, solid, f, pt, inkDefs, run, INK, PAPER, type Pt, type Vec } from '../lib/ink.ts';
import { spring, pendulum, pointerWind, seeded, wobble, ease, lerp, clamp, smooth } from '../lib/motion.ts';

const W = 960, H = 540, GY = 430;
const RED = '#dc3b30', RED_D = '#9c2420', CREAM = '#f8e4cc', LEAF = '#6d9a58';
const BLUE = '#a9b9cc', EYE = '#2f62b0', POUCH = '#f7ecd8', WATER = '#cfe4f3', DARK = '#2b2e3b', DARK2 = '#3a3e4f';
const PS = 1.5, PD = 0.7;

const svg = document.getElementById('scene') as unknown as SVGSVGElement;
svg.style.setProperty('--paper', '#fdfcf8');
const ink = inkDefs(svg);
const R = seeded(7);
const world = el('g', { filter: ink.filter }, svg);

type Upd = (t: number, dt: number, w: number) => void;
const ups: Upd[] = [];

// ---------- small helpers ----------
const line = (g: Element, d: string, w = PS, op = 1): SVGPathElement => {
  const p = pen(g, w); p.setAttribute('d', d); if (op < 1) p.setAttribute('opacity', String(op)); return p;
};
const sh = (g: Element, d: string, w = PS): SVGPathElement => { const p = shape(g, w); p.setAttribute('d', d); return p; };
const pa = (g: Element, c: string, d: string, w = PS): SVGPathElement => { const p = paint(g, c, w); p.setAttribute('d', d); return p; };
const rect = (x: number, y: number, w: number, h: number, r = 0): string =>
  r ? `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`
    : `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
function track(keys: Array<[number, number]>): (t: number) => number {
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
      if (t < t1) return lerp(v0, v1, ease((t - t0) / (t1 - t0)));
    }
    return keys[keys.length - 1][1];
  };
}
function ik(a: Pt, b: Pt, l1: number, l2: number, down: boolean): { mid: Vec; end: Vec } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const dist = clamp(Math.hypot(dx, dy), 0.8 * 1, l1 + l2 - 0.01), th = Math.atan2(dy, dx);
  const al = Math.acos(clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1));
  const c1: Vec = [a[0] + l1 * Math.cos(th - al), a[1] + l1 * Math.sin(th - al)];
  const c2: Vec = [a[0] + l1 * Math.cos(th + al), a[1] + l1 * Math.sin(th + al)];
  const mid = (c1[1] > c2[1]) === down ? c1 : c2;
  return { mid, end: [a[0] + dist * Math.cos(th), a[1] + dist * Math.sin(th)] };
}

const ownerLean = ((): ((t: number) => number) => track([[0, 0], [2.3, 0], [3.0, 1], [4.4, 1], [5.3, 0]]))();
let last = 0, t0 = 0;

// ---------- defs ----------
const hatch = el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(-38)' }, ink.defs);
el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: INK, 'stroke-width': 0.6 }, hatch);
const glare = el('radialGradient', { id: 'glare', cx: 0.86, cy: 0.2, r: 0.5 }, ink.defs);
el('stop', { offset: 0, 'stop-color': '#ffd27a', 'stop-opacity': 0.6 }, glare);
el('stop', { offset: 1, 'stop-color': '#ffe7b0', 'stop-opacity': 0 }, glare);
const wallClip = el('clipPath', { id: 'tailclip' }, ink.defs);

// ---------- far street (right edge, faded) ----------
{
  const g = el('g', { opacity: 0.42 }, world);
  sh(g, `M760 ${GY}V268Q860 250 ${W + 10} 262V${GY}Z`, 1.1);
  for (let i = 0; i < 14; i++) line(g, `M${762 + i * 15} 268V${254 - (i % 4 === 0 ? 14 : 8)}`, 0.7);
  line(g, `M752 270Q860 248 ${W + 10} 262`, 1.2);
  for (const x of [790, 880]) {
    sh(g, rect(x, 296, 46, 52), 1.0);
    for (let k = 1; k < 4; k++) line(g, `M${x + k * 11.5} 296V348`, 0.5);
    line(g, `M${x} 322H${x + 46}`, 0.5);
  }
  sh(g, rect(846, 340, 30, GY - 340), 1.0);
  line(g, `M834 60V${GY - 8}`, 1.4); line(g, 'M812 104H858', 1.2);
  line(g, `M834 108Q800 128 ${W + 10} 120`, 0.6);
}

// ---------- sun (a pale ring with rays, top right) ----------
{
  const g = el('g', { opacity: 0.6 }, world);
  line(g, 'M775 150a30 30 0 1 0 0.1 0Z', 0.9);
  const rays: SVGPathElement[] = [];
  for (let i = 0; i < 14; i++) rays.push(line(g, 'M0 0', 0.8));
  ups.push((t) => rays.forEach((p, i) => {
    const a = (i / 14) * Math.PI * 2 + t * 0.05, r0 = 38 + 2 * Math.sin(t * 1.2 + i), r1 = 50 + 4 * Math.sin(t * 1.1 + i * 1.7);
    p.setAttribute('d', `M${f(745 + Math.cos(a) * r0)} ${f(150 + Math.sin(a) * r0)}L${f(745 + Math.cos(a) * r1)} ${f(150 + Math.sin(a) * r1)}`);
  }));
}

// ---------- shop front ----------
const shop = el('g', {}, world);
// pilaster + plaster texture
sh(shop, rect(704, 100, 18, GY - 100), PS);
line(shop, `M708 100V${GY}`, 0.5, 0.6);
for (let i = 0; i < 70; i++) {
  const x = R(8, 690), y = R(214, 420);
  if ((x > 30 && x < 270 && y > 212) || (x > 490 && x < 672 && y > 220 && y < 360)) continue;
  const l = R(5, 14);
  line(shop, `M${f(x)} ${f(y)}q${f(l / 2)} ${f(R(-1.5, 1.5))} ${f(l)} ${f(R(-1, 1))}`, 0.45, 0.45);
}
// drain pipe
sh(shop, rect(10, 126, 9, GY - 126), 1.0);
for (const y of [160, 270, 380]) blot(shop).setAttribute('d', rect(7, y, 15, 4, 1.5));

// door (sliding lattice panels)
sh(shop, rect(30, 214, 240, GY - 214), PS + 0.2);
for (const [x0, x1] of [[36, 148], [152, 264]] as const) {
  sh(shop, rect(x0, 220, x1 - x0, GY - 226), 1.1);
  line(shop, `M${x0} 306H${x1}`, 0.9);
  let k = 0;
  for (let x = x0 + 9; x < x1 - 4; x += 11, k++) line(shop, `M${x} ${k % 4 === 0 ? 220 : 228}V${k % 4 === 0 ? 306 : 298}`, 0.55);
  line(shop, `M${x0 + 3} 262H${x1 - 3}`, 0.45);
  for (const y of [330, 352, 374, 396]) line(shop, `M${x0 + 4} ${y}q${(x1 - x0) / 2} 3 ${x1 - x0 - 8} 0`, 0.4, 0.55);
  blot(shop).setAttribute('d', rect(x0 === 36 ? 140 : 156, 340, 3, 22, 1.4));
}

// wall shelf: kettle and a stack of bowls
{
  sh(shop, rect(290, 296, 84, 7, 2), PS);
  line(shop, 'M300 303l-4 9M364 303l4 9', 1.0);
  sh(shop, 'M304 296Q304 272 322 272Q340 272 340 296Z', 1.2);
  line(shop, 'M310 272Q322 262 334 272', 1.2); line(shop, 'M340 288Q352 284 354 276', 1.2); line(shop, 'M304 288Q296 288 295 281', 1.0);
  for (let i = 0; i < 3; i++) sh(shop, `M${350 - i * 0} ${296 - i * 8}h22q-2 8 -11 8t-11 -8Z`, 0.9);
}

// window / serving hatch with a dim interior and the owner as a silhouette
sh(shop, rect(492, 218, 176, 136), PS + 0.2);
const interior = el('path', { d: rect(502, 228, 156, 116, 2), fill: DARK }, shop);
for (const x of [520, 548]) el('path', { d: `M${x} 232V262`, stroke: '#8d92a6', 'stroke-width': 0.8, opacity: 0.35, fill: 'none' }, shop);
const owner = el('g', {}, shop);
el('path', { d: 'M566 344Q568 280 596 274Q632 268 650 300Q658 322 656 344Z', fill: DARK2 }, owner);
el('path', { d: 'M588 274Q594 250 612 250Q630 250 630 272Q612 282 588 274Z', fill: DARK2 }, owner);
ups.push((t) => { const L = ownerLean(last - t0 > 0 ? last - t0 : 0); owner.setAttribute('transform', `translate(${f(-56 * L)} ${f(0.8 * Math.sin(t * 0.9) + 4 * L)}) rotate(${f(-5 * L)} 610 330)`); });
void interior;
sh(shop, rect(482, 346, 196, 11, 3), PS);                       // sill
for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) {         // tile band under the sill
  const x = 492 + c * 18, y = 358 + r * 18;
  if (x + 18 <= 688) line(shop, `M${x} ${y}h18v18`, 0.45, 0.7);
}
sh(shop, 'M492 358V' + GY + 'H690V358', 0.9).setAttribute('fill', 'none');

// ground
const ground = el('g', {}, world);
sh(ground, rect(-5, GY, W + 10, H - GY + 5), PS);
for (const [y0, y1, xs] of [[GY, 470, [90, 250, 410, 570, 730, 890]], [470, 508, [170, 330, 490, 650, 810]], [508, H, [60, 220, 380, 540, 700, 860]]] as const) {
  line(ground, `M0 ${y1}H${W}`, PD, 0.7);
  for (const x of xs) line(ground, `M${x} ${y0}V${y1}`, PD, 0.7);
}
el('path', { d: `M0 ${GY}H744L676 ${H}H0Z`, fill: 'url(#hatch)', opacity: 0.4 }, ground);

// ---------- awning (stripes sway with the wind) ----------
const awning = el('g', {}, world);
const panels: SVGPathElement[] = [];
for (let i = 0; i < 19; i++) panels.push(i % 2 ? sh(awning, '', 1.1) : pa(awning, BLUE, '', 1.1));
line(awning, 'M-10 90H750', 0.8, 0.8);
ups.push((t, _dt, w) => panels.forEach((p, i) => {
  const x0 = -20 + i * 40, sag = 126 + w * 1.4 * Math.sin(t * 1.3 + i * 0.55) + 1.2 * Math.sin(t * 2.3 + i);
  p.setAttribute('d', `M${x0} -6H${x0 + 40}V114Q${x0 + 20} ${f(sag)} ${x0} 114Z`);
}));
// sign plank (납작만두) on two cords
const sign = el('g', {}, world);
line(sign, 'M266 118V150M374 118V150', 0.9);
sh(sign, rect(240, 148, 160, 54, 4), PS);
sh(sign, rect(246, 154, 148, 42, 3), 0.6);
const txt = el('text', { x: 320, y: 188, 'text-anchor': 'middle', 'font-size': 32, 'font-weight': 700, 'letter-spacing': 4, fill: INK, style: "font-family:'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif" }, sign);
txt.textContent = '납작만두';
ups.push((t, _dt, w) => sign.setAttribute('transform', `rotate(${f(w * 0.9 + 0.8 * Math.sin(t * 1.1))} 320 118)`));

// noren (cloth curtain) in the doorway
const noren = el('g', {}, world);
line(noren, 'M66 224H234', 2.2);
blot(noren).setAttribute('d', 'M62 221a4 4 0 1 0 0.1 0Zm172 0a4 4 0 1 0 0.1 0Z');
const nPanels = [0, 1, 2].map(() => pa(noren, BLUE, '', 1.2));
const emblem = line(noren, '', 0.9);
ups.push((t, _dt, w) => {
  nPanels.forEach((p, i) => {
    const x0 = 72 + i * 54, sway = w * 6 + 2.2 * Math.sin(t * 1.5 + i * 0.9), top = 226, bot = 328;
    p.setAttribute('d', `M${x0} ${top}H${x0 + 50}L${f(x0 + 50 + sway)} ${bot}Q${f(x0 + 25 + sway * 1.1)} ${bot + 4} ${f(x0 + sway)} ${bot}Z`);
  });
  const s = (w * 6 + 2.2 * Math.sin(t * 1.5 + 0.9)) * 0.42;
  emblem.setAttribute('d', `M${f(150 + s + 11)} 268a11 11 0 1 0 -0.1 0Z`);
});

// tub with a plant, in the sun
{
  const g = el('g', {}, world);
  sh(g, `M742 ${GY - 40}H794L790 ${GY}H746Z`, 1.3);
  line(g, `M744 ${GY - 30}H792`, 0.6);
  const leaves: SVGPathElement[] = [];
  for (let i = 0; i < 7; i++) leaves.push(line(g, '', 1.2));
  ups.push((t, _dt, w) => leaves.forEach((p, i) => {
    const a = -1.2 + i * 0.4, len = 44 + (i % 3) * 8, sway = (w * 6 + 2 * Math.sin(t * 1.4 + i)) * (len / 50);
    const x1 = 768 + Math.sin(a) * len + sway, y1 = GY - 40 - Math.cos(a) * len;
    p.setAttribute('d', `M${768 + (i - 3) * 3} ${GY - 40}Q${f(768 + Math.sin(a) * len * 0.3)} ${f(GY - 40 - len * 0.75)} ${f(x1)} ${f(y1)}`);
  }));
}

// heat shimmer over the sunlit pavement
{
  const g = el('g', {}, world);
  const ss: Array<{ p: SVGPathElement; x: number; y: number; k: number }> = [];
  for (let i = 0; i < 8; i++) ss.push({ p: line(g, '', 0.7, 0.5), x: R(760, 900), y: R(GY - 34, GY - 2), k: R(0, 6) });
  ups.push((t) => ss.forEach((s) => {
    const x = s.x + 8 * Math.sin(t * 0.4 + s.k), y = s.y - 5 * ((t * 0.12 + s.k) % 1);
    s.p.setAttribute('d', `M${f(x)} ${f(y)}q8 -3 16 0t16 0t16 0`);
    s.p.setAttribute('opacity', String(0.55 * Math.sin(Math.PI * ((t * 0.12 + s.k) % 1))));
  }));
}

// ---------- stool, chair ----------
const stoolX = 352, stoolTop = GY - 34;
{
  const g = el('g', {}, world);
  line(g, `M${stoolX - 16} ${stoolTop + 7}L${stoolX - 20} ${GY}M${stoolX + 16} ${stoolTop + 7}L${stoolX + 20} ${GY}M${stoolX - 18} ${GY - 14}H${stoolX + 18}`, 1.3);
  sh(g, rect(stoolX - 24, stoolTop, 48, 8, 3), PS);
}
const chairX = 432, hookX = 432, hookY = GY - 150;
{
  const g = el('g', {}, world);
  for (const dx of [-34, 34]) { line(g, `M${chairX + dx} ${GY - 168}V${GY - 86}`, 3.4); line(g, `M${chairX + dx} ${GY - 86}L${chairX + dx * 1.18} ${GY}`, 3); }
  for (const dx of [-24, 24]) line(g, `M${chairX + dx} ${GY - 76}L${chairX + dx * 1.1} ${GY}`, 2.2);
  sh(g, rect(chairX - 38, GY - 170, 76, 14, 6), PS);
  for (let k = 0; k < 3; k++) line(g, `M${chairX - 20 + k * 20} ${GY - 156}V${GY - 110}`, 1.0);
  sh(g, rect(chairX - 36, GY - 114, 72, 8, 3), PS);
  sh(g, rect(chairX - 46, GY - 88, 92, 12, 5), PS);
  line(g, `M${chairX - 34} ${GY - 40}H${chairX + 34}`, 1.1);
  blot(g).setAttribute('d', `M${hookX - 2} ${hookY - 6}h4v10h-4zM${hookX - 5} ${hookY + 1}h10v3h-10z`);
}

// ---------- Harangi ----------
const S = 0.95, X0 = 300;
const figBack = el('g', {}, world), cupG = el('g', {}, world), figFront = el('g', {}, world);
const shadow = el('ellipse', { cx: X0 + 6, cy: GY + 2, rx: 52, ry: 5, fill: INK, opacity: 0.16 }, figBack);
const fig = el('g', {}, figBack);
const tailG = el('g', {}, fig);
const TAIL = 'M-14 -12C-52 -10-78 -34-68 -68C-62 -92-30 -106-16 -88C-36 -88-44 -66-38 -48C-34 -34-26 -26-10 -28Z';
el('path', { d: TAIL }, wallClip);
pa(tailG, RED, TAIL, 0).setAttribute('stroke', 'none');
const tip = el('path', { d: 'M-72 -64C-66 -96-30 -112-12 -88C-30 -92-50 -86-66 -60Z', fill: CREAM, 'clip-path': 'url(#tailclip)' }, tailG);
void tip;
line(tailG, TAIL, PS);
const bodyG = el('g', {}, fig);
const breathG = el('g', {}, bodyG);
pa(breathG, RED, 'M-22 -6C-30 -28-22 -56 2 -58C26 -58 32 -30 24 -6C12 2-10 2-22 -6Z', PS);
el('path', { d: 'M3 -22C-6 -30-4 -48 6 -50C18 -48 22 -30 14 -20C10 -17 6 -18 3 -22Z', fill: CREAM }, breathG);
const leg = pa(fig, RED, 'M-6 -16C4 -26 22 -20 30 -12C37 -8 36 -2 28 -2H6C-4 -2-10 -8-6 -16Z', PS);
void leg;
for (const x of [31, 34.5, 38]) line(fig, `M${x} -9q2.5 3 0.6 6.5`, 0.8);
el('path', { d: 'M24 -8c3 0 6 2 6 5c-3 1-6 0-6-5Z', fill: CREAM, opacity: 0.0 }, fig);

const headG = el('g', {}, fig);
const earL = el('g', {}, headG), earR = el('g', {}, headG);
for (const [g, cx, cy] of [[earL, -17, -40], [earR, 22, -41]] as const) {
  const c = pa(g, RED, `M${cx - 9.5} ${cy}a9.5 9.5 0 1 0 19 0a9.5 9.5 0 1 0 -19 0Z`, PS);
  void c;
  el('path', { d: `M${cx - 5} ${cy + 1}a5 5 0 1 0 10 0a5 5 0 1 0 -10 0Z`, fill: CREAM }, g);
}
pa(headG, RED, 'M-26 -20C-26 -38-12 -44 2 -44C16 -44 29 -38 29 -20C29 -4 14 2 2 2C-12 2-26 -4-26 -20Z', PS);
el('path', { d: 'M-22 -12C-19 -23-6 -19 2 -19C10 -19 23 -23 26 -12C28 -3 14 0 2 0C-10 0-24 -3-22 -12Z', fill: CREAM }, headG);
blot(headG).setAttribute('d', 'M1.8 -9a2.6 1.9 0 1 0 5.2 0a2.6 1.9 0 1 0 -5.2 0Z');
const mouthOpen = pa(headG, RED_D, '', 0.8);
const mouthLine = line(headG, '', 1.0);
const eyeG = [el('g', {}, headG), el('g', {}, headG)];
const eyeParts = eyeG.map((g) => ({
  iris: paint(g, EYE, 0.8), pupil: blot(g), hi: el('circle', { r: 0.8, fill: PAPER }, g), lid: pen(g, 1.0), closed: pen(g, 1.1),
}));
const cheekDrops = [0, 1].map(() => sh(headG, '', 0.8));
const leaf = el('g', {}, headG);
pa(leaf, LEAF, 'M0 0C4 -7 14 -8 21 -1C14 5 5 6 0 0Z', 1.0);
line(leaf, 'M1 0Q10 -1 19 -1', 0.6);
line(headG, 'M2 -43Q3 -47 5 -49', 1.0);

const puff = [0, 1, 2].map(() => line(figFront, '', 0.9));
const armG = el('g', {}, figFront);
const arm = solid(limb(armG, 6.4, PS), RED);
const paw = pa(armG, RED, '', PS);

// cup (in scene coordinates)
const cup = el('g', {}, cupG);
const water = el('path', { d: 'M-5.4 -9Q0 -7.4 5.4 -9L4.4 -1.5H-4.4Z', fill: WATER }, cup);
sh(cup, 'M-7 -17H7L5.6 0H-5.6Z', 1.3).setAttribute('fill', 'none');
line(cup, 'M-7 -17H7', 1.6);
line(cup, 'M-3 -13l-0.8 8', 0.5, 0.7);

// owner's hand + pouch (in scene coordinates)
const pouchG = el('g', {}, world);
const strap = line(pouchG, 'M0 0V26', 0.9);
line(pouchG, 'M-5 24Q0 29 5 24', 0.9);
const pouchBody = pa(pouchG, POUCH, 'M-16 28Q-4 26 0 28Q4 26 16 28Q19 47 0 52Q-19 47 -16 28Z', 1.2);
void pouchBody;
for (let i = 0; i < 9; i++) { const a = Math.PI * (0.08 + (i / 8) * 0.84); line(pouchG, `M${f(Math.cos(a) * 16.5)} ${f(30 + Math.sin(a) * 21)}l${f(Math.cos(a) * 3)} ${f(Math.sin(a) * 3)}`, 0.6); }
line(pouchG, 'M-9 33Q0 38 9 33', 0.5, 0.7);
const ownerArm = el('g', {}, world);
const upper = solid(limb(ownerArm, 15, PS), BLUE), fore = limb(ownerArm, 10, PS);
const elbow = pa(ownerArm, BLUE, '', PS);
const hand = sh(ownerArm, '', 1.2);
const fingers = line(ownerArm, '', 0.8);

// overlays: warm glare + cool shade (multiply keeps ink black)
const ov = el('g', { 'pointer-events': 'none', style: 'mix-blend-mode:multiply' }, svg);
el('rect', { width: W, height: H, fill: 'url(#glare)' }, ov);
el('path', { d: `M-5 116H744V${GY}L676 ${H}H-5Z`, fill: '#bccbe6', opacity: 0.4 }, ov);

// ---------- timeline ----------
const T_HOOK = 3.9;

const tr = {
  lean: track([[0, 9], [3.0, 9], [3.6, 3], [5.2, 3], [6.5, 12], [7.6, 1], [9.0, -2], [10.4, 0.5]]),
  headRot: track([[0, 15], [2.9, 15], [3.8, -15], [5.0, -13], [5.7, 12], [6.7, 16], [7.7, -5], [8.5, -15], [9.4, -4], [10.6, 3]]),
  headDy: track([[0, 5], [3.0, 5], [4.0, 0], [9, 0]]),
  eyeOpen: track([[0, 0.34], [3.0, 0.34], [3.7, 1], [7.2, 0.9], [7.8, 0], [11.2, 0], [11.9, 0.9]]),
  eyeCurve: track([[0, -0.4], [7.4, -0.2], [8.2, 1]]),
  lookX: track([[0, 0], [3.2, 0], [3.8, 1.8], [5.0, 1.4], [5.6, 1.6], [7.4, 0.4]]),
  lookY: track([[0, 1.2], [3.2, 1.2], [3.9, -2.4], [5.1, -2.4], [5.7, 2.2], [7.0, 0], [8, 0]]),
  pant: track([[0, 1], [3.0, 1], [4.0, 0.3], [6.0, 0.1], [8.0, 0]]),
  smile: track([[0, 0], [8.4, 0], [9.4, 1]]),
  leaf: track([[0, 1], [3.0, 1], [3.7, 0.8], [5.2, 0.55], [7.6, 0.25], [9.6, 0], [20, 0]]),
  tail: track([[0, -40], [3.4, -40], [6.0, -20], [9.0, -4], [10.6, 7]]),
  scoot: track([[0, 0], [5.4, 0], [6.5, 20]]),
  sweat: track([[0, 1], [3.4, 1], [4.8, 0]]),
  rate: track([[0, 1.9], [3.2, 1.9], [5.0, 1.0], [8.4, 0.7], [9.2, 0.45]]),
  amp: track([[0, 1.5], [3.2, 1.5], [5.0, 0.9], [9.0, 0.6]]),
  flap: track([[0, 1], [3.0, 1], [3.7, 0]]),
  reach: track([[0, 0], [5.4, 0], [6.4, 1]]),
  lift: track([[0, 0], [6.7, 0], [8.1, 1]]),
  lower: track([[0, 0], [9.1, 0], [10.3, 1]]),
  water: track([[0, 0], [8.0, 0], [8.6, 0.5], [9.2, 0.5]]),
  breath: track([[8.7, 0], [9.0, 1], [10.6, 0]]),
  armOp: track([[0, 0], [2.3, 0], [2.8, 1], [5.0, 1], [5.5, 0]]),
};
const sp = { lean: spring(34, 9.5, 9), head: spring(34, 9.5, 15), paw: [spring(40, 10, 30), spring(40, 10, -46)], leaf: spring(60, 7, 1), tail: spring(26, 6, -40) };
let phase = 0;
const pouchP = pendulum(9, 0.9);
let released = false;
const wind = pointerWind(svg, 0.4);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const rot = (p: Pt, a: number, c: Pt): Vec => { const r = (a * Math.PI) / 180, dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * Math.cos(r) - dy * Math.sin(r), c[1] + dx * Math.sin(r) + dy * Math.cos(r)]; };

function eye(i: number, cx: number, cy: number, open: number, curve: number, lx: number, ly: number): void {
  const e = eyeParts[i];
  if (open > 0.18) {
    const ry = 3.9 * Math.min(1, open);
    e.iris.setAttribute('d', `M${cx - 3.7} ${cy}a3.7 ${f(ry)} 0 1 0 7.4 0a3.7 ${f(ry)} 0 1 0 -7.4 0Z`);
    e.pupil.setAttribute('d', `M${f(cx + lx - 1.9)} ${f(cy + ly * 0.5)}a1.9 ${f(1.9 * Math.min(1, open + 0.2))} 0 1 0 3.8 0a1.9 ${f(1.9 * Math.min(1, open + 0.2))} 0 1 0 -3.8 0Z`);
    e.hi.setAttribute('cx', f(cx + lx + 0.8)); e.hi.setAttribute('cy', f(cy + ly * 0.5 - 0.9));
    e.lid.setAttribute('d', `M${cx - 5.4} ${f(cy - ry + 0.2)}Q${cx} ${f(cy - ry - 3)} ${cx + 5.4} ${f(cy - ry + 0.2)}`);
    e.closed.setAttribute('d', '');
    e.hi.setAttribute('opacity', '1');
  } else {
    e.iris.setAttribute('d', ''); e.pupil.setAttribute('d', ''); e.lid.setAttribute('d', ''); e.hi.setAttribute('opacity', '0');
    e.closed.setAttribute('d', `M${cx - 4.8} ${f(cy + 0.4)}Q${cx} ${f(cy + 0.4 - 5 * curve)} ${cx + 4.8} ${f(cy + 0.4)}`);
  }
}

const draw = (tt: number, dt: number): void => {
  last = tt;
  const T = reduce ? 12 : tt - t0;
  const w = wind.step(tt);
  ups.forEach((u) => u(tt, dt, w));

  // --- Harangi pose targets ---
  phase += dt * tr.rate(T) * Math.PI * 2;
  const br = Math.sin(phase), panting = tr.pant(T);
  const lean = sp.lean.step(tr.lean(T) + 0.9 * tr.amp(T) * br * (panting > 0.2 ? 1 : 0.5), dt);
  const headRot = sp.head.step(tr.headRot(T), dt);
  const droop = sp.leaf.step(tr.leaf(T), dt);
  const tailA = sp.tail.step(tr.tail(T), dt) + 3 * wobble(tt, 0.9);
  const scoot = tr.scoot(T), dy = tr.headDy(T) + 0.5 * tr.amp(T) * br;
  const flat = `translate(${f(X0)} ${GY}) scale(${S}) translate(${f(scoot)} 0)`;
  shadow.setAttribute('cx', f(X0 + 6 + scoot * S));
  fig.setAttribute('transform', flat); figFront.setAttribute('transform', flat);
  const B: Vec = [0, -4];
  tailG.setAttribute('transform', `rotate(${f(tailA)} -14 -14)`);
  bodyG.setAttribute('transform', `rotate(${f(lean)} 0 -4)`);
  breathG.setAttribute('transform', `translate(0 -4) scale(${f(1 + 0.018 * tr.amp(T) * br)} ${f(1 + 0.03 * tr.amp(T) * br)}) translate(0 4)`);
  const neck = rot([4, -52], lean, B);
  headG.setAttribute('transform', `translate(${f(neck[0])} ${f(neck[1] + dy)}) rotate(${f(lean * 0.5 + headRot)})`);
  earL.setAttribute('transform', `rotate(${f(-20 * droop)} -14 -34)`);
  earR.setAttribute('transform', `rotate(${f(20 * droop)} 20 -35)`);
  leaf.setAttribute('transform', `translate(2 -44) rotate(${f(lerp(-64, 78, droop) + 4 * wobble(tt, 1.4))})`);

  // face
  const blinkT = (tt * 0.33) % 1;
  const blink = T > 11.9 ? 1 - Math.sin(Math.PI * clamp((blinkT - 0.9) / 0.1, 0, 1)) * 0.9 : 1;
  const open = tr.eyeOpen(T) * blink, curve = tr.eyeCurve(T), lx = tr.lookX(T), ly = tr.lookY(T);
  eye(0, -6, -14, open, curve, lx, ly); eye(1, 15, -14, open, curve, lx, ly);
  const m = panting * (0.5 + 0.5 * Math.max(0, Math.sin(phase - 0.6))) * 0.9, sm = tr.smile(T);
  if (m > 0.12) {
    mouthOpen.setAttribute('d', `M${f(4 - 3.2)} -2.5a3.2 ${f(3.6 * m)} 0 1 0 6.4 0a3.2 ${f(3.6 * m)} 0 1 0 -6.4 0Z`);
    mouthLine.setAttribute('d', '');
  } else {
    mouthOpen.setAttribute('d', '');
    mouthLine.setAttribute('d', `M-2 -3Q4 ${f(lerp(-1.4, 3.2, sm))} 10 -3`);
  }
  cheekDrops.forEach((p, k) => {
    const u = (tt * 0.42 + k * 0.5) % 1, o = tr.sweat(T) * Math.sin(Math.PI * u);
    if (o < 0.05) { p.setAttribute('d', ''); return; }
    const x = -24 - 3 * u, y = -34 + 26 * u;
    p.setAttribute('d', `M${f(x)} ${f(y - 4)}Q${f(x + 3.4)} ${f(y + 1)} ${f(x)} ${f(y + 3.2)}Q${f(x - 3.4)} ${f(y + 1)} ${f(x)} ${f(y - 4)}Z`);
    p.setAttribute('opacity', f(o));
  });

  // --- cup + arm (fig space IK) ---
  const toScene = (p: Pt): Vec => [X0 + S * (p[0] + scoot), GY + S * p[1]];
  const toFig = (p: Pt): Vec => [(p[0] - X0) / S - scoot, (p[1] - GY) / S];
  const hr = lean * 0.5 + headRot, mouthFig = ((): Vec => { const q = rot([neck[0] + 4 + 8 * Math.cos((hr * Math.PI) / 180), 0], 0, [0, 0]); void q;
    const loc = rot([4, -3], hr, [0, 0]); return [neck[0] + loc[0], neck[1] + dy + loc[1]]; })();
  const stoolCup: Vec = [stoolX, stoolTop - 9];
  const mouthScene = toScene(mouthFig);
  const lapScene = toScene([30, -28]);
  const liftK = tr.lift(T), lowK = tr.lower(T);
  let cupPos: Vec = [lerp(stoolCup[0], mouthScene[0] + 7, liftK), lerp(stoolCup[1], mouthScene[1] + 4, liftK) - 10 * Math.sin(Math.PI * liftK)];
  cupPos = [lerp(cupPos[0], lapScene[0], lowK), lerp(cupPos[1], lapScene[1], lowK)];
  cup.setAttribute('transform', `translate(${f(cupPos[0])} ${f(cupPos[1] + 9)}) rotate(${f(-8 * (liftK - lowK) * Math.max(0, -headRot / 15))})`);
  water.setAttribute('transform', `translate(0 ${f(tr.water(T) * 5.2)})`);
  const grab = toFig([cupPos[0] - 7, cupPos[1] + 4]);
  const flapAmp = tr.flap(T);
  const fl = Math.sin(tt * 7.5) * flapAmp;
  const restPaw: Vec = T < 3.6 ? [30 + 5 * fl, -50 + 3 * fl] : [26, -16];
  const base: Vec = [lerp(30 + 5 * fl, 26, smooth(3.0, 3.7, T)), lerp(-50 + 3 * fl, -16, smooth(3.0, 3.7, T))];
  void restPaw;
  const reach = tr.reach(T);
  const tgt: Vec = [lerp(base[0], grab[0], reach), lerp(base[1], grab[1], reach)];
  const pawX = sp.paw[0].step(tgt[0], dt), pawY = sp.paw[1].step(tgt[1], dt);
  const shoulder = rot([10, -44], lean, B);
  const { mid, end } = ik(shoulder, [pawX, pawY], 19, 17, true);
  arm.draw([shoulder, mid, end], [0.6, 1.2]);
  paw.setAttribute('d', `M${f(end[0] - 4.4)} ${f(end[1])}a4.4 4.2 0 1 0 8.8 0a4.4 4.2 0 1 0 -8.8 0Z`);
  const bz = tr.breath(T);
  puff.forEach((p, i) => {
    const o = bz * (1 - i * 0.2), x = mouthFig[0] + 10 + i * 8 + 6 * bz, y = mouthFig[1] - 2 - i * 5 - 4 * bz;
    p.setAttribute('d', o > 0.05 ? `M${f(x)} ${f(y)}q8 -3 16 1` : '');
    p.setAttribute('opacity', f(0.7 * o));
  });

  // --- owner hand + pouch ---
  const shoulderO: Vec = [596 - 56 * ownerLean(T) + 2, 304 + 4 * ownerLean(T)];
  const hx = track([[0, 604], [2.3, 604], [3.9, hookX + 14], [4.25, hookX + 14], [5.2, 604]])(T);
  const hy = track([[0, 332], [2.3, 332], [3.0, 300], [3.9, hookY + 12], [4.25, hookY + 12], [5.2, 330]])(T);
  const o = tr.armOp(T);
  ownerArm.setAttribute('opacity', f(o));
  ownerArm.setAttribute('display', o < 0.02 ? 'none' : 'inline');
  const wr: Vec = [hx, hy];
  const ia = ik(shoulderO, wr, 80, 76, false);
  upper.draw([shoulderO, ia.mid], [0, 0]); fore.draw([ia.mid, ia.end], [0, 1.0]);
  elbow.setAttribute('d', `M${f(ia.mid[0] - 7)} ${f(ia.mid[1])}a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z`);
  const e = ia.end;
  hand.setAttribute('d', `M${f(e[0] + 4)} ${f(e[1] - 9)}C${f(e[0] - 8)} ${f(e[1] - 12)} ${f(e[0] - 20)} ${f(e[1] - 8)} ${f(e[0] - 21)} ${f(e[1] - 1)}C${f(e[0] - 21)} ${f(e[1] + 7)} ${f(e[0] - 10)} ${f(e[1] + 11)} ${f(e[0] + 3)} ${f(e[1] + 8)}Z`);
  fingers.setAttribute('d', `M${f(e[0] - 19)} ${f(e[1] - 4)}q5 4 0 8M${f(e[0] - 13)} ${f(e[1] - 8)}q5 5 0 11M${f(e[0] - 7)} ${f(e[1] - 10)}q4 5 0 12`);
  if (!released && T > T_HOOK + 0.25) { released = true; pouchP.kick(-1.1); }
  if (T < T_HOOK - 1) released = false;
  const k = smooth(T_HOOK - 0.05, T_HOOK + 0.25, T);
  const anchor: Vec = [lerp(e[0] - 10, hookX, k), lerp(e[1] + 3, hookY - 1, k)];
  const swing = pouchP.step(0.8 * w + (T < T_HOOK ? 0 : 0), dt);
  const show = T > 2.6 || reduce;
  pouchG.setAttribute('display', show ? 'inline' : 'none');
  pouchG.setAttribute('transform', `translate(${f(anchor[0])} ${f(anchor[1])}) rotate(${f(T < T_HOOK ? 6 : (swing * 180) / Math.PI)})`);
  void strap; void pt;
};

ups.push(() => undefined);
svg.addEventListener('pointerdown', () => { t0 = last; released = false; phase = 0; });
const w = window as unknown as { __cut?: unknown };
w.__cut = { tr };
run(draw);
void W; void H; void wallClip; void line; void blot;
