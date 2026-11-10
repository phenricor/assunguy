// One season's economy, worked out as a whole year (three years are run and the last one is kept, so
// stocks settle): who works where, what each building yields, what families eat, what the workshops
// transform, what the market sells, what is hauled out and exported, what is lost, and the taxes.
import { BALANCE, BUILDINGS, GOODS, GOOD_IDS, MILESTONES, type BuildingDef, type BuildingId, type GoodDef, type GoodId, type Sector } from '@assunguy/data';
import { cellsOf, type NatureKind } from './map.js';
import { currentPrice, shockFactor } from './market.js';
import { connected, mainNetwork } from './network.js';
import { crisisOn, hasChoice, hasLaw, homeOf, taxRate, upgradeOf, workDone, type Family, type GameState } from './state.js';
import { finishTransport, haulSeason, exportThroughGateways, startTransport, type ProducerYear, type TransportSummary } from './transport.js';
import { WORLD } from '@assunguy/data';
import { landOf, lotKey, parseKey, type LotKey, type World } from './world.js';

type B = BuildingDef & { nearForest?: boolean };
export const def = (t: BuildingId): B => BUILDINGS[t] as B;
export const good = (g: GoodId): GoodDef => GOODS[g] as GoodDef;
const { regionSize: REG, height: NY, startColumn: A0 } = WORLD;

export const SECTOR_ORDER: Sector[] = ['farming', 'river', 'commerce', 'crafts', 'mining', 'services'];
const ALLOCATION_ORDER: Sector[] = ['farming', 'commerce', 'river', 'crafts', 'mining', 'services'];
/** Raw materials in the order workshops take them: hides become leather before leather becomes shoes. */
const MATERIAL_ORDER: GoodId[] = ['corn', 'rice', 'cassava', 'wheat', 'fish', 'meat', 'sugarcane', 'yerba', 'tobaccoLeaf', 'coffee', 'cotton', 'hide', 'leather', 'planks', 'iron'];
/** Workshops that run better with running water nearby (water wheel, monjolo, saw). */
const WATER_POWERED = new Set<BuildingId>(['monjolo', 'mill', 'sawmill', 'flourHouse', 'sugarMill', 'distillery', 'tannery']);
const RUNNING_WATER = new Set<NatureKind>(['stream', 'brook', 'waterfall', 'rapids']);
const SERVICE_WAGE: Partial<Record<BuildingId, number>> = { school: 8, apothecary: 8, chapel: 6, church: 12, hospital: 20, theater: 12, jail: 6, fireStation: 10, fountain: 2 };
/** Families of each crop field eat this many arrobas of what they grow, per season. */
const FIELD_FAMILY_EATS = BALANCE.subsistencePerSeason;
/** What a family eats of its own harvest counts in its income at nearly the village price. */
const TABLE_VALUE = BALANCE.subsistenceIncomeShare;
const KEEP = BALANCE.storageKeep;
const RIVER_FREIGHT = BALANCE.riverFreight;

export const jobsOf = (t: BuildingId): number => def(t).jobs ?? 0;
export const sectorOf = (t: BuildingId): Sector | undefined => def(t).sector;
const isCrop = (t: BuildingId) => !!def(t).crop;
export const slotsOf = (s: Pick<GameState, 'map' | 'upgrades'>, key: LotKey): number => {
  const t = s.map.buildings[key] as BuildingId;
  return jobsOf(t) + (upgradeOf(s, key) >= 2 && !isCrop(t) ? 1 : 0);
};

/** Building price at the current milestone: public buildings get dearer as the colony grows. */
export function costOf(t: BuildingId, milestone: number): number {
  const T = def(t);
  const isPublic = !T.housing && !T.crop && !T.fixed && T.payer !== 'families';
  return isPublic ? Math.round((T.cost * (BALANCE.milestoneCostFactor[milestone] ?? 1)) / 5) * 5 : T.cost;
}
const wageFactor = (milestone: number) => (milestone >= 3 ? 1.5 : milestone >= 2 ? 1 : 0);
export const wageOf = (t: BuildingId, milestone: number): number => Math.round((SERVICE_WAGE[t] ?? 0) * wageFactor(milestone));
/** Upkeep per season, paid by the colony (families pay for their own homes and fields). */
export function upkeepOf(t: BuildingId, milestone: number): number {
  const T = def(t);
  if (T.payer === 'families') return 0;
  return Math.max(1, Math.round(costOf(t, milestone) / (T.service || T.capacity || !T.jobs ? 90 : 180))) + wageOf(t, milestone);
}

// ---- families at work

const ratingEfficiency = (n: number) => Math.max(0.7, Math.min(1.15, 0.65 + 0.005 * n));
/** How well a family works: from its home's rating. Rating 30 gives 80%, 60 gives 95%, 90 gives 110%. */
export const familyEfficiency = (s: Pick<GameState, 'homeRating'>, f: Family): number => {
  const n = s.homeRating[homeOf(f.id)];
  return ratingEfficiency(n === undefined ? 60 : n);
};

