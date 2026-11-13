import { describe, expect, it } from 'vitest';
import { defineEvent, resolveEvent } from '../src/events.js';
import { newGame } from '../src/game.js';
import { passSeason } from '../src/season.js';
import fixture from './fixtures/newGame.json' with { type: 'json' };
import { LEGACY, legacyState } from './legacy.js';
import { applyPrototypeRules } from './prototypeRules.js';

applyPrototypeRules();

const B = LEGACY.buildings as Record<string, string>;
const near = (a: number, b: number, what: string) => expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(b)));
const play = (s: any, w: any) => { while (s.queue.length && !['end', 'victory'].includes(s.queue[0].kind)) { const d = defineEvent(s, s.queue[0]); resolveEvent(s, w, d.options.findIndex((o) => !o.can || o.can(s))); } };

describe('a new game (golden, against the prototype)', () => {
  for (const [seed, c] of Object.entries(fixture as unknown as Record<string, { start: Record<string, unknown>; seasons: any[] }>)) {
    it(`seed ${seed}: the same starting colony, then eight seasons`, () => {
      const { s, w } = newGame(Number(seed));
      const want = legacyState(c.start);
      expect({ ...s, chronicle: [], log: [] }).toEqual({ ...want, chronicle: [], log: [], taxHistory: [], reports: [] });
      play(s, w);
      c.seasons.forEach((x, i) => {
        passSeason(s, w); play(s, w);
        const when = `seed ${seed} season ${i + 1}`;
        expect(s.market.t, when).toBe(x.t);
        near(s.cash, x.caixa, `${when} cash`);
        expect([s.influence, s.level, s.milestone], when).toEqual([x.inf, x.nivelC, x.marco]);
        expect(s.map.buildings, `${when} buildings`).toEqual(Object.fromEntries(Object.entries(x.predios).map(([k, t]) => [k, B[t as string]])));
        expect(Object.keys(s.families).sort(), `${when} families`).toEqual(x.fams);
        expect(s.homeRating, `${when} ratings`).toEqual(x.notaCasa);
      });
    });
  }
});
