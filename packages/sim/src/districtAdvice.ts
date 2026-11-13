// Advice by district. A piece of advice about a lot (a building to swap, a vehicle to buy, a collection point to
// build) belongs to the district that holds the lot, and is shown on that district's screen; the advisor keeps the
// colony's own matters (taxes, the province, the race, the level) and points to a district only when something
// there is critical: families without work and no job left, cargo lost on foot, homes out of a service's reach,
// low satisfaction.
import type { DistrictAccount } from './accounts.js';
import type { Advice, AdviceAction } from './advisor.js';
import type { Districts } from './districts.js';
import type { Service } from './ratings.js';
import { parseKey, type LotKey } from './world.js';

const LOT = /^-?\d+,-?\d+$/;

/** The lot an advice is about, if any. */
export function adviceLot(a: Advice): LotKey | null {
  const x = a.action as AdviceAction | undefined;
  if (x) {
    if (x.kind === 'select' || x.kind === 'swap' || x.kind === 'buyVehicle' || x.kind === 'sellVehicle') return x.key;
    if (x.kind === 'collect') return x.lot ?? x.near ?? null;
    if (x.kind === 'build' && x.near) return x.near;
  }
  for (const k of ['at', 'key'] as const) { const v = a.params[k]; if (typeof v === 'string' && LOT.test(v)) return v as LotKey; }
  return null;
}

/** The district of a lot: the one that holds it, or else the one whose centre is nearest. */
export function districtOfLot(D: Districts, k: LotKey): LotKey | null {
  const c = D.cell[k];
  if (c) return c;
  if (!D.info.length) return null;
  const [a, b] = parseKey(k);
  return D.info.slice().sort((p, q) => Math.hypot(p.centre[0] - a, p.centre[1] - b) - Math.hypot(q.centre[0] - a, q.centre[1] - b))[0]!.id;
}

/** The advice split: the colony's own, and each district's (by the lot it is about). */
export function splitAdvice(list: Advice[], D: Districts): { colony: Advice[]; byDistrict: Record<LotKey, Advice[]> } {
  const colony: Advice[] = [], byDistrict: Record<LotKey, Advice[]> = {};
  for (const a of list) {
    const lot = adviceLot(a), d = lot && D.info.length > 1 ? districtOfLot(D, lot) : null;
    if (d) (byDistrict[d] ??= []).push(a); else colony.push(a);
  }
  return { colony, byDistrict };
}

export type DistrictProblem = 'jobs' | 'outlet' | 'service' | 'satisfaction';
export interface DistrictAlert { district: LotKey; problem: DistrictProblem; weight: number; n: number; share?: number; service?: Service; homes?: number }

/** What is critical in each district, worst first; the advisor shows these and opens the district. */
export function districtAlerts(A: DistrictAccount[]): DistrictAlert[] {
  const out: DistrictAlert[] = [];
  // families work anywhere in the colony: a district is short of jobs when it is worse off than the colony, and
  // only the two worst say so
  const fam = A.reduce((x, y) => x + y.families, 0), share = fam ? A.reduce((x, y) => x + y.idle, 0) / fam : 0;
  const short = new Set(A.filter((a) => a.families && a.idle >= 5 && a.idle / a.families >= Math.max(0.2, share) && a.filled >= a.jobs).sort((p, q) => q.idle - p.idle).slice(0, 2).map((a) => a.id));
  for (const a of A) {
    if (short.has(a.id)) out.push({ district: a.id, problem: 'jobs', weight: 82, n: a.idle });
    if (a.onFoot >= 30 && a.reach < 0.85) out.push({ district: a.id, problem: 'outlet', weight: 78, n: a.onFoot, share: Math.round(a.reach * 100) });
    const worst = (Object.entries(a.missing) as [Service, number][]).sort((p, q) => q[1] - p[1])[0];
    if (worst && worst[1] >= Math.max(3, a.homes * 0.3)) out.push({ district: a.id, problem: 'service', weight: 70, n: worst[1], service: worst[0], homes: a.homes });
    if (a.homes >= 3 && a.satisfaction < 55) out.push({ district: a.id, problem: 'satisfaction', weight: 74, n: a.satisfaction });
  }
  return out.sort((p, q) => q.weight - p.weight);
}
