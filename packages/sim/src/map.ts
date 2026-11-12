// The colony's map: streets, buildings, trees, which lands are ours, and the nature drawn once per game
// (streams, waterfalls, caves, sinkholes). Unlike the world, all of this is saved.
import { BALANCE, BUILDINGS, WORLD, type BuildingId } from '@assunguy/data';
import { mulberry32 } from './rng.js';
import { SEAT_LAND, inBounds, landOf, lotKey, noise, parseKey, type LandId, type LotKey, type World } from './world.js';

export type TreeKind = 'araucaria1' | 'araucaria2' | 'thicket1' | 'thicket2';
export type NatureKind = 'stream' | 'brook' | 'waterfall' | 'rapids' | 'oxbow' | 'limestone' | 'cave' | 'sinkhole' | 'wetSinkhole' | 'bedrock';
/** 'seen': explored but not annexed. Lands missing from the record are hidden. */
export type LandStatus = 'ours' | 'seen';

export interface MapState {
  streets: Record<LotKey, true>;
  /** Buildings by their anchor lot (the lot with the smallest column and row of the footprint). */
  buildings: Record<LotKey, BuildingId>;
  trees: Record<LotKey, TreeKind>;
  lands: Record<LandId, LandStatus>;
  nature: Record<LotKey, NatureKind>;
  /** i18n keys of named features (caves). */
  natureNames: Record<LotKey, string>;
}

const { width: NX, height: NY, regionSize: REG, startColumn: A0, startRow: M0 } = WORLD;
export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
/** The starting village was drawn this many rows north of its original plan. */
const PLAN_SHIFT = 19;
const CAVE_NAMES = 8;

export const sizeOf = (type: BuildingId): readonly [number, number] => (BUILDINGS[type] as { size?: readonly [number, number] }).size ?? [1, 1];

export function cellsOf(a: number, b: number, type: BuildingId): [number, number][] {
  const [w, h] = sizeOf(type), out: [number, number][] = [];
  for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) out.push([a + x, b + y]);
  return out;
}

/** The lots touching a building's footprint on its four sides. */
export function around(a: number, b: number, type: BuildingId): [number, number][] {
  const [w, h] = sizeOf(type), out: [number, number][] = [];
  for (let x = 0; x < w; x++) { out.push([a + x, b - 1]); out.push([a + x, b + h]); }
  for (let y = 0; y < h; y++) { out.push([a - 1, b + y]); out.push([a + w, b + y]); }
  return out;
}

/** Which building covers each lot, as the building's anchor key. */
export function occupancy(map: Pick<MapState, 'buildings'>): Record<LotKey, LotKey> {
  const o: Record<LotKey, LotKey> = {};
  for (const key of Object.keys(map.buildings) as LotKey[]) {
    const [a, b] = parseKey(key);
    for (const [x, y] of cellsOf(a, b, map.buildings[key] as BuildingId)) o[lotKey(x, y)] = key;
  }
  return o;
}

/** Terrain height at any point, interpolated between lot corners. */
export function heightAt(world: Pick<World, 'heights'>, i: number, j: number): number {
  if (i < 0 || j < 0 || i > NX || j > NY) return 0;
  const a = Math.min(NX - 1, Math.floor(i)), b = Math.min(NY - 1, Math.floor(j)), f = i - a, g = j - b;
  const H = world.heights, c0 = H[a] as Float32Array, c1 = H[a + 1] as Float32Array;
  return ((c0[b] as number) * (1 - f) + (c1[b] as number) * f) * (1 - g) + ((c0[b + 1] as number) * (1 - f) + (c1[b + 1] as number) * f) * g;
}

const riverMid = (world: World, a: number) => {
  const x = Math.max(0, Math.min(NX - 1, a));
  return (world.riverBank[x] as number) + (world.riverWidth[x] as number) / 2;
};