export interface Team { slots: number; families: Family[]; efficiency: number }
export interface SectorWork { slots: number; filled: number; efficiency: number; buildings: LotKey[]; yield: number }
export interface Allocation {
  byBuilding: Record<LotKey, Team>;
  bySector: Record<Sector, SectorWork>;
  idle: Family[];
  employed: number;
  total: number;
}

/** Families to jobs. The best-off families go to production first. */
export function allocate(s: GameState, linked = connected(s.map)): Allocation {
  const all = Object.values(s.families).filter((f) => linked.has(homeOf(f.id)));
  const used = new Set<Family>();
  const best = all.slice().sort((a, b) => familyEfficiency(s, b) - familyEfficiency(s, a));
  let i = 0;
  const next = () => { while (i < best.length && used.has(best[i] as Family)) i += 1; return best[i]; };
  const bySector = Object.fromEntries(SECTOR_ORDER.map((x) => [x, { slots: 0, filled: 0, efficiency: 0, buildings: [] as LotKey[], yield: 0 }])) as Record<Sector, SectorWork>;
  const keys = (Object.keys(s.map.buildings) as LotKey[]).filter((key) => linked.has(key) && jobsOf(s.map.buildings[key] as BuildingId));
  const teams: Record<LotKey, Family[]> = {};
  const inOrder = (fn: (key: LotKey, team: Family[]) => void) => {
    for (const sec of ALLOCATION_ORDER) for (const key of keys) if (sectorOf(s.map.buildings[key] as BuildingId) === sec) fn(key, (teams[key] ??= []));
  };
  // goods need a way out: a store is never left empty while anyone lives in the colony
  for (const sec of ['commerce', 'river'] as Sector[]) {
    const own = keys.filter((key) => sectorOf(s.map.buildings[key] as BuildingId) === sec && def(s.map.buildings[key] as BuildingId).capacity);
    if (!own.length || own.some((key) => (teams[key] ?? []).length)) continue;
    const top = own.slice().sort((x, y) => upgradeOf(s, y) - upgradeOf(s, x))[0] as LotKey, f = next();
    if (f) { used.add(f); (teams[top] ??= []).push(f); }
  }
  // two rounds, so a new building does not empty one that works: the basic team, then the extra slot of upgrades
  inOrder((key, team) => { while (team.length < jobsOf(s.map.buildings[key] as BuildingId)) { const f = next(); if (!f) break; used.add(f); team.push(f); } });
  inOrder((key, team) => { const v = slotsOf(s, key); while (team.length < v) { const f = next(); if (!f) break; used.add(f); team.push(f); } });
  const byBuilding: Record<LotKey, Team> = {};
  for (const sec of SECTOR_ORDER) for (const key of keys) {
    if (sectorOf(s.map.buildings[key] as BuildingId) !== sec) continue;
    const v = slotsOf(s, key), team = teams[key] ?? [];
    const ef = team.reduce((x, f) => x + familyEfficiency(s, f), 0);
    byBuilding[key] = { slots: v, families: team, efficiency: ef };
    const w = bySector[sec];
    w.slots += v; w.filled += team.length; w.efficiency += ef; w.buildings.push(key);
  }
  for (const sec of SECTOR_ORDER) { const w = bySector[sec]; w.yield = w.slots ? w.efficiency / w.slots : 0.95; }
  return { byBuilding, bySector, idle: all.filter((f) => !used.has(f)), employed: Object.values(byBuilding).reduce((x, p) => x + p.families.length, 0), total: Object.keys(s.families).length };
}

/** Share of a building's slots its team actually fills, weighted by how well they work (at most 1). */
export const teamEfficiency = (a: Allocation, s: Pick<GameState, 'map'>, key: LotKey): number => {
  const p = a.byBuilding[key];
  return p ? Math.min(1, p.efficiency / (jobsOf(s.map.buildings[key] as BuildingId) || 1)) : 0;
};
/** How well a hypothetical new building would be staffed from the idle families. */
export function newTeamEfficiency(s: GameState, a: Allocation, t: BuildingId): number {
  const base = jobsOf(t) || 1;
  return Math.min(1, a.idle.map((f) => familyEfficiency(s, f)).sort((x, y) => y - x).slice(0, base).reduce((x, v) => x + v, 0) / base);
}

// ---- place and level

