// Districts (from the village on): the seat's blocks grouped around a landmark (church, market, pier...),
// with streets as their borders. Ported from the prototype's `calculaBairros`. A district is anchored on a
// building; homes belong to the nearest anchor by street distance (crossing water or a land border costs
// more); too-big districts split, isolated homes form a hamlet, weak districts fold into others. Then whole
// blocks (ground closed in by streets) go to the district of most of their homes.
import type { BuildingId } from '@assunguy/data';
import { def } from './economy.js';
import { cellsOf } from './map.js';
import { connected, streetsBeside } from './network.js';
import type { GameState } from './state.js';
import { landOf, lotKey, parseKey, type LandId, type LotKey, type World } from './world.js';

/** A district's name: a key under district.* in i18n, with the land and a number when needed to tell apart. */
export interface DistrictName { key: string; land?: LandId; n?: number; custom?: string }
export interface District { id: LotKey; name: DistrictName; color: number; homes: LotKey[]; centre: [number, number]; hamlet: boolean }
export interface Districts { cell: Record<LotKey, LotKey>; info: District[]; outlines: Record<LotKey, [number, number][][]> }
/** What the districts remember between seasons: anchors stay where they were, hamlets stay hamlets, the player's names. */
export interface DistrictMemory { seen?: LotKey[]; seenNames?: string[]; hamlets?: LotKey[]; names?: Partial<Record<LotKey, string>> }

const LANDMARK: Partial<Record<BuildingId, string>> = {
  directorate: 'centre', church: 'mainSquare', chapel: 'churchSquare', market: 'marketSquare', riverPort: 'port', store: 'storeStreet', school: 'school',
  apothecary: 'apothecary', flourHouse: 'mills', distillery: 'mills', sugarMill: 'mills', sawmill: 'sawmill', monjolo: 'monjolo', council: 'councilSquare',
};
const PRIORITY: BuildingId[] = ['directorate', 'council', 'church', 'chapel', 'market', 'riverPort', 'store', 'school', 'apothecary', 'flourHouse', 'distillery', 'sugarMill', 'sawmill', 'monjolo'];
export const DISTRICT_COLORS = ['#C2562B', '#2F7F8A', '#8A5BB5', '#A67C12', '#3E7D3A', '#B5476B'];
const O = { R: 6, bridge: 10, border: 3, minHomes: 6, maxHomes: 30, hamlet: 3 };
export const districtsUnlocked = (s: GameState): boolean => s.milestone >= 2;

/** A comparable string for a district name, to keep names apart. */
export const nameId = (n: DistrictName): string => n.custom ?? `${n.key}${n.land ? `|${n.land}` : ''}${n.n ? `#${n.n}` : ''}`;

