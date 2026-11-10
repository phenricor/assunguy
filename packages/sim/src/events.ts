// Events: what happens to the colony each season and the decisions it asks for. Each event is declared
// here with its options and effects; all text lives in the i18n catalogs under event.<id>.*.
// Every random draw comes from the market's seed, in the prototype's order.
import { BUILDINGS, GOODS, GOOD_IDS, LEVELS, WEATHER_ODDS, type BuildingId, type GoodId } from '@assunguy/data';
import { allocate, def, hasRoad, sectorOf, soilOf, type Economy } from './economy.js';
import { arrivalChance, arrivalSize, emptySlots, loseFamilies, receiveFamilies, syncFamilies } from './families.js';
import { measure } from './measure.js';
import { lcgNext } from './rng.js';
import { canPlace } from './placement.js';
import { rateHomes, updateRatings, type Ratings } from './ratings.js';
import { crisisOn, hasChoice, hasLaw, homeOf, workDone, type FamilyId, type GameState } from './state.js';
import { landOf, parseKey, type LotKey, type World } from './world.js';
import { connected } from './network.js';

/** The season roll: the same generator as the market's, sharing its seed (as the prototype does). */
export const draw = (s: GameState): number => lcgNext(s.market);

export type DilemmaId = 'earlyArrival' | 'storeBox' | 'storeDebt' | 'accusation' | 'divino' | 'fever' | 'peddler' | 'blacksmith' | 'kaingangVisit' | 'fences' | 'barter' | 'committee' | 'promise' | 'engineer';
export type QueuedEvent =
  | { kind: 'dilemma'; id: DilemmaId }
  | { kind: 'crisis'; id: 'frost' | 'flood' }
  | { kind: 'immigrants'; n: number; origin: string }
  | { kind: 'cropSwap'; key: LotKey; family: FamilyId; from: BuildingId; to: BuildingId; gain: number; cost: number; losses: [GoodId, number][] }
  | { kind: 'pathChoice'; level: number }
  | { kind: 'intro' } | { kind: 'decree'; milestone: string } | { kind: 'victory' }
  | { kind: 'inspector'; milestone: string } | { kind: 'end'; milestone: string }
  | { kind: 'requisition' };

/** The colony-wide effects an option can have; the prototype's `soma`. */
export interface Effects { cash?: number; influence?: number; satisfaction?: number; seasons?: number; reason?: string; extraDemand?: number; lose?: number; receive?: number; origin?: string; training?: number }
export function applyEffects(s: GameState, o: Effects): void {
  if (o.cash) s.cash += o.cash;
  if (o.influence) s.influence = Math.max(0, Math.min(15, s.influence + o.influence));
  if (o.satisfaction) s.effects.push({ satisfaction: o.satisfaction, seasonsLeft: o.seasons || 4, reason: o.reason || 'mood.recentDecision' });
  if (o.extraDemand) s.extraDemand += o.extraDemand;
  if (o.lose) loseFamilies(s, o.lose);
  if (o.receive) receiveFamilies(s, o.receive, o.origin || 'brazilian');
  if (o.training) Object.values(s.families).filter((f) => f.trade === 'crafts').slice(0, 6).forEach((f) => { f.skill = Math.min(100, f.skill + (o.training as number)); });
}
const schedule = (s: GameState, id: DilemmaId, inSeasons: number) => { s.agenda.push({ id, t: s.market.t + inSeasons }); };
export const chronicle = (s: GameState, key: string, params?: Record<string, string | number>) => {
  s.chronicle.push({ t: s.market.t, key, ...(params ? { params } : {}) });
  if (s.chronicle.length > 200) s.chronicle.shift();
};

export interface Option { can?: (s: GameState) => boolean; apply: (s: GameState, w: World) => void; params?: Record<string, string | number> }
export interface Defined { id: string; params?: Record<string, string | number>; options: Option[]; changesGame?: boolean }

