// The outside market: each good's price drifts toward a reference, and short shocks (pests, a drop in
// demand at the port, weather) push it around for a few seasons.
import { GOODS, GOOD_IDS, type GoodId } from '@assunguy/data';
import { lcgNext } from './rng.js';

export type ShockKind = 'pest' | 'demand' | 'price' | 'capacity';

/** A temporary multiplier on one good (or a pseudo-good like the river port's capacity). */
export interface MarketShock {
  good: GoodId | '_port';
  kind: ShockKind;
  factor: number;
  seasonsLeft: number;
  /** i18n key that names the cause, with its params. */
  reason: string;
  reasonParams?: Record<string, string>;
}

export interface MarketState {
  /** Season counter (see calendar.ts). */
  t: number;
  seed: number;
  history: Partial<Record<GoodId, number[]>>;
  shocks: MarketShock[];
}

const HISTORY = 16;
/** Goods that can be hit by a random shock, in draw order. */
const SHOCKABLE: GoodId[] = ['corn', 'beans', 'rice', 'wheat', 'planks', 'rooftiles', 'saltFish', 'mate', 'ropeTobacco', 'driedCoffee', 'rapadura'];
const PEST_PRONE: GoodId[] = ['corn', 'beans', 'rice', 'wheat'];

const referencePrice = (g: GoodId): number => GOODS[g].exportPrice || GOODS[g].localPrice;

/** Product of all active shocks of one kind on one good (1 when none). */
export function shockFactor(market: MarketState, good: GoodId | '_port', kind: ShockKind): number {
  let f = 1;
  for (const s of market.shocks) if (s.good === good && s.kind === kind) f *= s.factor;
  return f;
}

export function currentPrice(market: MarketState, good: GoodId): number {
  const series = market.history[good];
  return series && series.length ? (series[series.length - 1] as number) : referencePrice(good);
}

export interface AdvanceOptions {
  /** Scales the chance of a random shock (polyculture lowers it, monoculture raises it). */
  shockOdds?: number;
}

/** One season of the outside market. Draws from the market's own seed in a fixed order. */
export function advanceMarket(market: MarketState, opts: AdvanceOptions = {}): void {
  for (const g of GOOD_IDS) {
    const ref = referencePrice(g) * (0.7 + 0.3 * shockFactor(market, g, 'demand')) * (1 + (1 - shockFactor(market, g, 'pest')) * 0.25) * shockFactor(market, g, 'price');
    const before = currentPrice(market, g);
    const next = before + (ref - before) * 0.4 + (lcgNext(market) - 0.5) * ref * 0.07;
    market.history[g] = [...(market.history[g] ?? []), Math.max(0.2, next)].slice(-HISTORY);
  }
  for (const s of market.shocks) s.seasonsLeft -= 1;
  market.shocks = market.shocks.filter((s) => s.seasonsLeft > 0);
  market.t += 1;
  if (lcgNext(market) < 0.22 * (opts.shockOdds ?? 1)) {
    const good = SHOCKABLE[Math.floor(lcgNext(market) * SHOCKABLE.length)] as GoodId;
    if (!market.shocks.some((s) => s.good === good)) {
      const pest = PEST_PRONE.includes(good) && lcgNext(market) < 0.6;
      market.shocks.push(
        pest
          ? { good, kind: 'pest', factor: 0.7, seasonsLeft: 3, reason: 'shock.pest', reasonParams: { good } }
          : { good, kind: 'demand', factor: 0.65 + lcgNext(market) * 0.1, seasonsLeft: 3, reason: 'shock.demandDrop', reasonParams: { good } },
      );
    }
  }
}

/** Twelve seasons of simulated history so the first year already has trends; the game opens with no shocks. */
export function initialMarket(seed = 1869): MarketState {
  const market: MarketState = { t: 0, seed, history: {}, shocks: [] };
  for (let n = 0; n < 12; n++) {
    advanceMarket(market);
    market.shocks = [];
  }
  market.t = 12;
  market.shocks = [];
  return market;
}
