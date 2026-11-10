// The world is regenerated from the map seed every time a game loads: river, lands (15x15-lot regions)
// with their biome, soil and deposits, and the terrain height. Nothing here is saved.
import { BIOMES, WORLD, type GoodId } from '@assunguy/data';
import { mulberry32 } from './rng.js';

export type LotKey = `${number},${number}`;
export type LandId = `${number},${number}`;
export type BiomeId = keyof typeof BIOMES;
export type DepositId = 'lime' | 'lead' | 'gold' | 'iron' | 'yerba';

export const lotKey = (a: number, b: number): LotKey => `${a},${b}`;
export const parseKey = (key: string): [number, number] => {
  const i = key.indexOf(',');
  return [Number(key.slice(0, i)), Number(key.slice(i + 1))];
};
export const landOf = (a: number, b: number): LandId => `${Math.floor(a / WORLD.regionSize)},${Math.floor(b / WORLD.regionSize)}`;

/** The land where the colony starts. */
export const SEAT_LAND: LandId = '1,3';

export interface Land {
  /** i18n key of the land's name, plus an optional "upper" marker when the biome ran out of names. */
  nameKey: string;
  upper?: boolean;
  biome: BiomeId;
  /** Forest density offset for this land. */
  forest: number;
  /** Yield multiplier per crop good. */
  soil: Partial<Record<GoodId, number>>;
  /**
   * Only during generation: lands the prototype set aside for Kaingang villages. The village mechanic is
   * gone (the Kaingang now only appear in events), but the draws that placed them are kept so a seed builds
   * the same map, and these lands end up as ordinary forest.
   */
  formerlyReserved?: boolean;
}

export interface World {
  seed: number;
  version: number;
  /** Twelve random phases shared by the noise functions. */
  phases: number[];
  /** Upper bank row of the main river, per column. */
  riverBank: number[];
  riverWidth: number[];
  water: Set<LotKey>;
  lands: Record<LandId, Land>;
  deposits: Record<LotKey, DepositId>;
  /** Terrain height at lot corners, [column][row]. */
  heights: Float32Array[];
  /** Random source for the rest of the generation (nature, trees), seeded from the map seed. */
  rest: () => number;
}

const { width: NX, height: NY, regionSize: REG, regionCols: COLS, regionRows: ROWS, startColumn: A0, startRow: M0 } = WORLD;
const SEAT_SOIL: Partial<Record<GoodId, number>> = { rice: 1.2, corn: 1.1, cassava: 1.1, beans: 1, sugarcane: 1.1, wheat: 0.85, tobaccoLeaf: 1, cotton: 0.9, coffee: 0.85 };
const BIOME_DECK: BiomeId[] = ['highlands', 'highlands', 'highlands', 'highlands', 'diggings', 'diggings', 'diggings', 'yerbaForest', 'yerbaForest', 'yerbaForest', 'yerbaForest', 'grassland', 'grassland', 'grassland', 'grassland', 'grassland', 'forest', 'forest', 'forest', 'forest', 'forest'];
const PLACE_COUNT: Record<BiomeId, number> = { floodplain: 12, grassland: 12, forest: 12, yerbaForest: 10, highlands: 10, diggings: 8 };
const RESERVED_NAMES = 3;

/** Smooth noise used for forests and terrain, from the world's phases. */
export function noise(world: Pick<World, 'phases'>, a: number, b: number): number {
  const p = world.phases;
  const f = (x: number, y: number, e: number, i: number) => Math.sin(x / e + (p[i] as number)) * Math.cos(y / e + (p[i + 1] as number));
  return f(a, b, 5.5, 0) + 0.6 * f(a + 9, b - 4, 2.9, 2);
}

function generateRiver(r: () => number, version: number) {
  const amp = 9 + r() * 14, e1 = 9 + r() * 9, f1 = r() * 6.28, e2 = 3.4 + r() * 2.6, f2 = r() * 6.28, up = r() < 0.5 ? -1 : 1, drift = up * (2 + r() * 16);
  const target = (a: number) => {
    const far = Math.min(1, Math.max(0, Math.abs(a - A0) - 9) / 14);
    const y = M0 + (amp * Math.sin((a - A0) / e1 + f1) - amp * Math.sin(f1) + 2.4 * Math.sin((a - A0) / e2 + f2) - 2.4 * Math.sin(f2) + (drift * Math.max(0, a - A0)) / 60) * far;
    return Math.max(3, Math.min(NY - 8, y));
  };
  let bank: number[] = new Array<number>(NX);
  bank[A0] = M0;
  const step = (from: number, a: number) => {
    const d = target(a) - (bank[from] as number);
    bank[a] = (bank[from] as number) + (Math.abs(d) < 0.6 ? 0 : Math.sign(d));
  };
  for (let a = A0 + 1; a < NX; a++) step(a - 1, a);
  for (let a = A0 - 1; a >= 0; a--) step(a + 1, a);
  // the river widens downstream
  let width: number[] = bank.map((_, a) => (a < A0 + 24 ? 2 : a < A0 + 46 ? 3 : 4));
  // map version 2: the main river is one lot wider, growing upward
  if (version >= 2) {
    width = width.map((w) => w + 1);
    bank = bank.map((y) => Math.max(1, y - 1));
  }
  const water = new Set<LotKey>();
  for (let a = 0; a < NX; a++) for (let n = 0; n < (width[a] as number); n++) water.add(lotKey(a, (bank[a] as number) + n));
  return { bank, width, water };
}