interface Dilemma { when?: (s: GameState, w: World, r: Ratings) => boolean; chance?: (s: GameState, r: Ratings) => number; interval?: number; options: Option[] }
const pay = (n: number) => (s: GameState) => s.cash >= n;
const DILEMMAS: Record<DilemmaId, Dilemma> = {
  earlyArrival: { when: (s) => emptySlots(s).length < 2 && s.market.t >= 16, interval: 40, options: [
    { apply: (s) => applyEffects(s, { satisfaction: -5, reason: 'mood.crowdedHomes' }) },
    { apply: (s) => { applyEffects(s, { cash: 150 }); schedule(s, 'storeDebt', 6); } },
    { can: pay(40), apply: (s) => applyEffects(s, { cash: -40 }) }] },
  storeBox: { when: (s) => s.market.t >= 20 && !s.flags.storeBox, interval: 99, options: [
    { apply: (s) => { applyEffects(s, { cash: 400 }); s.flags.storeBox = true; schedule(s, 'accusation', 7); } },
    { apply: (s) => { s.flags.storeBox = true; applyEffects(s, { satisfaction: 6, reason: 'mood.ledgersOpened' }); } }] },
  storeDebt: { options: [
    { can: pay(250), apply: (s) => applyEffects(s, { cash: -250 }) },
    { apply: (s) => applyEffects(s, { satisfaction: -6, seasons: 8, reason: 'mood.storeMonopoly' }) }] },
  accusation: { options: [
    { can: pay(400), apply: (s) => applyEffects(s, { cash: -400, satisfaction: 4, reason: 'mood.moneyReturned' }) },
    { apply: (s) => applyEffects(s, { extraDemand: 1, satisfaction: -4, reason: 'mood.boxRumours' }) }] },
  divino: { when: (s) => s.market.t % 4 === 1, interval: 12, options: [
    { can: pay(100), apply: (s) => applyEffects(s, { cash: -100, satisfaction: 8, reason: 'mood.divino' }) },
    { can: pay(25), apply: (s) => applyEffects(s, { cash: -25, satisfaction: 3, reason: 'mood.divino' }) },
    { apply: (s) => applyEffects(s, { satisfaction: -3, reason: 'mood.noFestival' }) }] },
  fever: { when: (s) => s.market.t >= 16, interval: 16,
    chance: (_s, r) => { const homes = Object.values(r.homes); return homes.filter((h) => h.items.some((i) => i.kind === 'outOfReach' && i.service === 'health')).length > homes.length * 0.4 ? 1.6 : 0.6; },
    options: [
      { can: pay(120), apply: (s) => applyEffects(s, { cash: -120 }) },
      { apply: (s) => { applyEffects(s, { satisfaction: -4, reason: 'mood.fever' }); loseFamilies(s, 2); } },
      { apply: (s) => { applyEffects(s, { satisfaction: 2, reason: 'mood.novena' }); loseFamilies(s, 5); } }] },
  peddler: { when: (s) => s.market.t >= 14, interval: 24, options: [
    { can: pay(60), apply: (s) => applyEffects(s, { cash: -60, satisfaction: 4, reason: 'mood.cheaperSalt' }) },
    { apply: (s) => applyEffects(s, { cash: 30 }) }] },
  blacksmith: { when: (s) => s.market.t >= 18 && !s.flags.blacksmith, interval: 99, options: [
    { can: pay(150), apply: (s) => { s.flags.blacksmith = true; applyEffects(s, { cash: -150, training: 25, satisfaction: -2, reason: 'mood.blacksmithCost' }); } },
    { apply: (s) => { s.flags.blacksmith = true; applyEffects(s, { satisfaction: 1, reason: 'mood.savedMoney' }); } }] },
  kaingangVisit: { when: (s) => s.market.t >= 24, interval: 24, options: [
    { can: pay(80), apply: (s) => applyEffects(s, { cash: -80, satisfaction: 2, reason: 'mood.kaingangPeace' }) },
    { apply: (s) => { applyEffects(s, { satisfaction: -1, reason: 'mood.grovesConflict' }); schedule(s, 'fences', 5); } }] },
  fences: { options: [
    { can: pay(120), apply: (s) => applyEffects(s, { cash: -120, satisfaction: 2, reason: 'mood.borderAgreement' }) },
    { apply: (s) => { applyEffects(s, { satisfaction: -5, reason: 'mood.borderFear' }); loseFamilies(s, 2); } }] },
  barter: { when: (s) => s.market.t >= 10 && s.market.t % 4 === 2, interval: 20, options: [
    { can: pay(40), apply: (s) => applyEffects(s, { cash: -40, satisfaction: 4, reason: 'mood.pineNutsOnTable' }) },
    { apply: (s) => applyEffects(s, { cash: 50 }) }] },
  committee: { when: (s) => allocate(s).idle.length > Object.keys(s.families).length * 0.4, interval: 16, options: [
    { can: pay(120), apply: (s) => applyEffects(s, { cash: -120, satisfaction: 6, reason: 'mood.relief' }) },
    { apply: (s) => { applyEffects(s, { satisfaction: 2, reason: 'mood.worksPromised' }); schedule(s, 'promise', 4); } },
    { apply: (s) => applyEffects(s, { satisfaction: -5, reason: 'mood.committeeIgnored' }) }] },
  promise: { options: [
    { can: pay(200), apply: (s) => applyEffects(s, { cash: -200, satisfaction: 7, reason: 'mood.promiseKept' }) },
    { apply: (s) => applyEffects(s, { satisfaction: -8, reason: 'mood.promiseBroken' }) }] },
  engineer: { when: (s) => s.market.t >= 28 && !hasRoad(s), interval: 24, options: [
    { can: pay(200), apply: (s) => { applyEffects(s, { cash: -200 }); s.extraStreets = (s.extraStreets || 0) + 40; } },
    { apply: () => {} }] },
};
/** Dilemmas that can come up on their own, in the order they are drawn from. */
const DECK = (Object.keys(DILEMMAS) as DilemmaId[]).filter((id) => DILEMMAS[id].when);

