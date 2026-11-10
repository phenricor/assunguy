import { describe, expect, it } from 'vitest';
import { connected, mainNetwork, reach } from '../src/network.js';
import fixture from './fixtures/network.json' with { type: 'json' };
import { legacyMap } from './legacy.js';

interface Case { state: Record<string, unknown>; network: string[]; linked: string[]; reach: Record<string, { radius: number; dist: Record<string, number> }> }
const cases = fixture as unknown as Record<string, Case>;

describe('street network (golden, against the playtester saves)', () => {
  for (const [name, c] of Object.entries(cases)) {
    const map = legacyMap(c.state);
    it(`${name}: finds the same main network and linked buildings`, () => {
      expect([...mainNetwork(map)].sort()).toEqual(c.network);
      expect([...connected(map)].sort()).toEqual(c.linked);
    });
    it(`${name}: services reach the same streets`, () => {
      for (const [key, r] of Object.entries(c.reach)) expect(Object.fromEntries(reach(map, key as `${number},${number}`, r.radius)), key).toEqual(r.dist);
    });
  }

  it('cuts off a building whose street is severed from the port', () => {
    const map = legacyMap(cases.canoes?.state as Record<string, unknown>);
    const before = connected(map).size;
    for (const k of Object.keys(map.streets)) if (Number(k.split(',')[1]) > 53) delete map.streets[k as `${number},${number}`];
    expect(connected(map).size).toBeLessThan(before);
  });
});
