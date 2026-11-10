// Rules changed in the November review that the prototype never had, checked on the real saves.
import { describe, expect, it } from 'vitest';
import { connected } from '../src/network.js';
import { distance, geography } from '../src/transport.js';
import type { LotKey } from '../src/world.js';
import fixture from './fixtures/seasons.json' with { type: 'json' };
import { legacyState } from './legacy.js';

const speedrun = () => legacyState((fixture as unknown as Record<string, { state: Record<string, unknown> }>).speedrun!.state);

describe('collection points serve only fields beyond the free walk', () => {
  it('a trading post on the Sede border takes no cargo from fields that walk to the store for free', () => {
    const s = speedrun();
    s.map.buildings['30,53'] = 'tradingPost'; s.fleet['30,53'] = { muleTrain: 2 };
    const G = geography(s, connected(s.map)), post = G.collections.findIndex((c) => c.key === '30,53');
    expect(post).toBeGreaterThanOrEqual(0);
    const inReach = (Object.keys(G.producers) as LotKey[]).filter((k) => distance(k, '30,53') <= G.collections[post]!.reach);
    const near = inReach.filter((k) => G.producers[k]!.carry <= 6), far = inReach.filter((k) => G.producers[k]!.carry > 6);
    expect(near.length).toBeGreaterThan(0);
    for (const k of near) expect(G.producers[k]!.collections, k).not.toContain(post);
    for (const k of far) expect(G.producers[k]!.collections, k).toContain(post);
  });
});

describe('outlet: how much of each producer reaches a buyer', () => {
  it('per-producer losses on the way add up to the colony totals, and shares stay within 0 and 1', async () => {
    const { computeEconomy } = await import('../src/economy.js');
    const { generateWorld } = await import('../src/world.js');
    for (const name of ['speedrun', 'canoes']) {
      const s = legacyState((fixture as unknown as Record<string, { state: Record<string, unknown> }>)[name]!.state), w = generateWorld(s.seed, s.mapVersion);
      const c = computeEconomy(s, w), xs = Object.values(c.outlet);
      expect(xs.length, name).toBeGreaterThan(0);
      const sum = (f: (o: (typeof xs)[number]) => number) => xs.reduce((x, o) => x + f(o), 0);
      expect(sum((o) => o.lost.onFoot + o.lost.collection), name).toBeCloseTo(c.lostBy.carrying, 6);
      expect(sum((o) => o.lost.noGateway), name).toBeCloseTo(c.lostBy.noGateway, 6);
      for (const o of xs) { expect(o.share).toBeGreaterThanOrEqual(0); expect(o.share).toBeLessThanOrEqual(1); }
    }
  });
});