const CRISES: Record<'frost' | 'flood', Option[]> = {
  frost: [{ can: pay(80), apply: (s) => applyEffects(s, { cash: -80, satisfaction: 3, reason: 'mood.frostAid' }) }, { apply: (s) => applyEffects(s, { satisfaction: -3, reason: 'mood.frost' }) }],
  flood: [{ can: pay(100), apply: (s) => applyEffects(s, { cash: -100, satisfaction: 2, reason: 'mood.floodRepairs' }) }, { apply: (s) => applyEffects(s, { satisfaction: -2, reason: 'mood.flood' }) }],
};
export const PATH_CHOICES: Record<number, [string, string]> = { 3: ['polyculture', 'monoculture'], 6: ['familyWorkshop', 'manufacture'], 9: ['freeMuleteers', 'storeContract'], 12: ['publicSchool', 'brotherhoods'] };
export const ARRIVAL_COST = 11;
const SWAP_FACTOR = 0.5;
export const firstHarvest = (t: BuildingId, now: number): number => {
  const season = def(t).output?.season;
  if (season === undefined) return now + 1;
  let T = now + 1;
  while (T % 4 !== season) T += 1;
  return T;
};

/** An event's id for i18n, its text parameters and its options. */
export function defineEvent(s: GameState, ev: QueuedEvent): Defined {
  switch (ev.kind) {
    case 'dilemma': return { id: ev.id, options: DILEMMAS[ev.id].options };
    case 'crisis': return { id: ev.id, options: CRISES[ev.id] };
    case 'immigrants': {
      const cost = ev.n * ARRIVAL_COST, half = Math.ceil(ev.n / 2), a = allocate(s);
      const open = Object.values(a.bySector).reduce((x, w) => x + Math.max(0, w.slots - w.filled), 0);
      return { id: 'immigrants', params: { n: ev.n, origin: ev.origin, idle: a.idle.length, open, half, cost, halfCost: half * ARRIVAL_COST }, options: [
        { can: pay(cost), apply: (s2) => { receiveFamilies(s2, ev.n, ev.origin); } },
        { can: pay(half * ARRIVAL_COST), apply: (s2) => { receiveFamilies(s2, half, ev.origin); } },
        { apply: (s2) => { s2.nextArrival = s2.market.t + 4; } }] };
    }
    case 'cropSwap': {
      const f = s.families[ev.family];
      if (s.map.buildings[ev.key] !== ev.from || !f) return { id: 'cropSwapStale', options: [{ apply: () => {} }] };
      return { id: 'cropSwap', params: { family: f.surname, from: ev.from, to: ev.to, gain: ev.gain, seasons: firstHarvest(ev.to, s.market.t) - s.market.t }, options: [
        { apply: (s2, w) => { const g = s2.families[ev.family]; if (g) g.savings = Math.max(0, (g.savings || 0) - ev.cost); s2.map.buildings[ev.key] = ev.to; s2.firstHarvest ??= {}; s2.firstHarvest[ev.key] = firstHarvest(ev.to, s2.market.t); s2.log.push({ t: s2.market.t, kind: 'swapped', building: ev.to, from: ev.from, cost: 0, family: true }); updateRatings(s2, w); } },
        { apply: (s2) => applyEffects(s2, { satisfaction: -2, reason: 'mood.swapRefused' }) }] };
    }
    case 'pathChoice': {
      const [a, b] = PATH_CHOICES[ev.level] as [string, string];
      const pick = (id: string): Option => ({ params: { choice: id }, apply: (s2, w) => { s2.choices[ev.level] = id; updateRatings(s2, w); } });
      return { id: 'pathChoice', params: { level: ev.level, a, b }, options: [pick(a), pick(b)] };
    }
    case 'intro': return { id: 'intro', options: [{ apply: () => {} }], changesGame: true };
    case 'decree': return { id: 'decree', params: { milestone: ev.milestone }, options: [
      { can: pay(150), apply: (s2) => applyEffects(s2, { cash: -150, satisfaction: 8, reason: 'mood.festival' }) },
      { apply: (s2) => applyEffects(s2, { satisfaction: 2, reason: `milestone.${ev.milestone}.reached` }) }] };
    case 'victory': return { id: 'victory', options: [{ apply: () => {} }, { apply: () => {} }], changesGame: true };
    case 'inspector': return { id: 'inspector', params: { milestone: ev.milestone }, options: [
      { apply: (s2) => { s2.intervention = true; s2.extraDemand += 2; s2.deadline = s2.market.t + 8; s2.warned = false; applyEffects(s2, { influence: -3, satisfaction: -5, seasons: 4, reason: 'mood.inspector' }); } },
      { can: (s2) => s2.influence >= 6 && s2.cash >= 500, apply: (s2) => { s2.extraDemand += 2; s2.deadline = s2.market.t + 8; s2.warned = false; applyEffects(s2, { influence: -6, cash: -500 }); } }] };
    case 'end': return { id: 'end', params: { milestone: ev.milestone }, options: [{ apply: () => {} }, { apply: () => {} }], changesGame: true };
    case 'requisition': return { id: 'requisition', options: [
      { can: pay(1500), apply: (s2) => applyEffects(s2, { cash: -1500 }) },
      { apply: (s2) => { const all = Object.values(s2.families); for (const f of [...new Set([...all.filter((x) => !x.trade), ...all])].slice(0, 6)) delete s2.families[f.id]; } },
      { apply: (s2) => { s2.grantCut = 8; } }] };
  }
}

