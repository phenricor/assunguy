// What the player does between seasons: build, move, demolish, upgrade, open streets, explore and annex
// lands, buy and sell vehicles, set tariffs, swap crops, propose taxes and town laws, start great works,
// hire the immigration agent and ask the province for help. Each command checks what the prototype's
// screens checked, changes the state, and settles it the way the prototype's `mudou` did: fields get their
// first harvest, families follow the homes and the homes are re-rated. Building costs paid this season are
// kept in `seasonWork`, so demolishing or undoing before the season passes gives the money back.
import { GREAT_WORKS, LAWS, MILESTONES, TRANSPORT_ROLES, VEHICLES, type BuildingId, type GoodId, type GreatWorkId, type TransportRoleDef, type VehicleDef, type VehicleId } from '@assunguy/data';
import { annexCost, upgradeCost } from './advisor.js';
import { costOf, def } from './economy.js';
import { applyEffects, chronicle, firstHarvest } from './events.js';
export { settle } from './settle.js';
import { cellsOf } from './map.js';
import { canPlace, canPlaceStreet, type PlacementError } from './placement.js';
import { updateRatings } from './ratings.js';
import { measuredChange, settle } from './settle.js';
import { change, snapshot } from './report.js';
import { AGENT_COST } from './season.js';
import { opened, raceBuilding, railBlocked, railCost } from './race.js';
import { occupancy } from './map.js';
import { upgradeOf, type FamilyId, type GameState, type TaxId, type TaxLaw } from './state.js';
import { fleetOf, fleetSize, fleetSlots } from './transport.js';
import { lotKey, parseKey, type LandId, type LotKey, type World } from './world.js';

export type CommandError =
  | PlacementError | 'noCash' | 'noInfluence' | 'locked' | 'notHere' | 'sameLot' | 'councilHasLaws' | 'notFamilyPaid' | 'maxLevel'
  | 'streetLimit' | 'notNeighbour' | 'alreadyKnown' | 'unknownLand' | 'alreadyOurs' | 'wrongVehicle' | 'noSlot' | 'noVehicle'
  | 'notCrop' | 'stillGreen' | 'cropNotFit' | 'noCouncil' | 'noLawSlot' | 'needsLaw' | 'badRate' | 'alreadyAsked' | 'inspector' | 'noMilestone';
export type CommandResult = { ok: true; refund?: number } | { ok: false; error: CommandError };
const ok = (refund?: number): CommandResult => (refund ? { ok: true, refund } : { ok: true });
const fail = (error: CommandError): CommandResult => ({ ok: false, error });

export const STREET_COST = 5;
export const EXPEDITION_COST = 60;
const unlocked = (s: GameState, t: BuildingId) => (!def(t).lateGame || raceBuilding(s, t)) && (def(t).minLevel || 1) <= (s.level || 1);
const onRails = (s: GameState, cells: [number, number][]) => !!s.race && cells.some(([x, y]) => s.race!.rails[lotKey(x, y)]);
const roleOf = (t: BuildingId) => (TRANSPORT_ROLES as Partial<Record<BuildingId, TransportRoleDef>>)[t];
const log = (s: GameState, kind: string, extra: Record<string, unknown> = {}) => { s.log.push({ t: s.market.t, kind, ...extra }); if (s.log.length > 600) s.log.splice(0, 100); };

/** Streets the work gangs can open in a season. */
export const streetLimit = (s: GameState): number =>
  24 + (s.extraStreets || 0) + (s.laws.workParty ? 12 : 0) + ((s.level || 1) - 1) * 3
  + (Object.keys(s.map.buildings) as LotKey[]).filter((k) => s.map.buildings[k] === 'directorate').reduce((n, k) => n + 8 + 4 * upgradeOf(s, k), 0);
export const streetsThisSeason = (s: GameState): number => Object.keys(s.seasonWork.streets).length;

export function build(s: GameState, w: World, type: BuildingId, a: number, b: number): CommandResult {
  if (!unlocked(s, type)) return fail('locked');
  const er = canPlace(s.map, w, type, a, b);
  if (er) return fail(er);
  if (onRails(s, cellsOf(a, b, type))) return fail('buildingHere');
  const cost = costOf(type, s.milestone);
  if (s.cash < cost) return fail('noCash');
  const key = lotKey(a, b);
  const ch = measuredChange(s, w, () => { s.map.buildings[key] = type; for (const [x, y] of cellsOf(a, b, type)) delete s.map.trees[lotKey(x, y)]; });
  s.cash -= cost; s.buildCosts += cost; s.seasonWork.buildings[key] = cost;
  log(s, 'built', { building: type, key, cost, change: ch });
  settle(s, w);
  return ok();
}

