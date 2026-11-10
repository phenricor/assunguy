import { describe, expect, it } from 'vitest';
import type { GoodId } from '@assunguy/data';
import { advanceMarket, currentPrice, initialMarket } from '../src/market.js';
import fixture from './fixtures/market.json' with { type: 'json' };
import { SHOCK_KIND, goodFromLegacy } from './legacy.js';

interface Season { t: number; seed: number; prices: Record<string, number>; shocks: { b: string; tipo: string; f: number; restam: number }[] }
const golden = fixture as unknown as { start: { t: number; seed: number; prices: Record<string, number[]> }; seasons: Season[] };

describe('market (golden, against the prototype)', () => {
  it('builds the same twelve seasons of price history', () => {
    const m = initialMarket();
    expect(m.t).toBe(golden.start.t);
    expect(m.seed).toBe(golden.start.seed);
    for (const [legacy, series] of Object.entries(golden.start.prices)) {
      expect(m.history[goodFromLegacy(legacy) as GoodId], legacy).toEqual(series);
    }
  });

  it('moves prices and draws shocks exactly like the prototype for 24 seasons', () => {
    const m = initialMarket();
    for (const s of golden.seasons) {
      advanceMarket(m);
      expect(m.t).toBe(s.t);
      expect(m.seed).toBe(s.seed);
      for (const [legacy, price] of Object.entries(s.prices)) expect(currentPrice(m, goodFromLegacy(legacy) as GoodId)).toBeCloseTo(price, 12);
      expect(m.shocks.map((x) => [x.good, x.kind, x.factor, x.seasonsLeft])).toEqual(s.shocks.map((x) => [goodFromLegacy(x.b), SHOCK_KIND[x.tipo], x.f, x.restam]));
    }
  });
});
