import { describe, expect, it } from 'vitest';
import { defineEvent, resolveEvent } from '../src/events.js';
import { passSeason } from '../src/season.js';
import type { GameState } from '../src/state.js';
import { generateWorld } from '../src/world.js';
import fixture from './fixtures/seasons.json' with { type: 'json' };
import { LEGACY, goodFromLegacy, legacyEvent, legacyState } from './legacy.js';

type Snap = Record<string, any>;
const cases = fixture as unknown as Record<string, { state: Record<string, unknown>; seasons: { queued: any[]; picks: number[]; after: Snap }[] }>;
const B = LEGACY.buildings as Record<string, string>, SEC = LEGACY.sectors as Record<string, string>;
const near = (a: number, b: number, what: string) => expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(b)));

function compare(s: GameState, x: Snap, when: string) {
  expect(s.market.t, when).toBe(x.t);
  expect(s.market.seed, `${when} seed`).toBe(x.seed);
  near(s.cash, x.caixa, `${when} cash`);
  expect([s.influence, s.level, s.milestone, s.deadline, s.extraDemand], `${when} standing`).toEqual([x.inf, x.nivelC, x.marco, x.prazo, x.exig]);
  near(s.grantFactor, x.verbaMod ?? 1, `${when} grant factor`);
  expect(Object.values(s.families).map((f) => [f.id, f.surname, f.trade, f.skill, f.newcomer, f.idle, f.arrived]), `${when} families`).toEqual(x.fams.map((f: any[]) => [f[0], f[1], f[2] ? SEC[f[2]] : null, f[3], f[4], f[5], f[6]]));
  Object.values(s.families).forEach((f, i) => near(f.savings, x.fams[i][7], `${when} savings ${f.id}`));
  expect(s.map.buildings, `${when} buildings`).toEqual(Object.fromEntries(Object.entries(x.predios).map(([k, t]) => [k, B[t as string]])));
  expect(s.upgrades, `${when} upgrades`).toEqual(x.nivel);
  expect(s.effects.map((e) => [e.satisfaction, e.seasonsLeft]), `${when} effects`).toEqual(x.efeitos);
  expect(s.market.shocks.map((e) => [e.good, e.kind, e.factor, e.seasonsLeft]), `${when} shocks`).toEqual(x.eventos.map(([b, k, f, r]: any[]) => [b === '_porto' ? '_port' : goodFromLegacy(b), ({ peste: 'pest', procura: 'demand', preco: 'price', cap: 'capacity' } as any)[k], f, r]));
  for (const [g, p] of Object.entries(x.price)) near(s.market.history[goodFromLegacy(g) as keyof typeof s.market.history]!.at(-1)!, p as number, `${when} price ${g}`);
  expect(s.homeRating, `${when} ratings`).toEqual(x.notaCasa);
  for (const [k, v] of Object.entries(x.vol ?? {})) near(s.transport.volume[k as `${number},${number}`] ?? 0, v as number, `${when} volume ${k}`);
  expect(Object.keys(s.reliefWorkers).sort(), `${when} relief`).toEqual(x.frenteIds);
  expect(s.variety, `${when} variety`).toBe(x.variedade);
  expect(s.firstHarvest, `${when} harvests`).toEqual(x.plantio);
  expect([s.warned, s.misses ?? 0, s.intervention, s.nextArrival, s.nextSwapAsk, s.lastDilemma], `${when} flags`).toEqual([x.aviso, x.atrasos, x.intervencao, x.proxLeva, x.proxPedidoTroca, x.ultimoDilema]);
}

describe('whole seasons (golden, against the prototype)', () => {
  for (const [name, c] of Object.entries(cases)) {
    it(`${name}: ${c.seasons.length} seasons match, events and all`, () => {
      const s = legacyState(c.state), w = generateWorld(s.seed, s.mapVersion);
      c.seasons.forEach((season, i) => {
        const when = `${name} season ${i + 1}`;
        passSeason(s, w);
        expect(s.queue.map((e) => JSON.stringify(e)), `${when} queue`).toEqual(season.queued.map((e) => JSON.stringify(legacyEvent(e))));
        for (const pick of season.picks) {
          const d = defineEvent(s, s.queue[0]!), mine = d.options.findIndex((o) => !o.can || o.can(s));
          expect(mine, `${when} pick`).toBe(pick);
          resolveEvent(s, w, mine);
        }
        compare(s, season.after, when);
      });
    });
  }
});