/** Moving is free; families move with their home, and an upgrade or a pending payment moves with the building. */
export function move(s: GameState, w: World, from: LotKey, a: number, b: number): CommandResult {
  const type = s.map.buildings[from] as BuildingId | undefined;
  if (!type) return fail('notHere');
  const key = lotKey(a, b);
  if (key === from) return fail('sameLot');
  const er = canPlace(s.map, w, type, a, b, from);
  if (er) return fail(er);
  const ch = measuredChange(s, w, () => {
  if (def(type).housing) for (const id of Object.keys(s.families) as FamilyId[]) {
    if (!id.startsWith(`${from}#`)) continue;
    const f = s.families[id]!, to = `${key}#${id.split('#')[1]}` as FamilyId;
    delete s.families[id]; f.id = to; s.families[to] = f;
    delete s.vacated[to];
  }
  delete s.map.buildings[from];
  if (s.upgrades[from] !== undefined) { s.upgrades[key] = s.upgrades[from]!; delete s.upgrades[from]; }
  s.map.buildings[key] = type;
  for (const [x, y] of cellsOf(a, b, type)) delete s.map.trees[lotKey(x, y)];
  });
  for (const part of ['buildings', 'upgrades', 'swaps'] as const) {
    const m = s.seasonWork[part] as Record<string, unknown>;
    if (from in m) { m[key] = m[from]; delete m[from]; }
  }
  if (s.fleet[from]) { s.fleet[key] = s.fleet[from]!; delete s.fleet[from]; }
  if (s.tariffMargin[from] !== undefined) { s.tariffMargin[key] = s.tariffMargin[from]!; delete s.tariffMargin[from]; }
  if (s.firstHarvest && s.firstHarvest[from] !== undefined) { s.firstHarvest[key] = s.firstHarvest[from]!; delete s.firstHarvest[from]; }
  log(s, 'moved', { building: type, from, key, change: ch });
  settle(s, w);
  return ok();
}

/** Demolishing gives back what was paid this season for the building, its upgrade or its crop swap. */
export function demolish(s: GameState, w: World, key: LotKey): CommandResult {
  const type = s.map.buildings[key] as BuildingId | undefined;
  if (!type) return fail('notHere');
  if (type === 'council' && Object.values(s.map.buildings).filter((x) => x === 'council').length === 1 && (Object.keys(s.laws).length || Object.values(s.taxes).some((l) => l && (l.general || Object.keys(l.byGood ?? {}).length)))) return fail('councilHasLaws');
  const refund = (s.seasonWork.buildings[key] ?? 0) + (s.seasonWork.upgrades[key]?.cost ?? 0) + (s.seasonWork.swaps[key]?.cost ?? 0);
  const ch = measuredChange(s, w, () => { delete s.map.buildings[key]; delete s.upgrades[key]; });
  if (refund) { s.cash += refund; s.buildCosts = Math.max(0, s.buildCosts - refund); }
  delete s.seasonWork.buildings[key]; delete s.seasonWork.upgrades[key]; delete s.seasonWork.swaps[key];
  delete s.fleet[key]; delete s.tariffMargin[key];
  log(s, refund ? 'cancelled' : 'demolished', { building: type, key, change: ch });
  settle(s, w);
  return ok(refund);
}

/** The colony pays to upgrade what it runs; families upgrade their homes and fields themselves. */
export function upgrade(s: GameState, w: World, key: LotKey): CommandResult {
  const type = s.map.buildings[key] as BuildingId | undefined;
  if (!type) return fail('notHere');
  if (def(type).payer === 'families') return fail('notFamilyPaid');
  const lv = upgradeOf(s, key);
  if (lv >= 2) return fail('maxLevel');
  const cost = upgradeCost(type, lv, s.milestone);
  if (s.cash < cost) return fail('noCash');
  s.cash -= cost; s.buildCosts += cost;
  const p = s.seasonWork.upgrades[key];
  s.seasonWork.upgrades[key] = { cost: (p?.cost ?? 0) + cost, from: p ? p.from : lv };
  const ch = measuredChange(s, w, () => { s.upgrades[key] = lv + 1; });
  log(s, 'upgraded', { building: type, key, cost, change: ch });
  settle(s, w);
  return ok();
}

