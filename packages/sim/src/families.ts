// Families: who lives in each home slot, their trade and skill, arrivals (groups of immigrants and
// children of the colony marrying), departures, savings, and homes they upgrade with their own money.
import { BUILDINGS, GOOD_IDS, type BuildingId, type GoodId, type Sector } from '@assunguy/data';
import { allocate, def, good, sectorOf, type Economy } from './economy.js';
import { mulberry32, hashKey } from './rng.js';
import { crisisOn, homeOf, upgradeOf, workDone, type Family, type FamilyId, type GameState, type Trade } from './state.js';
import { taxEffect, updateRatings } from './ratings.js';
import type { LotKey, World } from './world.js';

/** Surnames by origin; proper names, shown as they are in both languages. */
export const SURNAMES: Record<string, string[]> = {
  german: ['Schmitt', 'Weber', 'Müller', 'Becker', 'Haas'], french: ['Dubois', 'Lefèvre', 'Roux'], english: ['Wood', 'Harris', 'Bennett'],
  swedish: ['Lindqvist', 'Berg'], italian: ['Ferretti', 'Rossi', 'Zanetti', 'Sartori'], swiss: ['Keller', 'Favre'], belgian: ['Peeters', 'Claes'],
  spanish: ['Ortega', 'Vidal'], brazilian: ['Almeida', 'Cardoso', 'Moreira', 'Nogueira', 'Bueno', 'Ribas', 'Pires', 'Mendes', 'Lima', 'Rocha'],
};
const ALL_SURNAMES = Object.values(SURNAMES).flat();
/** The trade each origin most often brings. */
export const ORIGIN_TRADE: Record<string, Trade> = { german: 'crafts', swedish: 'crafts', swiss: 'crafts', italian: 'farming', brazilian: 'farming', french: 'commerce', belgian: 'commerce', english: 'mining', spanish: 'river' };
/** The first families cover what the colony has on day one; capacity cannot depend on luck. */
const FOUNDERS: [Trade | null, number][] = [['farming', 62], ['river', 66], ['commerce', 82], ['farming', 62], ['farming', 62], ['farming', 62], ['crafts', 50], [null, 0], [null, 0], [null, 0]];
export const ARRIVAL_AID = 5;
export const SEED_AID = 6;
const SAVING_SHARE = 0.4;
const FIELD_UPGRADE_COST = [28, 60];
export const HOME_UPGRADE: Partial<Record<BuildingId, { to: BuildingId; cost: number; rating: number; needs: GoodId[] }>> = {
  hut: { to: 'house', cost: 36, rating: 45, needs: ['planks'] },
  house: { to: 'whitewashedHouse', cost: 80, rating: 55, needs: ['rooftiles', 'lime'] },
  whitewashedHouse: { to: 'townhouse', cost: 150, rating: 65, needs: ['rooftiles', 'planks', 'lime'] },
};

export const skillLevel = (h: number): 'master' | 'skilled' | 'apprentice' | 'none' => (h >= 80 ? 'master' : h >= 50 ? 'skilled' : h > 0 ? 'apprentice' : 'none');

/** A family for a home slot, drawn from the slot's own seed so the same slot always gets the same family. */
export function newFamily(s: Pick<GameState, 'greatWorks'> | null, id: FamilyId, newcomer: boolean, origin?: string): Family {
  const r = mulberry32(hashKey(id));
  const x = r();
  // newcomers do not always know how to farm; some arrive with no trade at all
  const bands: [number, Trade | null][] = newcomer ? [[0.35, 'farming'], [0.45, 'river'], [0.6, 'crafts'], [0.65, 'commerce'], [1, null]] : [[0.46, 'farming'], [0.53, 'river'], [0.58, 'crafts'], [0.62, 'commerce'], [1, null]];
  let trade = (bands.find(([p]) => x <= p) as [number, Trade | null])[1];
  if (origin && ORIGIN_TRADE[origin] && r() < 0.7) trade = ORIGIN_TRADE[origin] as Trade;
  let skill = trade ? Math.round((newcomer ? 25 : 30) + r() * (newcomer ? 35 : 45)) : 0;
  if (newcomer && skill && s && workDone(s, 'normalSchool')) skill = Math.min(100, skill + 15);
  const names = origin && SURNAMES[origin] ? (SURNAMES[origin] as string[]) : ALL_SURNAMES;
  return {
    id, surname: names[hashKey(id + 'n' + (newcomer ? Math.floor(r() * 99) : '')) % names.length] as string, trade, skill,
    newcomer: newcomer ? 2 : 0, idle: 0, arrived: newcomer ? 0 : -1, savings: newcomer ? 0 : 4 + (hashKey(id + 'f') % 14), ...(origin ? { origin } : {}),
  };
}

