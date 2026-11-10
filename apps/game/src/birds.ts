// Birds of the Ribeira valley on the map, drawn by code in the renderer's depth order: white egrets in the
// shallows, green ibises (tapicurus) probing the wet banks in twos and threes, cormorants (biguás) swimming
// and diving, southern lapwings (quero-queros) by the fields, and now and then a flock of parakeets
// (maritacas) crossing over the forest. Herons and ibises take off when disturbed and land further along the
// river. Decoration only: no state, nothing to tap.
import type { GameState, LotKey, World } from '@assunguy/sim';
import { api, hooks } from './view';

type Kind = 'egret' | 'ibis' | 'cormorant' | 'lapwing';
interface Bird { kind: Kind; a: number; b: number; dir: number; state: 'stand' | 'walk' | 'fly' | 'dive'; t: number; next: number; from: [number, number]; to: [number, number]; dur: number; seed: number }
interface Flock { a: number; b: number; da: number; db: number; t: number; n: number }

let birds: Bird[] = [];
let flock: Flock | null = null;
let shoreOf = new Map<string, [number, number]>(), waterOf = new Map<string, [number, number]>();
let banks: [number, number][] = [], shallows: [number, number][] = [], fields: [number, number][] = [], deep: [number, number][] = [];
let last = 0;
let centre: [number, number] = [22, 52];
const rnd = Math.random;
const pick = <T>(xs: T[]): T => xs[Math.floor(rnd() * xs.length)] as T;

/** Where birds can be: wet banks, shallow and open water, the edges of fields. Called after each change. */
export function syncBirds(s: GameState, w: World): void {
  const key = (a: number, b: number) => `${a},${b}` as LotKey;
  const seen = (a: number, b: number) => !!s.map.lands[`${Math.floor(a / 15)},${Math.floor(b / 15)}` as never];
  const water = (a: number, b: number) => w.water.has(key(a, b));
  const free = (a: number, b: number) => !s.map.buildings[key(a, b)] && !s.map.streets[key(a, b)];
  banks = []; shallows = []; fields = []; deep = []; shoreOf = new Map(); waterOf = new Map();
  const st = Object.keys(s.map.streets).map((k) => k.split(',').map(Number) as [number, number]);
  if (st.length) centre = [st.reduce((x, p) => x + p[0], 0) / st.length, st.reduce((x, p) => x + p[1], 0) / st.length];
  for (const k of w.water) {
    const [a, b] = k.split(',').map(Number) as [number, number];
    if (!seen(a, b) || s.map.streets[k]) continue;
    const land = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).find(([x, y]) => !water(a + x, b + y)), edge = !!land;
    if (land) shoreOf.set(`${a},${b}`, [land[0], land[1]]);
    (edge ? shallows : deep).push([a, b]);
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (!water(a + x, b + y) && seen(a + x, b + y) && free(a + x, b + y)) { banks.push([a + x, b + y]); waterOf.set(`${a + x},${b + y}`, [-x, -y]); }
  }
  for (const [k, t] of Object.entries(s.map.buildings)) if (/Field$/.test(t)) { const [a, b] = k.split(',').map(Number) as [number, number]; fields.push([a, b]); }
  const want: Record<Kind, number> = { egret: Math.min(18, Math.round(shallows.length / 6)), ibis: Math.min(24, Math.round(banks.length / 5)), cormorant: Math.min(6, Math.round(deep.length / 20)), lapwing: Math.min(6, Math.floor(fields.length / 6) * 2) };
  // keep the birds whose places still exist, add or drop to the wanted numbers
  birds = birds.filter((x) => x.state === 'fly' || placeOk(x));
  for (const kind of Object.keys(want) as Kind[]) {
    const have = birds.filter((x) => x.kind === kind);
    for (const x of have.slice(want[kind])) birds.splice(birds.indexOf(x), 1);
    for (let i = have.length; i < want[kind]; i++) { const b = spawn(kind); if (b) birds.push(b); if (kind === 'ibis' && b) for (let k = 0; k < 1 + Math.floor(rnd() * 2) && i + 1 < want[kind]; k++, i++) birds.push({ ...b, a: b.a + (rnd() - 0.5) * 0.5, b: b.b + (rnd() - 0.5) * 0.5, seed: rnd() * 100, next: 2 + rnd() * 6 }); }
  }
}
function placeOk(x: Bird): boolean {
  const near = (list: [number, number][]) => list.some(([a, b]) => Math.abs(a + 0.5 - x.a) < 1 && Math.abs(b + 0.5 - x.b) < 1);
  return x.kind === 'egret' ? near(shallows) : x.kind === 'ibis' ? near(banks) : x.kind === 'cormorant' ? near(deep) || near(shallows) : near(fields);
}
function spot(kind: Kind): [number, number] | null {
  const list = kind === 'egret' ? shallows : kind === 'ibis' ? banks : kind === 'cormorant' ? (deep.length ? deep : shallows) : fields;
  if (!list.length) return null;
  // most birds stay within sight of the colony, the rest anywhere along the river already seen
  const near = list.filter(([a, b]) => Math.hypot(a - centre[0], b - centre[1]) < 16);
  const [a, b] = pick(near.length && rnd() < 0.75 ? near : list);
  // egrets wade at the edge, on the side of the shore
  if (kind === 'egret') { const [x, y] = shoreOf.get(`${a},${b}`) ?? [0, 0]; return [a + 0.5 + x * 0.38 + (rnd() - 0.5) * 0.3, b + 0.5 + y * 0.38 + (rnd() - 0.5) * 0.3]; }
  // ibises probe the wet sand at the water's edge
  if (kind === 'ibis') { const [x, y] = waterOf.get(`${a},${b}`) ?? [0, 0]; return [a + 0.5 + x * 0.42 + (rnd() - 0.5) * 0.35, b + 0.5 + y * 0.42 + (rnd() - 0.5) * 0.35]; }
  return kind === 'lapwing' ? [a + (rnd() < 0.5 ? -0.1 : 1.1), b + rnd()] : [a + 0.2 + rnd() * 0.6, b + 0.2 + rnd() * 0.6];
}
function spawn(kind: Kind): Bird | null {
  const p = spot(kind);
  if (!p) return null;
  return { kind, a: p[0], b: p[1], dir: rnd() < 0.5 ? 1 : -1, state: 'stand', t: 0, next: 3 + rnd() * 12, from: p, to: p, dur: 0, seed: rnd() * 100 };
}