const eventKey = (ev: QueuedEvent) => ('id' in ev ? ev.id : ev.kind);
/** Resolves the first queued event with the chosen option. */
export function resolveEvent(s: GameState, w: World, option: number): void {
  const ev = s.queue[0];
  if (!ev) return;
  const d = defineEvent(s, ev), op = d.options[option];
  if (!op || (op.can && !op.can(s))) return;
  s.queue.shift();
  chronicle(s, `event.${d.id}.option.${option}.chronicle`, d.params);
  op.apply(s, w);
  if (d.changesGame) { if (ev.kind !== 'intro') { syncFamilies(s); updateRatings(s, w); } return; }
  s.log.push({ t: s.market.t, kind: 'decision', event: eventKey(ev), option });
  updateRatings(s, w);
}

// ---- the season roll

export type News = { key: string; params?: Record<string, string | number> };
const ORIGINS = ['german', 'swedish', 'swiss', 'italian', 'brazilian', 'french', 'belgian', 'english', 'spanish'];
const FROST_GOODS: GoodId[] = ['wheat', 'coffee', 'corn', 'beans', 'tobaccoLeaf', 'cotton'];

/** This season's weather; rain helps crops, storms hurt them and the port, fog slows the canoes. */
export function drawWeather(s: GameState, season: number, frost: boolean, flood: boolean, news: News[]): string {
  if (frost) return 'frost';
  if (flood) return 'flood';
  const P = WEATHER_ODDS[season] as Record<string, number>, ev = s.market.shocks;
  let x = draw(s), kind = 'clear';
  for (const k of Object.keys(P)) { x -= P[k] as number; if (x < 0) { kind = k; break; } }
  if (kind === 'rain') {
    for (const g of ['rice', 'corn', 'beans', 'cassava', 'sugarcane'] as GoodId[]) ev.push({ good: g, kind: 'pest', factor: 1.1, seasonsLeft: 1, reason: 'shock.goodRain' });
    news.push({ key: 'news.goodRain' });
  } else if (kind === 'storm') {
    for (const g of ['corn', 'wheat', 'beans', 'tobaccoLeaf', 'cotton', 'coffee'] as GoodId[]) ev.push({ good: g, kind: 'pest', factor: 0.85, seasonsLeft: 1, reason: 'shock.storm' });
    ev.push({ good: '_port', kind: 'capacity', factor: 0.7, seasonsLeft: 1, reason: 'shock.storm' });
    const repairs = Math.min(300, 4 * Object.keys(s.map.buildings).length);
    s.cash -= repairs; s.effects.push({ satisfaction: -2, seasonsLeft: 1, reason: 'mood.storms' });
    news.push({ key: 'news.storms', params: { repairs } });
  } else if (kind === 'fog') {
    ev.push({ good: '_port', kind: 'capacity', factor: 0.85, seasonsLeft: 1, reason: 'shock.fog' });
    news.push({ key: 'news.fog' });
  }
  return kind;
}

