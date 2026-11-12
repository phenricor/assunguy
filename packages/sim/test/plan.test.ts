import { describe, expect, it } from 'vitest';
import { advanceRace, allocate, computeEconomy, departuresAhead, levelPlan, newGame, passSeason, slotsOf, type LotKey } from '../src/index.js';

describe('the way to the next level', () => {
  it('a new colony gets a plan of works that reaches level 2, with its cost and income', () => {
    const { s, w } = newGame(1869);
    s.queue = [];
    const p = levelPlan(s, w)!;
    expect(p.level).toBe(2);
    expect(p.items.length).toBeGreaterThan(0);
    expect(p.cost).toBe(p.items.reduce((x, i) => x + i.cost, 0));
    expect(p.gain).toBeGreaterThan(0);
    expect(p.reached || p.families > 0).toBe(true);
  });
  it('each upgrade the colony pays for opens one more job; fields keep theirs', () => {
    const { s } = newGame(1869);
    const k = 'k1' as LotKey, f = 'k2' as LotKey;
    s.map.buildings[k] = 'fishery'; s.map.buildings[f] = 'beanField';
    expect(slotsOf(s, k)).toBe(2);
    s.upgrades[k] = 1; expect(slotsOf(s, k)).toBe(3);
    s.upgrades[k] = 2; expect(slotsOf(s, k)).toBe(4);
    s.upgrades[f] = 2; expect(slotsOf(s, f)).toBe(1);
  });
});

describe('the race', () => {
  it('leading two markets counts toward victory only from level 12', () => {
    const { s, w } = newGame(1869);
    s.queue = []; s.milestone = 3; passSeason(s, w);
    const c = computeEconomy(s, w);
    c.transport.destVolume.iguape = 100; c.transport.destVolume.curitiba = 100;
    c.transport.competitiveness.iguape = 1.1; c.transport.competitiveness.curitiba = 1.1;
    s.level = 10; advanceRace(s, c, []);
    expect(s.race!.winning).toBe(0);
    s.level = 12; advanceRace(s, c, []);
    expect(s.race!.winning).toBe(1);
  });
  it('warns before families leave, with the income and the works that avoid it', () => {
    const { s, w } = newGame(1869);
    s.queue = []; s.milestone = 3; passSeason(s, w);
    const c = computeEconomy(s, w), fam = Object.keys(s.families).length, now = c.incomeTotal / fam;
    // the best year was well above today, and the last seasons slide toward it
    s.race!.peakPerFamily = now * 1.25; s.race!.perFamily = [now * 1.2, now * 1.15, now * 1.1, now * 1.05];
    const d = departuresAhead(s, w, c)!;
    expect(d).not.toBeNull();
    expect(d.seasons).toBeGreaterThanOrEqual(1);
    expect(d.gain).toBeGreaterThan(0);
    expect(d.count).toBeGreaterThan(0);
    expect(allocate(s).idle.length).toBeGreaterThanOrEqual(0);
  });
});
