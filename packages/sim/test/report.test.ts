import { describe, expect, it } from 'vitest';
import { build, settle } from '../src/commands.js';
import { lotsFor } from '../src/measure.js';
import { passSeason } from '../src/season.js';
import { generateWorld, parseKey } from '../src/world.js';
import seasons from './fixtures/seasons.json' with { type: 'json' };
import { legacyState } from './legacy.js';

describe('report: what decisions changed, and the series', () => {
  it('a hut adds places to live; the season report groups it with its change; the series grows', () => {
    const s = legacyState((seasons as any).speedrun.state), w = generateWorld(s.seed, s.mapVersion);
    s.cash = 2000; settle(s, w);
    const lot = lotsFor(s, w, 'hut', 1)[0]!;
    expect(build(s, w, 'hut', ...parseKey(lot)).ok).toBe(true);
    const entry = s.log.at(-1)!;
    expect(entry.kind).toBe('built');
    expect((entry.change as any).places).toBe(1);
    const r = passSeason(s, w);
    expect(r.decisions.works).toEqual([expect.objectContaining({ building: 'hut', kind: 'built', n: 1, cost: 20 })]);
    expect(r.decisions.works[0]!.change.places).toBe(1);
    expect(r.returns.length).toBeGreaterThan(3);
    expect(s.series).toHaveLength(1);
    expect(s.series![0]).toMatchObject({ t: s.market.t, families: expect.any(Number), production: expect.any(Object) });
    expect(s.log).toEqual([]);
  });
});
