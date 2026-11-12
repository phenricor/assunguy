import { describe, expect, it } from 'vitest';
import { createTranslator } from '@assunguy/i18n';
import { SEAT_LAND, generateWorld, lotKey } from '../src/world.js';
import fixture from './fixtures/world.json' with { type: 'json' };
import { LEGACY, goodFromLegacy } from './legacy.js';
import { applyPrototypeRules } from './prototypeRules.js';

applyPrototypeRules();

interface Case {
  seed: number; version: number; phases: number[]; bank: number[]; width: number[]; water: number;
  lands: Record<string, { biome: string; place: number | 'seat'; upper: boolean; forest: number; soil: Record<string, number> }>;
  deposits: Record<string, string>; heights: [number, number, number][]; next: number[];
}
const cases = fixture as unknown as Case[];
const biome = (id: string) => LEGACY.biomes?.[id] as string;
const deposit = (id: string) => LEGACY.deposits?.[id] as string;

describe('world generation (golden, against the prototype)', () => {
  for (const c of cases) {
    describe(`seed ${c.seed}, map v${c.version}`, () => {
      const w = generateWorld(c.seed, c.version);

      it('draws the same phases and river', () => {
        expect(w.phases).toEqual(c.phases);
        expect(w.riverBank).toEqual(c.bank);
        expect(w.riverWidth).toEqual(c.width);
        expect(w.water.size).toBe(c.water);
      });

      it('builds the same lands', () => {
        expect(Object.keys(w.lands)).toEqual(Object.keys(c.lands));
        for (const [id, l] of Object.entries(c.lands)) {
          const land = w.lands[id as keyof typeof w.lands];
          expect(land?.biome, id).toBe(biome(l.biome));
          expect(land?.nameKey, id).toBe(l.place === 'seat' ? 'land.seat' : `biome.${biome(l.biome)}.place.${l.place}`);
          expect(!!land?.upper, id).toBe(l.upper);
          expect(land?.forest, id).toBeCloseTo(l.forest, 12);
          expect(land?.formerlyReserved, id).toBeUndefined();
          expect(land?.soil, id).toEqual(Object.fromEntries(Object.entries(l.soil).map(([g, v]) => [goodFromLegacy(g), v])));
        }
      });

      it('places the same deposits', () => {
        expect(w.deposits).toEqual(Object.fromEntries(Object.entries(c.deposits).map(([k, v]) => [k, deposit(v)])));
      });

      it('raises the same terrain and leaves the rest of the sequence in step', () => {
        for (const [i, j, h] of c.heights) expect(w.heights[i]?.[j], `${i},${j}`).toBeCloseTo(h, 4);
        expect([w.rest(), w.rest(), w.rest()]).toEqual(c.next);
      });
    });
  }

  it('names every land in both languages', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const { has } = createTranslator(locale);
      for (const c of cases) for (const land of Object.values(generateWorld(c.seed, c.version).lands)) expect(has(land.nameKey), land.nameKey).toBe(true);
      expect(has('land.upper')).toBe(true);
    }
  });

  it('starts the colony on the river at the seat', () => {
    const w = generateWorld(1869);
    expect(w.lands[SEAT_LAND]?.biome).toBe('floodplain');
    expect(w.water.has(lotKey(22, w.riverBank[22] as number))).toBe(true);
  });
});
