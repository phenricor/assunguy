// Home ratings (0 to 100): services within street reach, goods for sale, nuisances next door, the
// colony-wide mood (events, laws, choices, city problems, transport), the tax burden and what the
// current milestone demands. A family works better in a better home (see economy.ts).
import { BUILDINGS, GOOD_IDS, LAWS, type BuildingId, type GoodId, type Sector } from '@assunguy/data';
import { computeEconomy, def, good, SECTOR_ORDER, sectorOf, type Economy } from './economy.js';
import { currentPrice } from './market.js';
import { connected, distanceToFootprint, reach, streetsBeside } from './network.js';
import { hasChoice, homeOf, upgradeOf, workDone, type FamilyId, type GameState } from './state.js';
import { lotKey, parseKey, type LotKey, type World } from './world.js';
import type { NatureKind } from './map.js';

export type Service = 'faith' | 'school' | 'health' | 'commerce' | 'water' | 'culture';
const SERVICES: Service[] = ['faith', 'school', 'health', 'commerce', 'water', 'culture'];
const SERVICE_VALUE: Record<Service, number> = { faith: 12, school: 12, health: 12, commerce: 12, water: 10, culture: 6 };
/** Goods better homes like to find for sale. */
const WANTS: Partial<Record<BuildingId, GoodId[]>> = { house: ['tools', 'cloth'], whitewashedHouse: ['tools', 'cloth', 'rapadura', 'shoes'], townhouse: ['tools', 'cloth', 'rapadura', 'shoes', 'furniture', 'driedCoffee'] };
const NUISANCE_PENALTY = [0, 30, 20, 10];
const MILESTONE_DEMAND = [0, 4, 8, 12];
const NATURAL_WATER: Partial<Record<NatureKind, 'stream' | 'brook' | 'oxbow' | 'sinkhole'>> = { stream: 'stream', brook: 'brook', waterfall: 'brook', oxbow: 'oxbow', wetSinkhole: 'sinkhole' };

export type RatingItem =
  | { kind: 'service'; service: Service; streets: number; value: number }
  | { kind: 'naturalWater'; source: 'stream' | 'brook' | 'oxbow' | 'sinkhole'; value: number }
  | { kind: 'outOfReach'; service: Service }
  | { kind: 'forSale'; good: GoodId; found: boolean; value: number }
  | { kind: 'nuisance'; building: BuildingId; lots: number; value: number }
  | { kind: 'colony'; reason: string; params?: Record<string, string | number>; value: number }
  | { kind: 'taxes'; value: number }
  | { kind: 'milestoneDemand'; milestone: number; value: number }
  | { kind: 'unlinked'; cap: number };

export interface Ratings {
  homes: Record<LotKey, { rating: number; items: RatingItem[] }>;
  linked: Set<LotKey>;
  /** Mean rating weighted by the families living in each home. */
  mean: number;
  families: number;
  health: number;
}

export const serviceOf = (t: BuildingId): Service | undefined => def(t).service as Service | undefined;
export const serviceRadius = (s: GameState, key: LotKey): number => {
  const t = s.map.buildings[key] as BuildingId;
  return (def(t).radius ?? 0) + 3 * upgradeOf(s, key) + ((t === 'school' && hasChoice(s, 'publicSchool')) || ((t === 'chapel' || t === 'church') && hasChoice(s, 'brotherhoods')) ? 6 : 0);
};

/** Water nature gives: a brook, oxbow or flooded sinkhole within two lots of the home. */
export function naturalWater(s: Pick<GameState, 'map'>, a: number, b: number): 'stream' | 'brook' | 'oxbow' | 'sinkhole' | null {
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) { const t = s.map.nature[lotKey(a + x, b + y)]; if (t && NATURAL_WATER[t]) return NATURAL_WATER[t] as 'stream'; }
  return null;
}