function generateLands(r: () => number, river: { bank: number[]; width: number[]; water: Set<LotKey> }) {
  const lands: Record<LandId, Land> = {};
  const deposits: Record<LotKey, DepositId> = {};
  const used = new Set<string>();
  const pickName = (biome: BiomeId | 'reserved'): { nameKey: string; upper?: boolean } => {
    const count = biome === 'reserved' ? RESERVED_NAMES : PLACE_COUNT[biome];
    const keys = Array.from({ length: count }, (_, i) => (biome === 'reserved' ? `land.reserved.${i}` : `biome.${biome}.place.${i}`));
    const free = keys.filter((n) => !used.has(n));
    if (!free.length) return { nameKey: keys[Math.floor(r() * keys.length)] as string, upper: true };
    const n = free[Math.floor(r() * free.length)] as string;
    used.add(n);
    return { nameKey: n };
  };
  const touchesRiver = (c: number, l: number) => {
    for (let a = c * REG; a < (c + 1) * REG; a++) {
      const m = river.bank[a] as number;
      if (m + (river.width[a] as number) > l * REG && m < (l + 1) * REG) return true;
    }
    return false;
  };
  const ids: [number, number][] = [];
  for (let c = 0; c < COLS; c++) for (let l = 0; l < ROWS; l++) ids.push([c, l]);
  const far = ids.filter(([c, l]) => !touchesRiver(c, l) && Math.abs(c - 1) + Math.abs(l - 3) >= 3);
  const reserved: [number, number][] = [];
  for (let n = 0; n < 30 && reserved.length < 3 && far.length; n++) {
    const o = far[Math.floor(r() * far.length)] as [number, number];
    if (o[0] === 1 && o[1] === ROWS - 1) continue;
    if (reserved.every(([c, l]) => Math.abs(c - o[0]) + Math.abs(l - o[1]) >= 4)) reserved.push(o);
  }
  const deck = [...BIOME_DECK];
  for (const [c, l] of ids) {
    const id = `${c},${l}` as LandId;
    if (id === SEAT_LAND) { lands[id] = { nameKey: 'land.seat', biome: 'floodplain', forest: -0.5, soil: { ...SEAT_SOIL } }; continue; }
    if (reserved.some(([x, y]) => x === c && y === l)) { lands[id] = { ...pickName('reserved'), biome: 'forest', forest: 0.3, soil: {}, formerlyReserved: true }; continue; }
    let biome: BiomeId;
    const river_ = touchesRiver(c, l);
    if (river_ && r() < 0.55) biome = r() < 0.75 ? 'floodplain' : 'diggings';
    else if (deck.length && r() < 0.8) biome = deck.splice(Math.floor(r() * deck.length), 1)[0] as BiomeId;
    else biome = (['grassland', 'forest', 'yerbaForest', 'floodplain', 'highlands'] as BiomeId[])[Math.floor(r() * 5)] as BiomeId;
    if (biome === 'floodplain' && !river_) biome = 'grassland';
    const B = BIOMES[biome];
    const soil: Partial<Record<GoodId, number>> = {};
    for (const [g, v] of Object.entries(B.soil)) soil[g as GoodId] = Math.round((v + (r() - 0.5) * 0.24) * 100) / 100;
    lands[id] = { ...pickName(biome), biome, forest: B.forest + (r() - 0.5) * 0.16, soil };
  }
  // deposits: each land draws where they lie and, sometimes, one more or one less
  const freeLot = (c: number, l: number): LotKey | null => {
    for (let n = 0; n < 40; n++) {
      const a = c * REG + 1 + Math.floor(r() * (REG - 2)), b = l * REG + 1 + Math.floor(r() * (REG - 2));
      const key = lotKey(a, b);
      if (!river.water.has(key) && !deposits[key]) return key;
    }
    return null;
  };
  for (const id of Object.keys(lands) as LandId[]) {
    const land = lands[id] as Land, [c, l] = parseKey(id);
    if (land.formerlyReserved) {
      // the old village lots: drawn and discarded, to keep the seed's sequence
      for (let n = 0; n < 4; n++) freeLot(c, l);
      continue;
    }
    if (id === SEAT_LAND) continue;
    const kinds = BIOMES[land.biome].deposits as Record<string, number>;
    for (const [kind, base] of Object.entries(kinds)) {
      const q = Math.max(0, base + Math.round((r() - 0.5) * 3));
      if (r() < 0.2 && land.biome === 'highlands') continue; // not every highland has every deposit
      for (let n = 0; n < q; n++) {
        const key = freeLot(c, l);
        if (key) deposits[key] = kind as DepositId;
      }
    }
  }
  // the seat has little, but enough to start: two lime deposits, away from the first village
  for (const [a, b] of [[A0 + 5, M0 + 11], [A0 + 6, M0 + 12]] as const) deposits[lotKey(a, b)] = 'lime';
  // make sure every resource exists somewhere
  const ensure = (kind: DepositId, qty: number) => {
    if (Object.values(deposits).includes(kind)) return;
    const list = (Object.keys(lands) as LandId[]).filter((id) => !(lands[id] as Land).formerlyReserved && id !== SEAT_LAND);
    const id = list[Math.floor(r() * list.length)] as LandId;
    const [c, l] = parseKey(id);
    for (let n = 0; n < qty; n++) {
      const key = freeLot(c, l);
      if (key) deposits[key] = kind;
    }
  };
  ensure('gold', 3);
  ensure('lead', 3);
  ensure('iron', 3);
  ensure('yerba', 6);
  // former reserves become ordinary forest, named from the forest list by position
  for (const id of Object.keys(lands) as LandId[]) {
    const land = lands[id] as Land;
    if (!land.formerlyReserved) continue;
    const [c, l] = parseKey(id);
    lands[id] = { nameKey: `biome.forest.place.${(c * 7 + l * 13) % PLACE_COUNT.forest}`, biome: 'forest', forest: BIOMES.forest.forest, soil: { ...BIOMES.forest.soil } as Partial<Record<GoodId, number>> };
  }
  return { lands, deposits };
}