export function natureNear(s: Pick<GameState, 'map'>, a: number, b: number, kinds: Set<NatureKind>, radius: number): boolean {
  for (let x = -radius; x <= radius; x++) for (let y = -radius; y <= radius; y++) {
    const n = s.map.nature[lotKey(a + x, b + y)];
    if (n && kinds.has(n)) return true;
  }
  return false;
}
const forestFactor = (s: GameState, a: number, b: number) => {
  let n = 0;
  for (let x = -4; x <= 4; x++) for (let y = -4; y <= 4; y++) if (s.map.trees[lotKey(a + x, b + y)]) n += 1;
  return 0.5 + 0.5 * Math.min(1, n / 16);
};
export const soilOf = (w: World, key: LotKey, good: GoodId): number => {
  const [a, b] = parseKey(key);
  return w.lands[landOf(a, b)]?.soil[good] || 1;
};
const OXBOW = new Set<NatureKind>(['oxbow']);
export function placeFactor(s: GameState, w: World, key: LotKey): number {
  const t = s.map.buildings[key] as BuildingId, T = def(t), [a, b] = parseKey(key);
  const water = WATER_POWERED.has(t) && natureNear(s, a, b, RUNNING_WATER, 2) ? 1.2 : 1;
  if (T.crop) { const g = T.output?.good as GoodId; return soilOf(w, key, g) * (g === 'rice' && natureNear(s, a, b, OXBOW, 2) ? 1.15 : 1); }
  if (T.nearForest) return forestFactor(s, a, b) * water;
  return water;
}
export const levelFactor = (s: GameState, key: LotKey): number => 1 + upgradeOf(s, key) * (isCrop(s.map.buildings[key] as BuildingId) ? 0.25 : 0.5);
const stillGreen = (s: GameState, key: LotKey) => !!s.firstHarvest && (s.firstHarvest[key] ?? -Infinity) > s.market.t;
const healthFactor = (s: GameState) => (s.problems.epidemic ? (workDone(s, 'hospital') ? 0.98 : 0.94) : 1);

/** The road to Curitiba leaves by a south-edge lot in the exit land: the one nearest the marked point. */
export function roadExit(s: Pick<GameState, 'map'>, net?: Set<LotKey>): number | null {
  const c0 = Math.floor(A0 / REG) * REG, ok = (x: number) => !!s.map.streets[lotKey(x, NY - 1)] && (!net || net.has(lotKey(x, NY - 1)));
  for (let d = 0; d < REG; d++) for (const x of [A0 - d, A0 + d]) if (x >= c0 && x < c0 + REG && ok(x)) return x;
  return null;
}
export const hasRoad = (s: Pick<GameState, 'map'>): boolean => roadExit(s, mainNetwork(s.map)) !== null;
/** Past this many, more waystations and pastures carry no more. */
const MAX_ROAD = { waystation: 6, pasture: 4 };

/** Hypothetical buildings the advisor measures: counts by type, plus a yield multiplier by sector. */
export type Extra = Partial<Record<BuildingId, number>> & { yield?: Partial<Record<Sector, number>> };

export interface Counts {
  /** Linked buildings by type (with hypothetical ones). */
  n: Partial<Record<BuildingId, number>>;
  /** Place times level factor of each producing building. */
  factor: Record<LotKey, number>;
  linked: Set<LotKey>;
  deposits: Record<'lime' | 'lead' | 'gold' | 'iron', number>;
  families: number;
  slots: number;
  unlinked: number;
  work: Allocation;
  /** Sector yield after health and laws. */
  sectorYield: Record<Sector, number>;
  /** Sum of place and level factors of producing buildings, by type. */
  factorSum: Partial<Record<BuildingId, number>>;
  /** Arrobas per season the mule trains carry on the road to Curitiba. */
  muleTrains: number;
  /** Arrobas per season the market and stores can sell. */
  market: number;
}

