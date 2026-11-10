// The colony's purse and its standing with the province: grants, upkeep, relief works, great works,
// the twice-yearly report, and the goals (levels and milestones with deadlines).
import { BALANCE, BUILDINGS, GREAT_WORKS, VEHICLES, GREAT_WORK_IDS, LEVELS, MILESTONES, type BuildingId, type GreatWorkId, type LevelDef, type MilestoneDef } from '@assunguy/data';
import { allocate, computeEconomy, def, hasRoad, upkeepOf, type Economy } from './economy.js';
import { connected } from './network.js';
import { rateHomes, updateRatings } from './ratings.js';
import { workDone, type FamilyId, type GameState } from './state.js';
import { fleetUpkeep } from './transport.js';
import { RELIEF_WAGE } from './families.js';
import type { LotKey, World } from './world.js';

const RELIEF_WORK_ADVANCE = 0.03;
const RELIEF_FREIGHT = 0.15;
const RELIEF_NEED = { building: 2, large: 3, streetsPerFamily: 4, upgrade: 1, greatWork: 15 };
export const WASTE_LIMIT = 0.25;
export const NEWCOMER_WAGE = 2;

export const streetUpkeep = (milestone: number): number => [0.1, 0.1, 0.15, 0.3][milestone] ?? 0.3;
export const greatWorksUpkeep = (s: GameState): number => GREAT_WORK_IDS.reduce((x, id) => x + (workDone(s, id) ? GREAT_WORKS[id].upkeep : 0), 0);
export const cityServices = (s: GameState): number => (s.milestone >= 3 ? Object.keys(s.families).length * 0.8 : 0);
export const grantFactor = (s: GameState): number => ((s.grantCut ?? 0) > 0 ? 0.7 : 1) * (s.intervention ? 0.5 : 1);
export const milestoneDef = (i: number): MilestoneDef | undefined => MILESTONES[i];
export const levelDef = (n: number): LevelDef | undefined => LEVELS.find((l) => l.level === n);
export const wasteShare = (c: Economy): number => (c.producedTotal > 0 ? c.lostTotal / c.producedTotal : 0);

/** Upkeep per season: buildings, streets, great works and, in a town, city services. */
export const upkeepPerSeason = (s: GameState): number =>
  Object.values(s.map.buildings).reduce((x, t) => x + upkeepOf(t as BuildingId, s.milestone), 0) + Object.keys(s.map.streets).length * streetUpkeep(s.milestone) + greatWorksUpkeep(s) + cityServices(s);

// ---- relief works: idle families earn a day wage from the purse to keep roads or help a great work

export interface ReliefItem { id: 'buildings' | 'streets' | 'upgrades' | GreatWorkId | 'roads'; count?: number; need: number; staffed: number; greatWork?: boolean }
export interface ReliefPlan { items: ReliefItem[]; idle: number; staffed: number; need: number; cost: number; freightCut: number }
const roadsNeed = (s: GameState) => Math.max(8, Math.ceil(Object.keys(s.map.streets).length / 25));