/** Colony-wide satisfaction items, the same for every home. */
export function colonyMood(s: GameState): { reason: string; params?: Record<string, string | number>; value: number }[] {
  const items: { reason: string; params?: Record<string, string | number>; value: number }[] = [];
  for (const e of s.effects) items.push({ reason: e.reason, ...(e.params ? { params: e.params } : {}), value: e.satisfaction ?? 0 });
  for (const id of Object.keys(s.laws)) { const sat = (LAWS as Record<string, { satisfaction: number }>)[id]?.satisfaction; if (s.laws[id] && sat) items.push({ reason: `law.${id}`, value: sat }); }
  const families = Object.keys(s.families).length;
  if (s.variety !== undefined && s.variety >= 4) items.push({ reason: 'mood.variedTable', value: 2 });
  else if (s.variety === 3) items.push({ reason: 'mood.variedTable', value: 1 });
  else if (s.variety !== undefined && s.variety <= 1 && families > 20) items.push({ reason: 'mood.poorTable', value: -2 });
  if (hasChoice(s, 'familyWorkshop')) items.push({ reason: 'choice.familyWorkshop', value: 3 });
  if (hasChoice(s, 'manufacture')) items.push({ reason: 'choice.manufacture', value: -3 });
  if (hasChoice(s, 'brotherhoods')) items.push({ reason: 'choice.brotherhoods', value: 2 });
  // city problems
  if (families > 150) { const q = Math.min(6, Math.floor((families - 150) / 40)); if (q) items.push({ reason: 'mood.bigCity', value: -q }); }
  if (Object.values(s.map.buildings).includes('theater')) items.push({ reason: 'mood.theater', value: 2 });
  if (workDone(s, 'hospital')) items.push({ reason: 'mood.hospital', value: 2 });
  if (s.problems.epidemic) items.push({ reason: 'mood.epidemic', value: workDone(s, 'hospital') ? -2 : -5 });
  if (s.problems.disorder) items.push({ reason: 'mood.disorder', value: -3 });
  // transport
  const u = s.transport.last;
  if (u) {
    if (u.margin >= 0.05) items.push({ reason: 'mood.highTariffs', value: -Math.max(1, Math.round(u.margin * 10)) });
    else if (u.margin <= -0.05) items.push({ reason: 'mood.subsidizedFreight', value: Math.max(1, Math.round(-u.margin * 10)) });
    if (u.loss > 0.15) items.push({ reason: 'mood.lostOnTheWay', value: -Math.max(1, Math.round((u.loss - 0.15) * 20)) });
  }
  return items;
}

// ---- taxes

export type TaxGroup = Sector | 'idle';
export interface TaxGroupEffect { group: TaxGroup; families: number; before: number; after: number; total: number; weight: number; drop: number }
export interface TaxEffect { economy: Economy; groups: TaxGroupEffect[]; familiesAtRisk: number; businessesAtRisk: number; revenue: number }

