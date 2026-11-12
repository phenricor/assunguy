import { describe, expect, it } from 'vitest';
import { createTranslator } from '@assunguy/i18n';
import { initialMap, rapidsLimit } from '../src/map.js';
import { generateWorld } from '../src/world.js';
import fixture from './fixtures/map.json' with { type: 'json' };
import { LEGACY } from './legacy.js';
import { applyPrototypeRules } from './prototypeRules.js';

applyPrototypeRules();

interface Case {
  seed: number; version: number; streets: string[]; buildings: Record<string, string>; trees: Record<string, string>;
  lands: Record<string, string>; nature: Record<string, string>; names: Record<string, string>; next: number[];
}
const cases = fixture as unknown as Case[];
const CAVES = ['Gruta da Lancinha', 'Gruta do Monge', 'Gruta das Andorinhas', 'Gruta da Água Santa', 'Gruta do Tigre', 'Gruta dos Morcegos', 'Gruta da Pedra Furada', 'Gruta do Bugre'];
const LAND_STATUS: Record<string, string> = { nossa: 'ours', vista: 'seen' };
const mapValues = (o: Record<string, string>, table: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, table[v] ?? `?${v}`]));

describe('new game map (golden, against the prototype)', () => {
  for (const c of cases) {
    describe(`seed ${c.seed}, map v${c.version}`, () => {
      const world = generateWorld(c.seed, c.version);
      const map = initialMap(world);

      it('lays out the starting village', () => {
        expect(Object.keys(map.streets).sort()).toEqual([...c.streets].sort());
        expect(map.buildings).toEqual(mapValues(c.buildings, LEGACY.buildings as Record<string, string>));
        expect(map.lands).toEqual(mapValues(c.lands, LAND_STATUS));
      });

      it('grows the same trees and keeps the random source in step', () => {
        expect(map.trees).toEqual(mapValues(c.trees, LEGACY.trees as Record<string, string>));
        expect([world.rest(), world.rest()]).toEqual(c.next);
      });

      it('draws the same nature', () => {
        expect(map.nature).toEqual(mapValues(c.nature, LEGACY.nature as Record<string, string>));
        expect(map.natureNames).toEqual(Object.fromEntries(Object.entries(c.names).map(([k, n]) => [k, `nature.cave.place.${CAVES.indexOf(n)}`])));
      });
    });
  }

  it('names nature in both languages', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const { has } = createTranslator(locale);
      const map = initialMap(generateWorld(1869));
      for (const kind of new Set(Object.values(map.nature))) expect(has(`nature.${kind}`), kind).toBe(true);
      for (const key of Object.values(map.natureNames)) expect(has(key), key).toBe(true);
    }
  });

  it('puts rapids upstream of the seat only', () => {
    const map = initialMap(generateWorld(1869));
    expect(rapidsLimit(map)).toBeGreaterThan(-1);
    expect(rapidsLimit(map)).toBeLessThan(22 - 10);
  });
});
