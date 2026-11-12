import { describe, expect, it } from 'vitest';
import { computeEconomy } from '../src/economy.js';
import { emptySlots, familiesInvest, newFamily, passFamilies, syncFamilies, updateSupply } from '../src/families.js';
import { initialMap } from '../src/map.js';
import { initialMarket } from '../src/market.js';
import type { FamilyId, GameState } from '../src/state.js';
import { generateWorld } from '../src/world.js';
import fixture from './fixtures/families.json' with { type: 'json' };
import { LEGACY, goodFromLegacy, legacyState } from './legacy.js';
import { applyPrototypeRules } from './prototypeRules.js';

applyPrototypeRules();

type LF = { id: string; nome: string; oficio: string | null; hab: number; nova: number; parada: number; chegou: number; fundo: number };
const F = fixture as unknown as {
  founders: Record<string, LF>; newcomers: { id: string; o?: string; f: LF }[];
  season: { state: Record<string, unknown>; afterPass: Record<string, [number, number]>; supply: { abast: Record<string, number>; variedade: number }; done: { casas: Record<string, number>; plantas: number; gasto: number }; savings: Record<string, number>; predios: Record<string, string>; nivel: Record<string, number>; vagas: string[] };
};
const trade = (o: string | null) => (o ? (LEGACY.sectors as Record<string, string>)[o] : null);
const same = (f: ReturnType<typeof newFamily>, x: LF) => expect([f.id, f.surname, f.trade, f.skill, f.newcomer, f.idle, f.arrived, f.savings]).toEqual([x.id, x.nome, trade(x.oficio), x.hab, x.nova, x.parada, x.chegou, x.fundo]);

describe('families (golden, against the prototype)', () => {
  it('settles the same ten founders in a new game', () => {
    const w = generateWorld(1869);
    const s = { map: initialMap(w), families: {}, greatWorks: {}, market: initialMarket() } as unknown as GameState;
    syncFamilies(s, true);
    expect(Object.keys(s.families)).toEqual(Object.keys(F.founders));
    for (const [id, x] of Object.entries(F.founders)) same(s.families[id as FamilyId]!, x);
  });

  it('draws the same newcomers for each origin', () => {
    for (const n of F.newcomers) same(newFamily({ greatWorks: {} }, n.id as FamilyId, true, n.o && (LEGACY.origins as Record<string, string>)[n.o]), n.f);
  });

  describe('one season on the speedrun save', () => {
    const s = legacyState(F.season.state);
    const w = generateWorld(s.seed, s.mapVersion);
    passFamilies(s);

    it('counts idle seasons the same way', () => {
      expect(Object.fromEntries(Object.values(s.families).map((f) => [f.id, [f.newcomer, f.idle]]))).toEqual(F.season.afterPass);
    });

    it('records the same supply and table variety, then the same savings and upgrades', () => {
      const c = computeEconomy(s, w);
      updateSupply(s, c);
      expect(s.variety).toBe(F.season.supply.variedade);
      expect(s.supply).toEqual(Object.fromEntries(Object.entries(F.season.supply.abast).map(([g, v]) => [goodFromLegacy(g), v])));
      const done = familiesInvest(s, w, c);
      expect([done.fields, done.spent]).toEqual([F.season.done.plantas, F.season.done.gasto]);
      for (const [id, v] of Object.entries(F.season.savings)) expect(s.families[id as FamilyId]!.savings, id).toBeCloseTo(v, 9);
      expect(s.upgrades).toEqual(F.season.nivel);
      expect(emptySlots(s)).toEqual(F.season.vagas);
    });
  });
});