/** Who pays what: income before and after taxes for each group of families. */
export function taxEffect(s: GameState, w: World, economy = computeEconomy(s, w)): TaxEffect {
  const c = economy, a = c.counts.work;
  const income: Record<TaxGroup, number> = { farming: 0, river: 0, crafts: 0, mining: 0, commerce: 0, services: 0, idle: 0 };
  const pays: Record<TaxGroup, number> = { farming: 0, river: 0, crafts: 0, mining: 0, commerce: 0, services: 0, idle: 0 };
  let turnover = 0;
  for (const g of GOOD_IDS) {
    const grp = good(g).group as TaxGroup;
    income[grp] += c.income[g] + c.ownTable[g] * good(g).localPrice;
    pays[grp] += c.tax.tithe[g] + c.tax.export[g];
    turnover += c.market[g] * good(g).localPrice + c.exported[g] * currentPrice(s.market, g);
  }
  for (const k of Object.keys(income) as TaxGroup[]) income[k] = Math.max(0, income[k]);
  income.commerce = turnover * 0.2;
  const businesses = (c.counts.n.store ?? 0) + (c.counts.n.market ?? 0);
  pays.commerce += c.revenue.businessTax;
  const fam = {} as Record<TaxGroup, number>;
  for (const sec of SECTOR_ORDER) fam[sec] = a.bySector[sec].filled;
  fam.idle = a.idle.length;
  income.services = fam.services * 14;
  income.idle = fam.idle * 8;
  const perFamily = s.taxes.lotInstallment?.general || 0;
  const groups = (Object.keys(fam) as TaxGroup[]).filter((g) => fam[g] > 0).map((g) => {
    const total = pays[g] + perFamily * fam[g];
    const weight = income[g] > 0 ? total / income[g] : total > 0 ? 1 : 0;
    return { group: g, families: fam[g], before: income[g] / fam[g], after: (income[g] - total) / fam[g], total, weight, drop: Math.round(Math.min(45, weight * 70)) };
  });
  let familiesAtRisk = 0;
  for (const x of groups) if (x.group !== 'commerce' && x.total > 0) { if (x.after < 3) familiesAtRisk += x.families; else if (x.after < 5) familiesAtRisk += Math.ceil(x.families / 2); }
  const com = groups.find((x) => x.group === 'commerce');
  const businessesAtRisk = com && businesses ? ((com.after * com.families) / businesses < 12 && com.total > 0 ? businesses : 0) : 0;
  return { economy: c, groups, familiesAtRisk, businessesAtRisk, revenue: c.revenue.total };
}

/** Rating points each family loses to taxes, or null when no tax is in force. */
export function taxBurden(s: GameState, w: World): Partial<Record<FamilyId, number>> | null {
  if (!Object.values(s.taxes).some(Boolean)) return null;
  const ef = taxEffect(s, w);
  const drop: Partial<Record<TaxGroup, number>> = {};
  for (const x of ef.groups) drop[x.group] = x.drop;
  const a = ef.economy.counts.work, out: Partial<Record<FamilyId, number>> = {};
  for (const key of Object.keys(a.byBuilding) as LotKey[]) for (const f of (a.byBuilding[key] as { families: { id: FamilyId }[] }).families) out[f.id] = drop[sectorOf(s.map.buildings[key] as BuildingId) as Sector] ?? 0;
  for (const f of a.idle) out[f.id] = drop.idle ?? 0;
  return out;
}

