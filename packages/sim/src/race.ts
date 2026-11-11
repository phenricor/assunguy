// The late-game transport race (the prototype's `corrida`). From the season after the colony becomes a Town,
// rival colonies deliver to the same markets cheaper and cheaper on a fixed schedule; the colony's
// competitiveness in each market is the rival's cost per arroba over its own cheapest full-gateway cost.
// Below 0.8 the market takes less of its cargo, and prices follow competitiveness. Railways (rails laid lot by
// lot from a train station to an edge of the map) open Curitiba, Paranaguá and later São Paulo. Families leave
// when the income per family falls from its best or the freight is too dear; a colony that stays down is
// declared in decline and ends; one that leads two markets for two years at level 12 wins.
import { BUILDINGS, VEHICLES, WORLD, type BuildingId, type VehicleDef, type VehicleId } from '@assunguy/data';
import type { Economy } from './economy.js';
import { chronicle } from './events.js';
import { heightAt } from './map.js';
import type { GameState, DestinationId } from './state.js';
import { landOf, lotKey, parseKey, type LotKey, type World } from './world.js';

export interface RaceState {
  /** Season the race started. */
  t0: number;
  /** Rail lots laid. */
  rails: Record<LotKey, true>;
  /** Advances already announced: `p<at>` a year before, `a<at>` on the day. */
  notices: string[];
  peakFamilies: number;
  /** Income per family, the last four seasons and the best yearly mean. */
  perFamily: number[];
  peakPerFamily: number;
  /** Volume-weighted competitiveness last season. */
  meanCompetitiveness: number;
  negativeSeasons: number;
  lowSeasons: number;
  decline: { left: number } | null;
  winning: number;
  won?: boolean;
}

export const RIVAL0: Record<DestinationId, number> = { iguape: 0.5, curitiba: 1, paranagua: 1.4, saoPaulo: 1 };
/** What the rivals do, by seasons since the race started; `opens` unlocks for the colony too. */
export const ADVANCES: { at: number; key: string; factors: Partial<Record<DestinationId, number>>; opens: string[] }[] = [
  { at: 4, key: 'carts', factors: { curitiba: 0.8 }, opens: [] },
  { at: 12, key: 'pontaGrossa', factors: { paranagua: 0.6 }, opens: ['mediumTrain'] },
  { at: 20, key: 'steamers', factors: { iguape: 0.7 }, opens: [] },
  { at: 32, key: 'secondWave', factors: { curitiba: 0.62, paranagua: 0.7 }, opens: ['heavyTrain', 'north'] },
];
/** Train trips per arroba to each market, and the tolls beyond the map by the edge the rails leave from. */
export const TRAIN_TRIP: Partial<Record<DestinationId, number>> = { curitiba: 0.22, paranagua: 0.28, saoPaulo: 0.3 };
export const TOLL: Record<'south' | 'east' | 'north', Partial<Record<DestinationId, number>>> = { south: { paranagua: 0.33 }, east: { paranagua: 0.12 }, north: { saoPaulo: 0.12 } };
export const RAIL_ON_WATER = 2000;

export const raceTime = (s: GameState): number => (s.race ? s.market.t - s.race.t0 : 0);
/** Whether an item the rivals' advances unlock is open now (always false before the race). */
export const opened = (s: GameState, item: string): boolean => !!s.race && !ADVANCES.some((a) => a.opens.includes(item) && a.at > raceTime(s));
export function rivalCost(s: GameState, d: DestinationId): number {
  let r = RIVAL0[d];
  const t = raceTime(s);
  for (const a of ADVANCES) if (a.at <= t && a.factors[d]) r *= a.factors[d] as number;
  return r;
}
export const nextAdvance = (s: GameState) => ADVANCES.find((a) => a.at > raceTime(s)) ?? null;
/** Rival cost over ours, kept between 0.6 and 1.1. */
export const competitivenessOf = (rival: number, cost: number): number => Math.max(0.6, Math.min(1.1, rival / Math.max(0.01, cost)));
/** The share of the cargo a market takes at a competitiveness. */
export const acceptance = (comp: number): number => (comp >= 0.8 ? 1 : 0.3 + Math.max(0, (comp - 0.6) / 0.2) * 0.7);
/** Late-game buildings open during the race. */
export const raceBuilding = (s: GameState, t: BuildingId): boolean => !!s.race && (t === 'trainStation' || t === 'railStop');
/** Whether a vehicle can be bought now: rail vehicles from the race on (the bigger trains when the rivals' advances open them), others by level. */
export function vehicleAvailable(s: GameState, v: VehicleId): boolean {
  const V = VEHICLES[v] as VehicleDef | undefined;
  if (!V) return false;
  if (V.lateGame && !(s.race && (v === 'railcar' || v === 'lightTrain' || opened(s, v)))) return false;
  return (s.level || 1) >= (V.minLevel || 1);
}