/** What the works ask for this season and how many idle families the purse can pay. Always on. */
export function reliefPlan(s: GameState): ReliefPlan {
  const items: ReliefItem[] = [];
  const built = (Object.keys(s.seasonWork.buildings) as LotKey[]).filter((x) => s.map.buildings[x]);
  if (built.length) items.push({ id: 'buildings', count: built.length, need: built.reduce((n, x) => n + (def(s.map.buildings[x] as BuildingId).size ? RELIEF_NEED.large : RELIEF_NEED.building), 0), staffed: 0 });
  const streets = (Object.keys(s.seasonWork.streets) as LotKey[]).filter((x) => s.map.streets[x]).length;
  if (streets) items.push({ id: 'streets', count: streets, need: Math.ceil(streets / RELIEF_NEED.streetsPerFamily), staffed: 0 });
  const up = (Object.keys(s.seasonWork.upgrades) as LotKey[]).filter((x) => s.map.buildings[x]).length + (Object.keys(s.seasonWork.swaps) as LotKey[]).filter((x) => s.map.buildings[x]).length;
  if (up) items.push({ id: 'upgrades', count: up, need: up * RELIEF_NEED.upgrade, staffed: 0 });
  for (const id of GREAT_WORK_IDS) { const g = s.greatWorks[id]; if (g && g.active && !g.done) items.push({ id, need: RELIEF_NEED.greatWork, staffed: 0, greatWork: true }); }
  items.push({ id: 'roads', need: roadsNeed(s), staffed: 0 });
  const idle = allocate(s).idle.length;
  let left = Math.max(0, Math.min(idle, Math.floor(Math.max(0, s.cash) / RELIEF_WAGE)));
  for (const it of items) { it.staffed = Math.min(it.need, left); left -= it.staffed; }
  const staffed = items.reduce((n, it) => n + it.staffed, 0), roads = items[items.length - 1] as ReliefItem;
  return { items, idle, staffed, need: items.reduce((n, it) => n + it.need, 0), cost: staffed * RELIEF_WAGE, freightCut: RELIEF_FREIGHT * (roads.staffed / roads.need) };
}

/** Hires the longest-idle families, pays their wages and lets them speed up great works. Returns the plan. */
export function applyRelief(s: GameState): ReliefPlan {
  const p = reliefPlan(s);
  s.reliefWorkers = {}; s.freightRelief = p.freightCut; s.reliefCost = p.cost;
  if (!p.staffed) return p;
  for (const f of allocate(s).idle.slice().sort((x, y) => (y.idle || 0) - (x.idle || 0)).slice(0, p.staffed)) s.reliefWorkers[f.id as FamilyId] = true;
  s.cash -= p.cost;
  for (const it of p.items) if (it.greatWork && it.staffed) { const g = s.greatWorks[it.id] as NonNullable<GameState['greatWorks'][string]>; g.extra = (g.extra || 0) + it.staffed * RELIEF_WORK_ADVANCE; }
  return p;
}

export type GreatWorkNews = { work: GreatWorkId; kind: 'stalled' | 'advanced' | 'done' };
const instalment = (id: GreatWorkId) => Math.round(GREAT_WORKS[id].cost / GREAT_WORKS[id].seasons);

/** Pays one instalment of each active great work; relief works can pay whole seasons ahead at half price. */
export function advanceGreatWorks(s: GameState, news: GreatWorkNews[]): number {
  let paid = 0;
  for (const id of Object.keys(s.greatWorks) as GreatWorkId[]) {
    const g = s.greatWorks[id], G = GREAT_WORKS[id];
    if (!G || !g || g.done || !g.active) continue;
    const p = instalment(id);
    if (s.cash < p) { if (!g.stalled) news.push({ work: id, kind: 'stalled' }); g.stalled = true; continue; }
    s.cash -= p; s.buildCosts += p; paid += p; g.paid = (g.paid || 0) + 1; g.stalled = false;
    while ((g.extra || 0) >= 1 && g.paid < G.seasons && s.cash >= p / 2) { g.extra = (g.extra as number) - 1; g.paid += 1; s.cash -= p / 2; s.buildCosts += p / 2; paid += p / 2; news.push({ work: id, kind: 'advanced' }); }
    if (g.paid >= G.seasons) { g.done = true; g.active = false; news.push({ work: id, kind: 'done' }); }
  }
  if (workDone(s, 'telegraph') && s.market.t % 4 === 0) s.influence += 1;
  return paid;
}

// ---- goals

export interface GoalItem { kind: 'families' | 'road' | 'lands' | 'satisfaction' | 'building' | 'workers' | 'income'; target: number; current: number; ok: boolean; building?: BuildingId; extraDemand?: number }

/**
 * What a milestone still asks for. `meanRating` defaults to rating the homes now; 'live' re-rates the live
 * colony twice, as the prototype's `faltasDaMeta` did inside the season (the check uses the first, the
 * figure shown the second; they differ only while taxes weigh on the ratings).
 */