// ---- behaviour

function step(x: Bird, dt: number): void {
  x.t += dt;
  if (x.state === 'fly') {
    const f = Math.min(1, x.t / x.dur);
    x.a = x.from[0] + (x.to[0] - x.from[0]) * f; x.b = x.from[1] + (x.to[1] - x.from[1]) * f;
    if (f >= 1) { x.state = 'stand'; x.t = 0; x.next = 6 + rnd() * 20; }
    return;
  }
  if (x.state === 'dive') { if (x.t > 2.2) { x.state = 'stand'; x.t = 0; x.next = 4 + rnd() * 8; const p = spot('cormorant'); if (p && Math.hypot(p[0] - x.a, p[1] - x.b) < 3) { x.a = p[0]; x.b = p[1]; } } return; }
  if (x.state === 'walk') {
    const f = Math.min(1, x.t / x.dur);
    x.a = x.from[0] + (x.to[0] - x.from[0]) * f; x.b = x.from[1] + (x.to[1] - x.from[1]) * f;
    if (f >= 1) { x.state = 'stand'; x.t = 0; x.next = 2 + rnd() * 8; }
    return;
  }
  if (x.t < x.next) return;
  x.t = 0;
  const r = rnd();
  if (x.kind === 'cormorant' && r < 0.4) { x.state = 'dive'; return; }
  // take off now and then (egrets and ibises fly further, lapwings only a short hop)
  if ((x.kind !== 'cormorant' && r < (x.kind === 'lapwing' ? 0.15 : 0.22)) || (x.kind === 'cormorant' && r < 0.5)) {
    const p = x.kind === 'lapwing' ? spot('lapwing') : spot(x.kind);
    if (p && Math.hypot(p[0] - x.a, p[1] - x.b) > 1) {
      const d = Math.hypot(p[0] - x.a, p[1] - x.b);
      if (d < 22 || x.kind !== 'lapwing') { x.state = 'fly'; x.from = [x.a, x.b]; x.to = p; x.dur = Math.max(2, d / (x.kind === 'egret' ? 2.2 : 2.8)); x.dir = p[0] - p[1] >= x.a - x.b ? 1 : -1; return; }
    }
  }
  // a few steps
  const to: [number, number] = [x.a + (rnd() - 0.5) * 0.5, x.b + (rnd() - 0.5) * 0.5];
  x.state = 'walk'; x.from = [x.a, x.b]; x.to = to; x.dur = 1.2 + rnd() * 1.6; x.dir = to[0] - to[1] >= x.a - x.b ? 1 : -1;
  x.next = 2 + rnd() * 6;
}

