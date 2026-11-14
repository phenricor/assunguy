// Advice carries a rule id, the numbers its text needs and an action; display text lives in i18n under
// advice.<rule>.title and advice.<rule>.body. Parameters named building, to, from, good, service, vehicle,
// milestone, land, work, chain and cause hold ids the interface turns into names; `at` is a lot whose
// building and land are named; every other parameter is a number (money in $, percents already x100).
// The advisor: a ranked list of advice, each measured by the economy where it is about income. Advice carries
// a rule id, the numbers its text needs and an action; display text lives in i18n under advice.<rule>.*.
// Ported from the prototype's `conselhosSem` and `conselhosTransp`, with the November review fixes:
// advice the colony cannot pay for is blocked, the province's extra funds and time are offered here, a
// far land gets a measured package (store + waystation + mule trains, or a collection point) instead of a
// lone store, and each producer's outlet feeds a "what fixes it" advice.
import { ADVANCES, raceTime, railExits, rivalCost, vehicleAvailable } from './race.js';
import { milestoneLevel, BALANCE, BUILDINGS, GOOD_IDS, GREAT_WORKS, GREAT_WORK_IDS, LEVELS, MILESTONES, TRANSPORT_ROLES, VEHICLES, type BuildingId, type GoodId, type GreatWorkId, type MilestoneDef, type TransportRoleDef, type VehicleDef, type VehicleId,  } from '@assunguy/data';
import { allocate, computeEconomy, costOf, def, good, hasRoad, recipesOf, SECTOR_ORDER, sectorOf, soilOf, teamEfficiency, upkeepOf, type Economy, type Extra } from './economy.js';
import { firstHarvest, overplanted, swapCost, swapOptions } from './events.js';
import { computeDistricts, districtsUnlocked, nameId } from './districts.js';
import { ARRIVAL_AID, emptySlots, HOME_UPGRADE, SEED_AID } from './families.js';
import { lotsFor, measure } from './measure.js';
import { connected, mainNetwork } from './network.js';
import { canPlace, canPlaceStreet } from './placement.js';
import { goalPace, greatWorksUpkeep, levelRequirements, milestoneGaps, wasteShare, WASTE_LIMIT, type GoalItem } from './province.js';
import { ratingsAfter, rateHomes, taxEffect, type Ratings, type Service } from './ratings.js';
import { hasLaw, homeOf, upgradeOf, type GameState, type TaxLaw, type DestinationId } from './state.js';
import { processingPotential, type ProcessingPotential } from './processing.js';
import { distance, fleetOf, fleetSize, fleetSlots, gatewayTight, geography } from './transport.js';
import { landOf, lotKey, parseKey, type LandId, type LotKey, type World } from './world.js';

/** Every rule the advisor can emit; each has advice.<rule>.title and .body in both languages. */
export const ADVICE_RULES = [
  'deadline', 'levelFamilies', 'exportDuty.first', 'exportDuty.more', 'exportDuty.hurts', 'process.potential', 'process.potentialNoGain', 'food.market', 'food.crop', 'food.plant', 'cash.negative', 'cash.runningOut', 'unlinked', 'marketFull.people', 'marketFull.upgrade', 'marketFull.build', 'cropSwap', 'overplanted', 'workersWithoutService', 'greatWork', 'council', 'tithe.choking', 'tithe.hurts', 'tithe.relief', 'tithe.more', 'tithe.first', 'idle.invest', 'idle.jobs', 'chain', 'caneIdle', 'levelBuilding', 'milestoneBuilding', 'milestoneLands', 'milestoneFamilies', 'jobsEmpty.homes', 'jobsEmpty.build', 'waste', 'lostGood.workshop', 'lostGood.noBuyer', 'homesCanGrow', 'service.satisfaction', 'service.homes', 'crowded', 'road.lands', 'road.street', 'nextLevel', 'noVehicles.collection', 'noVehicles.gateway', 'full.collection', 'full.gateway', 'noSlot', 'idleCollection', 'idleFleet', 'idle.upgrade', 'levelWorkers.upgrade', 'service.upgrade', 'race.soonLead', 'race.soonBehind', 'race.departures', 'noCollection', 'pierFullIdle', 'pierFullIdle.less', 'noGateway', 'highTariffs', 'farLand.collection', 'farLand.storePackage', 'levelWorkers', 'outlet.vehicle', 'outlet.upgrade', 'farLand.store', 'farLand.storeEarly', 'outlet.swap', 'outlet.collect', 'province.extraTime', 'province.extraFunds', 'streets.room',
] as const;
/** Families for each job a goal asks for: when milestones count families at work, some are always between jobs. */
const familySpare = (): number => (BALANCE.milestoneWorkers ? 0.9 : 1);
/** The prototype asked one more point of satisfaction before suggesting a tithe; the game does not. */
const firstTitheExtra = (): number => (BALANCE.titheSpare >= 3 ? 1 : 0);

export type AdviceAction =
  | { kind: 'screen'; screen: 'level' | 'economy' | 'direction' | 'transport'; tab?: string; law?: 'tithe' | 'exportDuty'; value?: number }
  | { kind: 'build'; building: BuildingId | 'street'; near?: LotKey }
  | { kind: 'select'; key: LotKey; upgrade?: true }
  | { kind: 'swap'; key: LotKey; to: BuildingId; from: BuildingId }
  | { kind: 'land'; land: LandId }
  | { kind: 'buyVehicle'; key: LotKey; vehicle: VehicleId }
  | { kind: 'sellVehicle'; key: LotKey; vehicle: VehicleId }
  | { kind: 'collect'; building: BuildingId; land?: LandId; near?: LotKey; lot?: LotKey; fleet?: Partial<Record<VehicleId, number>>; with?: BuildingId[] }
  | { kind: 'province'; request: 'extraFunds' | 'extraTime' }
  | { kind: 'streets'; from: [number, number]; to: [number, number] }
  | { kind: 'district'; id: LotKey }
  | { kind: 'buildAt'; building: BuildingId; lot: LotKey }
  | { kind: 'buildLots'; building: BuildingId; lots: LotKey[] };

export interface Advice {
  rule: string;
  weight: number;
  params: Record<string, string | number>;
  action: AdviceAction | null;
  /** What following it costs from the purse now (0 when nothing). */
  cost: number;
  /** Shown but not actionable: it costs more than the cash in hand. */
  blocked: boolean;
  goals?: GoalItem[];
}

// ---- small helpers shared by the rules

/** Every building income advice competes on the same scale: in how many years the gain pays the cost. */
export const workWeight = (cost: number, gain: number): number => 60 + Math.max(0, Math.min(30, 30 - (cost / Math.max(1, gain)) * 4));
const unlocked = (s: GameState, t: BuildingId): boolean => !def(t).lateGame && (def(t).minLevel || 1) <= (s.level || 1);
const vehicleUnlocked = vehicleAvailable;
const roleOf = (t: BuildingId): TransportRoleDef | undefined => (TRANSPORT_ROLES as Partial<Record<BuildingId, TransportRoleDef>>)[t];
const ALL = Object.keys(BUILDINGS) as BuildingId[];
/** The colony with more vehicles at a building, and its level raised when asked. */
const withFleet = (s: GameState, key: LotKey, v: VehicleId, n = 1, up = 0): GameState => {
  const f = fleetOf(s, key);
  return { ...s, fleet: { ...s.fleet, [key]: { ...f, [v]: (f[v] ?? 0) + n } }, ...(up ? { upgrades: { ...s.upgrades, [key]: (s.upgrades[key] ?? 0) + up } } : {}) };
};
/** The largest vehicle a transport building can take at this level. */
const bestVehicleAt = (s: GameState, key: LotKey): VehicleId | undefined => ((roleOf(s.map.buildings[key] as BuildingId)?.vehicles ?? []) as VehicleId[]).filter((v) => vehicleUnlocked(s, v)).sort((p, q) => (VEHICLES[q] as VehicleDef).cargo - (VEHICLES[p] as VehicleDef).cargo)[0];
/**
 * A new collection point or gateway starts with the vehicle it comes with: the cheapest first step, which the
 * player can afford sooner; when it fills up, the advice for a full building adds the next vehicle, measured.
 */
const PACKAGE = 1;
const extraVehicles = (t: BuildingId) => PACKAGE - (roleOf(t)?.starter ? 1 : 0);
const packageCost = (s: GameState, t: BuildingId, v: VehicleId): number => costOf(t, s.milestone) + extraVehicles(t) * (VEHICLES[v] as VehicleDef).price;
const packageFleet = (t: BuildingId, v: VehicleId): Partial<Record<VehicleId, number>> => (extraVehicles(t) > 0 ? { [v]: extraVehicles(t) } : {});
/** Store, market and pier upgrades cost the full price, then half again; others 60% then the full price. */
const FLEET_UPGRADE: BuildingId[] = ['store', 'market', 'riverPort'];
export const upgradeCost = (t: BuildingId, level: number, milestone: number): number => Math.round(costOf(t, milestone) * (FLEET_UPGRADE.includes(t) ? (level === 0 ? 1 : 1.5) : (level === 0 ? 0.6 : 1)));
const SERVICE_VALUE: Record<Service, number> = { faith: 12, school: 12, health: 12, commerce: 12, water: 10, culture: 6 };
const SERVICES: Service[] = ['faith', 'school', 'health', 'commerce', 'water', 'culture'];
const SERVICE_BUILDING: Record<Service, BuildingId> = { faith: 'chapel', school: 'school', health: 'apothecary', commerce: 'store', water: 'well', culture: 'theater' };
/** Buildings worth measuring for income: they produce, transform or sell; not those built on deposits. */
const INVEST = ALL.filter((t) => (def(t).output || def(t).extraOutputs || def(t).recipes || def(t).capacity) && !def(t).onDeposit);
const WORKSHOPS = ALL.filter((t) => def(t).recipes);

