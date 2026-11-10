// What each kind of building the colony already has is worth (the prototype's "Patrimônio"): what the last one
// adds to the families' income, what one more would add on a real free lot, and a verdict. Costly in a big
// colony (two economies per type), so the screen computes it after it has opened.
import { BUILDINGS, type BuildingId, type GoodId } from '@assunguy/data';
import { computeEconomy, def, good, upkeepOf, type Economy } from './economy.js';
import { withWorks } from './measure.js';
import type { GameState } from './state.js';
import type { LotKey, World } from './world.js';

export type AssetVerdict = 'worth' | 'people' | 'outlet' | 'limit' | 'not';
export interface AssetReturn {
  type: BuildingId; n: number;
  /** Income a year from one more, on a real free lot (or the last one's when there is no lot). */
  next: number;
  /** Income a year the last one adds. */
  last: number;
  noLot: boolean; upkeep: number; verdict: AssetVerdict; jobs: number; noTeam: number;
  goods?: { produced: number; soldHere: number; exported: number; lost: number; income: number };
}

const MINE_GOODS = ['lime', 'lead', 'gold', 'iron'] as GoodId[];
function goodsOf(t: BuildingId): GoodId[] {
  if (t === 'mine') return MINE_GOODS;
  const T = def(t);
  return [...(T.output ? [T.output.good] : []), ...(T.extraOutputs ?? []).map((x) => x.good), ...(T.recipes ?? []).map((x) => x.to)] as GoodId[];
}
const isAsset = (t: BuildingId) => { const T = def(t); return !!(T.output || T.extraOutputs || T.recipes || T.capacity || t === 'mine'); };

/** True when more cargo wants to leave than the gateways carry. */
export function cargoStuck(c: Economy): boolean {
  const out = c.peaks.carts.demand;
  return out >= 3 && out > c.transport.gateways.reduce((x, g) => x + g.capacity, 0) * 1.05;
}

export function assetReturns(s: GameState, w: World, c: Economy = computeEconomy(s, w)): AssetReturn[] {
  const linked = c.counts.linked, work = c.counts.work, stuck = cargoStuck(c), out: AssetReturn[] = [];
  for (const t of Object.keys(BUILDINGS) as BuildingId[]) {
    if (!isAsset(t)) continue;
    const keys = (Object.keys(s.map.buildings) as LotKey[]).filter((k) => s.map.buildings[k] === t && linked.has(k));
    if (!keys.length) continue;
    const last = Math.round(c.incomeTotal - computeEconomy(s, w, { [t]: -1 }).incomeTotal);
    const cp = withWorks(s, w, { [t]: 1 });
    const more = cp && !cp[1] ? Math.round(computeEconomy(cp[0], w).incomeTotal - c.incomeTotal) : null;
    const next = more ?? last, upkeep = upkeepOf(t, s.milestone) * 4, net = next - upkeep;
    const goods = goodsOf(t), jobs = def(t).jobs ?? 0;
    const outlet = net <= 5 && stuck && goods.some((g) => good(g).exportPrice > 0);
    const people = jobs > 0 && !work.idle.length && net <= 5;
    const verdict: AssetVerdict = people ? 'people' : outlet ? 'outlet' : net > 5 ? 'worth' : net >= -5 ? 'limit' : 'not';
    const noTeam = jobs ? keys.filter((k) => !work.byBuilding[k]?.families.length).length : 0;
    const item: AssetReturn = { type: t, n: keys.length, next, last, noLot: more === null, upkeep, verdict, jobs: jobs * keys.length, noTeam };
    if (goods.length) {
      const sum = (f: (g: GoodId) => number) => Math.round(goods.reduce((x, g) => x + (f(g) || 0), 0));
      item.goods = { produced: sum((g) => c.produced[g]), soldHere: sum((g) => c.market[g] + c.ownTable[g]), exported: sum((g) => c.exported[g]), lost: sum((g) => c.lost[g]), income: sum((g) => c.income[g]) };
    }
    out.push(item);
  }
  return out;
}
