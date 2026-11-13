// The way to the next level as one plan: what it still lacks (families at work, income, buildings) and a package
// of works that closes the gap, each step measured on a copy of the colony with the works on real free lots.
// The player reads it as "build these; it costs this and pays that", not as a list of formulas. It is costly (one
// economy per step), so it runs as steps the screen spreads over a few frames.
import { BALANCE, BUILDINGS, LEVELS, TRANSPORT_ROLES, type BuildingId } from '@assunguy/data';
import { allocate, computeEconomy, costOf, def, type Economy } from './economy.js';
import { upgradeCost } from './advisor.js';
import { withWorks } from './measure.js';
import { levelRequirements, type GoalItem } from './province.js';
import { upgradeOf, type GameState } from './state.js';
import type { LotKey, World } from './world.js';

export interface PlanItem { building: BuildingId; n: number; cost: number; upgrade?: true; /** Where: the lots the works were measured on (the building's lot for an upgrade). */ lots: LotKey[] }
export interface LevelPlan {
  level: number;
  /** Families at work now and what the level asks. */
  workers: { current: number; target: number };
  income: { current: number; target: number };
  /** Buildings the level asks for that are still missing. */
  missing: { building: BuildingId; n: number }[];
  /** The works, merged by kind, in the order they were chosen. */
  items: PlanItem[];
  cost: number;
  /** Income a year the works add. */
  gain: number;
  /** Families still missing to fill the jobs (homes and arrivals, not works). */
  families: number;
  /** The plan reaches the level's numbers. */
  reached: boolean;
  /** What else the level still asks (districts, a share without work, the milestone's satisfaction, lands, road). */
  pending: GoalItem[];
}

/** A job is worth about this much income a year when choosing between works. */
const JOB_VALUE = 100;
const MAX_STEPS = 45;
const ALL = Object.keys(BUILDINGS) as BuildingId[];
const isRole = (t: BuildingId) => !!(TRANSPORT_ROLES as Partial<Record<BuildingId, unknown>>)[t];
/** Fields go in blocks (ten while many jobs are missing, then five); other works one at a time. */
const blockOf = (t: BuildingId, short: number) => (def(t).crop ? (short > 40 ? 10 : 5) : 1);

interface Cand { key: string; t: BuildingId; upgrade: boolean; n: number; cost: number; jobs: number; gain: number }

/**
 * Steps of the plan: each yields after one measured economy; the return value is the plan (null at the top level).
 * Drive it with `runPlan` in tests, or a few steps per frame on screen.
 */