export function annexCost(s: GameState): { influence: number; cash: number } {
  const n = Object.values(s.map.lands).filter((x) => x === 'ours').length;
  return { influence: 1 + Math.floor(n / 6), cash: 60 + 15 * n };
}
const neighbourOfOurs = (s: GameState, id: LandId): boolean => { const [c, l] = parseKey(id); return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([x, y]) => s.map.lands[`${c + x},${l + y}` as LandId] === 'ours'); };
/** The next land to annex: by the river first when asked, then one already seen. */
export function suggestedLand(s: GameState, w: World, river: boolean): LandId | null {
  const hasRiver = (id: LandId) => { const [cl] = parseKey(id), R = 15; for (let x = cl * R; x < (cl + 1) * R; x++) if (w.riverWidth[x] && landOf(x, w.riverBank[x] as number) === id) return true; return false; };
  const ids = (Object.keys(w.lands) as LandId[]).filter((id) => s.map.lands[id] !== 'ours' && neighbourOfOurs(s, id));
  // from the village on, without the road, the lands on its way south come first: the town asks for it
  const way = s.milestone >= 2 && !hasRoad(s) ? new Set(Array.from({ length: 58 }, (_, i) => landOf(22, 47 + i))) : null;
  const score = (id: LandId) => (river && hasRiver(id) ? 0 : 2) + (s.map.lands[id] === 'seen' ? 0 : 1) - (way?.has(id) ? 3 : 0);
  return ids.sort((x, y) => score(x) - score(y))[0] ?? null;
}
/** A free lot on our river bank where a pier fits (a missing street does not count against it). */
export function freeRiverbank(s: GameState, w: World): boolean {
  for (let x = 0; x < w.riverWidth.length; x++) {
    if (!w.riverWidth[x]) continue;
    for (const y of [(w.riverBank[x] as number) - 1, (w.riverBank[x] as number) + (w.riverWidth[x] as number)]) {
      if (y < 0 || y >= 105 || s.map.lands[landOf(x, y)] !== 'ours') continue;
      const er = canPlace(s.map, w, 'riverPort', x, y);
      if (!er || er === 'needsStreet') return true;
    }
  }
  return false;
}
const landHasWater = (s: GameState, w: World, id: LandId): boolean => { const [c, l] = parseKey(id); for (let a = c * 15; a < c * 15 + 15; a++) for (let b = l * 15; b < l * 15 + 15; b++) if (w.water.has(lotKey(a, b)) || s.map.nature[lotKey(a, b)] === 'stream') return true; return false; };
const greatWorkLocked = (s: GameState, w: World, id: GreatWorkId): boolean => {
  const G = GREAT_WORKS[id] as { milestone?: number; level?: number; road?: boolean; deposit?: string };
  if (G.milestone && s.milestone < G.milestone) return true;
  if (G.level && s.level < G.level) return true;
  if (G.road && !hasRoad(s)) return true;
  if (G.deposit && !(Object.keys(s.map.buildings) as LotKey[]).some((k) => s.map.buildings[k] === 'mine' && w.deposits[k] === G.deposit)) return true;
  return false;
};

/** What a year looks like for the purse: taxes, the share of trade, minus upkeep. Before the grant. */
function purseYear(s: GameState, c: Economy): number {
  const upkeep = (Object.values(s.map.buildings).reduce((x, t) => x + upkeepOf(t as BuildingId, s.milestone), 0) + greatWorksUpkeep(s)) * 4;
  return c.revenue.total * (hasLaw(s, 'landRegistry') ? 1.1 : 1) + c.incomeTotal * ((MILESTONES[s.milestone] as MilestoneDef).shareOfTrade || 0) - upkeep;
}

/** The best tithe (or export duty) the colony can charge without the mean rating falling under `floor` or families
 *  going under, with the other taxes as they are. The duty is tried at the rates the government screen offers. */
export function suggestedTithe(s: GameState, w: World, floor: number, id: 'tithe' | 'exportDuty' = 'tithe'): { rate: number; mean: number; revenue: number } {
  const without = { ...s, taxes: { ...s.taxes, [id]: null } };
  let best = { rate: 0, mean: rateHomes(without, w).mean, revenue: taxEffect(without, w).revenue };
  for (const rate of id === 'tithe' ? [0.04, 0.08, 0.12, 0.16, 0.2] : [0.05, 0.08, 0.1, 0.15, 0.2]) {
    const test = { ...s, taxes: { ...s.taxes, [id]: { general: rate, byGood: {} } as TaxLaw } };
    const mean = rateHomes(test, w).mean, ef = taxEffect(test, w);
    if (mean < floor || ef.familiesAtRisk) break;
    best = { rate, mean, revenue: ef.revenue };
  }
  return best;
}

/** Where a collection point for a land (or near a commerce) would reach the most producers that need it. */
export function collectionLot(s: GameState, w: World, t: BuildingId, land: LandId | null, near?: LotKey): LotKey | null {
  const G = geography(s, connected(s.map)), reachT = roleOf(t)?.reach ?? 6;
  const targets = near ? [near] : (Object.keys(G.producers) as LotKey[]).filter((x) => G.producers[x]!.land === land && G.producers[x]!.carry > 6 && !G.producers[x]!.collections.some((ci) => G.collections[ci]!.type === t));
  const seen = new Set<LotKey>();
  let best: { c: LotKey; n: number } | null = null;
  for (const r of mainNetwork(s.map)) {
    const [a, b] = parseKey(r);
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = lotKey(a + x, b + y);
      if (seen.has(c)) continue;
      seen.add(c);
      const n = targets.filter((z) => distance(z, c) <= (near ? (roleOf('store')?.reach ?? 6) + 4 : reachT)).length;
      if (!n || (best && n <= best.n)) continue;
      if (canPlace(s.map, w, t, a + x, b + y)) continue;
      best = { c, n };
    }
  }
  return best ? best.c : null;
}

/** The colony with these buildings and fleets placed on these lots. */
const withPlaced = (w: World, s: GameState, put: Partial<Record<LotKey, BuildingId>>, fleet: Partial<Record<LotKey, Partial<Record<VehicleId, number>>>> = {}): GameState => {
  const x: GameState = { ...s, map: { ...s.map, buildings: { ...s.map.buildings, ...put } as GameState['map']['buildings'] }, fleet: { ...s.fleet, ...fleet } as GameState['fleet'] };
  return x;
};
/** withPlaced with the homes rated again: for works that change how the homes rate (a store is their commerce). */
const withPlacedRated = (w: World, s: GameState, put: Partial<Record<LotKey, BuildingId>>, fleet: Partial<Record<LotKey, Partial<Record<VehicleId, number>>>> = {}): GameState => {
  const x = withPlaced(w, s, put, fleet);
  if (BALANCE.measureRatings) x.homeRating = ratingsAfter(s, x, w);
  return x;
};

export interface ProducerFix { action: AdviceAction; gain: number; cost: number; rule: string; params: Record<string, string | number> }
/**
 * The best measured way to make more of a producer's cargo reach a buyer, or more of its lot: change the crop,
 * or put a collection point within its reach. Gains are the colony's income per year.
 */
export function producerFix(s: GameState, w: World, key: LotKey, c: Economy = computeEconomy(s, w)): ProducerFix | null {
  const t = s.map.buildings[key] as BuildingId | undefined;
  if (!t) return null;
  const options: ProducerFix[] = [];
  if (def(t).crop && !(s.seasonWork.swaps[key])) {
    const op = swapOptions(s, w, key)[0];
    if (op && op.gain >= 12 && op.cost <= op.gain * 3) options.push({ rule: 'outlet.swap', action: { kind: 'swap', key, to: op.t, from: t }, gain: op.gain, cost: Math.max(0, op.cost), params: { building: t, to: op.t, gain: op.gain, cost: op.cost } });
  }
  const G = geography(s, connected(s.map)), p = G.producers[key];
  // a fix for this producer has to bring more of its own cargo to a buyer: a vehicle at a full pier elsewhere may
  // pay the colony, but does nothing for cargo lost on foot here
  const o0 = c.outlet[key], lost0 = o0 ? o0.sent - o0.delivered : 0;
  const helps = (c2: Economy) => !o0 || (c2.outlet[key]?.delivered ?? 0) - o0.delivered >= Math.max(1, lost0 * 0.1);
  if (p && p.carry > 6) {
    const land = p.land;
    for (const [ct, v] of [['tradingPost', 'muleTrain'], ['landing', 'canoe']] as const) {
      if (!unlocked(s, ct) || (ct === 'landing' && !landHasWater(s, w, land))) continue;
      const lot = nearestFree(s, w, ct, key);
      if (!lot) continue;
      const c2 = computeEconomy(withPlaced(w, s, { [lot]: ct }, { [lot]: { [v]: PACKAGE } }), w), gain = c2.incomeTotal - c.incomeTotal;
      const cost = packageCost(s, ct, v);
      if (gain >= 15 && helps(c2)) options.push({ rule: 'outlet.collect', action: { kind: 'collect', building: ct, lot, fleet: packageFleet(ct, v) }, gain, cost, params: { building: ct, vehicle: v, gain: Math.round(gain), cost } });
    }
  }
  // what already serves it: one more vehicle at a collection point in its reach, or at a full gateway
  if (p) {
    const at = [...p.collections.map((ci) => G.collections[ci]!.key), ...c.transport.gateways.filter((g) => gatewayTight(g)).map((g) => g.key)];
    for (const k of at) {
      const v = bestVehicleAt(s, k);
      if (!v || fleetSize(s, k) >= fleetSlots(s, k)) continue;
      const c2 = computeEconomy(withFleet(s, k, v), w), gain = c2.incomeTotal - c.incomeTotal, cost = (VEHICLES[v] as VehicleDef).price;
      if (gain >= 15 && helps(c2)) options.push({ rule: 'outlet.vehicle', action: { kind: 'buyVehicle', key: k, vehicle: v }, gain, cost, params: { building: s.map.buildings[k] as BuildingId, vehicle: v, gain: Math.round(gain), cost } });
    }
    // a full gateway with no slot left: raise its level and add a vehicle
    for (const g of c.transport.gateways.filter((y) => gatewayTight(y) && fleetSize(s, y.key) >= fleetSlots(s, y.key) && upgradeOf(s, y.key) < 2)) {
      const v = bestVehicleAt(s, g.key);
      if (!v) continue;
      const c2 = computeEconomy(withFleet(s, g.key, v, 1, 1), w), gain = c2.incomeTotal - c.incomeTotal, cost = upgradeCost(s.map.buildings[g.key] as BuildingId, upgradeOf(s, g.key), s.milestone) + (VEHICLES[v] as VehicleDef).price;
      if (gain >= 15 && helps(c2)) options.push({ rule: 'outlet.upgrade', action: { kind: 'select', key: g.key, upgrade: true }, gain, cost, params: { building: s.map.buildings[g.key] as BuildingId, vehicle: v, gain: Math.round(gain), cost } });
    }
  }
  return options.sort((x, y) => y.gain / Math.max(1, y.cost) - x.gain / Math.max(1, x.cost))[0] ?? null;
}
/** The free lot next to the main network nearest to a producer, within the collection point's reach. */
function nearestFree(s: GameState, w: World, t: BuildingId, key: LotKey): LotKey | null {
  const reachT = roleOf(t)?.reach ?? 6, seen = new Set<LotKey>();
  let best: { c: LotKey; d: number } | null = null;
  for (const r of mainNetwork(s.map)) {
    const [a, b] = parseKey(r);
    for (const [x, y] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const c = lotKey(a + x, b + y), d = distance(key, c);
      if (seen.has(c) || d > reachT || (best && d >= best.d)) continue;
      seen.add(c);
      if (!canPlace(s.map, w, t, a + x, b + y)) best = { c, d };
    }
  }
  return best ? best.c : null;
}