// ---- drawing (ctx is the renderer's, in screen pixels; s is the zoom)

function egret(g: CanvasRenderingContext2D, x: number, y: number, s: number, d: number, b: Bird, now: number): void {
  if (b.state === 'fly') return flying(g, x, y, s, d, now, b, '#F8F6EE', '#C9C4B4', 8);
  const bob = b.state === 'walk' ? Math.sin(now * 8 + b.seed) * 0.6 : 0, peck = b.state === 'stand' && Math.sin(now * 0.7 + b.seed) > 0.93;
  g.strokeStyle = '#2A2622'; g.lineWidth = 0.9 * s;
  g.beginPath(); g.moveTo(x - 1 * s, y); g.lineTo(x - 0.6 * s, y - 5 * s); g.moveTo(x + 1 * s, y); g.lineTo(x + 0.6 * s, y - 5 * s); g.stroke();
  g.fillStyle = '#F8F6EE'; g.beginPath(); g.ellipse(x, y - 6.5 * s + bob, 3.4 * s, 1.9 * s, -0.25 * d, 0, 7); g.fill();
  g.strokeStyle = '#F8F6EE'; g.lineWidth = 1.5 * s; g.lineCap = 'round';
  const hx = x + d * (peck ? 3.8 : 2.4) * s, hy = y - (peck ? 6 : 11.8) * s + bob;
  g.beginPath(); g.moveTo(x + d * 2.2 * s, y - 7.2 * s + bob); g.quadraticCurveTo(x + d * 0.4 * s, y - 9.6 * s + bob, hx, hy); g.stroke();
  g.strokeStyle = '#E2B13C'; g.lineWidth = 0.9 * s; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + d * 2.6 * s, hy + (peck ? 1.6 : 0.5) * s); g.stroke();
  g.lineCap = 'butt';
  g.fillStyle = 'rgba(70,110,140,.25)'; g.beginPath(); g.ellipse(x, y + 0.6 * s, 3 * s, 0.9 * s, 0, 0, 7); g.fill();
}
function ibis(g: CanvasRenderingContext2D, x: number, y: number, s: number, d: number, b: Bird, now: number): void {
  if (b.state === 'fly') return flying(g, x, y, s, d, now, b, '#3C4A36', '#2A3428', 6.5);
  const probe = b.state === 'stand' && Math.sin(now * 1.3 + b.seed) > 0.3, bob = b.state === 'walk' ? Math.sin(now * 9 + b.seed) * 0.5 : 0;
  g.fillStyle = 'rgba(40,40,30,.22)'; g.beginPath(); g.ellipse(x, y + 0.4 * s, 3 * s, 0.9 * s, 0, 0, 7); g.fill();
  g.strokeStyle = '#4A5A44'; g.lineWidth = 0.8 * s;
  g.beginPath(); g.moveTo(x - 0.8 * s, y); g.lineTo(x - 0.5 * s, y - 2.8 * s); g.moveTo(x + 0.8 * s, y); g.lineTo(x + 0.5 * s, y - 2.8 * s); g.stroke();
  g.fillStyle = '#34412F'; g.beginPath(); g.ellipse(x - d * 0.3 * s, y - 4.2 * s + bob, 3.2 * s, 1.8 * s, -0.15 * d, 0, 7); g.fill();
  g.fillStyle = 'rgba(120,160,90,.55)'; g.beginPath(); g.ellipse(x - d * 0.6 * s, y - 4.6 * s + bob, 1.8 * s, 0.8 * s, -0.15 * d, 0, 7); g.fill();
  const hx = x + d * 2.6 * s, hy = y - (probe ? 2.6 : 5.8) * s + bob;
  g.fillStyle = '#2E3A2A'; g.beginPath(); g.arc(hx, hy, 1.1 * s, 0, 7); g.fill();
  g.strokeStyle = '#2B2B26'; g.lineWidth = 0.8 * s; g.beginPath(); g.moveTo(hx + d * 0.8 * s, hy); g.quadraticCurveTo(hx + d * 3 * s, hy + 0.2 * s, hx + d * 3.6 * s, hy + (probe ? 2.6 : 2) * s); g.stroke();
}
function cormorant(g: CanvasRenderingContext2D, x: number, y: number, s: number, d: number, b: Bird, now: number): void {
  if (b.state === 'fly') return flying(g, x, y, s, d, now, b, '#26241F', '#1A1916', 6);
  if (b.state === 'dive') { const r = (b.t % 2.2) * 2; g.strokeStyle = `rgba(230,240,245,${Math.max(0, 0.5 - b.t * 0.2)})`; g.lineWidth = 0.8 * s; g.beginPath(); g.ellipse(x, y, (2 + r) * s, (0.8 + r * 0.35) * s, 0, 0, 7); g.stroke(); return; }
  const rock = Math.sin(now * 2 + b.seed) * 0.4;
  g.strokeStyle = 'rgba(230,240,245,.45)'; g.lineWidth = 0.7 * s; g.beginPath(); g.ellipse(x, y + 0.4 * s, 4 * s, 1.1 * s, 0, 0, 7); g.stroke();
  g.fillStyle = '#26241F'; g.beginPath(); g.ellipse(x, y - 0.6 * s + rock, 3.4 * s, 1.2 * s, 0, Math.PI, 0); g.fill();
  g.strokeStyle = '#26241F'; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x + d * 2.2 * s, y - 1 * s + rock); g.lineTo(x + d * 2.8 * s, y - 4.6 * s + rock); g.stroke();
  g.fillStyle = '#26241F'; g.beginPath(); g.arc(x + d * 2.9 * s, y - 4.8 * s + rock, 0.9 * s, 0, 7); g.fill();
  g.strokeStyle = '#B49A5A'; g.lineWidth = 0.7 * s; g.beginPath(); g.moveTo(x + d * 3.4 * s, y - 4.8 * s + rock); g.lineTo(x + d * 4.8 * s, y - 4.4 * s + rock); g.stroke();
}
function lapwing(g: CanvasRenderingContext2D, x: number, y: number, s: number, d: number, b: Bird, now: number): void {
  if (b.state === 'fly') return flying(g, x, y, s, d, now, b, '#8C8578', '#1E1E1C', 5);
  const bob = b.state === 'walk' ? Math.sin(now * 12 + b.seed) * 0.4 : 0;
  g.fillStyle = 'rgba(40,40,30,.2)'; g.beginPath(); g.ellipse(x, y + 0.3 * s, 2.2 * s, 0.7 * s, 0, 0, 7); g.fill();
  g.strokeStyle = '#C25A5A'; g.lineWidth = 0.6 * s; g.beginPath(); g.moveTo(x - 0.5 * s, y); g.lineTo(x - 0.4 * s, y - 2.6 * s); g.moveTo(x + 0.5 * s, y); g.lineTo(x + 0.4 * s, y - 2.6 * s); g.stroke();
  g.fillStyle = '#F2EFE6'; g.beginPath(); g.ellipse(x, y - 3.4 * s + bob, 2.2 * s, 1.2 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#8C8578'; g.beginPath(); g.ellipse(x - d * 0.4 * s, y - 4 * s + bob, 2.3 * s, 1 * s, -0.2 * d, 0, 7); g.fill();
  g.fillStyle = '#1E1E1C'; g.beginPath(); g.ellipse(x + d * 1 * s, y - 4 * s + bob, 1 * s, 0.9 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#8C8578'; g.beginPath(); g.arc(x + d * 1.6 * s, y - 5.3 * s + bob, 0.9 * s, 0, 7); g.fill();
  g.strokeStyle = '#1E1E1C'; g.lineWidth = 0.5 * s; g.beginPath(); g.moveTo(x + d * 1.3 * s, y - 6 * s + bob); g.lineTo(x - d * 0.2 * s, y - 6.8 * s + bob); g.stroke();
}
/** A bird in flight: slow wingbeats for herons, faster for the small ones, its shadow on the ground below. */
function flying(g: CanvasRenderingContext2D, x: number, y: number, s: number, d: number, now: number, b: Bird, col: string, tip: string, span: number): void {
  const f = Math.min(1, b.t / b.dur), alt = Math.sin(f * Math.PI) * 18 * s + 4 * s, beat = Math.sin(now * (b.kind === 'egret' ? 6 : 10) + b.seed);
  g.fillStyle = 'rgba(30,30,20,.16)'; g.beginPath(); g.ellipse(x, y, span * 0.5 * s, 1 * s, 0, 0, 7); g.fill();
  const yy = y - alt;
  g.strokeStyle = col; g.lineWidth = 1.6 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - span * s, yy - beat * 3 * s); g.quadraticCurveTo(x - span * 0.4 * s, yy - 2 * s - beat * 1.5 * s, x, yy); g.quadraticCurveTo(x + span * 0.4 * s, yy - 2 * s - beat * 1.5 * s, x + span * s, yy - beat * 3 * s); g.stroke();
  g.strokeStyle = tip; g.lineWidth = 1.2 * s; g.beginPath(); g.moveTo(x - span * s, yy - beat * 3 * s); g.lineTo(x - span * 0.8 * s, yy - beat * 2.6 * s); g.moveTo(x + span * s, yy - beat * 3 * s); g.lineTo(x + span * 0.8 * s, yy - beat * 2.6 * s); g.stroke();
  g.fillStyle = col; g.beginPath(); g.ellipse(x, yy, 2.6 * s, 1.1 * s, 0, 0, 7); g.fill();
  if (b.kind === 'egret') { g.strokeStyle = '#2A2622'; g.lineWidth = 0.7 * s; g.beginPath(); g.moveTo(x - d * 2 * s, yy); g.lineTo(x - d * 5 * s, yy + 0.6 * s); g.stroke(); g.strokeStyle = '#E2B13C'; g.beginPath(); g.moveTo(x + d * 2.4 * s, yy - 0.4 * s); g.lineTo(x + d * 4.2 * s, yy - 0.2 * s); g.stroke(); }
  if (b.kind === 'ibis') { g.strokeStyle = '#2B2B26'; g.lineWidth = 0.7 * s; g.beginPath(); g.moveTo(x + d * 2.4 * s, yy); g.quadraticCurveTo(x + d * 4.4 * s, yy, x + d * 5 * s, yy + 1.4 * s); g.stroke(); }
  g.lineCap = 'butt';
}
function parakeets(g: CanvasRenderingContext2D, P: (a: number, b: number) => [number, number], s: number, now: number): void {
  if (!flock) return;
  const f = flock;
  for (let i = 0; i < f.n; i++) {
    const ox = Math.sin(i * 2.3 + now * 0.9) * 1.2 + (i % 4) * 0.5, oy = Math.cos(i * 1.7 + now * 1.1) * 0.9 + Math.floor(i / 4) * 0.4;
    const [x, y] = P(f.a + ox, f.b + oy), yy = y - 34 * s, beat = Math.sin(now * 22 + i);
    g.strokeStyle = i % 3 ? '#4E8F3A' : '#3F7A2E'; g.lineWidth = 1.2 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - 3 * s, yy - beat * 1.6 * s); g.lineTo(x, yy); g.lineTo(x + 3 * s, yy - beat * 1.6 * s); g.stroke();
    g.fillStyle = 'rgba(30,30,20,.1)'; g.beginPath(); g.ellipse(x, y, 1.6 * s, 0.5 * s, 0, 0, 7); g.fill();
  }
  g.lineCap = 'butt';
}

