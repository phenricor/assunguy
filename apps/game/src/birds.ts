// Birds of the Ribeira valley on the map, drawn by code in the renderer's depth order: white egrets in the
// shallows, green ibises (tapicurus) probing the wet banks in twos and threes, cormorants (biguás) swimming
// and diving, southern lapwings (quero-queros) by the fields, and now and then a flock of parakeets
// (maritacas) crossing over the forest. Herons and ibises take off when disturbed and land further along the
// river. They are models in the prototype's sprite generator (birdModels.js, appended to it at build time), so
// they share the light, outline and shadows of the people and the boats; here they only move, and fade in and
// out instead of popping. Decoration only: no state, nothing to tap.
import type { GameState, LotKey, World } from '@assunguy/sim';
import { api, hooks } from './view';

type Kind = 'egret' | 'ibis' | 'cormorant' | 'lapwing';
interface Bird { kind: Kind; a: number; b: number; ang: number; al: number; gone?: boolean; state: 'stand' | 'walk' | 'fly' | 'dive'; t: number; next: number; from: [number, number]; to: [number, number]; dur: number; seed: number }
interface Flock { a: number; b: number; da: number; db: number; t: number; n: number; ph: number[] }

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
  // birds whose place is gone, or too many of a kind, fade away instead of vanishing
  for (const x of birds) if (x.state !== 'fly' && !placeOk(x)) x.gone = true;
  for (const kind of Object.keys(want) as Kind[]) {
    const have = birds.filter((x) => x.kind === kind && !x.gone);
    for (const x of have.slice(want[kind])) x.gone = true;
    for (let i = have.length; i < want[kind]; i++) { const b = spawn(kind); if (b) birds.push(b); if (kind === 'ibis' && b) for (let k = 0; k < 1 + Math.floor(rnd() * 2) && i + 1 < want[kind]; k++, i++) birds.push({ ...b, a: b.a + (rnd() - 0.5) * 0.5, b: b.b + (rnd() - 0.5) * 0.5, ang: rnd() * 6.28, seed: rnd() * 100, next: 2 + rnd() * 6 }); }
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
  return { kind, a: p[0], b: p[1], ang: rnd() * 6.28, al: 0, state: 'stand', t: 0, next: 3 + rnd() * 12, from: p, to: p, dur: 0, seed: rnd() * 100 };
}

// ---- behaviour

function step(x: Bird, dt: number): void {
  // fade: in over a second when it arrives, out when it leaves or goes under water
  const want = x.gone || (x.state === 'dive' && x.t > 0.1 && x.t < 1.9) ? 0 : 1;
  x.al = want > x.al ? Math.min(1, x.al + dt / 1) : Math.max(0, x.al - dt / (x.state === 'dive' ? 0.35 : 0.8));
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
      if (d < 22 || x.kind !== 'lapwing') { x.state = 'fly'; x.from = [x.a, x.b]; x.to = p; x.dur = Math.max(2.5, d / (x.kind === 'egret' ? 2.2 : 2.8)); x.ang = Math.atan2(p[1] - x.b, p[0] - x.a); return; }
    }
  }
  // a few steps
  const to: [number, number] = [x.a + (rnd() - 0.5) * 0.5, x.b + (rnd() - 0.5) * 0.5];
  x.state = 'walk'; x.from = [x.a, x.b]; x.to = to; x.dur = 1.2 + rnd() * 1.6; x.ang = Math.atan2(to[1] - x.b, to[0] - x.a);
  x.next = 2 + rnd() * 6;
}

// ---- drawing: each bird is a generated sprite, through the renderer's own anim(); alpha carries the fades

const NAME: Record<Kind, string> = { egret: 'garca', ibis: 'tapicuru', cormorant: 'bigua', lapwing: 'queroquero' };
// flight altitude of each sprite, in model units (as in birdModels.js): low for take-off and landing, then cruise
const ALT: Record<Kind, [number, number]> = { egret: [1.1, 2.6], ibis: [1, 2.2], cormorant: [0.8, 1.6], lapwing: [0.6, 1.2] };
const BEAT: Record<Kind, number> = { egret: 3, ibis: 5, cormorant: 5, lapwing: 7 };
const PX = 7.2; // screen pixels per model unit of height, at zoom 1
type Anim = (nome: string, dir: number, quadro: number, px: number, py: number, alfa?: number, ang?: number) => void;

/** One bird: on the ground, or in the air between two of its sprites (ground, low, cruise), cross-faded and
 * shifted so the body rises smoothly instead of jumping from one height to the next. */