/** Trees at the start of a game. Uses the world's running random source. */
export function initialTrees(world: World): Record<LotKey, TreeKind> {
  const t: Record<LotKey, TreeKind> = {}, R = world.rest;
  for (let a = 0; a < NX; a++) for (let b = 0; b < NY; b++) {
    const key = lotKey(a, b);
    if (world.water.has(key)) continue;
    // leave a clearing around deposits so they show
    let near = false;
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) if (world.deposits[lotKey(a + x, b + y)]) near = true;
    if (near) continue;
    const n = noise(world, a, b) + (world.lands[landOf(a, b)] as { forest: number }).forest;
    if (n > 0.35 && R() < 0.85) t[key] = n > 0.75 ? (R() < 0.6 ? 'araucaria1' : 'araucaria2') : R() < 0.35 ? 'araucaria2' : R() < 0.6 ? 'thicket1' : 'thicket2';
  }
  // riverside forest, except where a fixed draw leaves it open
  const fixed = (a: number, b: number, s: number) => {
    let h = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(s + 1, 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  for (let a = 0; a < NX; a++) for (let b = 0; b < NY; b++) {
    const key = lotKey(a, b);
    if (t[key] || world.water.has(key) || world.deposits[key]) continue;
    const bank = DIRS4.some(([x, y]) => world.water.has(lotKey(a + x, b + y)));
    if (bank && fixed(a, b, 77) < 0.72) t[key] = fixed(a, b, 78) < 0.2 ? 'araucaria2' : 'thicket1';
  }
  return t;
}

/** The seat is ours; the river downstream is already known to the end of the map, but not annexed. */
function initialLands(world: World): Record<LandId, LandStatus> {
  const t: Record<LandId, LandStatus> = { [SEAT_LAND]: 'ours' };
  for (let a = A0; a < NX; a++) for (let n = 0; n < (world.riverWidth[a] as number); n++) {
    const id = landOf(a, (world.riverBank[a] as number) + n);
    if (!t[id]) t[id] = 'seen';
  }
  return t;
}

const START_BUILDINGS: [BuildingId, [number, number][]][] = [
  ['chapel', [[21, 32]]], ['store', [[23, 32]]], ['riverPort', [[22, 30]]], ['cornField', [[24, 32]]], ['beanField', [[25, 32]]],
  ['cassavaField', [[20, 32]]],
];
const START_HOMES = (): [BuildingId, [number, number][]][] => (BALANCE.smallHomes ? [['house', [[20, 34], [21, 34], [23, 34], [24, 34]]]] : [['house', [[20, 34]]], ['hut', [[21, 34], [23, 34], [24, 34]]]]);

/** The starting village: two streets, a chapel, a store, a river port, three fields and four homes. */
export function initialMap(world: World): MapState {
  const map: MapState = { streets: {}, buildings: {}, trees: initialTrees(world), lands: initialLands(world), nature: {}, natureNames: {} };
  const street = (a0: number, b0: number, a1: number, b1: number) => {
    for (let a = Math.min(a0, a1); a <= Math.max(a0, a1); a++) for (let b = Math.min(b0, b1) + PLAN_SHIFT; b <= Math.max(b0, b1) + PLAN_SHIFT; b++) {
      map.streets[lotKey(a, b)] = true;
      delete map.trees[lotKey(a, b)];
    }
  };
  street(22, 31, 22, 36);
  street(19, 33, 26, 33);
  for (const [type, lots] of [...START_BUILDINGS, ...START_HOMES()]) for (const [a, b0] of lots) {
    const key = lotKey(a, b0 + PLAN_SHIFT);
    map.buildings[key] = type;
    delete map.trees[key];
  }
  const { nature, names } = generateNature(world, map);
  map.nature = nature;
  map.natureNames = names;
  for (const key of Object.keys(nature) as LotKey[]) delete map.trees[key];
  return map;
}

/**
 * Nature of the upper Ribeira: brooks and waterfalls, rapids upstream, oxbow lakes on the floodplain,
 * limestone with caves and sinkholes, bedrock. Drawn once per game from the map seed, around what is
 * already built.
 */
export function generateNature(world: World, map: Pick<MapState, 'buildings' | 'streets'>): { nature: Record<LotKey, NatureKind>; names: Record<LotKey, string> } {
  const r = mulberry32(((world.seed ^ 0x2c1b3c6d) >>> 0) || 7);
  const nat: Record<LotKey, NatureKind> = {}, names: Record<LotKey, string> = {};
  const occ = occupancy(map);
  const awayFromSeat = (a: number, b: number) => Math.hypot(a - A0, b - (M0 + 6)) > 9;
  const free = (a: number, b: number) => {
    if (!inBounds(a, b)) return false;
    const key = lotKey(a, b);
    return !world.water.has(key) && !world.deposits[key] && !occ[key] && !map.streets[key] && !nat[key];
  };
  const fromRiver = (a: number, b: number) => Math.abs(b + 0.5 - riverMid(world, a));
  const cellsOfLand = (id: LandId) => {
    const [c, l] = parseKey(id), out: [number, number][] = [];
    for (let a = c * REG; a < (c + 1) * REG; a++) for (let b = l * REG; b < (l + 1) * REG; b++) out.push([a, b]);
    return out;
  };
  const pick = (id: LandId, ok?: (a: number, b: number) => boolean): [number, number] | null => {
    const cs = cellsOfLand(id);
    for (let n = 0; n < 60; n++) {
      const [a, b] = cs[Math.floor(r() * cs.length)] as [number, number];
      if (free(a, b) && (!ok || ok(a, b))) return [a, b];
    }
    return null;
  };
  const patch = (id: LandId, kind: NatureKind, size: number, ok?: (a: number, b: number) => boolean): [number, number][] => {
    const s = pick(id, ok);
    if (!s) return [];
    const done: [number, number][] = [s];
    nat[lotKey(...s)] = kind;
    for (let n = 0; n < size * 8 && done.length < size; n++) {
      const [a, b] = done[Math.floor(r() * done.length)] as [number, number], [x, y] = DIRS4[Math.floor(r() * 4)] as readonly [number, number];
      if (landOf(a + x, b + y) === id && free(a + x, b + y) && (!ok || ok(a + x, b + y))) {
        nat[lotKey(a + x, b + y)] = kind;
        done.push([a + x, b + y]);
      }
    }
    return done;
  };
  const biomeOf = (id: LandId) => (world.lands[id] as { biome: string }).biome;
  const ids = (Object.keys(world.lands) as LandId[]).sort();
  const caveNames = Array.from({ length: CAVE_NAMES }, (_, i) => i);
  for (const id of ids) {
    const bi = biomeOf(id);
    // limestone cliffs; a cave at the edge of some
    const q = bi === 'highlands' ? 2 + Math.floor(r() * 2) : bi === 'diggings' ? 1 : (bi === 'forest' || bi === 'grassland') && r() < 0.35 ? 1 : 0;
    for (let n = 0; n < q; n++) {
      const block = patch(id, 'limestone', 4 + Math.floor(r() * (bi === 'highlands' ? 9 : 5)), (a, b) => awayFromSeat(a, b) && fromRiver(a, b) > 3);
      if (block.length >= 4 && caveNames.length && (bi === 'highlands' || bi === 'diggings') && r() < 0.55) {
        const c = block.find(([a, b]) => DIRS4.some(([x, y]) => free(a + x, b + y)));
        if (c) {
          const key = lotKey(...c);
          nat[key] = 'cave';
          names[key] = `nature.cave.place.${caveNames.splice(Math.floor(r() * caveNames.length), 1)[0] as number}`;
        }
      }
    }
    // sinkholes: the ground gave way; some hold water
    if (bi !== 'floodplain' && r() < 0.7) {
      const qd = 1 + Math.floor(r() * 3);
      for (let n = 0; n < qd; n++) {
        const s = pick(id, (a, b) => awayFromSeat(a, b) && fromRiver(a, b) > 3);
        if (s) nat[lotKey(...s)] = r() < 0.4 ? 'wetSinkhole' : 'sinkhole';
      }
    }
    // bedrock: stone flush with the ground, poor for fields
    if ((bi === 'highlands' || bi === 'grassland') && r() < 0.8) {
      const ql = 1 + Math.floor(r() * 2);
      for (let n = 0; n < ql; n++) patch(id, 'bedrock', 3 + Math.floor(r() * 5), awayFromSeat);
    }
  }
  // limestone crops out next to lime deposits
  for (const key of (Object.keys(world.deposits) as LotKey[]).sort()) {
    if (world.deposits[key] !== 'lime' || r() < 0.5) continue;
    const [a, b] = parseKey(key);
    if (!awayFromSeat(a, b)) continue;
    let n = 1 + Math.floor(r() * 3);
    for (const [x, y] of DIRS4) if (n > 0 && free(a + x, b + y)) { nat[lotKey(a + x, b + y)] = 'limestone'; n--; }
  }
  // oxbow lakes: the river changed course and left a crescent of water beside it
  for (const id of ids) {
    if (biomeOf(id) !== 'floodplain' || r() > 0.8) continue;
    const [c] = parseKey(id), a = c * REG + 2 + Math.floor(r() * (REG - 4));
    const w = world.riverWidth[a];
    if (!w) continue;
    const side = r() < 0.5 ? -1 : 1, d = 3 + Math.floor(r() * 3), bank = world.riverBank[a] as number, y0 = side < 0 ? bank - d : bank + w - 1 + d;
    const cells: [number, number][] = [];
    for (let x = -3; x <= 3; x++) {
      const y = y0 - side * Math.round(0.28 * x * x);
      cells.push([a + x, y]);
      if (Math.abs(x) <= 1) cells.push([a + x, y + side]);
    }
    const ok = cells.filter(([x, y]) => free(x, y) && awayFromSeat(x, y) && !DIRS4.some(([p, q]) => world.water.has(lotKey(x + p, y + q))));
    if (ok.length >= 4) for (const [x, y] of ok) nat[lotKey(x, y)] = 'oxbow';
  }
  // brooks: rise high up, away from the river, and run down to it or to another brook; they go around
  // buildings and under streets
  const sources = ids.filter((id) => ['highlands', 'forest', 'yerbaForest', 'grassland', 'diggings'].includes(biomeOf(id)));
  const count = 7 + Math.floor(r() * 4), paths: [number, number][][] = [];
  const h = (a: number, b: number) => heightAt(world, a + 0.5, b + 0.5);
  for (let s = 0; s < count && sources.length; s++) {
    const id = sources[Math.floor(r() * sources.length)] as LandId;
    let start: [number, number] | null = null;
    for (let n = 0; n < 14; n++) {
      const p = pick(id, (a, b) => fromRiver(a, b) > 10);
      if (p && (!start || h(...p) > h(...start))) start = p;
    }
    if (!start) continue;
    const path: [number, number][] = [start], seen = new Set<LotKey>([lotKey(...start)]);
    let reached = false;
    for (let n = 0; n < 90; n++) {
      const [a, b] = path[path.length - 1] as [number, number];
      let best: { c: number; p: [number, number] } | null = null;
      for (const [x, y] of DIRS4) {
        const na = a + x, nb = b + y, key = lotKey(na, nb);
        if (!inBounds(na, nb) || seen.has(key)) continue;
        if (world.water.has(key) || nat[key] === 'brook' || nat[key] === 'waterfall' || nat[key] === 'stream') { reached = true; break; }
        if (!(free(na, nb) || (map.streets[key] && !occ[key] && !nat[key]))) continue;
        const cost = fromRiver(na, nb) + h(na, nb) * 0.03 + r() * 1.3 + (Math.hypot(na - A0, nb - (M0 + 6)) < 8 ? 25 : 0);
        if (!best || cost < best.c) best = { c: cost, p: [na, nb] };
      }
      if (reached || !best) break;
      path.push(best.p);
      seen.add(lotKey(...best.p));
    }
    if (!reached || path.length < 6) continue;
    let falls = 0;
    path.forEach(([a, b], i) => {
      let kind: NatureKind = 'brook';
      if (i > 0 && falls < 2 && !map.streets[lotKey(a, b)]) {
        const [pa, pb] = path[i - 1] as [number, number];
        if (h(pa, pb) - h(a, b) > 4.5) { kind = 'waterfall'; falls++; }
      }
      nat[lotKey(a, b)] = kind;
    });
    paths.push(path);
  }
  // map version 2: the three longest brooks become streams, and canoes go up them
  if (world.version >= 2) {
    paths.filter((c) => c.length >= 8).sort((x, y) => y.length - x.length).slice(0, 3).forEach((c) => c.forEach(([a, b]) => { nat[lotKey(a, b)] = 'stream'; }));
  }
  // rapids only upstream of the seat: a canoe from a port above them can't come down full
  for (let g = 0; g < 2; g++) {
    const a = 2 + Math.floor(r() * Math.max(1, A0 - 14));
    for (const x of [a, a + 1]) {
      const w = world.riverWidth[x], bank = world.riverBank[x] as number;
      if (!w || x >= A0 - 10) continue;
      let ok = true;
      for (let n = 0; n < w; n++) if (map.streets[lotKey(x, bank + n)] || occ[lotKey(x, bank + n)]) ok = false;
      if (ok) for (let n = 0; n < w; n++) nat[lotKey(x, bank + n)] = 'rapids';
    }
  }
  return { nature: nat, names };
}

/** The easternmost column with rapids, or -1. Ports at or west of it are upstream of the rapids. */
export function rapidsLimit(map: Pick<MapState, 'nature'>): number {
  let max = -1;
  for (const key of Object.keys(map.nature) as LotKey[]) if (map.nature[key] === 'rapids') max = Math.max(max, parseKey(key)[0]);
  return max;
}