// ---- the rules

interface Ctx { s: GameState; w: World; c: Economy; ratings: Ratings; linked: Set<LotKey>; memo: Map<string, Economy> }
/**
 * Upgrades worth weighing against a new building: one per kind the colony pays for (with jobs, not a field or a
 * home or transport), the cheapest first, each measured. An upgrade opens a job and raises the output by half.
 */
export function upgradeOptions(s: GameState, w: World, c: Economy, limit = 5, only?: (k: LotKey) => boolean): { key: LotKey; t: BuildingId; cost: number; gain: number }[] {
  const linked = connected(s.map), seen = new Set<BuildingId>(), out: { key: LotKey; t: BuildingId; cost: number; gain: number }[] = [];
  const keys = (Object.keys(s.map.buildings) as LotKey[]).filter((k) => {
    const t = s.map.buildings[k] as BuildingId, D = def(t);
    return linked.has(k) && D.payer === 'colony' && !D.crop && !D.housing && (D.jobs ?? 0) > 0 && !roleOf(t) && upgradeOf(s, k) < 2 && (!only || only(k));
  }).sort((p, q) => upgradeCost(s.map.buildings[p] as BuildingId, upgradeOf(s, p), s.milestone) - upgradeCost(s.map.buildings[q] as BuildingId, upgradeOf(s, q), s.milestone));
  for (const k of keys) {
    const t = s.map.buildings[k] as BuildingId;
    if (seen.has(t)) continue;
    seen.add(t);
    const gain = computeEconomy({ ...s, upgrades: { ...s.upgrades, [k]: upgradeOf(s, k) + 1 } }, w).incomeTotal - c.incomeTotal;
    out.push({ key: k, t, cost: upgradeCost(t, upgradeOf(s, k), s.milestone), gain });
    if (seen.size >= limit) break;
  }
  return out;
}

/** Upgrading the existing building of a service that is nearest the homes without it: how many of them it then reaches. */
export function serviceUpgrade(s: GameState, w: World, sv: Service, lacking: LotKey[]): { key: LotKey; t: BuildingId; cost: number; covers: number } | null {
  if (!lacking.length) return null;
  const [cx, cy] = lacking.reduce(([x, y], h) => { const [p, q] = parseKey(h); return [x + p / lacking.length, y + q / lacking.length]; }, [0, 0]);
  const cands = (Object.keys(s.map.buildings) as LotKey[]).filter((k) => def(s.map.buildings[k] as BuildingId).service === sv && def(s.map.buildings[k] as BuildingId).payer !== 'families' && upgradeOf(s, k) < 2)
    .sort((p, q) => { const [pa, pb] = parseKey(p), [qa, qb] = parseKey(q); return Math.hypot(pa - cx, pb - cy) - Math.hypot(qa - cx, qb - cy); }).slice(0, 2);
  let best: { key: LotKey; t: BuildingId; cost: number; covers: number } | null = null;
  for (const k of cands) {
    const t = s.map.buildings[k] as BuildingId, r = rateHomes({ ...s, upgrades: { ...s.upgrades, [k]: upgradeOf(s, k) + 1 } }, w);
    const covers = lacking.filter((h) => !r.homes[h]?.items.some((it) => it.kind === 'outOfReach' && it.service === sv)).length;
    if (covers > 0 && (!best || covers > best.covers)) best = { key: k, t, cost: upgradeCost(t, upgradeOf(s, k), s.milestone), covers };
  }
  return best;
}

const measured = (x: Ctx, extra?: Extra): Economy => {
  const k = extra ? JSON.stringify(extra) : '';
  let r = x.memo.get(k);
  if (!r) { r = measure(x.s, x.w, extra); x.memo.set(k, r); }
  return r;
};