/** Each season: effects wear off, frost and floods, weather, hunger, departures, arrivals, swap requests, dilemmas. */
export function rollEvents(s: GameState, w: World, c: Economy, r: Ratings): News[] {
  const t = s.market.t, season = t % 4, news: News[] = [];
  for (const e of s.effects) e.seasonsLeft -= 1;
  s.effects = s.effects.filter((e) => e.seasonsLeft > 0);
  const odds = hasChoice(s, 'polyculture') ? 0.5 : hasChoice(s, 'monoculture') ? 1.6 : 1;
  let frost = false, flood = false;
  if ((season === 3 || season === 2) && draw(s) < 0.1 * odds) {
    for (const g of FROST_GOODS) s.market.shocks.push({ good: g, kind: 'pest', factor: 0.6, seasonsLeft: 2, reason: 'shock.frost' });
    news.push({ key: 'news.frost' }); s.queue.push({ kind: 'crisis', id: 'frost' }); frost = true;
  }
  if (season === 1 && draw(s) < 0.12) {
    for (const g of ['rice', 'fish'] as GoodId[]) s.market.shocks.push({ good: g, kind: 'pest', factor: 0.6, seasonsLeft: 1, reason: 'shock.flood' });
    s.market.shocks.push({ good: '_port', kind: 'capacity', factor: 0.6, seasonsLeft: 1, reason: 'shock.flood' });
    news.push({ key: 'news.flood' }); s.queue.push({ kind: 'crisis', id: 'flood' }); flood = true;
  }
  s.weather = { t, kind: drawWeather(s, season, frost, flood, news) };
  // hunger: those without training leave first
  const short = c.hunger / Math.max(1, c.marketDemand);
  if (c.hunger > 12 && short > 0.15) {
    s.effects.push({ satisfaction: -8, seasonsLeft: 2, reason: 'mood.hunger' });
    news.push({ key: 'news.hunger', params: { names: loseFamilies(s, Math.min(4, Math.ceil(c.hunger / 30))).join(', ') } });
  }
  // long idle with a poor home: they leave
  const idle = Object.values(s.families).filter((f) => f.idle >= 8).slice(0, 3);
  if (idle.length) { news.push({ key: 'news.idleLeft', params: { names: idle.map((f) => f.surname).join(', ') } }); for (const f of idle) delete s.families[f.id]; }
  // a group of immigrants, if there are empty homes
  const slots = emptySlots(s).length;
  if (slots >= 2 && !s.queue.some((e) => e.kind === 'immigrants') && t >= (s.nextArrival || 0) && draw(s) < arrivalChance(s, r.mean)) {
    const origin = s.immigrationAgent?.origin || (ORIGINS[Math.floor(draw(s) * ORIGINS.length)] as string);
    s.queue.push({ kind: 'immigrants', n: Math.min(slots, Math.max(2, arrivalSize(s, r.mean, () => draw(s)))), origin });
  }
  // at most one crop swap request every two seasons
  if (t >= Math.max(12, s.nextSwapAsk || 0) && !s.queue.some((e) => e.kind === 'cropSwap') && draw(s) < 0.5) {
    const p = cropSwapRequest(s, w, r);
    if (p) { s.queue.push(p); s.nextSwapAsk = t + 2; }
  }
  // consequences due, otherwise maybe a dilemma from the deck
  const due = s.agenda.filter((a) => a.t <= t);
  s.agenda = s.agenda.filter((a) => a.t > t);
  for (const a of due) s.queue.push({ kind: 'dilemma', id: a.id });
  if (!due.length && t >= 14 && t - (s.lastDilemma || 0) >= 2 && draw(s) < 0.45) {
    const can = DECK.filter((id) => { const d = DILEMMAS[id]; return (d.when as NonNullable<Dilemma['when']>)(s, w, r) && t - (s.used[id] === undefined ? -999 : (s.used[id] as number)) >= (d.interval as number); });
    if (can.length) {
      const weights = can.map((id) => (DILEMMAS[id].chance ? (DILEMMAS[id].chance as NonNullable<Dilemma['chance']>)(s, r) : 1));
      let x = draw(s) * weights.reduce((a, b) => a + b, 0), i = 0;
      while (i < can.length - 1 && x > (weights[i] as number)) { x -= weights[i] as number; i += 1; }
      const id = can[i] as DilemmaId;
      s.used[id] = t; s.lastDilemma = t;
      s.queue.push({ kind: 'dilemma', id });
    }
  }
  return news;
}

// ---- crop swaps

const unlocked = (s: GameState, t: BuildingId) => (def(t).minLevel || 1) <= (s.level || 1);
const isGreen = (s: GameState, key: LotKey) => !!s.firstHarvest && (s.firstHarvest[key] ?? -Infinity) > s.market.t;

/** Crops that would lower income if one more were planted (the produce has no way out). */
export function overplanted(s: GameState, w: World): { t: BuildingId; v: number }[] {
  const base = measure(s, w).incomeTotal, have = new Set(Object.values(s.map.buildings));
  return (Object.keys(BUILDINGS) as BuildingId[]).filter((t) => def(t).crop && have.has(t)).map((t) => ({ t, v: measure(s, w, { [t]: 1 }).incomeTotal - base })).filter((x) => x.v <= -5).sort((a, b) => a.v - b.v);
}

