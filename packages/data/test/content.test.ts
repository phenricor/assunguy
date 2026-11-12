import { describe, expect, it } from 'vitest';
import { BIOMES, BUILDINGS, GOODS, LEVELS, LEVEL_UNLOCKS, MILESTONES, TRANSPORT_ROLES, VEHICLES, isBuilding, isGood, isVehicle } from '../src/index.js';

describe('content tables', () => {
  it('every building output and recipe names a known good', () => {
    for (const [id, b] of Object.entries(BUILDINGS)) {
      const def = b as { output?: { good: string }; recipes?: readonly { from: string; to: string }[]; extraOutputs?: readonly { good: string }[] };
      if (def.output) expect(isGood(def.output.good), `${id} output`).toBe(true);
      for (const r of def.recipes ?? []) {
        expect(isGood(r.from), `${id} recipe from ${r.from}`).toBe(true);
        expect(isGood(r.to), `${id} recipe to ${r.to}`).toBe(true);
      }
      for (const x of def.extraOutputs ?? []) expect(isGood(x.good), `${id} extra ${x.good}`).toBe(true);
    }
  });

  it('transport roles point at real buildings and vehicles', () => {
    for (const [id, r] of Object.entries(TRANSPORT_ROLES)) {
      expect(isBuilding(id), id).toBe(true);
      for (const v of (r as { vehicles?: readonly string[] }).vehicles ?? []) expect(isVehicle(v), `${id} ${v}`).toBe(true);
    }
  });

  it('level unlocks and milestone requirements name real buildings', () => {
    for (const list of Object.values(LEVEL_UNLOCKS)) for (const b of list) expect(isBuilding(b), b).toBe(true);
    for (const m of MILESTONES) for (const b of Object.keys(m.requires ?? {})) expect(isBuilding(b), `${m.id} ${b}`).toBe(true);
  });

  it('levels run 1 to 18 and milestones sit on levels 5, 9 and 14', () => {
    expect(LEVELS.map((l) => l.level)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
    expect(LEVELS.filter((l) => l.milestone).map((l) => l.level)).toEqual([5, 9, 14]);
  });

  it('each level asks for more than the one before, and nothing it asks for opens later', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const a = LEVELS[i - 1]!, b = LEVELS[i]!;
      expect(b.workers, `level ${b.level}`).toBeGreaterThan(a.workers);
      expect(b.income, `level ${b.level}`).toBeGreaterThan(a.income);
      for (const t of Object.keys(b.requires ?? {})) expect((BUILDINGS as Record<string, { minLevel?: number }>)[t]!.minLevel ?? 1, `${t} for level ${b.level}`).toBeLessThan(b.level);
    }
    for (const m of MILESTONES.slice(1)) for (const t of Object.keys(m.requires ?? {})) {
      const at = LEVELS.find((l) => l.milestone === MILESTONES.indexOf(m))!.level;
      expect((BUILDINGS as Record<string, { minLevel?: number }>)[t]!.minLevel ?? 1, `${t} for ${m.id}`).toBeLessThan(at);
    }
  });

  it('biome soils only rate known goods', () => {
    for (const b of Object.values(BIOMES)) for (const g of Object.keys(b.soil)) expect(isGood(g), g).toBe(true);
  });

  it('the canoe carries 120 arrobas per season', () => {
    expect(VEHICLES.canoe.cargo).toBe(120);
    expect(GOODS.corn.food).toBe(true);
  });
});