/** Rules about the colony as a whole (the prototype's `conselhosSem`). Sorted, one advice per building type. */
function colonyAdvice(x: Ctx): Advice[] {
  const { s, w, c, ratings } = x, e = c.counts, a = e.work;
  const fams = Object.values(s.families), nFam = fams.length, now = s.market.t;
  const list: Advice[] = [];
  const add = (weight: number, rule: string, params: Advice['params'], action: AdviceAction | null, extra: Partial<Advice> = {}) => list.push({ weight, rule, params, action, cost: 0, blocked: false, ...extra });
  const gainOf = (t: BuildingId) => measured(x, { [t]: 1 }).incomeTotal - c.incomeTotal;
  const can = (t: BuildingId) => unlocked(s, t);
  const cost = (t: BuildingId) => costOf(t, s.milestone);
  const build = (t: BuildingId): AdviceAction => ({ kind: 'build', building: t });
  // the province's deadline
  const target = MILESTONES[s.milestone + 1];
  if (target) {
    const left = s.deadline - now, missing = milestoneGaps(s, w, target).filter((g) => !g.ok);
    if (left <= 8 && missing.length) add(100, 'deadline', { seasons: Math.max(0, left), milestone: target.id }, { kind: 'screen', screen: 'level' }, { goals: missing.slice(0, 3) });
  }
  // food
  if (c.hunger > 1) {
    const full = c.peaks.market.demand > e.market + 0.5;
    if (full) { const t: BuildingId = can('market') ? 'market' : 'store'; add(95, 'food.market', { short: Math.round(c.hunger), building: t }, build(t)); }
    else {
      const ops = ALL.filter((t) => can(t) && !def(t).onDeposit && !def(t).riverside && def(t).output && good(def(t).output!.good as GoodId).food);
      const best = ops.map((t) => ({ t, v: c.hunger - measured(x, { [t]: 1 }).hunger })).sort((p, q) => q.v - p.v)[0];
      add(95, best ? 'food.crop' : 'food.plant', best ? { short: Math.round(c.hunger), building: best.t, covers: Math.round(best.v) } : { short: Math.round(c.hunger) }, best ? build(best.t) : { kind: 'screen', screen: 'economy' });
    }
  }
  // cash
  const year = purseYear(s, c) + (MILESTONES[s.milestone] as MilestoneDef).grant * (s.grantFactor || 1) * 4;
  if (s.cash < 0) add(90, 'cash.negative', { year: Math.round(year) }, { kind: 'screen', screen: 'direction' });
  else if (year < 0 && s.cash < -year * 2) add(80, 'cash.runningOut', { year: Math.round(year) }, { kind: 'screen', screen: 'direction' });
  // buildings off the street network
  if (e.unlinked) { const k0 = (Object.keys(s.map.buildings) as LotKey[]).find((k) => !x.linked.has(k)) as LotKey; add(85, 'unlinked', { n: e.unlinked }, { kind: 'select', key: k0 }); }
  // the market cannot sell it all
  const marketDemand = c.peaks.market.demand, marketCap = e.market;
  if (marketDemand >= 3 && marketDemand > marketCap * 1.05) {
    const types = (['market', 'store'] as BuildingId[]).filter(can), t = types[0];
    if (t) {
      const v = gainOf(t), params = { demand: Math.round(marketDemand), capacity: Math.round(marketCap) };
      if (v < 5) {
        if (!a.idle.length) { const sec = a.bySector[sectorOf(t) as keyof typeof a.bySector]; add(80, 'marketFull.people', { ...params, empty: Math.max(0, sec.slots - sec.filled), cost: cost('hut') }, build('hut')); }
      } else {
        const up = (Object.keys(s.map.buildings) as LotKey[]).filter((k) => types.includes(s.map.buildings[k] as BuildingId) && x.linked.has(k) && upgradeOf(s, k) < 2 && teamEfficiency(a, s, k) > 0.5).sort((p, q) => upgradeOf(s, p) - upgradeOf(s, q))[0];
        if (up) {
          const tp = s.map.buildings[up] as BuildingId, lv = upgradeOf(s, up), cu = upgradeCost(tp, lv, s.milestone);
          const vm = computeEconomy({ ...s, upgrades: { ...s.upgrades, [up]: lv + 1 } }, w).incomeTotal - c.incomeTotal;
          add(workWeight(cu, vm), 'marketFull.upgrade', { ...params, building: tp, cost: cu, gain: Math.round(vm) }, { kind: 'select', key: up, upgrade: true });
        } else add(workWeight(cost(t), v), 'marketFull.build', { ...params, building: t, cost: cost(t), gain: Math.round(v) }, build(t));
      }
    }
  }
  // change a crop that is already overplanted
  { const sw = cropSwap(s, w); if (sw) add(Math.min(76, workWeight(Math.max(1, sw.cost), sw.gain)), 'cropSwap', { from: sw.from, to: sw.t, cost: sw.cost, gain: sw.gain, seasons: firstHarvest(sw.t, now) - now }, { kind: 'swap', key: sw.key, to: sw.t, from: sw.from }); }
  { const ex = overplanted(s, w); if (ex.length) add(58, 'overplanted', { building: ex[0]!.t, loss: Math.round(-ex[0]!.v), more: ex.slice(1, 3).map((y) => y.t).join(',') }, { kind: 'screen', screen: 'economy', tab: 'capacity' }); }
  // workers far from a service work worse: taking the service to their homes pays in production
  {
    const workers = Object.values(a.byBuilding).flatMap((p) => p.families), FOR: [Service, BuildingId][] = [['water', 'well'], ['health', 'apothecary'], ['school', 'school'], ['faith', 'chapel'], ['commerce', 'store']];
    const ops = FOR.filter(([, t]) => can(t)).map(([sv, t]) => ({ sv, t, n: workers.filter((f) => ratings.homes[homeOf(f.id)]?.items.some((i) => i.kind === 'outOfReach' && i.service === sv)).length }))
      .filter((o) => o.n >= 4).map((o) => ({ ...o, v: (c.incomeTotal / Math.max(1, workers.length)) * o.n * SERVICE_VALUE[o.sv] * 0.005 })).sort((p, q) => q.v / cost(q.t) - p.v / cost(p.t));
    const o = ops[0];
    if (o && o.v >= 15) add(workWeight(cost(o.t), o.v), 'workersWithoutService', { n: o.n, service: o.sv, building: o.t, cost: cost(o.t), percent: Math.round(SERVICE_VALUE[o.sv] * 0.5), gain: Math.round(o.v) }, build(o.t));
  }
  // cash at hand and a great work waiting
  {
    const id = GREAT_WORK_IDS.find((g) => !greatWorkLocked(s, w, g) && !(s.greatWorks[g]?.active || s.greatWorks[g]?.done));
    if (id && s.cash >= (GREAT_WORKS[id] as { cost: number }).cost * 0.5) { const G = GREAT_WORKS[id] as { cost: number; seasons: number }; add(57, 'greatWork', { work: id, instalment: Math.round(G.cost / G.seasons), years: G.seasons / 4 }, { kind: 'screen', screen: 'direction', tab: 'works' }); }
  }
  // taxes and the council
  const hasCouncil = Object.values(s.map.buildings).includes('council');
  if (can('council') && !hasCouncil) add(88, 'council', { cost: cost('council'), revenue: Math.round(taxEffect({ ...s, taxes: { ...s.taxes, tithe: { general: 0.08 } } }, w).revenue) }, build('council'));
  // the satisfaction the taxes must leave: the milestone's, with a point to spare; once all milestones are met, what
  // the province still asks; with the purse in the red, only what keeps the province from scoring the colony down
  const inRed = s.cash < 0 && BALANCE.adviseExportDuty;
  const floor = inRed ? 46 : (target ? (target.satisfaction ?? 60) : BALANCE.taxFloorAfterTown) + BALANCE.titheSpare;
  if (hasCouncil && !s.pendingTaxes.tithe) {
    const ef = taxEffect(s, w), now0 = s.taxes.tithe?.general ?? 0, sug = suggestedTithe(s, w, floor), mean = ratings.mean;
    const act = (value: number): AdviceAction => ({ kind: 'screen', screen: 'direction', tab: 'taxes', law: 'tithe', value });
    const rich = 3000 + c.incomeTotal * 0.2;
    if (ef.familiesAtRisk) add(90, 'tithe.choking', { n: ef.familiesAtRisk, rate: Math.round(sug.rate * 100), mean, after: sug.mean }, act(sug.rate));
    else if (now0 > sug.rate && mean < floor && !inRed) add(84, 'tithe.hurts', { rate: Math.round(now0 * 100), wanted: floor - BALANCE.titheSpare, suggested: Math.round(sug.rate * 100), mean, after: sug.mean, revenue: Math.round(sug.revenue) }, act(sug.rate));
    else if (s.cash > rich && now0 >= 0.04) add(58, 'tithe.relief', { rate: Math.round((now0 - 0.04) * 100) }, act(Math.round((now0 - 0.04) * 100) / 100));
    else if (sug.rate >= now0 + 0.04 && sug.mean >= floor + firstTitheExtra() && s.cash < rich / 2) add(now0 ? 62 : 86, now0 ? 'tithe.more' : 'tithe.first', { rate: Math.round(sug.rate * 100), revenue: Math.round(sug.revenue), mean, after: sug.mean }, act(sug.rate));
  }
  // the export duty: a share of what leaves through the gateways, as heavy on satisfaction as the tithe and raising
  // about as much once the colony exports; suggested on the same terms, with the tithe as it is
  if (hasCouncil && BALANCE.adviseExportDuty && !s.pendingTaxes.exportDuty && !list.some((y) => y.rule === 'tithe.choking' || y.rule === 'tithe.hurts')) {
    const now0 = s.taxes.exportDuty?.general ?? 0, sug = suggestedTithe(s, w, floor, 'exportDuty'), mean = ratings.mean, rich = 3000 + c.incomeTotal * 0.2, base = taxEffect(s, w).revenue;
    const act = (value: number): AdviceAction => ({ kind: 'screen', screen: 'direction', tab: 'taxes', law: 'exportDuty', value });
    if (now0 > 0 && mean < floor && sug.rate < now0 && !inRed) add(80, 'exportDuty.hurts', { rate: Math.round(now0 * 100), wanted: floor - BALANCE.titheSpare, suggested: Math.round(sug.rate * 100), mean, after: sug.mean }, act(sug.rate));
    else if (sug.rate > now0 && sug.mean >= floor && s.cash < rich / 2 && sug.revenue - base >= 100)
      add(now0 ? 60 : 84, now0 ? 'exportDuty.more' : 'exportDuty.first', { rate: Math.round(sug.rate * 100), revenue: Math.round(sug.revenue - base), mean, after: sug.mean }, act(sug.rate));
  }
  // idle families and jobs with nobody
  // the jobs the next level asks for: its families at work, more when it allows only a share without work, or the
  // milestone's families when it carries one
  const lv1 = LEVELS.find((l) => l.level === s.level + 1), tgF = lv1?.milestone && BALANCE.milestoneWorkers ? Math.round(((MILESTONES[lv1.milestone] as MilestoneDef).families ?? 0) * (1 + (s.extraDemand || 0) * 0.05)) : 0;
  const next = lv1 && { ...lv1, workers: Math.max(lv1.workers, lv1.idle !== undefined ? Math.ceil(nFam * (1 - lv1.idle)) : 0, tgF) }, shortOfWork = !!next && a.employed < next.workers;
  if (a.idle.length >= 3 && (a.idle.length > nFam * 0.1 || shortOfWork)) {
    const wait = (t: BuildingId) => (def(t).crop ? firstHarvest(t, now) - now : 0);
    const rec = invest(x).filter((i) => (def(i.t).jobs || 0) > 0 && (!def(i.t).riverside || freeRiverbank(s, w))).sort((p, q) => (p.years + wait(p.t) / 4) - (q.years + wait(q.t) / 4))[0];
    // upgrading what exists can open the job cheaper and pay more than a new building
    const up = upgradeOptions(s, w, c, 4).filter((u) => u.gain >= Math.max(5, u.cost * 0.08)).sort((p, q) => q.gain / q.cost - p.gain / p.cost)[0];
    if (up && (!rec || up.gain / up.cost > rec.income / Math.max(1, rec.cost))) add(workWeight(up.cost, up.gain), 'idle.upgrade', { n: a.idle.length, building: up.t, at: up.key, cost: up.cost, gain: Math.round(up.gain) }, { kind: 'select', key: up.key, upgrade: true });
    else if (rec) { const nE = wait(rec.t); add(workWeight(rec.cost + (rec.income * nE) / 4, rec.income), 'idle.invest', { n: a.idle.length, building: rec.t, cost: rec.cost, gain: Math.round(rec.income), seasons: nE }, build(rec.t)); }
    else {
      const t = (['cassavaField', 'cornField', 'beanField'] as BuildingId[]).find(can) as BuildingId;
      add(shortOfWork ? 72 : 44, 'idle.jobs', { n: a.idle.length, level: s.level + 1, workers: next?.workers ?? 0, shortOfWork: shortOfWork ? 1 : 0, building: t, cost: cost(t) }, build(t));
    }
  }
  // the next level short only of workers: the cheapest jobs that still pay, so the colony can level up
  if (shortOfWork && next && c.incomeTotal >= next.income && a.idle.length >= 3) {
    const short = next.workers - a.employed;
    const cands = ALL.filter((t) => can(t) && (def(t).jobs ?? 0) > 0 && !def(t).housing && !roleOf(t) && !def(t).riverside).sort((p, q) => cost(p) / (def(p).jobs as number) - cost(q) / (def(q).jobs as number)).slice(0, 6);
    let best: { t: BuildingId; gain: number; perJob: number } | null = null;
    for (const t of cands) {
      const g = measured(x, { [t]: 1 }).incomeTotal - c.incomeTotal, perJob = cost(t) / (def(t).jobs as number);
      // a job that adds next to nothing (a crop the market already has too much of) only adds waste
      if (g >= Math.max(5, cost(t) * 0.08) && (!best || perJob < best.perJob - 1e-9 || (Math.abs(perJob - best.perJob) < 1e-9 && g > best.gain))) best = { t, gain: g, perJob };
    }
    // an upgrade opens one job: weighed by its cost per job like the new buildings
    const up = upgradeOptions(s, w, c, 5).filter((u) => u.gain >= Math.max(5, u.cost * 0.08)).sort((p, q) => p.cost - q.cost)[0];
    if (up && (!best || up.cost < best.perJob)) add(next.milestone ? 88 : 72, 'levelWorkers.upgrade', { level: next.level, n: short, current: a.employed, target: next.workers, building: up.t, at: up.key, cost: up.cost, gain: Math.round(up.gain) }, { kind: 'select', key: up.key, upgrade: true });
    else if (best) add(next.milestone ? 88 : 72, 'levelWorkers', { level: next.level, n: short, current: a.employed, target: next.workers, building: best.t, cost: cost(best.t), gain: Math.round(best.gain) }, build(best.t));
  }
  // new chains: a cane field alone yields nothing; the sum must join the works
  const has = (t: BuildingId) => Object.values(s.map.buildings).includes(t);
  for (const [chain, works, first] of [['caneSpirits', { caneField: 2, distillery: 1 }, 'caneField'], ['caneRapadura', { caneField: 2, sugarMill: 1 }, 'caneField'], ['saltFish', { fishery: 1, saltery: 1 }, 'fishery']] as const) {
    const types = Object.keys(works) as BuildingId[];
    if (!types.every(can) || types.some(has) || (first === 'fishery' && !freeRiverbank(s, w))) continue;
    const total = types.reduce((y, t) => y + cost(t) * (works as Record<string, number>)[t]!, 0);
    if (s.cash < total * 0.6) continue;
    const v = measured(x, works as Extra).incomeTotal - c.incomeTotal;
    if (v >= total * 0.15) add(workWeight(total, v) - 8, 'chain', { chain, cost: total, gain: Math.round(v) }, build(first));
  }
  if (has('caneField') && !has('distillery') && !has('sugarMill')) { const t = can('distillery') ? 'distillery' : can('sugarMill') ? 'sugarMill' : null; if (t) add(78, 'caneIdle', { building: t, cost: cost(t) }, build(t)); }
  // what the next level asks for beyond people and income
  if (next?.requires) for (const t of Object.keys(next.requires) as BuildingId[]) { const n = Object.values(s.map.buildings).filter((y) => y === t).length; if (n < (next.requires[t] as number) && can(t)) add(70, 'levelBuilding', { level: s.level + 1, building: t, cost: cost(t) }, build(t)); }
  if (target) {
    const count: Partial<Record<BuildingId, number>> = {};
    for (const k of Object.keys(s.map.buildings) as LotKey[]) if (x.linked.has(k)) count[s.map.buildings[k] as BuildingId] = (count[s.map.buildings[k] as BuildingId] ?? 0) + 1;
    const nextMilestone = !!next && next.milestone === s.milestone + 1;
    for (const t of Object.keys(target.requires ?? {}) as BuildingId[]) if ((count[t] ?? 0) < (target.requires![t] as number) && can(t)) add(nextMilestone ? 68 : 46, 'milestoneBuilding', { milestone: target.id, building: t, n: target.requires![t] as number, has: count[t] ?? 0, cost: cost(t) }, build(t));
    const nLands = Object.values(s.map.lands).filter((y) => y === 'ours').length, land = suggestedLand(s, w, true);
    if (target.lands && nLands < target.lands && land) { const q = annexCost(s); add(nextMilestone ? 64 : 44, 'milestoneLands', { milestone: target.id, n: target.lands, has: nLands, influence: q.influence, cost: q.cash }, { kind: 'land', land }, { cost: q.cash }); }
    const missingF = Math.ceil(Math.round((target.families ?? 0) * (1 + (s.extraDemand || 0) * 0.05)) / familySpare()) - nFam;
    const onlyPeople = nextMilestone && a.employed >= next!.workers && c.incomeTotal >= next!.income;
    if (missingF > 0 && (onlyPeople || a.idle.length <= nFam * 0.3) && emptySlots(s).length < (onlyPeople ? 14 : 8))
      add(onlyPeople ? 88 : a.idle.length <= nFam * 0.25 ? workWeight(cost('hut') + 2 * (ARRIVAL_AID + SEED_AID), (2 * c.incomeTotal) / Math.max(1, nFam)) : 54, 'milestoneFamilies', { milestone: target.id, n: missingF, raised: (s.extraDemand || 0) * 5, cost: cost('hut') }, build('hut'));
  }
  // a level between milestones needs families to fill its jobs: homes when there are too few, and few are idle
  if (next && BALANCE.milestoneWorkers && !(target && next.milestone === s.milestone + 1)) {
    const needF = Math.ceil(next.workers / familySpare()) - nFam;
    if (needF > 0 && a.idle.length <= nFam * 0.25 && emptySlots(s).length < 8)
      add(a.employed >= next.workers * 0.9 && c.incomeTotal >= next.income ? 80 : 60, 'levelFamilies', { level: next.level, n: needF, cost: cost('hut') }, build('hut'));
  }
  const noPeople = SECTOR_ORDER.reduce((y, sec) => y + Math.max(0, a.bySector[sec].slots - a.bySector[sec].filled), 0), empty = emptySlots(s).length;
  if (noPeople >= 2) { if (empty) add(52, 'jobsEmpty.homes', { n: noPeople, homes: empty }, null); else add(56, 'jobsEmpty.build', { n: noPeople, cost: cost('hut') }, build('hut')); }
  // waste: near the limit the province starts to count it
  const waste = wasteShare(c);
  if (waste >= WASTE_LIMIT - 0.05) {
    const worst = GOOD_IDS.slice().sort((p, q) => c.lost[q] - c.lost[p])[0] as GoodId, cause = (Object.keys(c.lostBy) as (keyof Economy['lostBy'])[]).sort((p, q) => c.lostBy[q] - c.lostBy[p])[0] as string;
    add(waste > WASTE_LIMIT ? 83 : 70, 'waste', { percent: Math.round(waste * 100), limit: Math.round(WASTE_LIMIT * 100), cause, good: worst }, { kind: 'screen', screen: 'economy', tab: 'summary' });
  }
  const stuck = c.peaks.carts.demand >= 3 && c.peaks.carts.demand > c.transport.gateways.reduce((y, p) => y + p.capacity, 0) * 1.05;
  const worstGood = GOOD_IDS.filter((g) => c.lost[g] > 30 && c.lost[g] > c.produced[g] * 0.25).sort((p, q) => c.lost[q] * good(q).localPrice - c.lost[p] * good(p).localPrice)[0];
  if (worstGood) {
    const wk = ALL.find((t) => can(t) && def(t).recipes && recipesOf(t, s.level).some((r) => r.from === worstGood) && !((e.n[t] ?? 0) > 0));
    if (wk) add(48, 'lostGood.workshop', { good: worstGood, lost: Math.round(c.lost[worstGood]), building: wk, gain: Math.round(gainOf(wk)) }, build(wk));
    else if (!stuck) add(42, 'lostGood.noBuyer', { good: worstGood, lost: Math.round(c.lost[worstGood]) }, { kind: 'screen', screen: 'economy', tab: 'resources' });
  }
  // a better home houses more people without a new lot; families pay, but need the material for sale
  const ready: Partial<Record<GoodId, number>> = {};
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    const up = HOME_UPGRADE[s.map.buildings[key] as BuildingId];
    if (!up || !can(up.to)) continue;
    const living = fams.filter((f) => homeOf(f.id) === key), rating = ratings.homes[key]?.rating ?? 0;
    if (!living.length || rating < up.rating || living.reduce((y, f) => y + (f.savings || 0), 0) < up.cost) continue;
    for (const g of up.needs) if (!((s.produced[g] ?? 0) > 1)) ready[g] = (ready[g] ?? 0) + 1;
  }
  for (const g of Object.keys(ready) as GoodId[]) { const t = ALL.find((y) => def(y).output?.good === g && can(y)); if (t && (ready[g] as number) >= 2) add(67, 'homesCanGrow', { n: ready[g] as number, good: g, building: t, cost: cost(t) }, build(t)); }
  // services
  let districts: ReturnType<typeof computeDistricts> | null = null;
  const homes = Object.values(ratings.homes), wanted = target ? (target.satisfaction ?? 60) : 60, mean = ratings.mean;
  if (mean < wanted + 6 && homes.length) {
    const ops = SERVICES.map((sv) => {
      const t = SERVICE_BUILDING[sv];
      if (!can(t)) return null;
      const n = homes.filter((h) => h.items.some((i) => i.kind === 'outOfReach' && i.service === sv)).length;
      if (!n) return null;
      const reachN = Math.min(n, Math.round((def(t).radius || 6) * 2)), up = (reachN * SERVICE_VALUE[sv]) / homes.length;
      return { sv, t, n, up, perCost: up / cost(t) };
    }).filter((o): o is NonNullable<typeof o> => !!o).sort((p, q) => q.perCost - p.perCost);
    ops.forEach((o, i) => {
      const weight = i === 0 && mean < wanted ? 85 : i === 0 && mean < wanted + 3 ? 62 : 32 + Math.min(14, o.n / 2);
      if (weight < 40 && o.n < Math.max(3, homes.length * 0.25)) return;
      // with districts, says where: the district with most homes without it, and takes the camera there
      let where: Record<string, string | number> = {}, act: AdviceAction = build(o.t);
      if (districtsUnlocked(s)) {
        const D = (districts ??= computeDistricts(s, w));
        const pb = D.info.map((d) => ({ d, without: d.homes.filter((h) => ratings.homes[h]?.items.some((it) => it.kind === 'outOfReach' && it.service === o.sv)) })).filter((x) => x.without.length).sort((p, q) => q.without.length - p.without.length)[0];
        if (pb) { where = { district: nameId(pb.d.name), at: pb.d.id, inDistrict: pb.without.length, all: pb.without.length === o.n ? 1 : 0 }; act = { kind: 'build', building: o.t, near: pb.without[0]! }; }
      }
      // upgrading the nearest one widens its reach: when it reaches the homes for less, that is the advice
      const lacking = (Object.keys(ratings.homes) as LotKey[]).filter((h) => ratings.homes[h]?.items.some((it) => it.kind === 'outOfReach' && it.service === o.sv));
      const su = i < 2 ? serviceUpgrade(s, w, o.sv, lacking) : null;
      if (su && su.covers / su.cost >= Math.min(o.n, Math.round((def(o.t).radius || 6) * 2)) / cost(o.t)) {
        add(weight, 'service.upgrade', { n: o.n, service: o.sv, building: su.t, at: su.key, cost: su.cost, covers: su.covers, mean, wanted }, { kind: 'select', key: su.key, upgrade: true });
        return;
      }
      add(weight, i === 0 && mean < wanted + 3 ? 'service.satisfaction' : 'service.homes', { n: o.n, service: o.sv, building: o.t, cost: cost(o.t), up: Math.max(0.1, Math.round(o.up * 10) / 10), mean, wanted, milestone: target?.id ?? '', ...where }, act);
    });
  }
  // growth
  const nLands = Object.values(s.map.lands).filter((y) => y === 'ours').length, land = suggestedLand(s, w, true);
  if (nFam > 40 * nLands && land) { const q = annexCost(s); add(50, 'crowded', { influence: q.influence, cost: q.cash }, { kind: 'land', land }, { cost: q.cash }); }
  if (s.milestone >= 2 && !hasRoad(s)) {
    // with the town next and the road all it still lacks, the road comes first
    const onlyRoad = !!next && next.milestone === 3 && levelRequirements(s, w, next.level, c).every((g) => g.ok || g.kind === 'road');
    // the road takes lands and seasons: from two levels before the town it comes before most works
    const weight = onlyRoad ? 92 : s.level >= milestoneLevel(3) - 2 ? 80 : next && next.milestone === 3 ? 66 : 30, south: LandId[] = [];
    for (let y = 47; y < 105; y++) { const id = landOf(22, y); if (!south.includes(id) && s.map.lands[id] !== 'ours') south.push(id); }
    if (south.length) add(weight, 'road.lands', { n: south.length }, { kind: 'land', land: south[0]! });
    else add(weight, 'road.street', {}, { kind: 'build', building: 'street' });
  }
  // the next level
  if (next) { const f = levelRequirements(s, w, s.level + 1, c).filter((y) => !y.ok); if (f.length) add(20, 'nextLevel', { level: s.level + 1 }, { kind: 'screen', screen: 'level' }, { goals: f.slice(0, 3) }); }
  return list;
}