/** Home slots that exist, in building order. */
export function homeSlots(s: Pick<GameState, 'map'>): FamilyId[] {
  const out: FamilyId[] = [];
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    const h = def(s.map.buildings[key] as BuildingId).housing;
    if (h) for (let n = 0; n < h; n++) out.push(`${key}#${n}`);
  }
  return out;
}

/** Keeps families in step with the homes: drops those whose home is gone; on a new game, fills the first homes. */
export function syncFamilies(s: GameState, first = false): void {
  const valid = new Set<FamilyId>();
  for (const id of homeSlots(s)) {
    valid.add(id);
    if (first && !s.families[id]) {
      const f = newFamily(s, id, false);
      f.arrived = 12 - (2 + (hashKey(id + 'c') % 8));
      const [trade, skill] = FOUNDERS[Object.keys(s.families).length % FOUNDERS.length] as [Trade | null, number];
      f.trade = trade; f.skill = skill ? skill + (hashKey(id + 'h') % 8) : 0;
      s.families[id] = f;
    }
  }
  for (const id of Object.keys(s.families) as FamilyId[]) if (!valid.has(id)) delete s.families[id];
}

/** Empty home slots a group of immigrants could take. */
export const emptySlots = (s: GameState): FamilyId[] => homeSlots(s).filter((id) => !s.families[id] && !s.vacated[id]);

/** The least skilled families leave first. Returns their surnames. */
export function loseFamilies(s: GameState, n: number): string[] {
  const out: string[] = [];
  for (const f of Object.values(s.families).sort((a, b) => a.skill - b.skill).slice(0, n)) { out.push(f.surname); delete s.families[f.id]; }
  return out;
}

/** A family without work only thinks of leaving if its home is also poor. */
export function passFamilies(s: GameState): void {
  const a = allocate(s);
  const working = new Set<FamilyId>();
  for (const t of Object.values(a.byBuilding)) for (const f of t.families) working.add(f.id);
  for (const f of Object.values(s.families)) {
    f.newcomer = Math.max(0, f.newcomer - 1);
    const n = s.homeRating[homeOf(f.id)];
    f.idle = working.has(f.id) || s.reliefWorkers[f.id] || (n !== undefined && n >= 55) ? 0 : f.idle + 1;
  }
}

/** Takes in up to `qty` families of an origin, paying arrival aid and seed for each. Returns how many came. */
export function receiveFamilies(s: GameState, qty: number, origin: string): number {
  const slots = emptySlots(s).slice(0, qty);
  for (const id of slots) {
    if (s.cash < ARRIVAL_AID + SEED_AID) continue;
    const f = newFamily(s, id, true, origin);
    f.arrived = s.market.t;
    s.cash -= ARRIVAL_AID + SEED_AID; s.arrivalCosts += ARRIVAL_AID + SEED_AID;
    s.families[id] = f;
  }
  return slots.length;
}

/** How attractive the colony is to immigrants. */
export function fame(s: GameState, meanRating: number) {
  const fam = Object.keys(s.families).length, sat = meanRating || 60;
  const size = 1 + Math.min(0.5, fam / 600), mood = 1 + 0.3 * Math.max(0, Math.min(1, (sat - 60) / 30));
  const agent = s.immigrationAgent ? 1.25 : 1, hospital = workDone(s, 'hospital') ? 1.1 : 1, event = crisisOn(s, 'republic') ? 1.4 : 1;
  return { size, mood, agent, hospital, event, total: size * mood * agent * hospital * event };
}
export const arrivalChance = (s: GameState, meanRating: number): number => (s.immigrationAgent ? 1 : (meanRating || 60) >= 70 ? 0.9 : 0.8);
export const arrivalSize = (s: GameState, meanRating: number, draw: () => number): number => Math.round((4 + Math.floor(draw() * 9)) * (workDone(s, 'railSpur') ? 1.5 : 1) * fame(s, meanRating).total);

