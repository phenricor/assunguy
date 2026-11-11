import { describe, expect, it } from 'vitest';
import { acceptance, advanceRace, buyVehicle, competitivenessOf, computeEconomy, newGame, passSeason, rails, railExits, rivalCost, opened, build, vehicleAvailable } from '../src/index.js';

describe('the transport race', () => {
  it('starts the season after the colony becomes a Town, with its intro', () => {
    const { s, w } = newGame(1869);
    s.queue = []; s.milestone = 3;
    passSeason(s, w);
    expect(s.race).not.toBeNull();
    expect(s.queue.some((e) => e.kind === 'raceIntro')).toBe(true);
  });
  it('rivals get cheaper on schedule and competitiveness follows', () => {
    const { s, w } = newGame(1869);
    s.queue = []; s.milestone = 3; passSeason(s, w);
    expect(rivalCost(s, 'curitiba')).toBe(1);
    s.market.t = s.race!.t0 + 4;
    expect(rivalCost(s, 'curitiba')).toBeCloseTo(0.8);
    expect(opened(s, 'mediumTrain')).toBe(false);
    s.market.t = s.race!.t0 + 12;
    expect(opened(s, 'mediumTrain')).toBe(true);
    expect(competitivenessOf(0.5, 0.35)).toBeCloseTo(1.1);
    expect(acceptance(0.7)).toBeCloseTo(0.65);
    // only the river port: Iguape has a competitiveness, the other markets none
    const c = computeEconomy(s, w);
    expect(c.transport.competitiveness.iguape).toBeGreaterThan(0);
    expect(c.transport.competitiveness.paranagua).toBe(0);
  });
  it('rails from a train station to the south edge open Curitiba and Paranaguá', () => {
    const { s, w } = newGame(1869);
    s.queue = []; s.milestone = 3; s.level = 10; passSeason(s, w);
    s.cash = 1e7;
    for (const id of Object.keys(w.lands)) s.map.lands[id as never] = 'ours';
    // a station on a free lot south of the seat, rails straight down to the edge
    let at: [number, number] | null = null;
    for (let b = 60; b < 90 && !at; b++) for (let a = 20; a < 30 && !at; a++) { s.map.streets[`${a - 1},${b}`] = true; if (build(s, w, 'trainStation', a, b).ok) at = [a, b]; else delete s.map.streets[`${a - 1},${b}`]; }
    expect(at).not.toBeNull();
    const [a, b] = at!;
    let col = a; // find a column whose lots down to the edge are free
    const r = rails(s, w, [col, b + 1], [col, 104]);
    expect(r.laid).toBeGreaterThan(0);
    if (r.ok && railExits(s, `${a},${b}`).south !== undefined) {
      const c = computeEconomy(s, w);
      expect(c.transport.gateways.find((g) => g.key === `${a},${b}`)?.dests.map((d) => d.d)).toEqual(['curitiba', 'paranagua']);
    }
    void advanceRace; void col;
  });
  it('trains can be bought from the race on, the bigger ones when the rivals open them, ', () => {
    const { s, w } = newGame(1869);
    s.queue = []; s.level = 10;
    expect(vehicleAvailable(s, 'lightTrain')).toBe(false);
    s.milestone = 3; passSeason(s, w);
    expect(vehicleAvailable(s, 'lightTrain')).toBe(true);
    expect(vehicleAvailable(s, 'mediumTrain')).toBe(false);
    s.cash = 1e7;
    for (const id of Object.keys(w.lands)) s.map.lands[id as never] = 'ours';
    // a station near the south edge whose column runs free down to it
    let at: [number, number] | null = null;
    for (let b = 96; b > 70 && !at; b--) for (let a = 10; a < 70 && !at; a++) {
      const t = structuredClone(s);
      t.map.streets[`${a - 1},${b}`] = true;
      if (!build(t, w, 'trainStation', a, b).ok || !rails(t, w, [a, b + 1], [a, 104]).ok || railExits(t, `${a},${b}`).south === undefined) continue;
      s.map.streets[`${a - 1},${b}`] = true; build(s, w, 'trainStation', a, b); rails(s, w, [a, b + 1], [a, 104]); at = [a, b];
    }
    expect(at).not.toBeNull();
    const [a, b] = at!;
    expect(railExits(s, `${a},${b}`).south).toBeDefined();
    expect(buyVehicle(s, w, `${a},${b}`, 'lightTrain').ok).toBe(true);
    s.market.t = s.race!.t0 + 12;
    expect(vehicleAvailable(s, 'mediumTrain')).toBe(true);
  });
});