/** A crop already overplanted, on the colony's weakest lot for it, and the best swap there. */
function cropSwap(s: GameState, w: World): { key: LotKey; from: BuildingId; t: BuildingId; cost: number; gain: number } | null {
  const linked = connected(s.map);
  let v: { key: LotKey; from: BuildingId; t: BuildingId; cost: number; gain: number } | null = null;
  for (const { t } of overplanted(s, w).slice(0, 2)) {
    const keys = (Object.keys(s.map.buildings) as LotKey[]).filter((k) => s.map.buildings[k] === t && linked.has(k) && !((s.firstHarvest?.[k] ?? -Infinity) > s.market.t) && !s.seasonWork.swaps[k]);
    if (!keys.length) continue;
    const g = def(t).output!.good as GoodId;
    keys.sort((p, q) => soilOf(w, p, g) - soilOf(w, q, g));
    const op = swapOptions(s, w, keys[0]!)[0];
    if (op && op.gain >= 12 && op.cost <= op.gain * 3 && (!v || op.gain > v.gain)) v = { key: keys[0]!, from: t, t: op.t, cost: op.cost, gain: op.gain };
  }
  return v;
}

/** The three best buildings to put money in, by years to pay back (food first when there is hunger). */
function invest(x: Ctx): { t: BuildingId; cost: number; income: number; years: number; hunger: number }[] {
  const { s, c } = x;
  const list = INVEST.filter((t) => unlocked(s, t)).map((t) => { const m = measured(x, { [t]: 1 }); return { t, cost: costOf(t, s.milestone), income: m.incomeTotal - c.incomeTotal, hunger: c.hunger - m.hunger, years: 0 }; })
    .filter((i) => i.income > 4 || i.hunger > 1);
  for (const i of list) i.years = i.income > 0 ? i.cost / i.income : 99;
  return list.filter((i) => i.years <= 10 || i.hunger > 1).sort((p, q) => (q.hunger > 1 ? 1 : 0) - (p.hunger > 1 ? 1 : 0) || p.years - q.years).slice(0, 3);
}

