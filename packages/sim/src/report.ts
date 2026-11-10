// What the season report and the screens show beyond the season step itself: the result of each good over
// the year (the prototype's `calculaRetorno`), a snapshot of the colony to measure what a decision changed
// (`fotoColonia`, `difColonia`), and the per-season series behind the evolution graphs (`M.serie`).
import { GOOD_IDS, MILESTONES, type BuildingId, type GoodId, type MilestoneDef } from '@assunguy/data';
import { computeEconomy, def, good, upkeepOf, type Economy } from './economy.js';
import { greatWorksUpkeep } from './province.js';
import { rateHomes } from './ratings.js';
import { hasLaw, type GameState } from './state.js';
import type { LotKey, World } from './world.js';

/** One good over the year: net result, sales, upkeep of what makes it, losses, what workshops paid for it, raw materials bought, sales by season, freight. */
export interface GoodReturn { good: GoodId; net: number; sales: number; upkeep: number; lost: number; paidByWorkshops: number; materials: number; bySeason: number[]; freight: number }

export function goodReturns(s: GameState, c: Economy): GoodReturn[] {
  const upkeep: Partial<Record<GoodId, number>> = {}, materials: Partial<Record<GoodId, number>> = {};
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    if (!c.counts.linked.has(key)) continue;
    const t = s.map.buildings[key] as BuildingId, T = def(t), cost = upkeepOf(t, s.milestone);
    if (!cost) continue;
    const outs = [...(T.output ? [T.output.good] : []), ...(T.extraOutputs ?? []).map((x) => x.good), ...(T.recipes ?? []).map((x) => x.to)].filter((g) => c.produced[g as GoodId] > 0.5) as GoodId[];
    for (const g of outs) upkeep[g] = (upkeep[g] ?? 0) + (cost * 4) / outs.length;
  }
  for (const by of Object.values(c.processedBy)) for (const [chain, x] of Object.entries(by ?? {})) { const [from, to] = chain.split('>') as [GoodId, GoodId]; materials[to] = (materials[to] ?? 0) + x * good(from).localPrice; }
  return GOOD_IDS.map((g) => {
    const m0 = upkeep[g] ?? 0;
    return { good: g, net: Math.round(c.income[g] - m0), sales: Math.round(c.sales[g]), upkeep: Math.round(m0), lost: Math.round(c.lost[g]), paidByWorkshops: Math.round(c.processed[g] * good(g).localPrice), materials: Math.round(materials[g] ?? 0), bySeason: [0, 1, 2, 3].map((e) => Math.round(Math.max(0, c.salesBySeason[e]?.[g] ?? 0))), freight: Math.round(c.freight[g] ?? 0) };
  }).filter((x) => x.sales >= 1 || x.upkeep || x.lost >= 1 || x.paidByWorkshops >= 1);
}

/**
 * The colony at a glance, to tell what a decision changed: families' income, the purse's year, market and
 * transport capacity per season, jobs, places to live, satisfaction and linked buildings. (The prototype
 * measured ox carts and canoes from its old capacity model; the port measures the gateways and collection
 * points of the transport model instead.)
 */
export interface Snapshot { income: number; purse: number; market: number; gateways: number; collections: number; jobs: number; places: number; satisfaction: number; linked: number }
export function snapshot(s: GameState, w: World, c: Economy = computeEconomy(s, w)): Snapshot {
  const upkeep = (Object.values(s.map.buildings).reduce((x, t) => x + upkeepOf(t as BuildingId, s.milestone), 0) + greatWorksUpkeep(s)) * 4;
  let places = 0;
  for (const t of Object.values(s.map.buildings)) places += def(t as BuildingId).housing ?? 0;
  return {
    income: c.incomeTotal, purse: c.revenue.total * (hasLaw(s, 'landRegistry') ? 1.1 : 1) + c.incomeTotal * ((MILESTONES[s.milestone] as MilestoneDef).shareOfTrade || 0) - upkeep,
    market: c.counts.market, gateways: c.transport.gateways.reduce((x, g) => x + g.capacity, 0), collections: c.transport.collections.reduce((x, g) => x + g.capacity, 0),
    jobs: c.counts.slots, places, satisfaction: rateHomes(s, w).mean, linked: c.counts.linked.size,
  };
}
export type Change = Partial<Snapshot>;
/** What changed between two snapshots, leaving out what barely moved. */
export function change(a: Snapshot, b: Snapshot): Change {
  const d: Change = {};
  for (const k of Object.keys(a) as (keyof Snapshot)[]) { const v = b[k] - a[k]; if (Math.abs(v) >= (k === 'satisfaction' || k === 'jobs' || k === 'places' || k === 'linked' ? 1 : 1.5)) d[k] = v; }
  return d;
}
export function addChange(to: Change, d: Change | undefined): Change { for (const k of Object.keys(d ?? {}) as (keyof Snapshot)[]) to[k] = (to[k] ?? 0) + (d![k] as number); return to; }