const DRAW: Record<Kind, typeof egret> = { egret, ibis, cormorant, lapwing };

/** Called by the renderer while it fills its depth buckets: adds each bird where it belongs in the scene. */
export function drawBirds(add: (depth: number, f: () => void) => void, paraVista: (a: number, b: number) => [number, number], projT: (u: number, v: number) => [number, number], cam: { z: number }): void {
  const now = performance.now() / 1000, dt = Math.min(0.1, last ? now - last : 0); last = now;
  for (const b of birds) step(b, dt);
  // a flock of parakeets now and then, across the map from one forest edge to another
  if (!flock && rnd() < dt * 0.012 && banks.length) { const [a, b] = pick(banks); const ang = rnd() * 6.28; flock = { a: a - Math.cos(ang) * 25, b: b - Math.sin(ang) * 25, da: Math.cos(ang) * 3.2, db: Math.sin(ang) * 3.2, t: 0, n: 7 + Math.floor(rnd() * 5) }; }
  if (flock) { flock.t += dt; flock.a += flock.da * dt; flock.b += flock.db * dt; if (flock.t > 18) flock = null; }
  if (cam.z < 0.45) return;
  const g = api.ctx as CanvasRenderingContext2D, s = Math.max(0.55, cam.z) * 1.35;
  const P = (a: number, b: number) => projT(...paraVista(a, b));
  const W = (api.W as number) + 40, H = (api.H as number) + 40;
  for (const b of birds) {
    const [u, v] = paraVista(b.a, b.b), [x, y] = projT(u, v);
    if (x < -40 || y < -60 || x > W || y > H) continue;
    const depth = b.state === 'fly' ? 1e6 : Math.floor(u) + Math.floor(v) + 0.05;
    add(depth, () => DRAW[b.kind](g, x, y, s, b.dir, b, now));
  }
  if (flock) add(1e6 + 1, () => parakeets(g, P, s, now));
}

hooks.birds = drawBirds;
