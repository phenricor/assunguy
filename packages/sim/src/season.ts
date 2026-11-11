// Passing a season: the purse, laws coming into force, the market, relief works, families, savings and
// upgrades, ratings, the province report, events, great works, city problems, long crises, transport,
// caves, goals and the report. One command, deterministic given the state.
import { LEVELS, MILESTONES, type BuildingId, type MilestoneDef } from '@assunguy/data';
import { allocate, computeEconomy, type Economy } from './economy.js';
import { advanceLongCrises, advanceProblems, chronicle, draw, rollEvents, teachersCollege, PATH_CHOICES, type News } from './events.js';
import { childrenMarry, familiesInvest, passFamilies, syncFamilies, updateSupply } from './families.js';
import { advanceMarket } from './market.js';
import { advanceGreatWorks, advanceTransport, applyRelief, grantFactor, levelRequirements, provinceReport, upkeepPerSeason, NEWCOMER_WAGE, type GreatWorkNews } from './province.js';
import { taxEffect, updateRatings } from './ratings.js';
import { settle, storedMean } from './settle.js';
import { nameId, rememberDistricts } from './districts.js';
import { collectInstalments } from './installments.js';
import { advanceRace, startRace } from './race.js';
import { change, goodReturns, seasonDecisions, seriesPoint, snapshot, type Change, type Decisions, type GoodReturn } from './report.js';
import { hasChoice, hasLaw, type GameState } from './state.js';
import { landOf, parseKey, type LotKey, type World } from './world.js';

export const AGENT_COST = (s: GameState) => (s.milestone >= 3 ? 260 : 180);

export interface GoalCheck { levelUp?: number; milestone?: string; missed?: string; misses?: number }
/** Levels up when every requirement is met; a missed deadline is announced once. */
export function checkGoals(s: GameState, w: World, c: Economy): GoalCheck | null {
  const n = s.level + 1, t = s.market.t, lv = LEVELS.find((l) => l.level === n);
  if (lv && levelRequirements(s, w, n, c, true).every((x) => x.ok)) {
    s.level = n;
    s.influence = Math.max(0, Math.min(15, s.influence + 1));
    if (PATH_CHOICES[n]) s.queue.push({ kind: 'pathChoice', level: n });
    const out: GoalCheck = { levelUp: n };
    if (lv.milestone) {
      s.milestone = lv.milestone; s.extraDemand = 0;
      const target = MILESTONES[lv.milestone] as MilestoneDef;
      s.influence = Math.max(0, Math.min(15, s.influence + 1));
      s.queue.push({ kind: 'decree', milestone: target.id });
      out.milestone = target.id; s.warned = false;
      const next = MILESTONES[lv.milestone + 1];
      if (next) { s.deadline = t + (next.deadline as number); s.goalStart = t; }
      s.misses = 0; s.intervention = false; s.extendedDeadline = false;
    }
    return out;
  }
  const target = MILESTONES[s.milestone + 1];
  if (target && t > s.deadline && !s.warned) { s.warned = true; s.misses = (s.misses || 0) + 1; return { missed: target.id, misses: s.misses }; }
  return null;
}

export interface SeasonReport {
  t: number;
  news: News[];
  goal: GoalCheck | null;
  province: ReturnType<typeof provinceReport> | null;
  cash: { before: number; after: number; taxes: number; grant: number; share: number; upkeep: number; wages: number; relief: number; works: number; greatWorks: number; agent: number; fleet: number; tariffs: number; arrivals: number };
  satisfaction: { before: number; after: number };
  summary: { income: number; lost: number; exported: number; employed: number; families: number };
  invested: { homes: Partial<Record<BuildingId, number>>; fields: number; spent: number };
  familiesAtRisk: number; businessesAtRisk: number;
  /** Each good's year, the season's decisions with what they changed, and the taxes and laws that came into force. */
  returns: GoodReturn[];
  decisions: Decisions;
  passed: { taxes: { id: string; revenue: number }[]; laws: { id: string; change: Change }[] };
  /** Lot instalments received (0 unless the instalments switch is on). */
  instalments: number;
}