export function undoUpgrade(s: GameState, w: World, key: LotKey): CommandResult {
  const p = s.seasonWork.upgrades[key];
  if (!p) return fail('notHere');
  measuredChange(s, w, () => { if (p.from) s.upgrades[key] = p.from; else delete s.upgrades[key]; });
  delete s.seasonWork.upgrades[key];
  s.cash += p.cost; s.buildCosts = Math.max(0, s.buildCosts - p.cost);
  settle(s, w);
  return ok(p.cost);
}

/** Opens a straight line of streets, lot by lot, until one cannot be opened. Returns how many were. */
export function streets(s: GameState, w: World, from: [number, number], to: [number, number]): CommandResult & { opened: number } {
  const [x0, y0] = from, [x1, y1] = to;
  if (x0 !== x1 && y0 !== y1) return { ...fail('notHere'), opened: 0 };
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), cells: [number, number][] = [];
  for (let i = 0; i <= steps; i++) cells.push([x0 + Math.sign(x1 - x0) * i, y0 + Math.sign(y1 - y0) * i]);
  let opened = 0, error: CommandError | null = null;
  updateRatings(s, w);
  const before = snapshot(s, w);
  for (const [p, q] of cells) {
    const key = lotKey(p, q);
    if (s.map.streets[key]) continue;
    let e: CommandError | null = canPlaceStreet(s.map, w, p, q);
    if (!e && s.cash < STREET_COST) e = 'noCash';
    if (!e && streetsThisSeason(s) >= streetLimit(s)) e = 'streetLimit';
    if (e) { error = e; break; }
    s.map.streets[key] = true; delete s.map.trees[key];
    s.cash -= STREET_COST; s.buildCosts += STREET_COST; s.seasonWork.streets[key] = STREET_COST;
    opened++;
  }
  if (opened) { updateRatings(s, w); log(s, 'built', { building: 'street', n: opened, cost: opened * STREET_COST, change: change(before, snapshot(s, w)) }); settle(s, w); }
  return error && !opened ? { ...fail(error), opened } : { ok: true, opened };
}

export function undoStreet(s: GameState, w: World, key: LotKey): CommandResult {
  const v = s.seasonWork.streets[key];
  if (v === undefined) return fail('notHere');
  delete s.map.streets[key]; delete s.seasonWork.streets[key];
  s.cash += v; s.buildCosts = Math.max(0, s.buildCosts - v);
  settle(s, w);
  return ok(v);
}

/** Removing an older street: free, nothing back. */
export function demolishStreet(s: GameState, w: World, key: LotKey): CommandResult {
  if (!s.map.streets[key]) return fail('notHere');
  if (s.seasonWork.streets[key] !== undefined) return undoStreet(s, w, key);
  delete s.map.streets[key];
  settle(s, w);
  return ok();
}

/** Lays rails in a straight line, lot by lot, while the cash and the ground allow (the race only). */
export function rails(s: GameState, w: World, from: [number, number], to: [number, number]): CommandResult & { laid: number; cost: number } {
  if (!s.race) return { ...fail('locked'), laid: 0, cost: 0 };
  const [x0, y0] = from, [x1, y1] = to;
  if (x0 !== x1 && y0 !== y1) return { ...fail('notHere'), laid: 0, cost: 0 };
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), occ = occupancy(s.map);
  let laid = 0, spent = 0, error: CommandError | null = null;
  for (let i = 0; i <= steps; i++) {
    const p = x0 + Math.sign(x1 - x0) * i, q = y0 + Math.sign(y1 - y0) * i, key = lotKey(p, q);
    if (s.race.rails[key]) continue;
    const why = railBlocked(s, w, p, q, occ);
    if (why) { error = why === 'unknownLand' ? 'unknownLand' : 'buildingHere'; break; }
    const c = railCost(s, w, p, q);
    if (s.cash < c) { error = 'noCash'; break; }
    s.race.rails[key] = true; delete s.map.trees[key];
    s.cash -= c; s.buildCosts += c; spent += c; laid++;
  }
  if (laid) { log(s, 'built', { building: 'rail', n: laid, cost: spent }); settle(s, w); }
  return error && !laid ? { ...fail(error), laid, cost: spent } : { ok: true, laid, cost: spent };
}

const neighbourOfOurs = (s: GameState, id: LandId) => { const [c, l] = parseKey(id); return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).some(([x, y]) => s.map.lands[`${c + x},${l + y}` as LandId] === 'ours'); };