// ---- rails

const NX = WORLD.width, NY = WORLD.height;
export const edgeOf = (a: number, b: number): 'south' | 'east' | 'north' | null => (b >= NY - 1 ? 'south' : a >= NX - 1 ? 'east' : b <= 0 ? 'north' : null);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
/** The edges the rails touching a station reach, with the distance in lots. */
export function railExits(s: GameState, station: LotKey): Partial<Record<'south' | 'east' | 'north', number>> {
  const rails = s.race?.rails ?? {}, [a, b] = parseKey(station), out: Partial<Record<'south' | 'east' | 'north', number>> = {};
  const start = DIRS.map(([x, y]) => lotKey(a + x, b + y)).filter((q) => rails[q]);
  const dist = new Map<LotKey, number>(start.map((q) => [q, 1])), queue = [...start];
  while (queue.length) {
    const q = queue.shift() as LotKey, [p, r] = parseKey(q), e = edgeOf(p, r);
    if (e && (e !== 'north' || opened(s, 'north')) && out[e] === undefined) out[e] = dist.get(q) as number;
    for (const [x, y] of DIRS) { const z = lotKey(p + x, r + y); if (rails[z] && !dist.has(z)) { dist.set(z, (dist.get(q) as number) + 1); queue.push(z); } }
  }
  return out;
}
/** The rail lots of a station's line to an edge, for drawing trains. */
export function railPath(s: GameState, station: LotKey, edge: 'south' | 'east' | 'north'): [number, number][] | null {
  const rails = s.race?.rails ?? {}, [a, b] = parseKey(station), prev = new Map<LotKey, LotKey | null>();
  let front = DIRS.map(([x, y]) => lotKey(a + x, b + y)).filter((q) => rails[q]);
  front.forEach((q) => prev.set(q, null));
  let end: LotKey | null = null;
  while (front.length && !end) {
    const next: LotKey[] = [];
    for (const q of front) { const [p, r] = parseKey(q); if (edgeOf(p, r) === edge) { end = q; break; } for (const [x, y] of DIRS) { const z = lotKey(p + x, r + y); if (rails[z] && !prev.has(z)) { prev.set(z, q); next.push(z); } } }
    front = next;
  }
  if (!end) return null;
  const pts: [number, number][] = [];
  for (let q: LotKey | null = end; q; q = prev.get(q) ?? null) { const [p, r] = parseKey(q); pts.unshift([p + 0.5, r + 0.5]); }
  return [[a + 0.5, b + 0.5], ...pts];
}
/** Cost of a rail lot: dearer up the hills, a bridge over water, more over streams and outside the colony. */
export function railCost(s: GameState, w: World, a: number, b: number): number {
  const key = lotKey(a, b);
  let c = 160 * (1 + Math.max(0, heightAt(w, a, b) - 6) / 12);
  if (w.water.has(key)) c = RAIL_ON_WATER;
  else if (['brook', 'waterfall', 'stream'].includes(s.map.nature[key] ?? '')) c += 150;
  if (s.map.lands[landOf(a, b)] !== 'ours') c *= 1.5;
  return Math.round(c / 10) * 10;
}
/** What stops a rail on a lot, or null. */
export function railBlocked(s: GameState, w: World, a: number, b: number, occupied: Record<LotKey, LotKey>): string | null {
  const key = lotKey(a, b);
  if (a < 0 || b < 0 || a >= NX || b >= NY) return 'outside';
  if (!s.race) return 'locked';
  if (!s.map.lands[landOf(a, b)]) return 'unknownLand';
  if (s.race.rails[key]) return 'alreadyRail';
  if (s.map.buildings[key] || occupied[key]) return 'buildingHere';
  if (w.deposits[key]) return 'deposit';
  const n = s.map.nature[key];
  if (n && !['stream', 'brook', 'waterfall', 'rapids', 'bedrock'].includes(n)) return 'natureHere';
  return null;
}

// ---- the season

export function startRace(s: GameState, news: { key: string; params?: Record<string, string | number> }[]): void {
  s.race = { t0: s.market.t, rails: {}, notices: [], peakFamilies: Object.keys(s.families).length, perFamily: [], peakPerFamily: 0, meanCompetitiveness: 1, negativeSeasons: 0, lowSeasons: 0, decline: null, winning: 0 };
  news.push({ key: 'news.race.start' });
  chronicle(s, 'chronicle.raceStarted');
  s.queue.push({ kind: 'raceIntro' } as never);
}