/** Rules about transport (the prototype's `conselhosTransp`). */
function transportAdvice(x: Ctx): Advice[] {
  const { s, w, c } = x, R = c.transport, L: Advice[] = [];
  const add = (weight: number, rule: string, params: Advice['params'], action: AdviceAction | null) => L.push({ weight, rule, params, action, cost: 0, blocked: false });
  // every suggestion here is measured on the whole chain: a vehicle behind a full gateway gains nothing, so the gateway comes first
  const gainVehicle = (key: LotKey, v: VehicleId, up = 0) => computeEconomy(withFleet(s, key, v, 1, up), w).incomeTotal - c.incomeTotal;
  const bestVehicle = (key: LotKey) => bestVehicleAt(s, key);
  let measuredN = 0, idleN = 0;
  const items = [...R.collections.map((y) => ['collection', y] as const), ...R.gateways.map((y) => ['gateway', y] as const)].sort((p, q) => q[1].peak - p[1].peak);
  for (const [which, y] of items) {
    const v = bestVehicle(y.key), room = fleetSize(s, y.key) < y.slots;
    if (!v) continue;
    const V = VEHICLES[v] as VehicleDef;
    const tight = which === 'gateway' ? gatewayTight(y) : y.peak >= 0.9;
    if (y.capacity <= 0 && room) {
      const g = gainVehicle(y.key, v);
      // an empty building is a waste the player may not have noticed: it ranks high when it pays
      if (g >= 10) add(Math.max(72, workWeight(V.price, g)), `noVehicles.${which}`, { at: y.key, vehicle: v, cost: V.price, gain: Math.round(g) }, { kind: 'buyVehicle', key: y.key, vehicle: v });
      continue;
    }
    if (tight && room && measuredN < 4) {
      measuredN++;
      const g = gainVehicle(y.key, v);
      if (g - V.upkeep * 4 >= V.price / 2) add(workWeight(V.price, g), `full.${which}`, { at: y.key, vehicle: v, cost: V.price, upkeep: V.upkeep * 4, gain: Math.round(g) }, { kind: 'buyVehicle', key: y.key, vehicle: v });
    } else if (tight && !room && upgradeOf(s, y.key) < 2) {
      const g = gainVehicle(y.key, v, 1), cost = upgradeCost(s.map.buildings[y.key] as BuildingId, upgradeOf(s, y.key), s.milestone) + V.price;
      if (g >= 10) add(workWeight(cost, g), 'noSlot', { at: y.key, vehicle: v, cost, gain: Math.round(g) }, { kind: 'select', key: y.key, upgrade: true });
    }
    // little used, with more than one vehicle: selling one is measured; its upkeep goes into the tariff the families pay
    else if (fleetSize(s, y.key) > 1 && (which === 'collection' ? y.peak < 0.5 : (y as Economy['transport']['gateways'][number]).occupancy < 0.4) && idleN < 3) {
      idleN++;
      const v0 = (Object.keys(y.fleet) as VehicleId[]).filter((z) => y.fleet[z]).sort((p, q) => (VEHICLES[q] as VehicleDef).upkeep - (VEHICLES[p] as VehicleDef).upkeep)[0];
      if (!v0) continue;
      const g = computeEconomy(withFleet(s, y.key, v0, -1), w).incomeTotal - c.incomeTotal;
      if (g >= 10) add(Math.min(74, 60 + g / 20), 'idleFleet', { at: y.key, vehicle: v0, gain: Math.round(g), back: Math.round((VEHICLES[v0] as VehicleDef).price * 0.5) }, { kind: 'sellVehicle', key: y.key, vehicle: v0 });
    }
  }
  if (s.level >= milestoneLevel(1)) for (const r of R.lands.filter((y) => y.producedValue > 0 && y.lostValue > 40 && y.lostValue / y.producedValue > 0.12 && !y.covered).slice(0, 2)) {
    const t: BuildingId = landHasWater(s, w, r.id) ? 'landing' : 'tradingPost', v: VehicleId = t === 'tradingPost' ? 'muleTrain' : 'canoe', total = packageCost(s, t, v);
    const lot = collectionLot(s, w, t, r.id);
    if (!lot) continue;
    const gain = computeEconomy(withPlaced(w, s, { [lot]: t }, { [lot]: { [v]: PACKAGE } }), w).incomeTotal - c.incomeTotal;
    if (gain < 15) continue;
    L.push({ weight: workWeight(total, gain), rule: 'noCollection', params: { land: r.id, lost: Math.round(r.lostValue), building: t, vehicle: v, cost: total, gain: Math.round(gain) }, action: { kind: 'collect', building: t, land: r.id, lot, fleet: packageFleet(t, v) }, cost: total, blocked: false });
  }
  // the pier full all year and idle people: transforming here employs them and sends less cargo to the canoes
  {
    const a0 = allocate(s);
    if (R.gateways.some((y) => gatewayTight(y)) && a0.idle.length >= 1) {
      let best: { t: BuildingId; g: number; less: number } | null = null;
      for (const t of WORKSHOPS.filter((y) => unlocked(s, y) && recipesOf(y, s.level).some((rc) => (c.produced[rc.from as GoodId] ?? 0) > 40))) {
        const c2 = measured(x, { [t]: 1 }), g = c2.incomeTotal - c.incomeTotal, less = c.exportedTotal - c2.exportedTotal;
        if (g > 20 && (!best || g > best.g)) best = { t, g, less };
      }
      if (best) { const n = Math.min(a0.idle.length, def(best.t).jobs || 1); add(78, best.less > 10 ? 'pierFullIdle.less' : 'pierFullIdle', { building: best.t, cost: costOf(best.t, s.milestone), n, gain: Math.round(best.g), less: best.less > 10 ? Math.round(best.less) : 0 }, { kind: 'build', building: best.t }); }
    }
  }
  // a raw good that mostly leaves raw or goes to waste, and is worth half as much again processed: its workshop
  if (BALANCE.adviseProcessing) {
    const P = processingPotential(s, c);
    const ripe = (Object.values(P) as ProcessingPotential[]).filter((p) => p.share > 0.5 && p.potential >= 10 && p.processedValue >= p.rawPrice * 1.5).sort((p, q) => q.potential * (q.processedValue - q.rawPrice) - p.potential * (p.processedValue - p.rawPrice));
    for (const p of ripe.slice(0, 2)) {
      const cost = costOf(p.building, s.milestone), gain = measured(x, { [p.building]: 1 }).incomeTotal - c.incomeTotal;
      const params = { good: p.good, product: p.to, building: p.building, share: Math.round(p.share * 100), n: Math.round(p.potential), more: Math.round((p.processedValue / Math.max(0.01, p.rawPrice) - 1) * 100), cost, gain: Math.round(gain) };
      add(gain >= 15 ? Math.max(56, workWeight(cost, gain)) : 50, gain >= 15 ? 'process.potential' : 'process.potentialNoGain', params, { kind: 'build', building: p.building });
    }
  }
  // the store package replaces the prototype's lone store for far fields (see storePackage)
  // a commerce with no gateway in reach: a waystation next to it, measured with its mule trains
  if (unlocked(s, 'waystation')) for (const y of R.commerce.filter((z) => !z.linked && z.lost > 20)) {
    const lot = collectionLot(s, w, 'waystation', null, y.key);
    if (!lot) continue;
    const cost = packageCost(s, 'waystation', 'muleTrain'), gain = computeEconomy(withPlaced(w, s, { [lot]: 'waystation' }, { [lot]: { muleTrain: PACKAGE } }), w).incomeTotal - c.incomeTotal;
    if (gain >= 15) L.push({ weight: workWeight(cost, gain), rule: 'noGateway', params: { at: y.key, lost: Math.round(y.lost), cost, gain: Math.round(gain) }, action: { kind: 'collect', building: 'waystation', near: y.key, lot, fleet: packageFleet('waystation', 'muleTrain') }, cost, blocked: false });
  }
  const u = s.transport.last;
  if (u && u.margin >= 0.25 && u.loss > 0.2) add(60, 'highTariffs', { margin: Math.round(u.margin * 100), loss: Math.round(u.loss * 100) }, { kind: 'screen', screen: 'transport', tab: 'collections' });
  return L;
}