/** An expedition maps a neighbouring land in the same season (the review dropped the wait). */
export function explore(s: GameState, w: World, id: LandId): CommandResult {
  if (!w.lands[id]) return fail('unknownLand');
  if (s.map.lands[id]) return fail('alreadyKnown');
  if (!neighbourOfOurs(s, id)) return fail('notNeighbour');
  if (s.cash < EXPEDITION_COST) return fail('noCash');
  s.cash -= EXPEDITION_COST; s.buildCosts += EXPEDITION_COST;
  s.map.lands[id] = 'seen';
  log(s, 'explored', { land: id });
  chronicle(s, 'chronicle.explored', { land: id });
  return ok();
}

export function annex(s: GameState, w: World, id: LandId): CommandResult {
  if (!w.lands[id]) return fail('unknownLand');
  if (s.map.lands[id] === 'ours') return fail('alreadyOurs');
  if (s.map.lands[id] !== 'seen') return fail('unknownLand');
  if (!neighbourOfOurs(s, id)) return fail('notNeighbour');
  const c = annexCost(s);
  if (s.influence < c.influence) return fail('noInfluence');
  if (s.cash < c.cash) return fail('noCash');
  s.influence -= c.influence; s.cash -= c.cash; s.buildCosts += c.cash;
  s.map.lands[id] = 'ours';
  log(s, 'annexed', { land: id });
  chronicle(s, 'chronicle.annexed', { land: id });
  settle(s, w);
  return ok();
}

export function buyVehicle(s: GameState, w: World, key: LotKey, v: VehicleId): CommandResult {
  const t = s.map.buildings[key] as BuildingId | undefined, V = VEHICLES[v] as VehicleDef | undefined;
  if (!t || !V || !(roleOf(t)?.vehicles ?? []).includes(v)) return fail('wrongVehicle');
  if ((V.lateGame && !(s.race && (v === 'railcar' || v === 'lightTrain' || opened(s, v)))) || (s.level || 1) < (V.minLevel || 1)) return fail('locked');
  if (fleetSize(s, key) >= fleetSlots(s, key)) return fail('noSlot');
  if (s.cash < V.price) return fail('noCash');
  s.cash -= V.price; s.buildCosts += V.price;
  const f = { ...fleetOf(s, key) }; f[v] = (f[v] ?? 0) + 1; s.fleet[key] = f;
  chronicle(s, 'chronicle.boughtVehicle', { vehicle: v, building: t });
  settle(s, w);
  return ok();
}

/** Selling gives back half the price. */
export function sellVehicle(s: GameState, w: World, key: LotKey, v: VehicleId): CommandResult {
  const f = { ...fleetOf(s, key) };
  if (!f[v]) return fail('noVehicle');
  f[v] = (f[v] as number) - 1; if (!f[v]) delete f[v];
  s.fleet[key] = f;
  const back = Math.round((VEHICLES[v] as VehicleDef).price * 0.5);
  s.cash += back;
  settle(s, w);
  return ok(back);
}

/** The margin a collection point or gateway charges over cost; 0 is at cost. */
export function setMargin(s: GameState, w: World, key: LotKey, margin: number): CommandResult {
  if (!s.map.buildings[key] || !roleOf(s.map.buildings[key] as BuildingId)) return fail('notHere');
  if (margin) s.tariffMargin[key] = margin; else delete s.tariffMargin[key];
  settle(s, w);
  return ok();
}

/** The family replants the same lot: the level stays, the harvest starts over; swapping back undoes it. */
export function swapCrop(s: GameState, w: World, key: LotKey, to: BuildingId): CommandResult {
  const from = s.map.buildings[key] as BuildingId | undefined;
  if (!from || !def(from).crop || !def(to).crop || from === to) return fail('notCrop');
  if (!unlocked(s, to) || def(to).category === 'retired') return fail('locked');
  const [a, b] = parseKey(key);
  const er = canPlace(s.map, w, to, a, b, key);
  if (er) return fail('cropNotFit');
  const pt = s.seasonWork.swaps[key], built = s.seasonWork.buildings[key];
  const cost = built !== undefined ? costOf(to, s.milestone) - built : pt && to === pt.from ? -pt.cost : Math.round(costOf(to, s.milestone) * 0.5);
  if (cost > 0 && s.cash < cost) return fail('noCash');
  s.cash -= cost; s.buildCosts = Math.max(0, s.buildCosts + cost);
  s.firstHarvest ??= {};
  const back = !!pt && to === pt.from;
  if (built !== undefined) s.seasonWork.buildings[key] = costOf(to, s.milestone);
  else if (back) delete s.seasonWork.swaps[key];
  else { const p = pt ?? { from, cost: 0, firstHarvest: s.firstHarvest[key] ?? 0 }; p.cost += cost; s.seasonWork.swaps[key] = p; }
  const ch = measuredChange(s, w, () => { s.map.buildings[key] = to; s.firstHarvest![key] = back ? pt!.firstHarvest : firstHarvest(to, s.market.t); });
  log(s, back ? 'unswapped' : 'swapped', { building: to, from, cost, change: ch });
  settle(s, w);
  return ok(cost < 0 ? -cost : undefined);
}