/** What the colony has to work with this season. */
export function countEconomy(s: GameState, w: World, extra: Extra = {}): Counts {
  const linked = connected(s.map);
  const ready: Partial<Record<BuildingId, number>> = {}, n: Partial<Record<BuildingId, number>> = {}, factorSum: Partial<Record<BuildingId, number>> = {}, factor: Record<LotKey, number> = {};
  const deposits = { lime: 0, lead: 0, gold: 0, iron: 0 };
  let unlinked = 0;
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    if (!linked.has(key)) { unlinked += 1; continue; }
    const t = s.map.buildings[key] as BuildingId;
    n[t] = (n[t] ?? 0) + 1;
    if (stillGreen(s, key)) continue;
    ready[t] = (ready[t] ?? 0) + 1;
    const f = levelFactor(s, key) * placeFactor(s, w, key);
    factorSum[t] = (factorSum[t] ?? 0) + f;
    factor[key] = f;
    const dep = w.deposits[key];
    if (t === 'mine' && dep && dep in deposits) deposits[dep as keyof typeof deposits] += levelFactor(s, key);
  }
  const realMines = n.mine ?? 0;
  for (const t of Object.keys(extra) as (BuildingId | 'yield')[]) {
    if (t === 'yield') continue;
    const x = extra[t] as number, before = n[t] ?? 0;
    n[t] = Math.max(0, before + x);
    const mean = ready[t] ? (factorSum[t] as number) / (ready[t] as number) : 1;
    factorSum[t] = Math.max(0, (factorSum[t] ?? 0) + x * mean);
  }
  if (realMines && extra.mine) for (const d of Object.keys(deposits) as (keyof typeof deposits)[]) deposits[d] *= Math.max(0, (realMines + extra.mine) / realMines);
  let families = 0;
  for (const t of Object.keys(n) as BuildingId[]) if (def(t).housing) families += (def(t).housing as number) * (n[t] as number);
  const work = allocate(s, linked);
  if (Object.keys(s.families).length) {
    families = Object.keys(s.families).filter((id) => linked.has(homeOf(id as `${number},${number}#${number}`))).length;
    for (const t of Object.keys(extra) as (BuildingId | 'yield')[]) if (t !== 'yield' && def(t).housing) families += (def(t).housing as number) * (extra[t] as number);
    families = Math.max(0, families);
  }
  const slots = SECTOR_ORDER.reduce((x, sec) => x + work.bySector[sec].slots, 0) + (Object.keys(extra) as (BuildingId | 'yield')[]).reduce((x, t) => x + (t !== 'yield' ? jobsOf(t) * (extra[t] as number) : 0), 0);
  const cornTithe = taxRate(s, 'tithe', 'corn');
  const prodFactor = healthFactor(s) * (hasLaw(s, 'sundayWork') ? 1.1 : 1) * (hasLaw(s, 'longHours') ? 1.1 : 1) * (hasLaw(s, 'compulsorySchool') ? 0.96 : 1);
  const sectorYield = {} as Record<Sector, number>;
  for (const sec of SECTOR_ORDER) sectorYield[sec] = Math.min(1.25, Math.min(1.15, work.bySector[sec].yield * (extra.yield?.[sec] ?? 1)) * prodFactor);
  if (cornTithe > 0.1) sectorYield.farming *= 1 - (cornTithe - 0.1) * 0.5;
  const levels = (t: BuildingId) => {
    let f = 0;
    for (const key of Object.keys(s.map.buildings) as LotKey[]) if (s.map.buildings[key] === t && linked.has(key)) f += levelFactor(s, key);
    return Math.max(0, f + (extra[t] ?? 0));
  };
  const capFactor = (t: BuildingId) => (extra.yield?.[sectorOf(t) as Sector] ?? 1) * prodFactor;
  let market = 0;
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    const t = s.map.buildings[key] as BuildingId, cap = def(t).capacity?.market;
    if (cap && linked.has(key)) market += cap * (1 + upgradeOf(s, key) * 0.5) * teamEfficiency(work, s, key) * capFactor(t);
  }
  for (const t of Object.keys(extra) as (BuildingId | 'yield')[]) {
    if (t === 'yield') continue;
    const cap = def(t).capacity?.market;
    if (extra[t] && cap) market += cap * (extra[t] as number) * newTeamEfficiency(s, work, t) * capFactor(t);
  }
  // the road to Curitiba opens the mule trains; waystations and pastures add to what they carry
  const road = hasRoad(s);
  const muleTrains = road && !crisisOn(s, 'federalist')
    ? (40 + Math.min(MAX_ROAD.waystation, levels('waystation')) * 30 + Math.min(MAX_ROAD.pasture, levels('pasture')) * 50) * (hasChoice(s, 'freeMuleteers') ? 1.3 : 1) * (workDone(s, 'macadamRoad') ? 1.6 : 1)
    : 0;
  return { n, factor, linked, deposits, families, slots, unlinked, work, sectorYield, factorSum, muleTrains, market: market * (hasLaw(s, 'weeklyFair') ? 1.15 : 1) };
}

// ---- the table: each family eats a mix of what there is; what one dish lacks the others make up

const FOODS = GOOD_IDS.filter((g) => good(g).food).sort((x, y) => (good(y).spoils ? 1 : 0) - (good(x).spoils ? 1 : 0) || good(x).localPrice - good(y).localPrice);
const CONSUMER = GOOD_IDS.filter((g) => good(g).perFamily);
const WORKSHOPS = (Object.keys(BUILDINGS) as BuildingId[]).filter((t) => def(t).recipes);
const fromHarvest = (g: GoodId) => {
  const seasonal = (x: string) => (Object.keys(BUILDINGS) as BuildingId[]).some((t) => def(t).output?.good === x && def(t).output?.season !== undefined);
  return seasonal(g) || (Object.keys(BUILDINGS) as BuildingId[]).some((t) => (def(t).recipes ?? []).some((r) => r.to === g && seasonal(r.from)));
};
/** Consumer goods that come from a single harvest a year, and must be kept until the next. */
const SEASONAL = Object.fromEntries(CONSUMER.map((g) => [g, fromHarvest(g)])) as Record<GoodId, boolean>;
export const recipesOf = (t: BuildingId, level: number) => (def(t).recipes ?? []).filter((r) => (r.minLevel ?? 1) <= (level || 1));

export function serveTable(stock: Partial<Record<GoodId, number>>, amount: number): [Partial<Record<GoodId, number>>, number] {
  const d: Partial<Record<GoodId, number>> = {};
  let rest = amount;
  const there = FOODS.filter((g) => (stock[g] ?? 0) > 0.01 && good(g).dietWeight);
  const weight = there.reduce((x, g) => x + (good(g).dietWeight as number), 0);
  if (weight) for (const g of there) { const v = Math.min(stock[g] as number, (amount * (good(g).dietWeight as number)) / weight); if (v > 0) { d[g] = v; rest -= v; } }
  for (const g of FOODS) { if (rest <= 0.01) break; const v = Math.min((stock[g] ?? 0) - (d[g] ?? 0), rest); if (v > 0) { d[g] = (d[g] ?? 0) + v; rest -= v; } }
  return [d, Math.max(0, rest)];
}