/** Crops that fit this lot and how a full year's income would change with each, already harvested. */
export function swapOptions(s: GameState, w: World, key: LotKey): { t: BuildingId; cost: number; gain: number }[] {
  const [a, b] = parseKey(key), current = s.map.buildings[key] as BuildingId;
  const base: GameState = isGreen(s, key) ? { ...s, firstHarvest: { ...(s.firstHarvest ?? {}), [key]: 0 } } : s;
  const r0 = measure(base, w).incomeTotal;
  return (Object.keys(BUILDINGS) as BuildingId[]).filter((t) => t !== current && def(t).crop && def(t).category !== 'retired' && unlocked(s, t) && !canPlace(s.map, w, t, a, b, key))
    .map((t) => ({ t, cost: swapCost(s, key, t), gain: Math.round(measure({ ...base, map: { ...base.map, buildings: { ...s.map.buildings, [key]: t } } }, w).incomeTotal - r0) }))
    .sort((x, y) => y.gain - x.gain);
}
export function swapCost(s: GameState, key: LotKey, to: BuildingId): number {
  const p = s.seasonWork.buildings[key] as number | true | undefined, pt = s.seasonWork.swaps[key] as unknown as { from: BuildingId; cost: number } | true | undefined;
  if (typeof p === 'number') return (BUILDINGS[to].cost || 0) - p;
  if (pt && typeof pt === 'object' && to === pt.from) return -pt.cost;
  return Math.round((BUILDINGS[to].cost || 0) * SWAP_FACTOR);
}

/**
 * A family settled for six years asks to swap its crop: the one that most overflows, or on the weakest soil.
 * (The prototype asked families who had paid off their lot; with lot instalments gone, six years settled
 * stands in for that.)
 */
export function cropSwapRequest(s: GameState, w: World, r: Ratings): QueuedEvent | null {
  const a = allocate(s), over = overplanted(s, w).map((x) => x.t);
  const cands: { key: LotKey; f: GameState['families'][FamilyId]; over: number; soil: number }[] = [];
  for (const key of Object.keys(a.byBuilding) as LotKey[]) {
    const tp = s.map.buildings[key] as BuildingId;
    if (!def(tp).crop || isGreen(s, key) || !r.linked.has(key) || s.seasonWork.swaps[key]) continue;
    const f = a.byBuilding[key]?.families[0];
    if (f && s.market.t - f.arrived >= 24) cands.push({ key, f, over: over.includes(tp) ? 1 : 0, soil: soilOf(w, key, def(tp).output?.good as GoodId) });
  }
  if (!cands.length) return null;
  cands.sort((x, y) => y.over - x.over || x.soil - y.soil);
  const { key, f } = cands[0] as (typeof cands)[number], from = s.map.buildings[key] as BuildingId;
  const op = swapOptions(s, w, key).find((o) => (f!.savings || 0) >= Math.round((BUILDINGS[o.t].cost || 0) * SWAP_FACTOR));
  if (!op || op.gain < 40) return null;
  // what falls with the swap besides the crop itself: the workshop that depended on it
  const c0 = measure(s, w), c1 = measure({ ...s, map: { ...s.map, buildings: { ...s.map.buildings, [key]: op.t } } }, w);
  const losses = GOOD_IDS.map((g) => [g, Math.round(c1.income[g] - c0.income[g])] as [GoodId, number]).filter(([, v]) => v <= -10).sort((x, y) => x[1] - y[1]).slice(0, 2);
  return { kind: 'cropSwap', key, family: f!.id, from, to: op.t, gain: op.gain, cost: Math.round((BUILDINGS[op.t].cost || 0) * SWAP_FACTOR), losses };
}

// ---- city problems (from 150 families): epidemics, fires, disorder