function drawBird(anim: Anim, x: number, y: number, z: number, b: Bird, now: number, al: number): void {
  const n = NAME[b.kind], ang = b.ang;
  if (b.state !== 'fly') {
    const pose = b.state === 'walk' ? Math.floor(now * 5 + b.seed) % 2 : 0;
    // egrets now and then strike at a fish, ibises probe the mud with the bill most of the time
    const low = b.state === 'stand' && ((b.kind === 'egret' && Math.sin(now * 0.7 + b.seed) > 0.93) || (b.kind === 'ibis' && Math.sin(now * 1.3 + b.seed) > 0.3));
    if (b.kind === 'cormorant') ripple(x, y, z, al);
    anim(low ? n + 'B' : n, 0, pose, x, y, al, ang);
    return;
  }
  const [lo, hi] = ALT[b.kind];
  // height along the flight: up in the first seconds, down in the last
  const up = Math.min(1, b.t / 1.6, (b.dur - b.t) / 1.6), h = b.dur > 4 ? (up < 0.5 ? up * 2 * lo : lo + (up - 0.5) * 2 * (hi - lo)) : up * lo;
  const levels: [string, number][] = [[n, 0], [n + 'V1', lo], [n + 'V', hi]];
  const beat = Math.floor(now * BEAT[b.kind] + b.seed) % 2;
  let i = 0;
  while (i < 1 && h > levels[i + 1]![1]) i++;
  const [n0, h0] = levels[i]!, [n1, h1] = levels[i + 1]!, w = Math.max(0, Math.min(1, (h - h0) / (h1 - h0)));
  if (w < 1) anim(n0, 0, i === 0 ? 0 : beat, x, y - (h - h0) * PX * z, al * (1 - w), ang);
  if (w > 0) anim(n1, 0, beat, x, y + (h1 - h) * PX * z, al * w, ang);
}
function ripple(x: number, y: number, z: number, al: number): void {
  const g = api.ctx as CanvasRenderingContext2D;
  g.strokeStyle = `rgba(230,240,245,${0.4 * al})`; g.lineWidth = Math.max(0.6, 0.7 * z); g.beginPath(); g.ellipse(x, y + 1 * z, 6 * z, 1.8 * z, 0, 0, 7); g.stroke();
}

/** Called by the renderer while it fills its depth buckets: adds each bird where it belongs in the scene. */
export function drawBirds(add: (depth: number, f: () => void) => void, paraVista: (a: number, b: number) => [number, number], projT: (u: number, v: number) => [number, number], cam: { z: number }): void {
  const now = performance.now() / 1000, dt = Math.min(0.1, last ? now - last : 0); last = now;
  for (const b of birds) step(b, dt);
  birds = birds.filter((b) => !(b.gone && b.al <= 0));
  // a flock of parakeets now and then, across the map from one forest edge to another
  if (!flock && rnd() < dt * 0.012 && banks.length) { const [a, b] = pick(banks); const ang = rnd() * 6.28, n = 7 + Math.floor(rnd() * 5); flock = { a: a - Math.cos(ang) * 25, b: b - Math.sin(ang) * 25, da: Math.cos(ang) * 3.2, db: Math.sin(ang) * 3.2, t: 0, n, ph: Array.from({ length: n }, () => rnd() * 10) }; }
  if (flock) { flock.t += dt; flock.a += flock.da * dt; flock.b += flock.db * dt; if (flock.t > 18) flock = null; }
  // below this zoom they would be specks: they fade out with the zoom instead of disappearing at once
  const zf = Math.max(0, Math.min(1, (cam.z - 0.45) / 0.15));
  if (!zf) return;
  const anim = api.anim as Anim, z = cam.z;
  const W = (api.W as number) + 60, H = (api.H as number) + 60;
  for (const b of birds) {
    if (b.al <= 0) continue;
    const [u, v] = paraVista(b.a, b.b), [x, y] = projT(u, v);
    if (x < -60 || y < -80 || x > W || y > H) continue;
    const depth = b.state === 'fly' ? 1e6 : Math.floor(u) + Math.floor(v) + 0.05;
    add(depth, () => drawBird(anim, x, y, z, b, now, b.al * zf));
  }
  if (flock) {
    const f = flock, fa = zf * Math.max(0, Math.min(1, f.t / 2, (18 - f.t) / 2)), ang = Math.atan2(f.db, f.da);
    if (fa > 0) add(1e6 + 1, () => {
      for (let i = 0; i < f.n; i++) {
        const ox = Math.sin(i * 2.3 + now * 0.9) * 1.2 + (i % 4) * 0.5, oy = Math.cos(i * 1.7 + now * 1.1) * 0.9 + Math.floor(i / 4) * 0.4;
        const [x, y] = projT(...paraVista(f.a + ox, f.b + oy));
        anim('maritaca', 0, Math.floor(now * 9 + f.ph[i]!) % 2, x, y, fa, ang);
      }
    });
  }
}

hooks.birds = drawBirds;