/** One season of the evolution graphs. */
export interface SeriesPoint {
  t: number; families: number; idle: number; outbound: number; gateways: number; collections: number; muleTrains: number; marketDemand: number; marketCapacity: number;
  sales: number; produced: number; soldHere: number; byRiver: number; byRoad: number; stuck: number; noBuyer: number; relief: number;
  production: Partial<Record<GoodId, number>>; lost: Partial<Record<GoodId, number>>;
}
export function seriesPoint(s: GameState, c: Economy): SeriesPoint {
  const production: Partial<Record<GoodId, number>> = {}, lost: Partial<Record<GoodId, number>> = {};
  for (const g of GOOD_IDS) if (c.produced[g] >= 1) { production[g] = Math.round(c.produced[g]); if (c.lost[g] >= 1) lost[g] = Math.round(c.lost[g]); }
  return {
    t: s.market.t, families: c.counts.families, idle: c.counts.work.idle.length, outbound: Math.round(c.peaks.carts.demand),
    gateways: Math.round(c.transport.gateways.reduce((x, g) => x + g.capacity, 0)), collections: Math.round(c.transport.collections.reduce((x, g) => x + g.capacity, 0)),
    muleTrains: Math.round(c.counts.muleTrains), marketDemand: Math.round(c.peaks.market.demand), marketCapacity: Math.round(c.counts.market),
    sales: Math.round(c.salesTotal), produced: Math.round(c.producedTotal), soldHere: Math.round(c.marketTotal), byRiver: Math.round(c.byRiver), byRoad: Math.round(c.byRoad),
    stuck: Math.round(c.lostBy.transport), noBuyer: Math.round(c.lostBy.buyer), relief: Object.keys(s.reliefWorkers).length, production, lost,
  };
}

/** The season's decisions, grouped as the report shows them: works by type, demolitions, event choices. */
export interface Decisions {
  works: { building: string; kind: 'built' | 'upgraded'; n: number; cost: number; change: Change }[];
  demolished: { building: string; n: number; change: Change }[];
  events: { event: string; option: number; change: Change }[];
}
export function seasonDecisions(s: GameState, t: number): Decisions {
  const works: Record<string, Decisions['works'][number]> = {}, demolished: Record<string, Decisions['demolished'][number]> = {}, events: Decisions['events'] = [];
  for (const a of s.log) {
    if (a.t !== t) continue;
    const ch = a.change as Change | undefined;
    if (a.kind === 'built' || a.kind === 'upgraded') { const k = `${a.kind}:${String(a.building)}`; const x = (works[k] ??= { building: String(a.building), kind: a.kind, n: 0, cost: 0, change: {} }); x.n += 1; x.cost += Number(a.cost ?? 0); addChange(x.change, ch); }
    if (a.kind === 'demolished') { const x = (demolished[String(a.building)] ??= { building: String(a.building), n: 0, change: {} }); x.n += 1; addChange(x.change, ch); }
    if (a.kind === 'decision') events.push({ event: String(a.event), option: Number(a.option), change: ch ?? {} });
  }
  return { works: Object.values(works), demolished: Object.values(demolished), events };
}
