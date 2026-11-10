import { describe, expect, it } from 'vitest';
import { play } from '../src/bot.js';

describe('robot player', () => {
  it('plays a new game by following the advisor, the same way every time', () => {
    const a = play(1869, { seasons: 12 }), b = play(1869, { seasons: 12 });
    expect(a).toEqual(b);
    expect(a.seasons.length).toBe(12);
    expect(a.seasons.flatMap((x) => x.actions).length).toBeGreaterThan(10);
    expect(a.seasons.at(-1)!.families).toBeGreaterThan(10);
    expect(a.seasons.at(-1)!.level).toBeGreaterThanOrEqual(2);
  });
  it('the patient policy saves for heavy advice instead of spending on lighter ones', () => {
    const r = play(1869, { seasons: 12, policy: 'patient', reserve: 2000 });
    expect(r.policy).toBe('patient');
    expect(r.seasons.some((x) => x.actions.some((y) => y.startsWith('saving for')))).toBe(true);
  });
});