const hasCouncil = (s: GameState) => Object.values(s.map.buildings).includes('council');
/** Town laws that can be in force (or proposed) at once. */
export const lawSlots = (s: GameState): number =>
  1 + (Object.keys(s.map.buildings) as LotKey[]).filter((k) => s.map.buildings[k] === 'council').reduce((x, k) => x + 2 + upgradeOf(s, k), 0) + ((s.level || 1) >= 10 ? 1 : 0);

/** A tax proposal (or its repeal, with null) comes into force at the end of the season. */
export function proposeTax(s: GameState, id: TaxId, law: TaxLaw | null): CommandResult {
  if (!hasCouncil(s)) return fail('noCouncil');
  const rates = law ? [law.general, ...Object.values(law.byGood ?? {})] : [];
  if (rates.some((r) => !(r! >= 0 && r! <= 0.5))) return fail('badRate');
  s.pendingTaxes[id] = law ? { general: law.general, ...(law.byGood ? { byGood: { ...law.byGood } as Partial<Record<GoodId, number>> } : {}) } : null;
  log(s, 'proposed', { tax: id });
  return ok();
}

/** Proposes a town law, cancels a proposal, or repeals a law in force (repealing Sunday work repeals long hours too). */
export function toggleLaw(s: GameState, w: World, id: string): CommandResult {
  if (!(id in LAWS)) return fail('notHere');
  if (s.laws[id]) {
    delete s.laws[id]; if (id === 'sundayWork') delete s.laws.longHours;
    log(s, 'repealed', { law: id }); chronicle(s, 'chronicle.lawRepealed', { law: id });
  } else if (s.pendingLaws[id]) delete s.pendingLaws[id];
  else {
    if (!hasCouncil(s)) return fail('noCouncil');
    if (Object.keys(s.laws).length + Object.keys(s.pendingLaws).length >= lawSlots(s)) return fail('noLawSlot');
    const req = (LAWS as Record<string, { requires?: string }>)[id]!.requires;
    if (req && !s.laws[req]) return fail('needsLaw');
    s.pendingLaws[id] = true;
    log(s, 'proposed', { law: id });
  }
  updateRatings(s, w);
  return ok();
}

/** Starting a great work: its instalments are paid at the end of each season while the cash allows. */
export function setGreatWork(s: GameState, id: GreatWorkId, active: boolean): CommandResult {
  if (!(id in GREAT_WORKS)) return fail('notHere');
  const g = (s.greatWorks[id] ??= { paid: 0 });
  if (g.done) return fail('notHere');
  g.active = active;
  return ok();
}

/** The immigration agent: a group every season, paid each season. */
export function setAgent(s: GameState, hire: boolean): CommandResult {
  if (hire) {
    if (s.cash < AGENT_COST(s)) return fail('noCash');
    s.immigrationAgent = {};
    chronicle(s, 'chronicle.agentHired');
  } else { s.immigrationAgent = null; chronicle(s, 'chronicle.agentEnded'); }
  return ok();
}

/** The province: extra funds raise the families the goal asks for; more time is once per goal and not with the inspector here. */
export function askProvince(s: GameState, request: 'extraFunds' | 'extraTime'): CommandResult {
  if (request === 'extraFunds') {
    if (s.influence < 4) return fail('noInfluence');
    applyEffects(s, { influence: -4, cash: 400, extraDemand: 1 });
    chronicle(s, 'chronicle.askedFunds');
  } else {
    if (!MILESTONES[s.milestone + 1]) return fail('noMilestone');
    if (s.extendedDeadline) return fail('alreadyAsked');
    if (s.intervention) return fail('inspector');
    if (s.influence < 6) return fail('noInfluence');
    applyEffects(s, { influence: -6 });
    s.deadline += 4; s.extendedDeadline = true;
    chronicle(s, 'chronicle.askedTime');
  }
  log(s, 'asked', { request });
  return ok();
}