/** Rates every home. Also returns the colony's health share (water and apothecary nearby). */
export function rateHomes(s: GameState, w: World): Ratings {
  const linked = connected(s.map);
  const reachOf: Record<LotKey, Map<LotKey, number>> = {};
  const services: [LotKey, Service][] = [], nuisances: [LotKey, BuildingId, number][] = [];
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    const t = s.map.buildings[key] as BuildingId, sv = serviceOf(t), T = def(t);
    if (sv) { reachOf[key] = reach(s.map, key, serviceRadius(s, key)); if (linked.has(key)) services.push([key, sv]); }
    if (T.nuisance) nuisances.push([key, t, T.nuisance]);
  }
  const burden = taxBurden(s, w);
  const mood = colonyMood(s);
  const occupants: Partial<Record<LotKey, number>> = {};
  for (const id of Object.keys(s.families) as FamilyId[]) { const h = homeOf(id); occupants[h] = (occupants[h] ?? 0) + 1; }
  const homes: Ratings['homes'] = {};
  let sum = 0, families = 0, withWater = 0, withHealth = 0;
  const demand = MILESTONE_DEMAND[Math.min(3, s.milestone)] as number;
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    const t = s.map.buildings[key] as BuildingId, T = def(t);
    if (!T.housing) continue;
    const sides = streetsBeside(s.map, key), items: RatingItem[] = [];
    let rating = 36 - demand, water = false, health = false;
    const [a, b] = parseKey(key);
    for (const sv of SERVICES) {
      let best: number | null = null, lvl = 0;
      for (const [sk, st] of services) {
        if (st !== sv) continue;
        for (const r of sides) { const d = reachOf[sk]?.get(r); if (d !== undefined) { if (best === null || d < best) best = d; lvl = Math.max(lvl, upgradeOf(s, sk)); } }
      }
      if (best !== null) {
        const v = SERVICE_VALUE[sv] + lvl * 2; rating += v; items.push({ kind: 'service', service: sv, streets: best + 1, value: v });
        if (sv === 'water') water = true;
        if (sv === 'health') health = true;
      } else if (sv === 'water' && naturalWater(s, a, b)) {
        const v = SERVICE_VALUE.water - 2; rating += v; items.push({ kind: 'naturalWater', source: naturalWater(s, a, b) as 'brook', value: v }); water = true;
      } else if (sv !== 'culture' || s.level > (BUILDINGS.theater.minLevel ?? 1)) items.push({ kind: 'outOfReach', service: sv });
    }
    for (const g of WANTS[t] ?? []) { const found = (s.supply[g] ?? 0) > 0.5; if (found) rating += 2; items.push({ kind: 'forSale', good: g, found, value: found ? 2 : 0 }); }
    let penalty = 0;
    for (const [rk, rt, range] of nuisances) {
      const d = distanceToFootprint(a, b, rk, rt);
      if (d <= range) { penalty += NUISANCE_PENALTY[d] as number; items.push({ kind: 'nuisance', building: rt, lots: d, value: -(NUISANCE_PENALTY[d] as number) }); }
    }
    rating -= Math.min(penalty, 40);
    for (const x of mood) { rating += x.value; items.push({ kind: 'colony', reason: x.reason, ...(x.params ? { params: x.params } : {}), value: x.value }); }
    if (burden) {
      let qs = 0, qn = 0;
      for (let n = 0; n < (T.housing as number); n++) { const q = burden[`${key}#${n}` as FamilyId]; if (q !== undefined) { qs += q; qn += 1; } }
      const q = qn ? Math.round(qs / qn) : 0;
      if (q) { rating -= q; items.push({ kind: 'taxes', value: -q }); }
    }
    if (demand) items.push({ kind: 'milestoneDemand', milestone: Math.min(3, s.milestone), value: -demand });
    if (!linked.has(key)) { rating = Math.min(rating, 20); items.push({ kind: 'unlinked', cap: 20 }); }
    rating = Math.max(0, Math.min(100, rating));
    homes[key] = { rating, items };
    const n = occupants[key] ?? 0;
    sum += rating * n; families += n;
    if (water) withWater += n;
    if (health) withHealth += n;
  }
  // health: from the parish on, families without water and an apothecary nearby fall ill more and work less
  const healthShare = s.milestone >= 1 && families ? (withWater + withHealth) / 2 / families : 1;
  return { homes, linked, mean: families ? Math.round(sum / families) : 0, families, health: healthShare };
}

const baseRatings = new WeakMap<GameState, Ratings>();
/**
 * The stored ratings of a colony with works placed on it (`x`, made from `s`): each home's stored rating moved by
 * what the works change in it, so a measurement compares like with like whether or not the stored ratings are fresh.
 */
export function ratingsAfter(s: GameState, x: GameState, w: World): Record<LotKey, number> {
  let base = baseRatings.get(s);
  if (!base) { base = rateHomes(s, w); baseRatings.set(s, base); }
  const next = rateHomes(x, w), out: Record<LotKey, number> = { ...s.homeRating };
  for (const [k, v] of Object.entries(next.homes) as [LotKey, { rating: number }][]) {
    const was = base.homes[k]?.rating;
    out[k] = was === undefined ? v.rating : Math.max(0, Math.min(100, (s.homeRating[k] ?? was) + v.rating - was));
  }
  return out;
}

/** Rates homes and stores the result where the next season's allocation reads it. */
export function updateRatings(s: GameState, w: World): Ratings {
  const r = rateHomes(s, w);
  s.health = r.health;
  s.homeRating = Object.fromEntries(Object.entries(r.homes).map(([k, v]) => [k, v.rating]));
  return r;
}
export { BUILDINGS };
