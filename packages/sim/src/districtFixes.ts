// What a district's red numbers come from, and one or two ways out for each, measured. Jobs: the district's jobs
// are all taken while its families are idle; the ways out are the work (or the upgrade) that opens jobs here at
// the best return. Outlet: why the district's cargo does not reach a buyer (on foot, collection full, no gateway,
// gateway full, no buyer), and the district's own advice on it. Services: homes out of a service's reach, and the
// free lot of the district where that service covers most of them. Satisfaction: what weighs most on its homes.
// Costly (economies and ratings on copies), so it runs as steps the screen spreads over a few frames.
import { BUILDINGS, TRANSPORT_ROLES, type BuildingId } from '@assunguy/data';
import type { DistrictAccount } from './accounts.js';
import { serviceUpgrade, upgradeCost, type Advice, type AdviceAction } from './advisor.js';
import { districtOfLot } from './districtAdvice.js';
import type { Districts } from './districts.js';
import { computeEconomy, costOf, def, type Economy } from './economy.js';
import { lotsFor, withWorks } from './measure.js';
import { rateHomes, type Ratings, type Service } from './ratings.js';
import { upgradeOf, type GameState } from './state.js';
import type { LotKey, World } from './world.js';

/** One way out: what to do, what it costs and what it brings. */
export interface Fix {
  action: AdviceAction;
  building?: BuildingId;
  /** The advice it comes from, when it is one. */
  advice?: Advice;
  n?: number; cost: number; gain?: number; jobs?: number; covers?: number;
}
export type OutletCause = 'onFoot' | 'collection' | 'noGateway' | 'gatewayFull' | 'noBuyer';
export interface DistrictFixes {
  jobs?: { idle: number; jobs: number; outsiders: number; colonyIdle: number; fixes: Fix[] };
  outlet?: { cause: OutletCause; lost: number; share: number; fixes: Fix[] };
  services: { service: Service; n: number; homes: number; fixes: Fix[] }[];
  satisfaction?: { reasons: { kind: 'service' | 'nuisance' | 'other'; service?: Service; building?: BuildingId; reason?: string; homes: number }[]; fixes: Fix[] };
}

const ALL = Object.keys(BUILDINGS) as BuildingId[];
const isRole = (t: BuildingId) => !!(TRANSPORT_ROLES as Partial<Record<BuildingId, unknown>>)[t];
const OUTLET_RULES = /^(farLand|noCollection|noGateway|full\.|noVehicles|noSlot|outlet\.|idleFleet|producerFix|pierFull|isolated)/;

const canHave = (s: GameState, t: BuildingId) => !def(t).lateGame && (def(t).minLevel ?? 1) <= (s.level || 1);