export type PerGood = Record<GoodId, number>;
const zero = (): PerGood => Object.fromEntries(GOOD_IDS.map((g) => [g, 0])) as PerGood;
export type LossCause = 'transport' | 'buyer' | 'spoiled' | 'carrying' | 'noGateway';
export interface Peak { demand: number; passed: number; byGood: Partial<Record<GoodId, [number, number]>> }
const newPeak = (): Peak => ({ demand: 0, passed: 0, byGood: {} });

/** The year's flows. Accumulated on the last of the three simulated years. */
export interface Totals {
  byRiver: number; byRoad: number;
  produced: PerGood; ownTable: PerGood; market: PerGood; exported: PerGood; freight: PerGood; lost: PerGood; income: PerGood; processed: PerGood; demand: PerGood;
  hunger: number; producerShortfall: number; marketDemand: number;
  sales: PerGood; salesBySeason: Partial<PerGood>[]; incomeBySeason: Partial<PerGood>[]; lostBySeason: Partial<PerGood>[];
  lostBy: Record<LossCause, number>; lostByGood: Record<LossCause, Partial<PerGood>>;
  processedBy: Partial<Record<BuildingId, Record<string, number>>>;
  tax: { tithe: PerGood; export: PerGood };
  peaks: { market: Peak; carts: Peak; port: Peak; muleTrains: Peak };
}
const newTotals = (): Totals => ({
  byRiver: 0, byRoad: 0, produced: zero(), ownTable: zero(), market: zero(), exported: zero(), freight: zero(), lost: zero(), income: zero(), processed: zero(), demand: zero(),
  hunger: 0, producerShortfall: 0, marketDemand: 0, sales: zero(), salesBySeason: [{}, {}, {}, {}], incomeBySeason: [{}, {}, {}, {}], lostBySeason: [{}, {}, {}, {}],
  lostBy: { transport: 0, buyer: 0, spoiled: 0, carrying: 0, noGateway: 0 }, lostByGood: { transport: {}, buyer: {}, spoiled: {}, carrying: {}, noGateway: {} },
  processedBy: {}, tax: { tithe: zero(), export: zero() }, peaks: { market: newPeak(), carts: newPeak(), port: newPeak(), muleTrains: newPeak() },
});

/** How much of a producer's year reaches a buyer, and where the rest is lost. */
export interface Outlet { sent: number; delivered: number; share: number; lost: { onFoot: number; collection: number; noGateway: number; gatewayFull: number; noBuyer: number } }

/** Losses past the main commerce (gateways full, no buyer, spoiled) are per good, so each producer bears
 *  them in proportion to what it delivered there; the losses on the way are its own. */
export function outletOf(byProducer: Record<LotKey, ProducerYear>, T: Totals): Record<LotKey, Outlet> {
  const reached = (g: GoodId) => T.produced[g] - (T.lostByGood.carrying[g] ?? 0) - (T.lostByGood.noGateway[g] ?? 0);
  const part = (g: GoodId, lost: number) => (reached(g) > 1e-9 ? Math.min(1, lost / reached(g)) : 0);
  const out: Record<LotKey, Outlet> = {};
  for (const [key, p] of Object.entries(byProducer) as [LotKey, ProducerYear][]) {
    if (!(p.sent > 1e-9)) continue;
    let gatewayFull = 0, noBuyer = 0;
    for (const [g, q] of Object.entries(p.toMain) as [GoodId, number][]) {
      gatewayFull += q * part(g, T.lostByGood.transport[g] ?? 0);
      noBuyer += q * part(g, (T.lostByGood.buyer[g] ?? 0) + (T.lostByGood.spoiled[g] ?? 0));
    }
    const delivered = Math.max(0, p.sent - p.carrying - p.collection - p.noGateway - gatewayFull - noBuyer);
    out[key] = { sent: p.sent, delivered, share: delivered / p.sent, lost: { onFoot: p.carrying, collection: p.collection, noGateway: p.noGateway, gatewayFull, noBuyer } };
  }
  return out;
}

export interface Economy extends Totals {
  transport: TransportSummary;
  /** Per producing building: the share of its year's surplus that reaches a buyer. */
  outlet: Record<LotKey, Outlet>;
  revenue: { lotInstallment: number; tithe: number; exportDuty: number; businessTax: number; total: number };
  counts: Counts;
  subsistence: number;
  salesTotal: number; incomeTotal: number; lostTotal: number; producedTotal: number; exportedTotal: number; marketTotal: number; ownTableTotal: number;
  stock: PerGood;
  producersNeedPerYear: number;
  surplus: number;
}