export function computeDistricts(s: GameState, w: World): Districts {
  const map = s.map, linked = connected(map), reachAll = O.R + 3, isHome = (t: BuildingId | undefined) => !!t && !!def(t).housing;
  const mem = s.districts ?? {};
  const step = (from: LotKey, to: LotKey) => { const [a, b] = parseKey(to), [c, d] = parseKey(from); return 1 + (w.water.has(to) || w.water.has(from) ? O.bridge / 2 : 0) + (landOf(a, b) !== landOf(c, d) ? O.border : 0); };
  // street distance from the anchors, by buckets: the costs are small integers
  const paths = (sources: [LotKey, LotKey][], limit = 1e9) => {
    const dist = new Map<LotKey, number>(), owner = new Map<LotKey, LotKey>(), buckets: LotKey[][] = [];
    const put = (d: number, r: LotKey) => { (buckets[d] ??= []).push(r); };
    for (const [r, id] of sources) if (map.streets[r] && !dist.has(r)) { dist.set(r, 0); owner.set(r, id); put(0, r); }
    for (let d = 0; d < buckets.length; d++) {
      const b0 = buckets[d];
      if (!b0) continue;
      for (const r of b0) {
        if (dist.get(r) !== d) continue;
        const [a, b] = parseKey(r);
        for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = lotKey(a + da, b + db);
          if (!map.streets[n]) continue;
          const nd = d + step(r, n);
          if (nd > limit) continue;
          if (!dist.has(n) || nd < (dist.get(n) as number)) { dist.set(n, nd); owner.set(n, owner.get(r) as LotKey); put(nd, n); }
        }
      }
    }
    return { dist, owner };
  };
  type Paths = ReturnType<typeof paths>;
  const near = (key: LotKey, res: Paths) => { let m: { d: number; id: LotKey } | null = null; for (const r of streetsBeside(map, key)) { const d = res.dist.get(r); if (d !== undefined && (!m || d < m.d)) m = { d, id: res.owner.get(r) as LotKey }; } return m; };
  const sourcesOf = (l: LotKey[]) => l.flatMap((x) => streetsBeside(map, x).map((r) => [r, x] as [LotKey, LotKey]));
  const keys = Object.keys(map.buildings) as LotKey[];
  const homes = keys.filter((x) => isHome(map.buildings[x]) && linked.has(x));
  const candidates = keys.filter((x) => LANDMARK[map.buildings[x] as BuildingId] && linked.has(x));
  if (!homes.length || !candidates.length) return { cell: {}, info: [], outlines: {} };
  const dist0 = (x: LotKey) => { const [a, b] = parseKey(x); return Math.hypot(a - 22, b - 47); };
  let anchors: LotKey[] = [candidates.slice().sort((x, y) => PRIORITY.indexOf(map.buildings[x] as BuildingId) - PRIORITY.indexOf(map.buildings[y] as BuildingId) || dist0(x) - dist0(y))[0] as LotKey];
  const hamlets = new Set<LotKey>();
  // last season's districts stay where they were: a new home joins a district instead of making another
  for (const x of mem.seen ?? []) if (!anchors.includes(x) && map.buildings[x] && linked.has(x) && !(mem.hamlets ?? []).includes(x)) anchors.push(x);
  const all = [...candidates, ...homes], bonus = (c: LotKey) => (LANDMARK[map.buildings[c] as BuildingId] ? 1.25 : 1);
  // the anchor reaching most of a group of homes; a landmark counts a quarter more than a home
  const bestFor = (group: LotKey[], min: number) => {
    let m: { c: LotKey; s: number; g: number } | null = null;
    for (const c of all) {
      if (anchors.includes(c)) continue;
      const r2 = paths(sourcesOf([c]), O.R), g = group.filter((h) => { const d = near(h, r2); return d && d.d <= O.R; }).length;
      if (g >= min && (!m || g * bonus(c) > m.s)) m = { c, s: g * bonus(c), g };
    }
    return m;
  };
  for (let it = 0; it < 24; it++) {
    const res = paths(sourcesOf(anchors));
    const far = homes.filter((h) => { const d = near(h, res); return (!d || d.d > O.R) && (!d || d.d <= reachAll + 6); });
    if (far.length < O.minHomes) break;
    const m = bestFor(far, O.minHomes);
    if (!m) break;
    anchors.push(m.c);
  }
  let res = paths(sourcesOf(anchors));
  // a district too big splits in two, with halves of at least the minimum
  for (let it = 0; it < 12; it++) {
    const count: Partial<Record<LotKey, LotKey[]>> = {};
    for (const h of homes) { const d = near(h, res); if (d && d.d <= reachAll) (count[d.id] ??= []).push(h); }
    const big = anchors.find((x) => (count[x] ?? []).length > O.maxHomes);
    if (!big) break;
    const inside = new Set(count[big]);
    let m: { c: LotKey; s: number } | null = null;
    for (const c of all) {
      if (anchors.includes(c) || (map.buildings[c] && !inside.has(c) && !LANDMARK[map.buildings[c] as BuildingId])) continue;
      const r2 = paths(sourcesOf([c]), O.R + 3), moves = (count[big] as LotKey[]).filter((h) => { const a1 = near(h, r2), a0 = near(h, res); return a1 && a0 && a1.d < a0.d; }).length;
      if (moves >= O.minHomes && (count[big] as LotKey[]).length - moves >= O.minHomes && (!m || moves * bonus(c) > m.s)) m = { c, s: moves * bonus(c) };
    }
    if (!m) break;
    anchors.push(m.c); res = paths(sourcesOf(anchors));
  }
  // isolated homes, far from everything: a hamlet of their own, even a small one
  {
    let isolated = homes.filter((h) => { const d = near(h, res); return !d || d.d > reachAll; });
    for (let it = 0; it < 6 && isolated.length >= O.hamlet; it++) {
      const c = isolated[0] as LotKey, r2 = paths(sourcesOf([c]), reachAll), group = isolated.filter((h) => { const d = near(h, r2); return d && d.d <= reachAll; });
      if (group.length >= O.hamlet) { anchors.push(c); hamlets.add(c); }
      isolated = isolated.filter((h) => !group.includes(h) && h !== c);
    }
    res = paths(sourcesOf(anchors));
  }
  for (let it = 0; it < 8 && anchors.length > 1; it++) {
    const n: Partial<Record<LotKey, number>> = {};
    for (const h of homes) { const d = near(h, res); if (d && d.d <= reachAll) n[d.id] = (n[d.id] ?? 0) + 1; }
    const weak = anchors.find((x) => !hamlets.has(x) && (n[x] ?? 0) < O.minHomes);
    if (!weak) break;
    anchors = anchors.filter((x) => x !== weak); res = paths(sourcesOf(anchors));
  }
  // blocks: ground closed in by streets goes whole to the district of most of its homes
  const owner: Record<LotKey, LotKey> = {};
  let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
  for (const x of keys) {
    const d = near(x, res);
    if (!d || d.d > reachAll) continue;
    const [a, b] = parseKey(x);
    for (const [p, q] of cellsOf(a, b, map.buildings[x] as BuildingId)) { owner[lotKey(p, q)] = d.id; a0 = Math.min(a0, p); a1 = Math.max(a1, p); b0 = Math.min(b0, q); b1 = Math.max(b1, q); }
  }
  a0 -= 3; a1 += 3; b0 -= 3; b1 += 3;
  const free = (p: number, q: number) => p >= a0 && p <= a1 && q >= b0 && q <= b1 && !map.streets[lotKey(p, q)] && !w.water.has(lotKey(p, q));
  const cell: Record<LotKey, LotKey> = {}, seen = new Set<LotKey>();
  for (let p = a0; p <= a1; p++) for (let q = b0; q <= b1; q++) {
    if (!free(p, q) || seen.has(lotKey(p, q))) continue;
    const comp: [number, number][] = [], stack: [number, number][] = [[p, q]];
    seen.add(lotKey(p, q));
    let open = false;
    while (stack.length) {
      const [x, y] = stack.pop() as [number, number];
      comp.push([x, y]);
      if (x === a0 || x === a1 || y === b0 || y === b1) open = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const n = lotKey(x + dx, y + dy); if (!seen.has(n) && free(x + dx, y + dy)) { seen.add(n); stack.push([x + dx, y + dy]); } }
    }
    const vote: Partial<Record<LotKey, number>> = {};
    let built = 0;
    for (const [x, y] of comp) { const o = owner[lotKey(x, y)]; if (o) { built++; const t = map.buildings[lotKey(x, y)]; vote[o] = (vote[o] ?? 0) + (t && isHome(t) ? 3 : 1); } }
    const top = (Object.keys(vote) as LotKey[]).sort((x, y) => (vote[y] as number) - (vote[x] as number))[0];
    if (!top) continue;
    // an open block, or one mostly bush: only what is right next to the buildings
    const loose = open || (comp.length > 12 && built / comp.length < 0.25);
    for (const [x, y] of comp) {
      if (!loose) { cell[lotKey(x, y)] = top; continue; }
      let done = false;
      for (let dx = -1; dx <= 1 && !done; dx++) for (let dy = -1; dy <= 1 && !done; dy++) { const o = owner[lotKey(x + dx, y + dy)]; if (o) { cell[lotKey(x, y)] = o; done = true; } }
    }
  }
  // a street between blocks of the same district is its own; between two districts it is the border
  for (let it = 0; it < 2; it++) {
    const add: Record<LotKey, LotKey> = {};
    for (const r of Object.keys(map.streets) as LotKey[]) {
      if (cell[r]) continue;
      const [x, y] = parseKey(r), L = cell[lotKey(x - 1, y)], R = cell[lotKey(x + 1, y)], U = cell[lotKey(x, y - 1)], D = cell[lotKey(x, y + 1)];
      if (L && L === R) add[r] = L; else if (U && U === D) add[r] = U;
      else { const c: Record<string, number> = {}; for (const o of [L, R, U, D]) if (o) c[o] = (c[o] ?? 0) + 1; const t = Object.keys(c).find((o) => (c[o] as number) >= 3); if (t) add[r] = t as LotKey; }
    }
    Object.assign(cell, add);
  }
  // names: the main landmark inside; the first district is the Centre; a name the player gave wins
  const landmark: Partial<Record<LotKey, LotKey>> = {};
  for (const x of keys) {
    const t = map.buildings[x] as BuildingId, id = cell[x];
    if (!id || !LANDMARK[t] || t === 'directorate') continue;
    if (!landmark[id] || PRIORITY.indexOf(t) < PRIORITY.indexOf(map.buildings[landmark[id] as LotKey] as BuildingId)) landmark[id] = x;
  }
  const used: Record<string, 1> = {}, neighbours: Record<LotKey, Set<LotKey>> = {};
  for (const x of anchors) neighbours[x] = new Set();
  for (const c of Object.keys(cell) as LotKey[]) {
    const [a, b] = parseKey(c);
    for (const [da, db] of [[1, 0], [0, 1], [2, 0], [0, 2], [1, 1], [1, -1]] as const) { const o = cell[lotKey(a + da, b + db)]; if (o && o !== cell[c]) { neighbours[o]?.add(cell[c] as LotKey); neighbours[cell[c] as LotKey]?.add(o); } }
  }
  const color: Partial<Record<LotKey, number>> = {};
  for (const x of anchors.slice().sort((p, q) => (neighbours[q] as Set<LotKey>).size - (neighbours[p] as Set<LotKey>).size)) {
    const taken = new Set([...(neighbours[x] as Set<LotKey>)].map((v) => color[v]));
    const i = DISTRICT_COLORS.findIndex((_, j) => !taken.has(j));
    color[x] = i < 0 ? 0 : i;
  }
  const homesOf = (x: LotKey) => homes.filter((h) => cell[h] === x);
  const centreOf = (hs: LotKey[]): [number, number] => [hs.reduce((t, h) => t + parseKey(h)[0] + 0.5, 0) / Math.max(1, hs.length), hs.reduce((t, h) => t + parseKey(h)[1] + 0.5, 0) / Math.max(1, hs.length)];
  const c0 = centreOf(homesOf(anchors[0] as LotKey));
  // a place name: by the river, or which side of the centre it lies
  const place = (x: LotKey, hs: LotKey[]): DistrictName => {
    const [cx, cy] = centreOf(hs), [a, b] = parseKey(x), land = landOf(a, b);
    if (hamlets.has(x)) return w.lands[land] ? { key: 'district.hamlet', land } : { key: 'district.hamletAlone' };
    const river = hs.filter((h) => { const [p, q] = parseKey(h); for (let dp = -2; dp <= 2; dp++) for (let dq = -2; dq <= 2; dq++) if (w.water.has(lotKey(p + dp, q + dq))) return true; return false; }).length;
    if (river >= hs.length * 0.3) return { key: 'district.riverside' };
    const dx = cx - c0[0], dy = cy - c0[1];
    return { key: Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'district.upper' : 'district.lower') : dx > 0 ? 'district.east' : 'district.west' };
  };
  const info: District[] = anchors.map((x, i) => {
    const [a, b] = parseKey(x), land = landOf(a, b), hs = homesOf(x), custom = mem.names?.[x];
    let n: DistrictName;
    if (custom) n = { key: 'district.custom', custom };
    else {
      const mk = landmark[x];
      n = i === 0 ? { key: 'district.centre' } : mk && !hamlets.has(x) ? { key: `district.${LANDMARK[map.buildings[mk] as BuildingId]}` } : place(x, hs);
      if (used[nameId(n)]) n = place(x, hs);
      if (used[nameId(n)] && w.lands[land] && n.land !== land) n = { ...n, land };
      for (let r = 2; used[nameId(n)]; r++) n = { ...n, n: r };
    }
    used[nameId(n)] = 1;
    return { id: x, name: n, color: color[x] ?? 0, homes: hs, centre: centreOf(hs), hamlet: hamlets.has(x) };
  });
  return { cell, info, outlines: outlinesOf(cell, info) };
}

