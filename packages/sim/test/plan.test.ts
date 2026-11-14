import { describe, expect, it } from 'vitest';
import { advanceRace, allocate, computeEconomy, departuresAhead, levelPlan, newGame, passSeason, slotsOf, type LotKey } from '../src/index.js';
import { topLevel } from '@assunguy/data';

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
  it('leading two markets counts toward victory only from the top level', () => {
    const { s, w } = newGame(1869);
    s.queue = []; s.milestone = 3; passSeason(s, w);
    const c = computeEconomy(s, w);
    c.transport.destVolume.iguape = 100; c.transport.destVolume.curitiba = 100;
    c.transport.competitiveness.iguape = 1.1; c.transport.competitiveness.curitiba = 1.1;
    s.level = topLevel() - 1; advanceRace(s, c, []);
    expect(s.race!.winning).toBe(0);
    s.level = topLevel(); advanceRace(s, c, []);
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

describe('the export duty', () => {
  it('is suggested once there is a council, at a rate the satisfaction bears, and carried out as proposed', async () => {
    const { legacyState } = await import('./legacy.js'), { generateWorld } = await import('../src/world.js'), { advise } = await import('../src/advisor.js');
    const { proposeTax } = await import('../src/commands.js'), seasons = (await import('./fixtures/seasons.json', { with: { type: 'json' } })).default as unknown as Record<string, { state: Record<string, unknown> }>;
    const s = legacyState(seasons.speedrun!.state), w = generateWorld(s.seed, s.mapVersion);
    const free = Object.keys(s.map.streets).map((k) => k.split(',').map(Number) as [number, number]).map(([a, b]) => `${a + 1},${b}` as LotKey).find((k) => !s.map.buildings[k] && !s.map.streets[k])!;
    s.map.buildings[free] = 'council'; s.cash = 0;
    const duty = advise(s, w).find((x) => x.rule.startsWith('exportDuty'));
    expect(duty?.rule).toBe('exportDuty.first');
    expect(duty!.params.after as number).toBeGreaterThanOrEqual(duty!.params.mean as number - 10);
    const act = duty!.action as { law: 'exportDuty'; value: number };
    expect(proposeTax(s, act.law, { general: act.value }).ok).toBe(true);
    expect(s.pendingTaxes.exportDuty?.general).toBe(act.value);
  });
});

describe('a store with no gateway in reach', () => {
  it('is a district alert that says why the cargo stops, and the district screen offers a gateway for it', async () => {
    const { newGame } = await import('../src/game.js'), { build, streets } = await import('../src/commands.js');
    const { districtAccounts } = await import('../src/accounts.js'), { districtAlerts } = await import('../src/districtAdvice.js');
    const { districtFixes } = await import('../src/districtFixes.js'), { computeDistricts } = await import('../src/districts.js');
    const { s, w } = newGame(1869);
    s.cash = 1e5; s.level = 3; // waystations and landings open at 3
    // the colony's only store far from the river port, on a street of its own
    expect(streets(s, w, [22, 52], [22, 56]).ok).toBe(true);
    expect(streets(s, w, [22, 56], [29, 56]).ok).toBe(true);
    expect(build(s, w, 'store', 28, 57).ok).toBe(true);
    delete s.map.buildings['23,51' as LotKey];
    const A = districtAccounts(s, w), alert = districtAlerts(A).find((x) => x.problem === 'outlet');
    expect(alert?.cause).toBe('noGateway');
    const D = computeDistricts(s, w), fix = districtFixes(s, w, D, A.find((a) => a.id === alert!.district)!, []);
    expect(fix.outlet?.cause).toBe('noGateway');
    expect(fix.outlet?.fixes.some((f) => f.building === 'waystation' || f.building === 'landing')).toBe(true);
  });
});

describe('the processing potential', () => {
  it('is what of a raw good leaves raw or is wasted, priced at the best workshop the colony can build', async () => {
    const { legacyState } = await import('./legacy.js'), { generateWorld } = await import('../src/world.js'), { computeEconomy, def } = await import('../src/economy.js');
    const { processingPotential } = await import('../src/processing.js'), { currentPrice } = await import('../src/market.js');
    const seasons = (await import('./fixtures/seasons.json', { with: { type: 'json' } })).default as unknown as Record<string, { state: Record<string, unknown> }>;
    const s = legacyState(seasons.speedrun!.state), w = generateWorld(s.seed, s.mapVersion), c = computeEconomy(s, w);
    const P = Object.values(processingPotential(s, c));
    expect(P.length).toBeGreaterThan(0);
    for (const p of P) {
      const g = p!.good, left = (c.produced[g] ?? 0) - (c.ownTable[g] ?? 0) - (c.market[g] ?? 0) - (c.processed[g] ?? 0);
      expect(p!.potential).toBeCloseTo(Math.max(0, left), 6);
      expect(p!.share).toBeGreaterThanOrEqual(0); expect(p!.share).toBeLessThanOrEqual(1);
      expect((def(p!.building).minLevel ?? 1)).toBeLessThanOrEqual(s.level);
      const r = def(p!.building).recipes!.find((x) => x.from === g && x.to === p!.to)!;
      expect(p!.processedValue).toBeCloseTo(currentPrice(s.market, p!.to) * r.ratio, 6);
    }
  });
});