/** Free lots on our lands where a home fits: next to a street of the network. */
export function roomByStreets(s: GameState, w: World): number {
  let n = 0;
  for (const id of Object.keys(s.map.lands) as LandId[]) {
    if (s.map.lands[id] !== 'ours') continue;
    const [c, l] = parseKey(id);
    for (let a = c * 15; a < c * 15 + 15; a++) for (let b = l * 15; b < l * 15 + 15; b++) if (!canPlace(s.map, w, 'hut', a, b)) n++;
  }
  return n;
}
/** The straight line of four street lots out of the network with the most free lots along it. */
export function streetLine(s: GameState, w: World): { from: [number, number]; to: [number, number]; lots: number } | null {
  let best: { from: [number, number]; to: [number, number]; lots: number } | null = null;
  for (const key of Object.keys(s.map.streets) as LotKey[]) {
    const [a, b] = parseKey(key);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      // the free stretch out of this street lot, up to 6 lots (a stretch of at least 2 opens lots on both sides)
      const cells: [number, number][] = [];
      for (let i = 1; i <= 6; i++) { const x = a + dx * i, y = b + dy * i; if (canPlaceStreet(s.map, w, x, y)) break; cells.push([x, y]); }
      if (cells.length < 2) continue;
      let lots = 0;
      for (const [x, y] of cells) for (const [sx, sy] of dx ? [[0, 1], [0, -1]] as const : [[1, 0], [-1, 0]] as const) { const e = canPlace(s.map, w, 'hut', x + sx, y + sy); if (!e || e === 'needsStreet') lots += 1; }
      if (!best || lots > best.lots || (lots === best.lots && cells.length < Math.abs(best.to[0] - best.from[0]) + Math.abs(best.to[1] - best.from[1]) + 1)) best = { from: cells[0]!, to: cells[cells.length - 1]!, lots };
    }
  }
  return best && best.lots >= 3 ? best : null;
}

/** What following an action costs from the purse now. */
function actionCost(s: GameState, a: AdviceAction | null): number {
  if (!a) return 0;
  switch (a.kind) {
    case 'build': return a.building === 'street' ? 0 : costOf(a.building, s.milestone);
    case 'select': return a.upgrade ? upgradeCost(s.map.buildings[a.key] as BuildingId, upgradeOf(s, a.key), s.milestone) : 0;
    case 'swap': return Math.max(0, swapCost(s, a.key, a.to));
    case 'land': return annexCost(s).cash;
    case 'buyVehicle': return (VEHICLES[a.vehicle] as VehicleDef).price;
    case 'streets': return 4 * 5;
    default: return 0;
  }
}

/** The next rival advance within two years that takes a market the colony leads (or keeps above 80%) below it. */
export function raceSoon(s: GameState, c: Economy): { destination: DestinationId; seasons: number; rival: number; ours: number; share: number } | null {
  if (!s.race) return null;
  const t = raceTime(s), a = ADVANCES.find((x) => x.at > t && x.at - t <= 8);
  if (!a) return null;
  const comp = c.transport.competitiveness, vol = c.transport.destVolume;
  let worst: { destination: DestinationId; seasons: number; rival: number; ours: number; share: number } | null = null;
  for (const [d, f] of Object.entries(a.factors) as [DestinationId, number][]) {
    if (!((vol[d] ?? 0) > 0)) continue;
    const costs = c.transport.gateways.filter((g) => g.capacity > 0).flatMap((g) => g.dests.filter((x) => x.d === d).map((x) => x.full));
    if (!costs.length) continue;
    const ours = Math.min(...costs), rival = rivalCost(s, d) * f, now = comp[d] ?? 0, then = Math.max(0.6, Math.min(1.1, rival / ours));
    // it matters when a market led stops being led, or one above 80% falls below it
    if (!((now >= 1 && then < 1) || (now >= 0.8 && then < 0.8))) continue;
    if (!worst || then * 100 < worst.share) worst = { destination: d, seasons: a.at - t, rival: Math.round(rival * 100) / 100, ours: Math.round(ours * 100) / 100, share: Math.round(then * 100) };
  }
  return worst;
}

/**
 * Families leave in the race when the income per family, averaged over a year, falls more than 12% below its best.
 * New families keep coming (children marry), so this looks two seasons ahead at today's income and the recent
 * growth; when it would cross, it says how much more income a year avoids it and the cheapest jobs that bring it.
 */
export function departuresAhead(s: GameState, w: World, c: Economy): { seasons: number; share: number; gain: number; building: BuildingId; count: number; cost: number } | null {
  const R = s.race;
  if (!R || R.peakPerFamily <= 0) return null;
  const fam = Object.keys(s.families).length, ser = s.series ?? [], back = ser[Math.max(0, ser.length - 5)], last = ser[ser.length - 1];
  const growth = back && last && last.t > back.t ? Math.max(0, (last.families - back.families) / (last.t - back.t)) : 0;
  for (const k of [1, 2]) {
    const proj = Array.from({ length: k }, (_, i) => c.incomeTotal / Math.max(1, fam + growth * (i + 1)));
    const kept = R.perFamily.slice(-(4 - k)), mean = [...kept, ...proj].reduce((x, y) => x + y, 0) / (kept.length + k);
    const fall = 1 - mean / R.peakPerFamily;
    if (fall <= 0.12) continue;
    // the income a year that keeps the mean at 88% of the best
    const need = (0.88 * R.peakPerFamily * (kept.length + k) - kept.reduce((x, y) => x + y, 0)) / k * (fam + growth * k);
    const gap = Math.max(0, need - c.incomeTotal);
    if (gap < 10) return null;
    const x: Ctx = { s, w, c, ratings: rateHomes(s, w), linked: connected(s.map), memo: new Map([['', c]]) };
    const can = (t: BuildingId) => unlocked(s, t) && !!lotsFor(s, w, t, 1).length;
    let best: { t: BuildingId; gain: number; per: number } | null = null;
    for (const t of ALL.filter((y) => can(y) && (def(y).jobs ?? 0) > 0 && !def(y).housing && !roleOf(y) && !def(y).riverside).sort((p, q) => costOf(p, s.milestone) - costOf(q, s.milestone)).slice(0, 8)) {
      const g = measured(x, { [t]: 1 }).incomeTotal - c.incomeTotal;
      if (g >= 5 && (!best || costOf(t, s.milestone) / g < best.per)) best = { t, gain: g, per: costOf(t, s.milestone) / g };
    }
    if (!best) return null;
    const count = Math.max(1, Math.ceil(gap / best.gain));
    return { seasons: k, share: Math.round(fall * 100), gain: Math.round(gap), building: best.t, count, cost: count * costOf(best.t, s.milestone) };
  }
  return null;
}

/** The rules' list: colony and transport rules, heaviest first, one advice per building type. */
export function ruleAdvice(s: GameState, w: World): Advice[] {
  const c = computeEconomy(s, w), x: Ctx = { s, w, c, ratings: rateHomes(s, w), linked: connected(s.map), memo: new Map([['', c]]) };
  const one = (list: Advice[]) => { const seen = new Set<string>(); return list.filter((y) => { if (y.action?.kind !== 'build') return true; if (seen.has(y.action.building)) return false; seen.add(y.action.building); return true; }); };
  const colony = one(colonyAdvice(x).sort((p, q) => q.weight - p.weight));
  return one(colony.concat(transportAdvice(x)).sort((p, q) => q.weight - p.weight));
}

/** Producers losing the most on the way, worst first, with the value they lose per year. */
export function worstOutlets(s: GameState, c: Economy): { key: LotKey; lost: number; share: number }[] {
  return (Object.keys(c.outlet) as LotKey[]).map((key) => {
    const o = c.outlet[key]!, t = s.map.buildings[key] as BuildingId | undefined, g = t && def(t).output?.good;
    return { key, share: o.share, lost: (o.sent - o.delivered) * (g ? good(g as GoodId).localPrice : 1) };
  }).filter((x) => x.lost > 0).sort((p, q) => q.lost - p.lost);
}

export interface FarLandPlan { land: LandId; fields: number; lostOnFoot: number; option: 'collection' | 'storePackage' | 'store' | 'storeEarly'; action: AdviceAction; cost: number; gain: number }
/**
 * A land whose fields walk beyond the free distance and lose on the way. Measures a collection point there
 * and a store with a waystation and mule trains (the store alone, with no gateway in reach, only sells to
 * the families around it). Returns the better one, or null when neither pays.
 */
