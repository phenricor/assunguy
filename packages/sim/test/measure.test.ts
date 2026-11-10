import { describe, expect, it } from 'vitest';
import type { Extra } from '../src/economy.js';
import { measure } from '../src/measure.js';
import { generateWorld } from '../src/world.js';
import fixture from './fixtures/measure.json' with { type: 'json' };
import { LEGACY, legacyState } from './legacy.js';

const cases = fixture as unknown as Record<string, { state: Record<string, unknown>; runs: { x: Record<string, unknown>; renda: number; fora: number; perda: number }[] }>;
const toExtra = (x: Record<string, unknown>): Extra => Object.fromEntries(Object.entries(x).map(([k, v]) => k === 'rendimento'
  ? ['yield', Object.fromEntries(Object.entries(v as Record<string, number>).map(([s, f]) => [(LEGACY.sectors as Record<string, string>)[s], f]))]
  : [(LEGACY.buildings as Record<string, string>)[k], v])) as Extra;

describe('measuring hypothetical buildings (golden, against the playtester saves)', () => {
  for (const [name, c] of Object.entries(cases)) {
    it(`${name}: same income, exports and losses for each hypothetical building`, () => {
      const s = legacyState(c.state), w = generateWorld(s.seed, s.mapVersion);
      for (const r of c.runs) {
        const e = measure(s, w, toExtra(r.x));
        expect(e.incomeTotal, JSON.stringify(r.x)).toBeCloseTo(r.renda, 6);
        expect(e.exportedTotal, JSON.stringify(r.x)).toBeCloseTo(r.fora, 6);
        expect(e.lostTotal, JSON.stringify(r.x)).toBeCloseTo(r.perda, 6);
      }
    });
  }
});
