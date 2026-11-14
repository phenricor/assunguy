// What a raw good could still become in a workshop: the arrobas that leave the colony raw or go to waste (exported,
// lost, left in stock), as a share of what is made, and what an arroba of it is worth once processed. The families'
// own table and the colony's market are left alone: that is food and trade the colony already uses.
import { BUILDINGS, type BuildingId, type GoodId } from '@assunguy/data';
import { def, recipesOf, type Economy } from './economy.js';
import { currentPrice } from './market.js';
import type { GameState } from './state.js';

export interface ProcessingPotential {
  good: GoodId;
  /** Arrobas a year made, and those that could go to a workshop. */
  produced: number; potential: number;
  /** potential / produced, 0 to 1. */
  share: number;
  /** The workshop and product that pay most for an arroba of the good, among those the colony can build now. */
  building: BuildingId; to: GoodId;
  /** Price of an arroba of the good, and what it is worth processed (the product's price times the yield). */
  rawPrice: number; processedValue: number;
}

const WORKSHOPS = Object.keys(BUILDINGS) as BuildingId[];
const canBuild = (s: GameState, t: BuildingId) => !def(t).lateGame && (def(t).minLevel ?? 1) <= (s.level || 1);

/** Each raw good the colony makes and could process now, with how much of it could still go to a workshop. */
export function processingPotential(s: GameState, c: Economy): Partial<Record<GoodId, ProcessingPotential>> {
  const out: Partial<Record<GoodId, ProcessingPotential>> = {};
  for (const t of WORKSHOPS) {
    if (!canBuild(s, t)) continue;
    for (const r of recipesOf(t, s.level)) {
      const g = r.from as GoodId, produced = c.produced[g] ?? 0;
      if (produced <= 0.5) continue;
      const rawPrice = currentPrice(s.market, g), processedValue = currentPrice(s.market, r.to as GoodId) * r.ratio;
      const prev = out[g];
      if (prev && prev.processedValue >= processedValue) continue;
      const left = Math.max(0, produced - (c.ownTable[g] ?? 0) - (c.market[g] ?? 0) - (c.processed[g] ?? 0));
      out[g] = { good: g, produced, potential: left, share: left / produced, building: t, to: r.to as GoodId, rawPrice, processedValue };
    }
  }
  return out;
}