const WOODEN = new Set<BuildingId>(['hut', 'house']);
export function cityRisks(s: GameState, w: World, r: Ratings) {
  const fam = Object.keys(s.families).length, homes = (Object.keys(s.map.buildings) as LotKey[]).filter((k) => def(s.map.buildings[k] as BuildingId).housing && r.linked.has(k)), n = Math.max(1, homes.length), scale = Math.min(1, fam / 250);
  const active = fam >= 150;
  const goodWater = (h: LotKey) => !!r.homes[h]?.items.some((i) => (i.kind === 'service' && i.service === 'water') || i.kind === 'naturalWater');
  const near = (h: LotKey, types: BuildingId[], radius: number) => { const [a, b] = parseKey(h); return (Object.keys(s.map.buildings) as LotKey[]).some((x) => types.includes(s.map.buildings[x] as BuildingId) && r.linked.has(x) && (() => { const [p, q] = parseKey(x); return Math.abs(p - a) + Math.abs(q - b) <= radius; })()); };
  const noWater = homes.filter((h) => !goodWater(h)).length;
  const groups = woodenGroups(s), inGroups = groups.reduce((x, g) => x + g.length, 0);
  const protection = (g: LotKey[]) => { const c0 = g[0] as LotKey; return near(c0, ['fireStation'], 12) ? 0.15 : near(c0, ['fountain'], 7) ? 0.5 : 1; };
  const meanProtection = groups.length ? groups.reduce((x, g) => x + protection(g) * g.length, 0) / Math.max(1, inGroups) : 1;
  const idle = allocate(s).idle.length, distilleries = Object.values(s.map.buildings).filter((t) => t === 'distillery').length;
  const jailCover = homes.filter((h) => near(h, ['jail'], 12)).length / n;
  const disorder = (2.5 * (idle / Math.max(1, fam)) + 0.01 * distilleries) * (1 - 0.7 * jailCover);
  const epidemic = active ? 0.05 * (noWater / n) * scale * (hasLaw(s, 'healthCode') ? 0.5 : 1) * (workDone(s, 'hospital') ? 0.4 : 1) : 0;
  const fire = active ? 0.04 * (inGroups / n) * scale * meanProtection : 0;
  return { active, fam, noWater, homes: n, groups, inGroups, meanProtection, jailCover, disorder, epidemic, fire, distilleries, goodWater };
}
function woodenGroups(s: GameState): LotKey[][] {
  const wood = new Set((Object.keys(s.map.buildings) as LotKey[]).filter((x) => WOODEN.has(s.map.buildings[x] as BuildingId))), seen = new Set<LotKey>(), out: LotKey[][] = [];
  for (const x of wood) {
    if (seen.has(x)) continue;
    const g: LotKey[] = [], q = [x]; seen.add(x);
    while (q.length) { const y = q.pop() as LotKey; g.push(y); const [a, b] = parseKey(y); for (let da = -1; da <= 1; da++) for (let db = -1; db <= 1; db++) { const z = `${a + da},${b + db}` as LotKey; if (wood.has(z) && !seen.has(z)) { seen.add(z); q.push(z); } } }
    if (g.length >= 4) out.push(g);
  }
  return out;
}
function burnHomes(s: GameState, g: LotKey[], news: News[]): void {
  const n = Math.min(g.length, 2 + Math.floor(draw(s) * 4)), start = g[Math.floor(draw(s) * g.length)] as LotKey, [a0, b0] = parseKey(start);
  const target = g.slice().sort((x, y) => { const [p, q] = parseKey(x), [r2, t2] = parseKey(y); return Math.hypot(p - a0, q - b0) - Math.hypot(r2 - a0, t2 - b0); }).slice(0, n);
  const homeless: string[] = [];
  for (const h of target) {
    const fs = Object.values(s.families).filter((f) => homeOf(f.id) === h);
    delete s.map.buildings[h]; delete s.upgrades[h];
    for (const f of fs) { delete s.families[f.id]; const v = emptySlots(s)[0]; if (v) s.families[v] = { ...f, id: v }; else homeless.push(f.surname); }
  }
  news.push({ key: homeless.length ? 'news.fireHomeless' : 'news.fire', params: { n, names: homeless.slice(0, 4).join(', ') } });
  chronicle(s, 'chronicle.fire', { n });
  s.problems.lastFire = s.market.t; s.problems.fireHomes = n;
}
export function advanceProblems(s: GameState, w: World, r: Ratings, news: News[]) {
  const k = cityRisks(s, w, r), P = s.problems, t = s.market.t;
  if (P.epidemic) {
    P.epidemic.seasonsLeft -= 1;
    if (!workDone(s, 'hospital')) {
      const health = (h: LotKey) => !!r.homes[h]?.items.some((i) => i.kind === 'service' && i.service === 'health');
      const exposed = Object.values(s.families).filter((f) => { const h = homeOf(f.id); return !k.goodWater(h) && !health(h); });
      const q = Math.min(exposed.length, Math.max(exposed.length > 30 ? 1 : 0, Math.round(exposed.length * 0.01)));
      for (const f of exposed.slice(0, q)) delete s.families[f.id];
      if (q) news.push({ key: 'news.epidemicDeaths', params: { disease: P.epidemic.disease, n: q } });
    }
    if (P.epidemic.seasonsLeft <= 0) { news.push({ key: 'news.epidemicOver', params: { disease: P.epidemic.disease } }); P.epidemic = null; }
  } else if (k.epidemic && draw(s) < k.epidemic) {
    const disease = draw(s) < 0.5 ? 'fever' : 'cholera';
    const hospital = (Object.keys(s.map.buildings) as LotKey[]).some((x) => s.map.buildings[x] === 'hospital' && r.linked.has(x));
    let d = 2 + Math.floor(draw(s) * 3); if (hospital) d = Math.ceil(d / 2);
    P.epidemic = { disease, seasonsLeft: d, since: t };
    news.push({ key: 'news.epidemic', params: { disease, seasons: d, hospital: hospital ? 1 : 0 } }); chronicle(s, 'chronicle.epidemic', { disease });
  }
  if (k.groups.length && k.fire && draw(s) < k.fire) burnHomes(s, k.groups[Math.floor(draw(s) * k.groups.length)] as LotKey[], news);
  const before = !!P.disorder;
  P.disorder = k.active && k.disorder > 0.15 ? Math.round(k.disorder * 100) / 100 : 0;
  if (P.disorder && !before) news.push({ key: 'news.disorder' });
  if (!P.disorder && before) news.push({ key: 'news.disorderOver' });
  return k;
}