export function* districtFixSteps(s: GameState, w: World, D: Districts, a: DistrictAccount, mine: Advice[], c: Economy = computeEconomy(s, w), R: Ratings = rateHomes(s, w)): Generator<void, DistrictFixes> {
  const inside = (k: LotKey) => districtOfLot(D, k) === a.id;
  const d = D.info.find((x) => x.id === a.id);
  const out: DistrictFixes = { services: [] };
  // ---- jobs: all taken here while families are idle
  if (a.idle > 0 && a.filled >= a.jobs) {
    const fixes: Fix[] = [];
    const cands = ALL.filter((t) => canHave(s, t) && (def(t).jobs ?? 0) > 0 && !def(t).housing && !isRole(t) && !def(t).riverside)
      .sort((p, q) => costOf(p, s.milestone) / (def(p).jobs as number) - costOf(q, s.milestone) / (def(q).jobs as number)).slice(0, 10);
    for (const t of cands) {
      const n = def(t).crop ? 5 : 1, cp = withWorks(s, w, { [t]: n } as never, inside);
      if (!cp || cp[1]) continue;
      const lots = (Object.keys(cp[0].map.buildings) as LotKey[]).filter((k) => !s.map.buildings[k]);
      const gain = computeEconomy(cp[0], w).incomeTotal - c.incomeTotal; yield;
      const cost = costOf(t, s.milestone) * n, jobs = (def(t).jobs as number) * n;
      if (gain > 0) fixes.push({ action: n > 1 ? { kind: 'buildLots', building: t, lots } : { kind: 'buildAt', building: t, lot: lots[0] as LotKey }, building: t, n, cost, gain: Math.round(gain), jobs });
    }
    // an upgrade opens one more job where the colony pays for it
    const kinds = new Set<BuildingId>();
    for (const k of (d?.buildings ?? []).filter((k) => { const t = s.map.buildings[k] as BuildingId; return def(t).payer === 'colony' && !def(t).crop && (def(t).jobs ?? 0) > 0 && !isRole(t) && upgradeOf(s, k) < 2; })) {
      const t = s.map.buildings[k] as BuildingId;
      if (kinds.has(t) || kinds.size >= 4) continue;
      kinds.add(t);
      const gain = computeEconomy({ ...s, upgrades: { ...s.upgrades, [k]: upgradeOf(s, k) + 1 } }, w).incomeTotal - c.incomeTotal; yield;
      if (gain < 0) continue;
      fixes.push({ action: { kind: 'select', key: k, upgrade: true }, building: t, n: 1, cost: upgradeCost(t, upgradeOf(s, k), s.milestone), gain: Math.round(gain), jobs: 1 });
    }
    const score = (f: Fix) => ((f.jobs ?? 0) * 100 + (f.gain ?? 0)) / Math.max(1, f.cost);
    // the best new work and the best upgrade side by side, when there is one of each
    const builds = fixes.filter((f) => f.action.kind !== 'select').sort((p, q) => score(q) - score(p)), ups = fixes.filter((f) => f.action.kind === 'select').sort((p, q) => score(q) - score(p));
    const pick = builds[0] && ups[0] ? [builds[0], ups[0]].sort((p, q) => score(q) - score(p)) : [...builds, ...ups].slice(0, 2);
    out.jobs = { idle: a.idle, jobs: a.jobs, outsiders: Math.max(0, a.filled - a.working), colonyIdle: c.counts.work.idle.length, fixes: pick };
  }
  // ---- outlet: the main reason the cargo does not reach a buyer, and the district's advice on it
  if (a.reach < 0.85 && a.produced > 0) {
    const lost: Record<OutletCause, number> = { onFoot: 0, collection: 0, noGateway: 0, gatewayFull: 0, noBuyer: 0 };
    for (const k of d?.buildings ?? []) { const o = c.outlet[k]; if (o) for (const x of Object.keys(lost) as OutletCause[]) lost[x] += o.lost[x]; }
    const cause = (Object.keys(lost) as OutletCause[]).sort((p, q) => lost[q] - lost[p])[0] as OutletCause;
    const fixes: Fix[] = mine.filter((x) => OUTLET_RULES.test(x.rule) && x.action && !x.blocked).sort((p, q) => q.weight - p.weight).slice(0, 2)
      .map((x) => ({ action: x.action as AdviceAction, advice: x, cost: x.cost, gain: Number(x.params.gain) || undefined }));
    // cargo walking too far: a store or a collection point near the fields that lose it, measured on a few lots
    if (fixes.length < 2 && (cause === 'onFoot' || cause === 'collection')) {
      const losers = (d?.buildings ?? []).filter((k) => (c.outlet[k]?.lost.onFoot ?? 0) + (c.outlet[k]?.lost.collection ?? 0) > 1);
      if (losers.length) {
        const [cx, cy] = losers.reduce(([x, y], k) => { const [p, q] = k.split(',').map(Number) as [number, number]; return [x + p / losers.length, y + q / losers.length]; }, [0, 0]);
        const near = (l: LotKey[]) => l.sort((p, q) => { const [pa, pb] = p.split(',').map(Number) as [number, number], [qa, qb] = q.split(',').map(Number) as [number, number]; return Math.hypot(pa - cx, pb - cy) - Math.hypot(qa - cx, qb - cy); });
        // the nearest lots to the fields that lose cargo, and a spread of the others (a store far off can still win)
        const pick = (l: LotKey[]) => { const n = near(l); return [...new Set([...n.slice(0, 6), ...n.filter((_, i) => i % 2 === 1).slice(0, 16)])]; };
        const roles = TRANSPORT_ROLES as Partial<Record<BuildingId, { role?: string; starter?: string }>>;
        for (const t of (['store', 'tradingPost'] as BuildingId[]).filter((x) => canHave(s, x) && !fixes.some((f) => f.building === x))) {
          let best: { lot: LotKey; gain: number } | null = null;
          for (const lot of pick(lotsFor(s, w, t, 40, inside).filter((k) => !s.map.buildings[k]))) {
            const st = roles[t]?.starter;
            const g = computeEconomy({ ...s, map: { ...s.map, buildings: { ...s.map.buildings, [lot]: t } }, fleet: st ? { ...s.fleet, [lot]: { [st]: 1 } } : s.fleet }, w).incomeTotal - c.incomeTotal; yield;
            if (g > 10 && (!best || g > best.gain)) best = { lot, gain: g };
          }
          if (best) fixes.push({ action: { kind: 'buildAt', building: t, lot: best.lot }, building: t, n: 1, cost: costOf(t, s.milestone), gain: Math.round(best.gain) });
        }
        // upgrading the district's store or collection point (more reach, more vehicles) can do it for less
        for (const k of (d?.buildings ?? []).filter((k) => { const t = s.map.buildings[k] as BuildingId; return isRole(t) && def(t).payer !== 'families' && upgradeOf(s, k) < 2; }).slice(0, 3)) {
          const t = s.map.buildings[k] as BuildingId, g = computeEconomy({ ...s, upgrades: { ...s.upgrades, [k]: upgradeOf(s, k) + 1 } }, w).incomeTotal - c.incomeTotal; yield;
          if (g > 10) fixes.push({ action: { kind: 'select', key: k, upgrade: true }, building: t, n: 1, cost: upgradeCost(t, upgradeOf(s, k), s.milestone), gain: Math.round(g) });
        }
        fixes.sort((p, q) => (q.gain ?? 0) / Math.max(1, q.cost) - (p.gain ?? 0) / Math.max(1, p.cost)).splice(2);
      }
    }
    out.outlet = { cause, lost: Math.round(lost[cause]), share: Math.round(a.reach * 100), fixes };
  }
  // ---- services: homes out of reach, and the free lot that covers most of them
  for (const [sv, n] of (Object.entries(a.missing) as [Service, number][]).sort((p, q) => q[1] - p[1]).slice(0, 2)) {
    if (n < 2 && n < a.homes * 0.3) continue;
    const t = ALL.filter((x) => def(x).service === sv && canHave(s, x) && !isRole(x)).sort((p, q) => costOf(p, s.milestone) - costOf(q, s.milestone))[0];
    const fixes: Fix[] = [];
    if (t && d) {
      const lacking = d.homes.filter((h) => R.homes[h]?.items.some((it) => it.kind === 'outOfReach' && it.service === sv));
      const [cx, cy] = lacking.reduce(([x, y], h) => { const [p, q] = h.split(',').map(Number) as [number, number]; return [x + p / lacking.length, y + q / lacking.length]; }, [0, 0]);
      const lots = lotsFor(s, w, t, 40, inside).filter((k) => !s.map.buildings[k]).sort((p, q) => { const [pa, pb] = p.split(',').map(Number) as [number, number], [qa, qb] = q.split(',').map(Number) as [number, number]; return Math.hypot(pa - cx, pb - cy) - Math.hypot(qa - cx, qb - cy); }).slice(0, 5);
      let best: { lot: LotKey; covers: number } | null = null;
      for (const lot of lots) {
        const r2 = rateHomes({ ...s, map: { ...s.map, buildings: { ...s.map.buildings, [lot]: t } } }, w); yield;
        const covers = lacking.filter((h) => !r2.homes[h]?.items.some((it) => it.kind === 'outOfReach' && it.service === sv)).length;
        if (covers > 0 && (!best || covers > best.covers)) best = { lot, covers };
      }
      if (best) fixes.push({ action: { kind: 'buildAt', building: t, lot: best.lot }, building: t, n: 1, cost: costOf(t, s.milestone), covers: best.covers });
      // or the nearest one, upgraded: a wider reach
      const su = serviceUpgrade(s, w, sv, lacking); yield;
      if (su) fixes.push({ action: { kind: 'select', key: su.key, upgrade: true }, building: su.t, n: 1, cost: su.cost, covers: su.covers });
      fixes.sort((p, q) => (q.covers ?? 0) / Math.max(1, q.cost) - (p.covers ?? 0) / Math.max(1, p.cost));
    }
    out.services.push({ service: sv, n, homes: a.homes, fixes });
  }
  // ---- satisfaction: what weighs most on the district's homes
  if (a.homes >= 3 && a.satisfaction < 60 && d) {
    const weigh: Record<string, { kind: 'service' | 'nuisance' | 'other'; service?: Service; building?: BuildingId; reason?: string; homes: number; v: number; key?: LotKey }> = {};
    for (const h of d.homes) for (const it of R.homes[h]?.items ?? []) {
      if (it.kind === 'outOfReach') { const x = (weigh[`s:${it.service}`] ??= { kind: 'service', service: it.service, homes: 0, v: 0 }); x.homes++; x.v += 10; }
      else if (it.kind === 'nuisance' && it.value < 0) { const x = (weigh[`n:${it.building}`] ??= { kind: 'nuisance', building: it.building, homes: 0, v: 0 }); x.homes++; x.v -= it.value; }
    }
    const reasons = Object.values(weigh).sort((p, q) => q.v - p.v).slice(0, 2);
    const fixes: Fix[] = [];
    // a nuisance: the nearest such building can be moved
    const nz = reasons.find((x) => x.kind === 'nuisance');
    if (nz?.building) {
      const k = (d.buildings.find((k) => s.map.buildings[k] === nz.building) ?? (Object.keys(s.map.buildings) as LotKey[]).find((k) => s.map.buildings[k] === nz.building));
      if (k) fixes.push({ action: { kind: 'select', key: k }, building: nz.building, cost: 0 });
    }
    out.satisfaction = { reasons: reasons.map(({ kind, service, building, homes }) => ({ kind, ...(service ? { service } : {}), ...(building ? { building } : {}), homes })), fixes };
  }
  return out;
}

export function districtFixes(s: GameState, w: World, D: Districts, a: DistrictAccount, mine: Advice[]): DistrictFixes {
  const g = districtFixSteps(s, w, D, a, mine);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
