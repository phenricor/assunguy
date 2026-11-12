// A new game: the starting village of the prototype's "new colony", its eight founding families, the outside
// market from its fixed seed, the first goal (the parish) due in 40 seasons, and the intro decree queued.
import { MILESTONES, type MilestoneDef } from '@assunguy/data';
import { computeEconomy } from './economy.js';
import { syncFamilies, updateSupply } from './families.js';
import { initialMap } from './map.js';
import { initialMarket } from './market.js';
import { settle } from './settle.js';
import type { GameState } from './state.js';
import { generateWorld, type LotKey, type World } from './world.js';

/** The season the game starts in (the prototype's market is twelve seasons old by then). */
export const START_SEASON = 12;

export function newGame(seed: number, mapVersion = 2): { s: GameState; w: World } {
  const w = generateWorld(seed, mapVersion), map = initialMap(w);
  const fleet: GameState['fleet'] = {};
  for (const key of Object.keys(map.buildings) as LotKey[]) if (map.buildings[key] === 'riverPort') fleet[key] = { canoe: 1 };
  const s: GameState = {
    seed, mapVersion, map, upgrades: {}, families: {}, homeRating: {}, health: 1, supply: {}, firstHarvest: null,
    market: initialMarket(), cash: 1500, influence: 3, level: 1, milestone: 0,
    deadline: START_SEASON + ((MILESTONES[1] as MilestoneDef).deadline as number), goalStart: START_SEASON,
    taxes: { lotInstallment: null, tithe: null, exportDuty: null, businessTax: null }, laws: {}, choices: {}, greatWorks: {},
    problems: { epidemic: null, disorder: 0 }, crisis: null, queue: [], agenda: [], used: {}, flags: {}, chronicle: [], log: [],
    warned: false, pendingTaxes: {}, pendingLaws: {}, taxHistory: [], cavesSeen: [], reports: [],
    fleet, tariffMargin: {}, transport: { volume: {}, firewoodShortage: 0 }, effects: [], freightRelief: 0, reliefWorkers: {},
    vacated: {}, arrivalCosts: 0, immigrationAgent: null, produced: {},
    seasonWork: { buildings: {}, streets: {}, upgrades: {}, swaps: {} }, reliefCost: 0, buildCosts: 0, grantFactor: 1,
    intervention: false, extraDemand: 0, race: null,
  };
  syncFamilies(s, true);
  updateSupply(s, computeEconomy(s, w));
  s.queue.push({ kind: 'intro' });
  settle(s, w);
  return { s, w };
}