// ---- long, rare crises (from the village on): one at a time, announced a season ahead

export const LONG_CRISES = { republic: { seasons: 6 }, encilhamento: { seasons: 6 }, federalist: { seasons: 0 }, mate: { seasons: 14 } } as const;
export type LongCrisisId = keyof typeof LONG_CRISES;
export function advanceLongCrises(s: GameState, news: News[]): void {
  const t = s.market.t, A = s.crisis, mc = s.market;
  if ((s.grantCut ?? 0) > 0) s.grantCut = (s.grantCut as number) - 1;
  if (A && A.seasonsLeft > 0) {
    A.seasonsLeft -= 1;
    if (A.id === 'encilhamento') { const up = draw(s) < 0.5; for (const g of GOOD_IDS.filter((x) => GOODS[x].exportPrice)) mc.shocks.push({ good: g, kind: 'price', factor: up ? 1.3 : 0.7, seasonsLeft: 1, reason: 'shock.encilhamento' }); news.push({ key: up ? 'news.encilhamentoUp' : 'news.encilhamentoDown' }); }
    if (A.id === 'mate' && A.seasonsLeft === 6) { for (const g of ['yerba', 'mate'] as GoodId[]) mc.shocks.push({ good: g, kind: 'price', factor: 0.6, seasonsLeft: 6, reason: 'shock.mateBust' }); news.push({ key: 'news.mateBust' }); }
    if (A.seasonsLeft <= 0) { news.push({ key: 'news.crisisOver', params: { crisis: A.id } }); s.lastCrisis = t; s.crisis = null; }
    return;
  }
  if (s.nextCrisis) {
    if (t < s.nextCrisis.at) return;
    const id = s.nextCrisis.id; s.nextCrisis = null;
    const d = id === 'federalist' ? 4 + Math.floor(draw(s) * 5) : LONG_CRISES[id].seasons;
    s.crisis = { id, seasonsLeft: d, since: t }; s.crisesSeen = [...(s.crisesSeen ?? []), id];
    chronicle(s, 'chronicle.crisis', { crisis: id });
    if (id === 'republic') { const f = draw(s) < 0.5 ? 1.2 : 0.8; s.grantFactor = (s.grantFactor || 1) * f; news.push({ key: f > 1 ? 'news.republicUp' : 'news.republicDown', params: { seasons: d } }); }
    if (id === 'encilhamento') news.push({ key: 'news.encilhamento', params: { seasons: d } });
    if (id === 'mate') { for (const g of ['yerba', 'mate'] as GoodId[]) mc.shocks.push({ good: g, kind: 'price', factor: 1.6, seasonsLeft: 8, reason: 'shock.mateBoom' }); news.push({ key: 'news.mateBoom' }); }
    if (id === 'federalist') { news.push({ key: 'news.federalist', params: { seasons: d } }); s.queue.push({ kind: 'requisition' }); }
    return;
  }
  if (s.milestone < 2 || t - (s.lastCrisis || 0) < 8) return;
  const free = (Object.keys(LONG_CRISES) as LongCrisisId[]).filter((id) => !(s.crisesSeen ?? []).includes(id));
  if (!free.length || draw(s) >= 0.04) return;
  const id = free[Math.floor(draw(s) * free.length)] as LongCrisisId;
  s.nextCrisis = { id, at: t + 1 + Math.floor(draw(s) * 2) };
  news.push({ key: 'news.crisisWarning', params: { crisis: id } });
}

/** The teachers college: every year, families with a trade get better at it. */
export function teachersCollege(s: GameState): void {
  if (!workDone(s, 'normalSchool') || s.market.t % 4) return;
  for (const f of Object.values(s.families)) if (f.trade) f.skill = Math.min(100, (f.skill || 0) + 2);
}
export { connected, crisisOn, landOf, LEVELS, rateHomes, sectorOf };
