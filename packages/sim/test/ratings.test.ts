import { describe, expect, it } from 'vitest';
import { rateHomes, taxEffect, updateRatings, type RatingItem } from '../src/ratings.js';
import { generateWorld } from '../src/world.js';
import fixture from './fixtures/ratings.json' with { type: 'json' };
import { LEGACY, legacyState } from './legacy.js';
import { applyPrototypeRules } from './prototypeRules.js';

applyPrototypeRules();

interface Case {
  state: Record<string, unknown>; media: number; fams: number; saude: number; lig: string[];
  notas: Record<string, { nota: number; vals: (number | 'cap')[] }>;
  taxes: null | { grupos: { g: string; fam: number; antes: number; depois: number; total: number; peso: number; queda: number }[]; riscoFam: number; riscoNegocios: number; receita: number };
}
const cases = fixture as unknown as Record<string, Case>;
const valueOf = (i: RatingItem): number | 'cap' => (i.kind === 'unlinked' ? 'cap' : i.kind === 'outOfReach' ? 0 : i.value);
const GROUP: Record<string, string> = { ...(LEGACY.sectors as Record<string, string>), lote: 'idle' };

describe('home ratings (golden, against the playtester saves)', () => {
  for (const [name, c] of Object.entries(cases)) {
    describe(name, () => {
      const s = legacyState(c.state);
      const w = generateWorld(s.seed, s.mapVersion);
      const r = rateHomes(s, w);

      it('rates every home the same, item by item', () => {
        expect(Object.keys(r.homes).sort()).toEqual(Object.keys(c.notas).sort());
        for (const [k, n] of Object.entries(c.notas)) {
          expect(r.homes[k as `${number},${number}`]!.items.map(valueOf), k).toEqual(n.vals);
          expect(r.homes[k as `${number},${number}`]!.rating, k).toBe(n.nota);
        }
      });

      it('gets the same mean, families and health', () => {
        expect([r.mean, r.families]).toEqual([c.media, c.fams]);
        expect(r.health).toBeCloseTo(c.saude, 12);
        expect([...r.linked].sort()).toEqual(c.lig);
      });

      if (c.taxes) it('splits the tax burden the same way', () => {
        // the prototype measured it after re-rating the homes with the taxes in force
        updateRatings(s, w);
        const t = taxEffect(s, w), x = c.taxes!;
        expect(t.groups.map((g) => [g.group, g.families, g.drop])).toEqual(x.grupos.map((g) => [GROUP[g.g], g.fam, g.queda]));
        x.grupos.forEach((g, i) => { const y = t.groups[i]!; for (const [a, b] of [[y.before, g.antes], [y.after, g.depois], [y.total, g.total], [y.weight, g.peso]] as const) expect(a).toBeCloseTo(b, 6); });
        expect([t.familiesAtRisk, t.businessesAtRisk]).toEqual([x.riscoFam, x.riscoNegocios]);
        expect(t.revenue).toBeCloseTo(x.receita, 6);
      });
    });
  }
});