/** Children of families settled for four years in good homes form new families, if there is room. */
export function childrenMarry(s: GameState, draw: () => number): number {
  const t = s.market.t, slots = emptySlots(s);
  if (!slots.length) return 0;
  const able = Object.values(s.families).filter((f) => f.arrived <= t - 16 && (s.homeRating[homeOf(f.id)] || 0) >= 75);
  let n = 0;
  for (let i = 0; i < able.length; i++) if (draw() < 0.012) n += 1;
  n = Math.min(4, n, slots.length);
  for (let i = 0; i < n; i++) {
    const id = slots[i] as FamilyId, f = newFamily(s, id, false);
    f.arrived = t; f.savings = 2; f.child = true;
    s.families[id] = f;
  }
  s.childrenThisYear = (s.childrenThisYear ?? 0) + n;
  return n;
}

/** What families found for sale and how varied their table was, for the next ratings. */
export function updateSupply(s: GameState, c: Economy): void {
  s.supply = {}; s.produced = {};
  for (const g of GOOD_IDS) { s.produced[g] = c.produced[g]; if (c.demand[g]) s.supply[g] = c.market[g] / c.demand[g]; }
  const foods = GOOD_IDS.filter((g) => good(g).food).sort((x, y) => (good(y).spoils ? 1 : 0) - (good(x).spoils ? 1 : 0) || good(x).localPrice - good(y).localPrice);
  const eaten = foods.map((g) => (c.ownTable[g] || 0) + (c.market[g] || 0)), tot = eaten.reduce((x, y) => x + y, 0);
  s.variety = tot ? eaten.filter((v) => v / tot >= 0.08).length : 0;
}

/**
 * Families save part of their income, then upgrade their own fields and homes when they can pay and the
 * materials exist.
 */
export function familiesInvest(s: GameState, w: World, c: Economy) {
  const tax = taxEffect(s, w), income = incomePerFamily(s, tax.groups, tax.economy.counts.work);
  for (const f of Object.values(s.families)) f.savings = Math.max(0, (f.savings || 0) + (Math.max(0, income[f.id] || 0) / 4) * SAVING_SHARE);
  const done = { homes: {} as Partial<Record<BuildingId, number>>, fields: 0, spent: 0 };
  const a = allocate(s);
  for (const key of Object.keys(a.byBuilding) as LotKey[]) {
    if (!def(s.map.buildings[key] as BuildingId).crop) continue;
    const lv = upgradeOf(s, key), f = a.byBuilding[key]?.families[0];
    if (lv < 2 && f && (f.savings || 0) >= (FIELD_UPGRADE_COST[lv] as number)) { f.savings -= FIELD_UPGRADE_COST[lv] as number; s.upgrades[key] = lv + 1; done.fields += 1; done.spent += FIELD_UPGRADE_COST[lv] as number; }
  }
  const ratings = updateRatings(s, w).homes; // the prototype's calcula here re-rated the live colony
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    const t = s.map.buildings[key] as BuildingId, up = HOME_UPGRADE[t];
    if (!up || (def(up.to).minLevel ?? 1) > s.level) continue;
    if (!up.needs.every((g) => c.produced[g] > 1)) continue;
    const r = ratings[key]?.rating;
    if (r === undefined || r < up.rating) continue;
    const fs = Object.values(s.families).filter((f) => homeOf(f.id) === key), fund = fs.reduce((x, f) => x + (f.savings || 0), 0);
    if (!fs.length || fund < up.cost) continue;
    const share = up.cost / fund;
    for (const f of fs) f.savings -= f.savings * share;
    s.map.buildings[key] = up.to;
    done.homes[up.to] = (done.homes[up.to] ?? 0) + 1; done.spent += up.cost;
  }
  return done;
}

/** Each family's yearly income: by its sector's after-tax income per family, or day labour when idle. */
export function incomePerFamily(s: GameState, groups: { group: Sector | 'idle'; after: number }[], work: ReturnType<typeof allocate>): Partial<Record<FamilyId, number>> {
  const q: Partial<Record<string, number>> = {};
  for (const g of groups) q[g.group] = g.after;
  const out: Partial<Record<FamilyId, number>> = {};
  for (const key of Object.keys(work.byBuilding) as LotKey[]) for (const f of (work.byBuilding[key] as { families: Family[] }).families) out[f.id] = q[sectorOf(s.map.buildings[key] as BuildingId) as string] || 0;
  for (const f of work.idle) out[f.id] = (q.idle || 0) * lotFactor(f) + (s.reliefWorkers[f.id] ? RELIEF_WAGE * 4 : 0);
  return out;
}
/** Not every lot yields the same: land, hands and luck vary from family to family. */
export const lotFactor = (f: Pick<Family, 'id'>): number => 0.6 + (0.8 * (hashKey(f.id + 'l') % 100)) / 100;
export const RELIEF_WAGE = 3;
export { BUILDINGS };