export function milestoneGaps(s: GameState, w: World, target: MilestoneDef, meanRating?: number | 'live'): GoalItem[] {
  const linked = connected(s.map), count: Partial<Record<BuildingId, number>> = {};
  for (const key of Object.keys(s.map.buildings) as LotKey[]) if (linked.has(key)) { const t = s.map.buildings[key] as BuildingId; count[t] = (count[t] ?? 0) + 1; }
  const fam = Object.keys(s.families).length;
  const famTarget = Math.round((target.families ?? 0) * (1 + (s.extraDemand || 0) * 0.05));
  const items: GoalItem[] = [{ kind: 'families', target: famTarget, current: fam, ok: fam >= famTarget, ...(s.extraDemand ? { extraDemand: s.extraDemand * 5 } : {}) }];
  if (target.road) { const r = hasRoad(s); items.push({ kind: 'road', target: 1, current: r ? 1 : 0, ok: r }); }
  if (target.lands) { const n = Object.values(s.map.lands).filter((x) => x === 'ours').length; items.push({ kind: 'lands', target: target.lands, current: n, ok: n >= target.lands }); }
  const first = meanRating === 'live' ? updateRatings(s, w).mean : meanRating ?? rateHomes(s, w).mean, mean = meanRating === 'live' ? updateRatings(s, w).mean : first;
  items.push({ kind: 'satisfaction', target: target.satisfaction ?? 0, current: mean, ok: first >= (target.satisfaction ?? 0) });
  for (const [t, q] of Object.entries(target.requires ?? {}) as [BuildingId, number][]) {
    const have = (count[t] ?? 0) + (t === 'chapel' ? count.church ?? 0 : 0);
    items.push({ kind: 'building', building: t, target: q, current: have, ok: have >= q });
  }
  return items;
}

/** What the next level asks for: families at work, yearly income, buildings, and the milestone it carries. */
export function levelRequirements(s: GameState, w: World, n: number, c: Economy, live = false): GoalItem[] {
  const lv = levelDef(n) as LevelDef, workers = allocate(s).employed;
  const items: GoalItem[] = [{ kind: 'workers', target: lv.workers, current: workers, ok: workers >= lv.workers }, { kind: 'income', target: lv.income, current: c.incomeTotal, ok: c.incomeTotal >= lv.income }];
  for (const [t, q] of Object.entries(lv.requires ?? {}) as [BuildingId, number][]) { const have = Object.values(s.map.buildings).filter((x) => x === t).length; items.push({ kind: 'building', building: t, target: q, current: have, ok: have >= q }); }
  return lv.milestone ? items.concat(milestoneGaps(s, w, MILESTONES[lv.milestone] as MilestoneDef, live ? 'live' : undefined)) : items;
}

/** How much of the milestone is done against how much of the deadline has passed (families weigh 80%). */
export function goalPace(s: GameState, w: World, meanRating?: number | 'live'): { milestone: string; time: number; done: number; behind: number } | null {
  const target = MILESTONES[s.milestone + 1];
  if (!target) return null;
  const start = s.goalStart, total = Math.max(1, s.deadline - start), time = Math.min(1, Math.max(0, (s.market.t - start) / total));
  if (time < 0.2) return null;
  const items = milestoneGaps(s, w, target, meanRating), fam = items[0] as GoalItem, famF = Math.min(1, fam.current / Math.max(1, fam.target)), rest = items.slice(1), restF = rest.length ? rest.filter((x) => x.ok).length / rest.length : 1;
  const done = famF * 0.8 + restF * 0.2;
  return { milestone: target.id, time, done, behind: time - done };
}

export type ProvinceReason = 'satisfied' | 'dissatisfied' | 'inTheRed' | 'cashFell' | 'behindPace' | 'aheadOfPace' | 'wasted';
/**
 * Every two seasons the province scores the colony and sets the grant: +10% with 2 points, −15% at −1,
 * −30% at −2. (The prototype also scored lot instalments paid on time; that rule is gone.)
 */