export function advanceRace(s: GameState, c: Economy, news: { key: string; params?: Record<string, string | number> }[]): void {
  const R = s.race as RaceState, t = raceTime(s);
  for (const a of ADVANCES) {
    if (a.at - t === 4 && !R.notices.includes(`p${a.at}`)) { R.notices.push(`p${a.at}`); news.push({ key: `news.race.soon.${a.key}` }); }
    if (a.at === t && !R.notices.includes(`a${a.at}`)) { R.notices.push(`a${a.at}`); news.push({ key: `news.race.now.${a.key}` }); chronicle(s, `chronicle.race.${a.key}`); }
  }
  // firewood yards cut the forest around them, one tree a season
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    if (s.map.buildings[key] !== 'woodYard') continue;
    const [a, b] = parseKey(key);
    for (let r = 1; r <= 4; r++) { const tree = (Object.keys(s.map.trees) as LotKey[]).find((q) => { const [p, q2] = parseKey(q); return Math.max(Math.abs(p - a), Math.abs(q2 - b)) === r; }); if (tree) { delete s.map.trees[tree]; break; } }
  }
  // families leave when the income per family falls from its best (a yearly mean) or the freight is dear
  const fam = Object.keys(s.families).length, perFamily = fam ? c.incomeTotal / fam : 0;
  R.perFamily = [...R.perFamily, perFamily].slice(-4);
  const mean = R.perFamily.reduce((x, y) => x + y, 0) / R.perFamily.length;
  R.peakFamilies = Math.max(R.peakFamilies, fam); R.peakPerFamily = Math.max(R.peakPerFamily, mean);
  const fall = R.peakPerFamily ? 1 - mean / R.peakPerFamily : 0;
  const worstFirst = () => Object.values(s.families).sort((x, y) => (s.homeRating[x.id.slice(0, x.id.indexOf('#')) as LotKey] ?? 0) - (s.homeRating[y.id.slice(0, y.id.indexOf('#')) as LotKey] ?? 0));
  if (fall > 0.12) {
    const n = Math.max(1, Math.round(fam * Math.min(0.1, fall - 0.12)));
    for (const f of worstFirst().slice(0, n)) delete s.families[f.id];
    news.push({ key: 'news.race.incomeFell', params: { share: Math.round(fall * 100), n } });
  }
  if (R.meanCompetitiveness < 0.9) {
    const n = Math.round(Object.keys(s.families).length * (0.9 - R.meanCompetitiveness) * 0.25);
    if (n > 0) { for (const f of worstFirst().slice(0, n)) delete s.families[f.id]; news.push({ key: 'news.race.freight', params: { n } }); }
  }
  // decline and victory
  R.negativeSeasons = s.cash < 0 ? R.negativeSeasons + 1 : 0;
  R.lowSeasons = R.meanCompetitiveness < 0.8 ? R.lowSeasons + 1 : 0;
  const now = Object.keys(s.families).length;
  const bad = now < R.peakFamilies * 0.6 || R.negativeSeasons >= 6 || s.cash < -8000 || R.lowSeasons >= 8;
  if (bad) {
    if (!R.decline) { R.decline = { left: 8 }; news.push({ key: 'news.race.decline' }); chronicle(s, 'chronicle.race.decline'); }
    else { R.decline.left -= 1; if (R.decline.left <= 0) { s.queue.unshift({ kind: 'raceLost' } as never); chronicle(s, 'chronicle.race.lost'); } }
  } else if (R.decline) { R.decline = null; news.push({ key: 'news.race.recovered' }); }
  const vol = c.transport.destVolume, comp = c.transport.competitiveness;
  const used = (Object.keys(comp) as DestinationId[]).filter((d) => (vol[d] ?? 0) > 0), total = used.reduce((x, d) => x + (vol[d] ?? 0), 0);
  R.meanCompetitiveness = total ? used.reduce((x, d) => x + comp[d] * (vol[d] ?? 0), 0) / total : 1;
  const leading = used.filter((d) => comp[d] >= 1).length;
  R.winning = leading >= 2 ? R.winning + 1 : 0;
  if (R.winning >= 8 && s.level >= 12 && !R.won) { R.won = true; s.queue.push({ kind: 'raceWon' } as never); chronicle(s, 'chronicle.race.won'); }
}

export const _b = BUILDINGS;