export const DEPOSIT_GOOD = { lime: 'lime', lead: 'lead', gold: 'gold', iron: 'iron' } as const;
const fairFactor = (s: GameState) => (hasLaw(s, 'weeklyFair') ? 1.05 : 1);
export const sawmillFirewood = (s: GameState): number => 1 - (s.transport.firewoodShortage || 0) * 0.5;

export function computeEconomy(s: GameState, w: World, extra?: Extra): Economy {
  const mc = s.market;
  const e = countEconomy(s, w, extra);
  const q = (t: BuildingId) => e.n[t] ?? 0;
  // what each season yields, with soil, level, forest, people and pests
  const outputs: [GoodId, number, number | null, string][] = [];
  for (const t of Object.keys(e.factorSum) as BuildingId[]) {
    const T = def(t);
    if (!e.factorSum[t]) continue;
    const sec = T.sector as Sector, fs = e.factorSum[t] as number;
    const mono = T.crop && hasChoice(s, 'monoculture') ? 1.2 : 1;
    if (T.output) outputs.push([T.output.good as GoodId, T.output.perSeason * fs * e.sectorYield[sec] * mono * (T.output.good === 'planks' && workDone(s, 'steamSawmill') ? 1.6 * sawmillFirewood(s) : 1), T.output.season ?? null, t]);
    if (T.extraOutputs) for (const o of T.extraOutputs) outputs.push([o.good as GoodId, o.perSeason * fs * e.sectorYield[sec], null, t]);
  }
  // families decide for themselves: they transform only while the product is worth more than the raw material
  const capBase: Partial<Record<BuildingId, number>> = {}, options: Partial<Record<GoodId, { from: GoodId; to: GoodId; ratio: number; t: BuildingId }[]>> = {};
  for (const t of WORKSHOPS) {
    if (!((e.factorSum[t] ?? 0) > 0)) continue;
    capBase[t] = (def(t).processingCapacity as number) * (e.factorSum[t] as number) * e.sectorYield[def(t).sector as Sector] * (hasChoice(s, 'manufacture') ? 1.3 : 1);
    for (const r of recipesOf(t, s.level)) (options[r.from as GoodId] ??= []).push({ from: r.from as GoodId, to: r.to as GoodId, ratio: r.to === 'jerky' && workDone(s, 'jerkyPlant') ? r.ratio * 1.5 : r.ratio, t });
  }
  const exportKeep = (g: GoodId) => 1 - taxRate(s, 'exportDuty', g);
  const priceFactor = (g: GoodId) => (hasChoice(s, 'storeContract') ? 0.95 : 1) * (good(g).food && hasLaw(s, 'foodPriceCap') ? 0.85 : 1);
  const freight = RIVER_FREIGHT * (hasChoice(s, 'storeContract') ? 0.7 : 1) * fairFactor(s) * (workDone(s, 'railSpur') ? 0.6 : 1) * (1 - (s.freightRelief || 0));
  const sellOutside = (g: GoodId, already: number) => {
    const G = good(g);
    if (!G.exportPrice) return 0;
    return currentPrice(mc, g) * priceFactor(g) * (workDone(s, 'telegraph') ? 1.05 : 1) * exportKeep(g) * Math.max(0.45, 1 - already / ((G.baseDemand as number) * shockFactor(mc, g, 'demand') * 2)) - freight;
  };
  const depositYield = BALANCE.depositYield as Record<string, number>;
  const harvest = (season: number) => {
    const o: Partial<PerGood> = {};
    for (const [g, y, sq] of outputs) { const v = sq === null ? y : sq === season ? y : 0; if (v) o[g] = (o[g] ?? 0) + v * shockFactor(mc, g, 'pest'); }
    for (const d of Object.keys(e.deposits) as (keyof typeof e.deposits)[]) if (e.deposits[d]) o[d] = (o[d] ?? 0) + e.deposits[d] * (depositYield[d] as number) * e.sectorYield.mining * (d === 'lime' && workDone(s, 'limeWorks') ? 2 : 1);
    return o;
  };
  // the same harvest by building type, to know where each arroba comes from
  const harvestBy = (season: number) => {
    const L: [string, GoodId, number][] = [];
    for (const [g, y, sq, t] of outputs) { const v = sq === null ? y : sq === season ? y : 0; if (v) L.push([t, g, v * shockFactor(mc, g, 'pest')]); }
    for (const d of Object.keys(e.deposits) as (keyof typeof e.deposits)[]) if (e.deposits[d]) L.push([`mine:${d}`, d, e.deposits[d] * (depositYield[d] as number) * e.sectorYield.mining * (d === 'lime' && workDone(s, 'limeWorks') ? 2 : 1)]);
    return L;
  };
  const employed = e.work.employed;
  const foodProducers = (Object.keys(BUILDINGS) as BuildingId[]).reduce((x, t) => { const g = def(t).output?.good as GoodId | undefined; return x + (g && good(g)?.food ? q(t) * jobsOf(t) : 0); }, 0) + q('corral');
  const inFood = Math.min(foodProducers, employed);
  const subsistence = Math.max(0, e.families - employed);
  const buysFood = (employed - inFood + subsistence * 0.3) * 0.8;
  // those who grow food live off it: only the surplus travels
  const producersNeed = inFood * FIELD_FAMILY_EATS;
  const stock = zero();
  let tot: Totals | null = null;
  const yearExported: Partial<PerGood> = {}, yearByDest: Record<string, Partial<PerGood>> = {}, accI: Partial<PerGood> = {}, accL: Partial<PerGood> = {}, accS: Partial<PerGood> = {};
  const TR = startTransport(s, w, e);
  const commerceKeeps = (e.n.store ?? 0) + (e.n.market ?? 0) > 0;
  for (let t = 0; t < 12; t++) {
    const season = t % 4;
    if (t === 8) tot = newTotals();
    const pr = harvest(season);
    const avail = {} as PerGood, fresh = {} as PerGood;
    for (const g of GOOD_IDS) { fresh[g] = pr[g] ?? 0; if (tot) tot.produced[g] += fresh[g]; }
    // food producers eat first from what they grow; only the surplus goes to commerce
    let own = producersNeed;
    {
      const [d, r] = serveTable(fresh, own);
      for (const g of Object.keys(d) as GoodId[]) { fresh[g] -= d[g] as number; if (tot) { tot.ownTable[g] += d[g] as number; tot.income[g] += (d[g] as number) * good(g).localPrice * TABLE_VALUE; } }
      own = r;
    }
    { const arrived = haulSeason(TR, harvestBy(season), fresh, pr, tot); for (const g of GOOD_IDS) avail[g] = stock[g] + (arrived[g] ?? 0); }
    if (own > 0) {
      const [d, r] = serveTable(avail, own);
      for (const g of Object.keys(d) as GoodId[]) { avail[g] -= d[g] as number; if (tot) { tot.ownTable[g] += d[g] as number; tot.income[g] += (d[g] as number) * good(g).localPrice * TABLE_VALUE; } }
      own = r;
    }
    if (tot) tot.producerShortfall += own;
    // the market serves food first and then the rest; one shared capacity
    let capM = e.market, hungry = buysFood + own;
    const pM = newPeak();
    pM.demand = hungry;
    if (hungry > 0) {
      const [d] = serveTable(avail, hungry), sum = Object.values(d).reduce((x, y) => x + (y as number), 0), f = sum > 0 ? Math.min(1, capM / sum) : 0;
      for (const g of Object.keys(d) as GoodId[]) {
        const v = (d[g] as number) * f;
        avail[g] -= v; hungry -= v; capM -= v;
        pM.byGood[g] = [d[g] as number, v]; pM.passed += v;
        if (tot) { tot.market[g] += v; tot.income[g] += v * good(g).localPrice; tot.sales[g] += v * good(g).localPrice; }
      }
      hungry = Math.max(0, hungry);
    }
    if (tot) tot.hunger += hungry;
    // leftover raw material goes to the workshops while it pays; the workshop pays the local price to the producer
    if (season === 0) { for (const g of Object.keys(yearExported) as GoodId[]) yearExported[g] = 0; for (const d of Object.keys(yearByDest)) yearByDest[d] = {}; }
    const capLeft = { ...capBase }, planned: Partial<PerGood> = {};
    const worth = (g: GoodId, extraOut?: number) => {
      const per = good(g).perFamily;
      const inVillage = per ? Math.max(0, e.families * per - (planned[g] ?? 0)) : 0;
      return Math.max(inVillage > 0 ? good(g).localPrice : 0, sellOutside(g, (yearExported[g] ?? 0) + (planned[g] ?? 0) + (extraOut ?? 0)));
    };
    for (const from of MATERIAL_ORDER) {
      const ops = options[from];
      if (!ops || avail[from] <= 0) continue;
      const step = Math.max(2, avail[from] / 10);
      for (let n = 0; n < 14 && avail[from] > 0.01; n++) {
        const raw = worth(from, avail[from] / 2);
        let best: (typeof ops)[number] | null = null, vBest = raw * 1.05;
        for (const o of ops) { if ((capLeft[o.t] as number) <= 0.01) continue; const v = o.ratio * worth(o.to); if (v > vBest) { vBest = v; best = o; } }
        if (!best) break;
        const x = Math.min(step, avail[from], capLeft[best.t] as number);
        const out = x * best.ratio;
        avail[from] -= x; avail[best.to] += out; capLeft[best.t] = (capLeft[best.t] as number) - x;
        planned[best.to] = (planned[best.to] ?? 0) + out;
        if (tot) {
          tot.processed[from] += x; tot.produced[best.to] += out;
          const pp = (tot.processedBy[best.t] ??= {});
          pp[`${from}>${best.to}`] = (pp[`${from}>${best.to}`] ?? 0) + x;
          const paid = x * good(from).localPrice;
          tot.income[from] += paid; tot.income[best.to] -= paid;
        }
      }
    }
    // goods the families buy here
    for (const g of CONSUMER) {
      const dem = e.families * (good(g).perFamily as number);
      if (tot) tot.demand[g] += dem;
      const want = Math.min(avail[g], dem);
      if (want <= 0) continue;
      pM.demand += want;
      if (tot) tot.marketDemand += want;
      const v = Math.min(want, capM);
      avail[g] -= v; capM -= v;
      pM.byGood[g] = [want, v]; pM.passed += v;
      if (tot) { tot.market[g] += v; tot.income[g] += v * good(g).localPrice; tot.sales[g] += v * good(g).localPrice; }
    }
    if (tot) tot.marketDemand += buysFood + own;
    // before exporting, keep what families will buy until the next harvest
    const kept: Partial<PerGood> = {};
    for (const g of CONSUMER) {
      if (!SEASONAL[g] || avail[g] <= 0) continue;
      const k = Math.min(avail[g], e.families * (good(g).perFamily as number) * 3);
      if (k > 0) { kept[g] = k; avail[g] -= k; }
    }
    // and the household food until the next harvest, for growers and market buyers (granary and barn)
    {
      const [dR] = serveTable(avail, (producersNeed + buysFood) * 3);
      for (const g of Object.keys(dR) as GoodId[]) { const k = Math.min(avail[g], dR[g] as number); if (k > 0) { kept[g] = (kept[g] ?? 0) + k; avail[g] -= k; } }
    }
    const order = GOOD_IDS.filter((g) => good(g).exportPrice && avail[g] > 0 && currentPrice(mc, g) * (1 - taxRate(s, 'exportDuty', g)) > RIVER_FREIGHT).sort((x, y) => currentPrice(mc, y) - currentPrice(mc, x));
    // commerce sends what is left to the gateways; each destination pays what it pays
    const rr = exportThroughGateways(TR, { s, avail, order, tot, priceFactor, yearByDest });
    for (const g of Object.keys(kept) as GoodId[]) avail[g] += kept[g] as number;
    // leftovers stay with the families for next season, but some spoil; fresh fish does not keep
    for (const g of GOOD_IDS) {
      const G = good(g);
      stock[g] = G.spoils ? 0 : avail[g] * (!commerceKeeps ? KEEP.none : G.perishable && g !== 'corn' ? KEEP.fresh : KEEP.grain);
      if (tot) {
        const loss = avail[g] - stock[g];
        tot.lost[g] += loss;
        if (loss > 0) {
          const cause: LossCause = G.spoils ? 'spoiled' : order.includes(g) ? 'transport' : 'buyer';
          tot.lostBy[cause] += loss;
          tot.lostByGood[cause][g] = (tot.lostByGood[cause][g] ?? 0) + loss;
        }
      }
    }
    if (tot) for (const g of GOOD_IDS) {
      tot.incomeBySeason[season]![g] = tot.income[g] - (accI[g] ?? 0); accI[g] = tot.income[g];
      tot.lostBySeason[season]![g] = tot.lost[g] - (accL[g] ?? 0); accL[g] = tot.lost[g];
      tot.salesBySeason[season]![g] = tot.sales[g] - (accS[g] ?? 0); accS[g] = tot.sales[g];
    }
    if (tot) for (const [name, p] of [['market', pM], ['carts', rr.peak], ['port', rr.peak]] as const) if (p.demand >= tot.peaks[name].demand) tot.peaks[name] = p;
  }
  const T = tot as Totals;
  const sum = (o: Record<string, number>) => Object.values(o).reduce((a, x) => a + x, 0);
  for (const g of GOOD_IDS) T.tax.tithe[g] = (T.ownTable[g] + T.market[g] + T.exported[g]) * good(g).localPrice * taxRate(s, 'tithe', g);
  const perFamily = s.taxes.lotInstallment?.general || 0, perBusiness = s.taxes.businessTax?.general || 0;
  const revenue = { lotInstallment: e.families * perFamily, tithe: sum(T.tax.tithe), exportDuty: sum(T.tax.export), businessTax: ((e.n.store ?? 0) + (e.n.market ?? 0)) * perBusiness, total: 0 };
  revenue.total = (revenue.lotInstallment + revenue.tithe + revenue.exportDuty + revenue.businessTax) * (s.problems.disorder ? 0.94 : 1);
  const producedTotal = sum(T.produced), ownTableTotal = sum(T.ownTable), marketTotal = sum(T.market);
  return {
    ...T, transport: finishTransport(TR), outlet: outletOf(TR.acc.byProducer, T), revenue, counts: e, subsistence,
    salesTotal: sum(T.sales), incomeTotal: sum(T.income), lostTotal: sum(T.lost), producedTotal, exportedTotal: sum(T.exported), marketTotal, ownTableTotal,
    stock, producersNeedPerYear: producersNeed * 4, surplus: Math.max(0, producedTotal - ownTableTotal - marketTotal - sum(T.processed)),
  };
}

export const MILESTONE = (i: number) => MILESTONES[Math.min(MILESTONES.length - 1, i)];
export { cellsOf };
