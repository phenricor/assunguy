// The colony's accounts by district. The economy stays one (one market, one set of exports): each district is a
// way of reading it, and of setting goals on it. Its people (families, who works, who is idle, how they rate their
// homes and which services they lack), its jobs, and what its buildings make: each arroba of a good is credited to
// the buildings that make that good in proportion to their place and level, and the cargo's way out (sent, reached
// a buyer, lost on foot) is each producer's own.
import { BUILDINGS, type BuildingId, type GoodId } from '@assunguy/data';
import { computeDistricts, type District, type DistrictName, type Districts } from './districts.js';
import { computeEconomy, def, slotsOf, upkeepOf, type Economy } from './economy.js';
import { rateHomes, type Ratings, type Service } from './ratings.js';
import { homeOf, type FamilyId, type GameState } from './state.js';
import type { LotKey, World } from './world.js';

export interface DistrictAccount {
  id: LotKey; name: DistrictName; color: number; hamlet: boolean;
  homes: number; buildings: number;
  families: number; working: number; idle: number;
  /** Jobs in the district's buildings, and how many are taken. */
  jobs: number; filled: number;
  /** Homes that lack each service. */
  missing: Partial<Record<Service, number>>;
  /** Mean rating of the district's homes (weighted by families). */
  satisfaction: number;
  /** Arrobas a year, by where they go. */
  produced: number; ownTable: number; soldHere: number; exported: number; lost: number;
  /** Families' income a year from what the district makes. */
  income: number;
  /** Share of the district's surplus that reaches a buyer, and arrobas lost on the way on foot. */
  reach: number; onFoot: number;
  /** Arrobas a year that do not reach a buyer, by why. */
  lostBy: { onFoot: number; collection: number; noGateway: number; gatewayFull: number; noBuyer: number };
  /** Upkeep a year of the district's buildings. */
  upkeep: number;
  /** What it makes most, by income. */
  goods: { good: GoodId; produced: number; income: number }[];
}

const MINE_GOODS = ['lime', 'lead', 'gold', 'iron'] as GoodId[];
function goodsOf(t: BuildingId): GoodId[] {
  if (t === 'mine') return MINE_GOODS;
  const T = def(t);
  return [...(T.output ? [T.output.good] : []), ...(T.extraOutputs ?? []).map((x) => x.good), ...(T.recipes ?? []).map((x) => x.to)] as GoodId[];
}

export function districtAccounts(s: GameState, w: World, c: Economy = computeEconomy(s, w), D: Districts = computeDistricts(s, w), R: Ratings = rateHomes(s, w)): DistrictAccount[] {
  const byLot: Record<LotKey, LotKey> = {};
  for (const d of D.info) for (const k of d.buildings) byLot[k] = d.id;
  // each good's makers and their weights (place and level factor)
  const makers: Partial<Record<GoodId, { key: LotKey; f: number }[]>> = {};
  for (const k of Object.keys(s.map.buildings) as LotKey[]) {
    const t = s.map.buildings[k] as BuildingId;
    if (!(t in BUILDINGS)) continue;
    const f = c.counts.factor[k] ?? (c.counts.linked.has(k) ? 1 : 0);
    if (!f) continue;
    for (const g of goodsOf(t)) (makers[g] ??= []).push({ key: k, f });
  }
  const share: Record<LotKey, Partial<Record<GoodId, number>>> = {};
  for (const [g, list] of Object.entries(makers) as [GoodId, { key: LotKey; f: number }[]][]) {
    const tot = list.reduce((x, y) => x + y.f, 0);
    if (tot > 0) for (const m of list) (share[m.key] ??= {})[g] = m.f / tot;
  }
  const idle = new Set<FamilyId>(c.counts.work.idle.map((f) => f.id));
  const famByHome: Record<LotKey, FamilyId[]> = {};
  for (const id of Object.keys(s.families) as FamilyId[]) (famByHome[homeOf(id)] ??= []).push(id);
  const per = (x: Partial<Record<GoodId, number>>, g: GoodId) => x[g] ?? 0;
  return D.info.map((d: District) => {
    const fams = d.homes.flatMap((h) => famByHome[h] ?? []);
    const idleN = fams.filter((f) => idle.has(f)).length;
    let jobs = 0, filled = 0, upkeep = 0, sent = 0, delivered = 0, onFoot = 0;
    const lostBy = { onFoot: 0, collection: 0, noGateway: 0, gatewayFull: 0, noBuyer: 0 };
    const tot = { produced: 0, ownTable: 0, soldHere: 0, exported: 0, lost: 0, income: 0 };
    const byGood: Partial<Record<GoodId, { produced: number; income: number }>> = {};
    for (const k of d.buildings) {
      const t = s.map.buildings[k] as BuildingId;
      if (!(t in BUILDINGS)) continue;
      jobs += slotsOf(s, k); filled += c.counts.work.byBuilding[k]?.families.length ?? 0;
      upkeep += upkeepOf(t, s.milestone) * 4;
      const o = c.outlet[k];
      if (o) { sent += o.sent; delivered += o.delivered; onFoot += o.lost.onFoot; for (const k of Object.keys(lostBy) as (keyof typeof lostBy)[]) lostBy[k] += o.lost[k]; }
      for (const [g, f] of Object.entries(share[k] ?? {}) as [GoodId, number][]) {
        const p = per(c.produced, g) * f, inc = per(c.income, g) * f;
        tot.produced += p; tot.ownTable += per(c.ownTable, g) * f; tot.soldHere += per(c.market, g) * f; tot.exported += per(c.exported, g) * f; tot.lost += per(c.lost, g) * f; tot.income += inc;
        const b = (byGood[g] ??= { produced: 0, income: 0 }); b.produced += p; b.income += inc;
      }
    }
    // the homes' rating and the services they lack
    let rs = 0, rn = 0;
    const missing: Partial<Record<Service, number>> = {};
    for (const h of d.homes) {
      const r = R.homes[h], n = (famByHome[h] ?? []).length || 1;
      if (!r) continue;
      rs += r.rating * n; rn += n;
      for (const it of r.items) if (it.kind === 'outOfReach') missing[it.service] = (missing[it.service] ?? 0) + 1;
    }
    const round = (x: number) => Math.round(x);
    return {
      id: d.id, name: d.name, color: d.color, hamlet: d.hamlet,
      homes: d.homes.length, buildings: d.buildings.length,
      families: fams.length, working: fams.length - idleN, idle: idleN,
      jobs, filled, missing,
      satisfaction: rn ? round(rs / rn) : 0,
      produced: round(tot.produced), ownTable: round(tot.ownTable), soldHere: round(tot.soldHere), exported: round(tot.exported), lost: round(tot.lost), income: round(tot.income),
      reach: sent > 0 ? delivered / sent : 1, onFoot: round(onFoot),
      lostBy: { onFoot: round(lostBy.onFoot), collection: round(lostBy.collection), noGateway: round(lostBy.noGateway), gatewayFull: round(lostBy.gatewayFull), noBuyer: round(lostBy.noBuyer) },
      upkeep: round(upkeep),
      goods: (Object.entries(byGood) as [GoodId, { produced: number; income: number }][]).map(([g, v]) => ({ good: g, produced: round(v.produced), income: round(v.income) })).sort((a, b) => b.income - a.income).slice(0, 4),
    };
  });
}