export interface PlanOptions {
  /** Only these lots (a district's), and only works there. */
  only?: (k: LotKey) => boolean;
  /** Aim at this many more jobs instead of the next level. */
  jobs?: number;
}
export function* planSteps(s0: GameState, w: World, o: PlanOptions = {}): Generator<void, LevelPlan | null> {
  const lv = LEVELS.find((l) => l.level === s0.level + 1);
  if (!lv && !o.jobs) return null;
  const a00 = allocate(s0);
  // a district's plan: the jobs it lacks, nothing about the level
  const c00 = computeEconomy(s0, w);
  // at most a share of families without work: the jobs that keeps the rest at work
  const fam0 = Object.keys(s0.families).length, idleCap = lv?.idle !== undefined && !o.jobs ? Math.ceil(fam0 * (1 - lv.idle)) : 0;
  const reqs = o.jobs ? [] : levelRequirements(s0, w, lv!.level, c00);
  // a milestone's families at work (more when the province asked for more)
  const famGoal = reqs.find((g) => g.kind === 'families' && BALANCE.milestoneWorkers)?.target ?? 0;
  const next = o.jobs ? { level: s0.level, workers: a00.employed + o.jobs, income: 0, requires: {} as Partial<Record<BuildingId, number>> } : { ...lv!, workers: Math.max(lv!.workers, idleCap, famGoal) };
  const pending = reqs.filter((g) => !g.ok && !['workers', 'income', 'building', 'families'].includes(g.kind));
  let s = s0, c: Economy = c00;
  const base = c.incomeTotal, a0 = allocate(s);
  const have = (t: BuildingId) => Object.values(s.map.buildings).filter((x) => x === t).length;
  const missing = (Object.entries(next.requires ?? {}) as [BuildingId, number][]).filter(([t, q]) => have(t) < q).map(([t, q]) => ({ building: t, n: q - have(t) }));
  const items: PlanItem[] = [];
  let cost = 0;
  const addItem = (t: BuildingId, n: number, k: number, upgrade: boolean, lots: LotKey[]) => {
    cost += k;
    const it = items.find((x) => x.building === t && !!x.upgrade === upgrade);
    if (it) { it.n += n; it.cost += k; it.lots.push(...lots); } else items.push({ building: t, n, cost: k, lots: [...lots], ...(upgrade ? { upgrade: true as const } : {}) });
  };
  const added = (a: GameState, b: GameState) => (Object.keys(b.map.buildings) as LotKey[]).filter((k) => !a.map.buildings[k]);
  // the level's own buildings first (they open jobs too), when they can be built now
  for (const m of missing) {
    if ((def(m.building).minLevel ?? 1) > s.level) continue;
    const cp = withWorks(s, w, { [m.building]: m.n } as never, o.only);
    if (cp && !cp[1]) { const lots = added(s, cp[0]); s = cp[0]; addItem(m.building, m.n, costOf(m.building, s.milestone) * m.n, false, lots); }
  }
  c = computeEconomy(s, w); yield;
  const employed = () => allocate(s).employed;
  const done = () => employed() >= next.workers && c.incomeTotal >= next.income;
  // what can be built or upgraded now: kinds with jobs that are not homes or transport
  const level = s.level || 1;
  const buildable = ALL.filter((t) => !def(t).lateGame && (def(t).minLevel ?? 1) <= level && (def(t).jobs ?? 0) > 0 && !def(t).housing && !isRole(t) && !def(t).riverside);
  const upgradable = (t: BuildingId) => (Object.keys(s.map.buildings) as LotKey[]).find((k) => s.map.buildings[k] === t && upgradeOf(s, k) < 2 && (!o.only || o.only(k)));
  const cands: Cand[] = [];
  // the cheapest jobs of each sort are measured (a phone measures a few dozen economies at most)
  const perJob = (t: BuildingId) => costOf(t, s.milestone) / (def(t).jobs as number);
  for (const t of buildable.sort((p, q) => perJob(p) - perJob(q)).slice(0, 14)) cands.push({ key: `b:${t}`, t, upgrade: false, n: 1, cost: 0, jobs: 0, gain: NaN });
  const ups = [...new Set(Object.values(s.map.buildings) as BuildingId[])].filter((t) => { const D = def(t); return D.payer === 'colony' && !D.crop && !D.housing && (D.jobs ?? 0) > 0 && !isRole(t) && !!upgradable(t); });
  const upCost = (t: BuildingId) => { const k = upgradable(t) as LotKey; return upgradeCost(t, upgradeOf(s, k), s.milestone); };
  for (const t of ups.sort((p, q) => upCost(p) - upCost(q)).slice(0, 6)) cands.push({ key: `u:${t}`, t, upgrade: true, n: 1, cost: upCost(t), jobs: 1, gain: NaN });
  let lastLots: LotKey[] = [];
  const apply = (x: Cand): GameState | null => {
    if (x.upgrade) {
      const k = upgradable(x.t);
      if (!k) return null;
      x.cost = upgradeCost(x.t, upgradeOf(s, k), s.milestone);
      lastLots = [k];
      return { ...s, upgrades: { ...s.upgrades, [k]: upgradeOf(s, k) + 1 } };
    }
    const cp = withWorks(s, w, { [x.t]: x.n } as never, o.only);
    if (!cp || cp[1]) return null;
    lastLots = added(s, cp[0]);
    return cp[0];
  };
  const measure = (x: Cand) => {
    if (!x.upgrade) { x.n = blockOf(x.t, next.workers - employed()); x.cost = costOf(x.t, s.milestone) * x.n; x.jobs = (def(x.t).jobs as number) * x.n; }
    const t = apply(x); x.gain = t ? computeEconomy(t, w).incomeTotal - c.incomeTotal : -Infinity; };
  for (const x of cands) { measure(x); yield; }
  for (let i = 0; i < MAX_STEPS && !done(); i++) {
    // jobs nobody can take wait for families: homes and arrivals, not works
    if (employed() < next.workers && !allocate(s).idle.length && c.incomeTotal >= next.income) break;
    const shortJobs = employed() < next.workers;
    const score = (x: Cand) => (shortJobs ? x.jobs * JOB_VALUE : 0) + x.gain;
    // works that pay at least a little first; a job that adds next to nothing only when nothing else is left
    const pays = cands.filter((x) => x.gain > -Infinity && x.gain >= x.cost * 0.08);
    const pool = pays.length ? pays : cands.filter((x) => x.gain > -Infinity && (shortJobs ? x.jobs > 0 : x.gain > 0));
    const best = pool.sort((p, q) => score(q) / Math.max(1, q.cost) - score(p) / Math.max(1, p.cost))[0];
    if (!best) break;
    const t = apply(best);
    if (!t) { best.gain = -Infinity; continue; }
    s = t; addItem(best.t, best.n, best.cost, best.upgrade, lastLots);
    c = computeEconomy(s, w); yield;
    measure(best); yield;
  }
  const workers = employed(), idleLeft = allocate(s).idle.length;
  return {
    level: next.level,
    workers: { current: a0.employed, target: next.workers },
    income: { current: Math.round(base), target: next.income },
    missing,
    items,
    cost,
    gain: Math.round(c.incomeTotal - base),
    families: Math.max(0, next.workers - workers - idleLeft),
    reached: workers >= next.workers && c.incomeTotal >= next.income,
    pending: pending.filter((g) => g.kind !== 'idle' || workers < next.workers),
  };
}

/** The whole plan at once (tests and tools). */
export function levelPlan(s: GameState, w: World, o: PlanOptions = {}): LevelPlan | null {
  const g = planSteps(s, w, o);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}