/** Each district's border as closed loops (inside on the left), straight runs thinned and corners rounded. */
export function outlinesOf(cell: Record<LotKey, LotKey>, info: District[]): Record<LotKey, [number, number][][]> {
  const out: Record<LotKey, [number, number][][]> = {};
  for (const d of info) {
    const next = new Map<string, [number, number]>(), inside = (x: number, y: number) => cell[lotKey(x, y)] === d.id;
    for (const c of Object.keys(cell) as LotKey[]) {
      if (cell[c] !== d.id) continue;
      const [a, b] = parseKey(c);
      if (!inside(a, b - 1)) next.set(`${a},${b}`, [a + 1, b]);
      if (!inside(a + 1, b)) next.set(`${a + 1},${b}`, [a + 1, b + 1]);
      if (!inside(a, b + 1)) next.set(`${a + 1},${b + 1}`, [a, b + 1]);
      if (!inside(a - 1, b)) next.set(`${a},${b + 1}`, [a, b]);
    }
    const loops: [number, number][][] = [];
    while (next.size) {
      const [first] = next.keys();
      let at = first as string;
      const pts: [number, number][] = [];
      for (let g = 0; g < 8000 && next.has(at); g++) { pts.push(at.split(',').map(Number) as [number, number]); const pr = next.get(at) as [number, number]; next.delete(at); at = `${pr[0]},${pr[1]}`; }
      let p = pts.filter((q, i) => { const a = pts[(i - 1 + pts.length) % pts.length] as [number, number], c = pts[(i + 1) % pts.length] as [number, number]; return (q[0] - a[0]) * (c[1] - q[1]) !== (q[1] - a[1]) * (c[0] - q[0]); });
      for (let r = 0; r < 3; r++) { const n: [number, number][] = []; p.forEach((q, i) => { const c = p[(i + 1) % p.length] as [number, number]; n.push([q[0] * 0.75 + c[0] * 0.25, q[1] * 0.75 + c[1] * 0.25], [q[0] * 0.25 + c[0] * 0.75, q[1] * 0.25 + c[1] * 0.75]); }); p = n; }
      if (p.length >= 4) loops.push(p);
    }
    out[d.id] = loops;
  }
  return out;
}

/** Each season from the village on: remembers the districts and reports new ones. */
export function rememberDistricts(s: GameState, w: World): District[] {
  if (!districtsUnlocked(s)) return [];
  const ids = computeDistricts(s, w).info, mem = (s.districts ??= {}), names = mem.seenNames ?? [];
  // new is a district that existed neither by its anchor nor by its name
  const born = mem.seen ? ids.filter((d) => !mem.seen!.includes(d.id) && !names.includes(nameId(d.name))) : [];
  mem.seen = ids.map((d) => d.id); mem.seenNames = ids.map((d) => nameId(d.name)); mem.hamlets = ids.filter((d) => d.hamlet).map((d) => d.id);
  return born;
}