function generateHeights(phases: number[], river: { bank: number[]; width: number[] }): Float32Array[] {
  const heights: Float32Array[] = [];
  const cx = A0, cy = M0 + 6;
  const [p0, p1, p2, p3, p4] = phases.slice(4, 9) as [number, number, number, number, number];
  const mid = (a: number) => {
    const x = Math.max(0, Math.min(NX - 1, a));
    return (river.bank[x] as number) + (river.width[x] as number) / 2;
  };
  for (let i = 0; i <= NX; i++) {
    const col = new Float32Array(NY + 1);
    for (let j = 0; j <= NY; j++) {
      const reach = Math.min(1, Math.hypot(i - cx, j - cy) / 20);
      const amp = 9 + 42 * reach * reach;
      const wave = 0.5 + 0.34 * Math.sin(i / 7.5 + p0) * Math.cos(j / 6 + p1) + 0.22 * Math.sin(i / 3.1 + p2) * Math.cos(j / 2.7 + p3) + 0.06 * Math.sin((i + j) / 1.7 + p4);
      let nearRiver = 1;
      for (let x = Math.max(0, i - 3); x <= Math.min(NX - 1, i + 2); x++) nearRiver = Math.min(nearRiver, Math.hypot(x + 0.5 - i, mid(x) - j) / (2.4 + (river.width[x] as number) * 0.4));
      const edge = Math.min(1, Math.min(i, j, NX - i, NY - j) / 3);
      col[j] = Math.max(0, wave) * amp * Math.min(1, nearRiver) * edge;
    }
    heights.push(col);
  }
  return heights;
}

export function generateWorld(seed: number, version = 2): World {
  const r = mulberry32(seed);
  const phases = Array.from({ length: 12 }, () => r() * 6.28);
  const river = generateRiver(r, version);
  const { lands, deposits } = generateLands(r, river);
  const heights = generateHeights(phases, river);
  return { seed, version, phases, riverBank: river.bank, riverWidth: river.width, water: river.water, lands, deposits, heights, rest: mulberry32(seed ^ 0x5bd1e995) };
}

export const inBounds = (a: number, b: number): boolean => a >= 0 && b >= 0 && a < NX && b < NY;