export function passSeason(s: GameState, w: World): SeasonReport {
  const cashBefore = s.cash, worksBefore = s.buildCosts, arrivalsBefore = s.arrivalCosts, tBefore = s.market.t;
  const decisions = seasonDecisions(s, tBefore), passed: SeasonReport['passed'] = { taxes: [], laws: [] };
  const satBefore = storedMean(s);
  s.vacated = {};
  const c0 = computeEconomy(s, w);
  const taxes = (c0.revenue.total / 4) * (hasLaw(s, 'landRegistry') ? 1.1 : 1);
  const target0 = MILESTONES[s.milestone] as MilestoneDef;
  const grant = Math.round(target0.grant * (s.grantFactor || 1) * grantFactor(s));
  const wages = Object.values(s.families).filter((f) => f.newcomer > 0).length * NEWCOMER_WAGE;
  const share = Math.round((c0.incomeTotal / 4) * (target0.shareOfTrade || 0));
  const upkeep = upkeepPerSeason(s);
  s.cash += taxes + grant + share - upkeep - wages;
  // taxes passed last season come into force
  for (const id of Object.keys(s.pendingTaxes) as (keyof GameState['taxes'])[]) { const base = taxEffect(s, w).revenue; s.taxes[id] = s.pendingTaxes[id] ?? null; s.taxHistory.push({ id, t: s.market.t + 1 }); passed.taxes.push({ id, revenue: Math.round(taxEffect(s, w).revenue - base) }); }
  s.pendingTaxes = {};
  advanceMarket(s.market, { shockOdds: hasChoice(s, 'polyculture') ? 0.45 : hasChoice(s, 'monoculture') ? 1.6 : 1 });
  const relief = applyRelief(s);
  const news: News[] = [];
  if (relief.staffed) news.push({ key: 'news.relief', params: { n: relief.staffed } });
  passFamilies(s);
  const instalments = collectInstalments(s, w);
  const c1 = computeEconomy(s, w);
  updateSupply(s, c1);
  const invested = familiesInvest(s, w, c1);
  s.extraStreets = 0;
  s.seasonWork = { buildings: {}, streets: {}, upgrades: {}, swaps: {} };
  syncFamilies(s);
  let ratings = updateRatings(s, w);
  const c = computeEconomy(s, w), ef = taxEffect(s, w, c);
  s.halfYearBalance = (s.halfYearBalance || 0) + (s.cash - cashBefore);
  let province: SeasonReport['province'] = null;
  if (s.market.t % 2 === 0) { province = provinceReport(s, w, s.halfYearBalance, c, ratings.mean); s.halfYearBalance = 0; s.lastProvinceReport = province; }
  // families at risk from taxes move closer to leaving
  if (ef.familiesAtRisk) for (const f of Object.values(s.families).sort((a, b) => a.skill - b.skill).slice(0, ef.familiesAtRisk)) f.idle += 1;
  // town laws passed last season come into force
  // the prototype measured each law before and after it passed, re-rating the homes both times (fotoColonia)
  for (const id of Object.keys(s.pendingLaws)) { updateRatings(s, w); const before = snapshot(s, w); s.laws[id] = true; updateRatings(s, w); passed.laws.push({ id, change: change(before, snapshot(s, w)) }); chronicle(s, 'chronicle.lawPassed', { law: id }); }
  s.pendingLaws = {};
  news.push(...rollEvents(s, w, c, ratings));
  const workNews: GreatWorkNews[] = [];
  const greatWorks = advanceGreatWorks(s, workNews);
  for (const x of workNews) news.push({ key: `news.greatWork.${x.kind}`, params: { work: x.work } });
  // the end-game steps of the prototype: agent, children marrying, teachers college, problems, long crises, transport
  let agent = 0;
  if (s.immigrationAgent) { const cu = AGENT_COST(s); if (s.cash < cu) { news.push({ key: 'news.agentEnded' }); chronicle(s, 'chronicle.agentEnded'); s.immigrationAgent = null; } else { s.cash -= cu; agent = cu; } }
  const kids = childrenMarry(s, () => draw(s));
  if (kids) { news.push({ key: 'news.childrenMarried', params: { n: kids } }); chronicle(s, 'chronicle.childrenMarried', { n: kids }); }
  teachersCollege(s);
  advanceProblems(s, w, ratings, news);
  advanceLongCrises(s, news);
  const tr = advanceTransport(s, computeEconomy(s, w));
  if (s.milestone >= 3 && !s.race) startRace(s, news);
  else if (s.race) advanceRace(s, computeEconomy(s, w), news);
  if (tr.firewoodShortageStarted) news.push({ key: 'news.firewoodShortage' });
  // one line per kind of building, however many of them filled up
  const full: Record<string, number> = {};
  for (const k of tr.fullCollections) full[s.map.buildings[k] as string] = (full[s.map.buildings[k] as string] ?? 0) + 1;
  for (const [building, n] of Object.entries(full).sort()) news.push(n > 1 ? { key: 'news.collectionFullMany', params: { building, n } } : { key: 'news.collectionFull', params: { building } });
  // caves on our lands: settlers explore one now and then, and the province hears of it
  for (const key of (Object.keys(s.map.nature) as LotKey[]).filter((x) => s.map.nature[x] === 'cave').sort()) {
    const [a, b] = parseKey(key);
    if (s.map.lands[landOf(a, b)] !== 'ours' || s.cavesSeen.includes(key) || draw(s) > 0.25) continue;
    s.cavesSeen = [...s.cavesSeen, key]; s.influence += 1;
    news.push({ key: 'news.caveExplored', params: { cave: s.map.natureNames[key] ?? 'nature.cave' } }); chronicle(s, 'chronicle.caveExplored', { cave: s.map.natureNames[key] ?? 'nature.cave' });
  }
  // districts: new ones are news
  for (const d of rememberDistricts(s, w)) news.push({ key: 'news.districtBorn', params: { district: nameId(d.name), at: d.id, homes: d.homes.length } });
  // a business crushed by taxes for four seasons closes
  if (ef.businessesAtRisk) {
    s.businessStrain = (s.businessStrain || 0) + 1;
    if (s.businessStrain >= 4) {
      s.businessStrain = 0;
      const store = (Object.keys(s.map.buildings) as LotKey[]).find((x) => s.map.buildings[x] === 'store');
      if (store) { delete s.map.buildings[store]; delete s.upgrades[store]; news.push({ key: 'news.storeClosed' }); chronicle(s, 'chronicle.storeClosed'); }
    }
  } else s.businessStrain = 0;
  for (const e of s.market.shocks) if (e.good !== '_port' && e.kind !== 'price' && e.seasonsLeft >= 3) news.push({ key: 'news.shock', params: { reason: e.reason, ...(e.reasonParams ?? {}), share: Math.round((1 - e.factor) * 100), seasons: e.seasonsLeft, kind: e.kind } });
  const goal = checkGoals(s, w, c);
  if (goal?.missed) s.queue.unshift(goal.misses && goal.misses >= 2 ? { kind: 'end', milestone: goal.missed } : { kind: 'inspector', milestone: goal.missed });
  if (goal?.levelUp === 12) s.queue.push({ kind: 'victory' });
  if (province) { if (province.factor > 1 && s.market.t % 4 === 0) s.influence = Math.max(0, Math.min(15, s.influence + 1)); else if (province.factor < 1) s.influence = Math.max(0, Math.min(15, s.influence - 1)); }
  { const n = s.level + 1, lv = LEVELS.find((l) => l.level === n); s.progress = lv ? Math.min(1, Math.min(allocate(s).employed / lv.workers, c.incomeTotal / lv.income)) : 1; }
  s.series = [...(s.series ?? []), seriesPoint(s, c)].slice(-60);
  ratings = updateRatings(s, w);
  settle(s, w); // the prototype re-rated once more in `mudou`
  const report: SeasonReport = {
    t: s.market.t, news, goal, province,
    cash: { before: Math.round(cashBefore + worksBefore + arrivalsBefore), after: Math.round(s.cash), taxes: Math.round(taxes), grant, share, upkeep: Math.round(upkeep), wages, relief: relief.cost, works: Math.round(s.buildCosts - greatWorks), greatWorks: Math.round(greatWorks), agent, fleet: tr.fleetCost, tariffs: tr.tariffIncome, arrivals: Math.round(s.arrivalCosts) },
    satisfaction: { before: satBefore, after: ratings.mean },
    summary: { income: Math.round(c.incomeTotal), lost: Math.round(c.lostTotal), exported: Math.round(c.exportedTotal), employed: c.counts.work.employed, families: c.counts.families },
    invested, familiesAtRisk: ef.familiesAtRisk, businessesAtRisk: ef.businessesAtRisk,
    returns: goodReturns(s, c), decisions, passed, instalments: instalments.received,
  };
  s.reports = [...s.reports, report].slice(-12);
  s.log = []; s.buildCosts = 0; s.arrivalCosts = 0;
  return report;
}
