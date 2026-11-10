// Settling the colony after any change, as the prototype's `mudou` did: fields not yet harvested get their
// first harvest, families follow the homes and the homes are re-rated.
import { def } from './economy.js';
import { firstHarvest } from './events.js';
import { syncFamilies } from './families.js';
import { updateRatings } from './ratings.js';
import type { BuildingId } from '@assunguy/data';
import type { GameState } from './state.js';
import type { LotKey, World } from './world.js';

/** After any change: fields not yet harvested get their first harvest, families follow the homes, homes are re-rated. */
export function settle(s: GameState, w: World): void {
  const crops = (Object.keys(s.map.buildings) as LotKey[]).filter((k) => def(s.map.buildings[k] as BuildingId).crop);
  if (!s.firstHarvest) { s.firstHarvest = {}; for (const k of crops) s.firstHarvest[k] = 0; }
  else {
    for (const k of crops) if (s.firstHarvest[k] === undefined) s.firstHarvest[k] = firstHarvest(s.map.buildings[k] as BuildingId, s.market.t);
    for (const k of Object.keys(s.firstHarvest) as LotKey[]) if (!s.map.buildings[k] || !def(s.map.buildings[k] as BuildingId).crop) delete s.firstHarvest[k];
  }
  syncFamilies(s);
  updateRatings(s, w);
}

/** The colony's mean rating as last computed (the prototype's `C.media`), from the stored home ratings. */
export function storedMean(s: GameState): number {
  let sum = 0, n = 0;
  for (const id of Object.keys(s.families)) { const h = id.split('#')[0] as LotKey, r = s.homeRating[h]; if (r === undefined) continue; sum += r; n += 1; }
  return n ? Math.round(sum / n) : 0;
}

/** A change measured the way the prototype's `medindo` did: rated before, changed, families synced, rated after. */
export function measuredChange(s: GameState, w: World, change: () => void): void {
  updateRatings(s, w);
  change();
  syncFamilies(s);
  updateRatings(s, w);
}