export function provinceReport(s: GameState, w: World, halfYearBalance: number, c: Economy, meanRating: number) {
  const reasons: { reason: ProvinceReason; params?: Record<string, number | string> }[] = [];
  let score = 0;
  if (meanRating >= 60) { score += 1; reasons.push({ reason: 'satisfied' }); } else if (meanRating < 45) { score -= 1; reasons.push({ reason: 'dissatisfied' }); }
  if (s.cash < 0) { score -= 1; reasons.push({ reason: 'inTheRed' }); } else if (halfYearBalance < -500) { score -= 1; reasons.push({ reason: 'cashFell' }); }
  const p = goalPace(s, w, 'live');
  if (p) {
    if (p.behind > 0.15) { score -= p.behind > 0.3 ? 2 : 1; reasons.push({ reason: 'behindPace', params: { milestone: p.milestone, done: Math.round(p.done * 100), time: Math.round(p.time * 100) } }); }
    else if (p.behind < -0.1) { score += 1; reasons.push({ reason: 'aheadOfPace', params: { milestone: p.milestone } }); }
  }
  if (wasteShare(c) > WASTE_LIMIT) { score -= 1; reasons.push({ reason: 'wasted', params: { share: Math.round(wasteShare(c) * 100) } }); }
  const factor = score >= 2 ? 1.1 : score <= -2 ? 0.7 : score <= -1 ? 0.85 : 1;
  s.grantFactor = factor;
  return { score, reasons, factor };
}

/** One season of transport: volumes that set next season's tariffs, firewood, fleet costs and tariff income. */
export function advanceTransport(s: GameState, c: Economy): { fleetCost: number; tariffIncome: number; firewoodShortageStarted: boolean; fullCollections: LotKey[] } {
  const R = c.transport;
  const volume: Record<LotKey, number> = {};
  for (const x of R.collections) volume[x.key] = x.carried / 4;
  for (const x of R.gateways) volume[x.key] = x.volume / 4;
  s.transport.volume = volume;
  const cost = R.fleetCost, wanted = firewoodWanted(s), have = (c.produced.firewood || 0) / 4, missing = Math.max(0, wanted - have);
  let firewoodPaid = 0, short = 0;
  if (missing > 0) { const cu = missing * FIREWOOD_PRICE; if (s.cash >= cu) firewoodPaid = cu; else short = Math.min(1, missing / Math.max(1, wanted)); }
  const started = !!short && !s.transport.firewoodShortage;
  s.transport.firewoodShortage = short;
  const income = R.tariffs / 4;
  s.cash += income - cost - firewoodPaid;
  s.transport.last = { margin: R.meanMargin, loss: c.producedTotal > 0 ? wasteShare(c) : 0 };
  const m = R.mode, tot = Object.values(m).reduce((x, y) => x + y, 0);
  s.transportHistory = [...(s.transportHistory ?? []), { t: s.market.t, hauled: Math.round((tot - m.lost) / 4), lost: Math.round(m.lost / 4), delivered: Math.round(R.delivered), lostValue: Math.round(R.lostValue) }].slice(-16);
  const fullCollections: LotKey[] = [];
  const notes = (s.transport.fullNoted ??= {});
  for (const x of R.collections) {
    const full = x.capacity > 0 && x.peak >= 0.9;
    if (full && !notes[x.key]) { notes[x.key] = 1; fullCollections.push(x.key); } else if (!full) delete notes[x.key];
  }
  return { fleetCost: Math.round(cost + firewoodPaid), tariffIncome: Math.round(income), firewoodShortageStarted: started, fullCollections };
}
const FIREWOOD_PRICE = BALANCE.firewoodPrice;
/** Firewood the steamboats and trains burn per season. */
export function firewoodWanted(s: GameState): number {
  let q = 0;
  for (const key of Object.keys(s.fleet) as LotKey[]) for (const [v, n] of Object.entries(s.fleet[key] ?? {})) q += (n ?? 0) * ((VEHICLES as Record<string, { firewood?: number }>)[v]?.firewood ?? 0);
  return q;
}
export { BUILDINGS, computeEconomy, fleetUpkeep };