export function farLandPlan(s: GameState, w: World, c: Economy = computeEconomy(s, w)): FarLandPlan | null {
  const G = geography(s, connected(s.map)), byLand: Record<string, { n: number; lost: number }> = {};
  for (const [key, p] of Object.entries(G.producers) as [LotKey, (typeof G.producers)[LotKey]][]) {
    if (p.carry <= 6 || p.collections.length) continue;
    const o = c.outlet[key], t = s.map.buildings[key] as BuildingId, g = def(t).output?.good;
    if (!o) continue;
    const x = (byLand[p.land] ??= { n: 0, lost: 0 });
    x.n += 1; x.lost += o.lost.onFoot * (g ? good(g as GoodId).localPrice : 1);
  }
  const [land, info] = (Object.entries(byLand).sort((p, q) => q[1].lost - p[1].lost)[0] ?? []) as [LandId, { n: number; lost: number }] | [];
  if (!land || !info || info.n < 2 || info.lost < 30) return null;
  const options: FarLandPlan[] = [];
  const base = { land, fields: info.n, lostOnFoot: info.lost };
  for (const [t, v] of [['tradingPost', 'muleTrain'], ['landing', 'canoe']] as const) {
    if (!unlocked(s, t) || (t === 'landing' && !landHasWater(s, w, land))) continue;
    const lot = collectionLot(s, w, t, land);
    if (!lot) continue;
    const gain = computeEconomy(withPlaced(w, s, { [lot]: t }, { [lot]: { [v]: PACKAGE } }), w).incomeTotal - c.incomeTotal;
    options.push({ ...base, option: 'collection', action: { kind: 'collect', building: t, land, lot, fleet: packageFleet(t, v) }, cost: packageCost(s, t, v), gain });
  }
  if (unlocked(s, 'store')) {
    const storeLot = collectionLot(s, w, 'store', land);
    if (storeLot) {
      const withStore = withPlaced(w, s, { [storeLot]: 'store' }), G2 = geography(withStore, connected(withStore.map)), j = G2.commerce.findIndex((x) => x.key === storeLot);
      if (j >= 0 && G2.commerce[j]!.linked) {
        const gain = computeEconomy(BALANCE.measureRatings ? { ...withStore, homeRating: ratingsAfter(s, withStore, w) } : withStore, w).incomeTotal - c.incomeTotal;
        // a store with a gateway already in reach takes the produce alone; before the trading post opens, say it is coming
        options.push({ ...base, option: unlocked(s, 'tradingPost') ? 'store' : 'storeEarly', action: { kind: 'collect', building: 'store', land, lot: storeLot }, cost: costOf('store', s.milestone), gain });
      } else if (unlocked(s, 'waystation')) {
        const wayLot = collectionLot(withStore, w, 'waystation', null, storeLot);
        if (wayLot) {
          const gain = computeEconomy(withPlacedRated(w, s, { [storeLot]: 'store', [wayLot]: 'waystation' }, { [wayLot]: { muleTrain: PACKAGE } }), w).incomeTotal - c.incomeTotal;
          options.push({ ...base, option: 'storePackage', action: { kind: 'collect', building: 'store', land, lot: storeLot, with: ['waystation'], fleet: packageFleet('waystation', 'muleTrain') }, cost: costOf('store', s.milestone) + packageCost(s, 'waystation', 'muleTrain'), gain });
        }
      }
    }
  }
  const best = options.filter((o) => o.gain >= 15).sort((p, q) => workWeight(q.cost, q.gain) - workWeight(p.cost, p.gain))[0];
  return best ?? null;
}

/** The advisor's list, with the review fixes: costs and blocking, province requests, far-land packages, producer fixes. */
export function advise(s: GameState, w: World): Advice[] {
  const c = computeEconomy(s, w);
  let list = ruleAdvice(s, w);
  const add = (a: Omit<Advice, 'blocked'>) => list.push({ ...a, blocked: false });
  // far fields: a measured collection point or store package replaces the prototype's lone store
  const far = farLandPlan(s, w, c);
  if (far) {
    list = list.filter((y) => !(y.rule === 'noCollection' && y.params.land === far.land));
    add({ rule: `farLand.${far.option}`, weight: workWeight(far.cost, far.gain), params: { land: far.land, fields: far.fields, lost: Math.round(far.lostOnFoot), cost: far.cost, gain: Math.round(far.gain), ...(far.action.kind === 'collect' ? { building: far.action.building } : {}) }, action: far.action, cost: far.cost });
  }
  // the producer losing the most on the way, and what fixes it
  // only producers losing a real share, and not a field replanted in the last year (no churning back and forth)
  for (const o of worstOutlets(s, c).filter((x) => x.share < 0.85 && !((s.firstHarvest?.[x.key] ?? -Infinity) > s.market.t - 4)).slice(0, 3)) {
    const fix = producerFix(s, w, o.key, c);
    if (!fix || fix.gain < 15) continue;
    const same = (y: Advice) => JSON.stringify(y.action) === JSON.stringify(fix.action) || (y.action?.kind === 'swap' && fix.action.kind === 'swap' && y.action.from === fix.action.from && y.action.to === fix.action.to);
    const dup = list.some(same);
    if (!dup) add({ rule: fix.rule, weight: Math.min(76, workWeight(fix.cost, fix.gain)), params: { ...fix.params, key: o.key, share: Math.round(o.share * 100), lost: Math.round(o.lost) }, action: fix.action, cost: fix.cost });
    break;
  }
  // room to build: the advisor asks for streets before the lots along them run out (the prototype never did)
  { const room = roomByStreets(s, w), line = room < 6 ? streetLine(s, w) : null;
    if (line) add({ rule: 'streets.room', weight: 74, params: { lots: room, n: 4, cost: 20, gain: line.lots }, action: { kind: 'streets', from: line.from, to: line.to }, cost: 20 }); }
  // with the deadline near or the colony behind its pace, what the milestone asks for comes first: worth saving for
  if (MILESTONES[s.milestone + 1]) {
    const pace = goalPace(s, w), left = s.deadline - s.market.t;
    // above the idle-hands investments (up to about 87), so the cash goes to the goal; more so in the last three years
    if (left <= 24 || (pace && pace.behind > 0.15)) for (const y of list) if (y.rule === 'milestoneBuilding' || y.rule === 'milestoneLands') y.weight = Math.max(y.weight, left <= 12 ? 92 : 88);
    // and while the goal still lacks buildings or lands, new jobs wait: they pay the families, not the purse
    if ((left <= 24 || (pace && pace.behind > 0.15)) && list.some((y) => y.rule === 'milestoneBuilding' || y.rule === 'milestoneLands'))
      for (const y of list) if (y.rule === 'idle.invest' || y.rule === 'idle.jobs' || y.rule === 'chain' || y.rule === 'cropSwap') y.weight = Math.min(y.weight, 79);
    // the title comes with a level: near the deadline, new collection points and gateways (which pay the families
    // over years) wait behind what the goal and its level ask for; filling and fixing the ones that exist does not
    const titleLevel = LEVELS.find((l) => l.milestone === s.milestone + 1), employed = allocate(s).employed;
    if (left <= 24 && titleLevel && s.level < titleLevel.level) {
      for (const y of list) if (/^(farLand\.|noCollection$|noGateway$)/.test(y.rule)) y.weight = Math.min(y.weight, 79);
      // short of the workers that level asks for, with the goal's own buildings done: jobs first
      if (employed < titleLevel.workers && !list.some((y) => y.rule === 'milestoneBuilding' || y.rule === 'milestoneLands'))
        for (const y of list) if (y.rule === 'levelWorkers' || y.rule === 'idle.invest' || y.rule === 'idle.jobs' || y.rule.startsWith('pierFullIdle')) y.weight = Math.max(y.weight, y.rule === 'levelWorkers' ? (left <= 12 ? 93 : 89) : left <= 12 ? 92 : 88);
    }
    // families weigh most in the milestone and only come to empty homes: behind on them, homes come even with idle
    // hands (the prototype held huts back above 30% idle, so an advisor-led colony fell far short of its families)
    const tg = MILESTONES[s.milestone + 1] as MilestoneDef, missing = Math.ceil(Math.round((tg.families ?? 0) * (1 + (s.extraDemand || 0) * 0.05)) / familySpare()) - Object.keys(s.families).length;
    // and when the families still missing need more than one new family a season to arrive in time
    const needRate = missing / Math.max(1, left);
    if (missing > 0 && ((pace && pace.behind > 0) || left <= 16 || needRate > 1) && emptySlots(s).length < 8 && !list.some((y) => y.rule === 'milestoneFamilies'))
      add({ rule: 'milestoneFamilies', weight: needRate > 1.5 ? 87 : 80, params: { milestone: tg.id, n: missing, raised: (s.extraDemand || 0) * 5, cost: costOf('hut', s.milestone) }, action: { kind: 'build', building: 'hut' }, cost: costOf('hut', s.milestone) });
  }
  // the province: more time when the deadline is close and goals are missing; extra funds when cash runs out
  const target = MILESTONES[s.milestone + 1];
  if (target && list.some((y) => y.rule === 'deadline') && s.influence >= 6 && !s.extendedDeadline && !s.intervention)
    add({ rule: 'province.extraTime', weight: 99, params: { influence: 6, seasons: 4, milestone: target.id }, action: { kind: 'province', request: 'extraTime' }, cost: 0 });
  if (s.influence >= 4 && list.some((y) => y.rule === 'cash.negative' || y.rule === 'cash.runningOut'))
    add({ rule: 'province.extraFunds', weight: 89, params: { influence: 4, cash: 400, demand: ((s.extraDemand || 0) + 1) * 5 }, action: { kind: 'province', request: 'extraFunds' }, cost: 0 });
  // the race: a train station first, then the markets falling behind the rivals
  if (s.race) {
    const stations = (Object.keys(s.map.buildings) as LotKey[]).filter((k) => s.map.buildings[k] === 'trainStation');
    const comp = c.transport.competitiveness, vol = c.transport.destVolume;
    if (!stations.length) add({ rule: 'race.station', weight: 78, params: { cost: costOf('trainStation', s.milestone) }, action: { kind: 'build', building: 'trainStation' }, cost: costOf('trainStation', s.milestone) });
    else if (stations.every((k) => !Object.keys(railExits(s, k)).length)) add({ rule: 'race.rails', weight: 76, params: {}, action: { kind: 'screen', screen: 'transport' }, cost: 0 });
    const behind = (Object.keys(comp) as DestinationId[]).filter((d) => (vol[d] ?? 0) > 0 && comp[d] < 0.8).sort((a, b) => comp[a] - comp[b])[0];
    if (behind) add({ rule: 'race.behind', weight: 82, params: { destination: behind, share: Math.round(comp[behind] * 100) }, action: { kind: 'screen', screen: 'transport' }, cost: 0 });
    if (s.race.decline) add({ rule: 'race.decline', weight: 98, params: { n: s.race.decline.left }, action: { kind: 'screen', screen: 'transport' }, cost: 0 });
    const soon = raceSoon(s, c);
    if (soon) add({ rule: soon.share < 80 ? 'race.soonBehind' : 'race.soonLead', weight: soon.share < 80 ? 80 : 66, params: { destination: soon.destination, n: soon.seasons, rival: soon.rival, ours: soon.ours, share: soon.share }, action: { kind: 'screen', screen: 'transport' }, cost: 0 });
    const leave = departuresAhead(s, w, c);
    if (leave) add({ rule: 'race.departures', weight: leave.seasons <= 1 ? 94 : 86, params: { n: leave.seasons, share: leave.share, gain: leave.gain, building: leave.building, what: leave.count > 1 ? `building.${leave.building}.plural` : `building.${leave.building}`, count: leave.count, cost: leave.cost }, action: { kind: 'build', building: leave.building as BuildingId }, cost: leave.cost });
  }
  for (const y of list) { if (!y.cost) y.cost = actionCost(s, y.action); y.blocked = y.cost > Math.max(0, s.cash); }
  return list.sort((p, q) => q.weight - p.weight);
}
