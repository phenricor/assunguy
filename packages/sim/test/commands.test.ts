import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BALANCE } from '@assunguy/data';
import { annex, askProvince, build, buyVehicle, demolish, explore, move, proposeTax, sellVehicle, setMargin, settle, streets, swapCrop, toggleLaw, upgrade, type CommandResult } from '../src/commands.js';
import { defineEvent, resolveEvent } from '../src/events.js';
import { passSeason } from '../src/season.js';
import type { GameState } from '../src/state.js';
import { generateWorld, parseKey, type LandId, type LotKey } from '../src/world.js';
import fixture from './fixtures/commands.json' with { type: 'json' };
import { LEGACY, goodFromLegacy, legacyState } from './legacy.js';
import { applyPrototypeRules } from './prototypeRules.js';

applyPrototypeRules();

type Snap = Record<string, any>;
const B = LEGACY.buildings as Record<string, string>, V = LEGACY.vehicles as Record<string, string>, LAW = LEGACY.laws as Record<string, string>, TAX = LEGACY.taxes as Record<string, string>;
const near = (a: number, b: number, what: string) => expect(Math.abs(a - b), `${what}: ${a} vs ${b}`).toBeLessThanOrEqual(1e-6 * Math.max(1, Math.abs(b)));
const noZero = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v));

function compare(s: GameState, x: Snap, when: string) {
  near(s.cash, x.caixa, `${when} cash`);
  near(s.buildCosts, x.obrasEst, `${when} build costs`);
  expect([s.influence, s.extraDemand, s.deadline, !!s.extendedDeadline], `${when} standing`).toEqual([x.inf, x.exig, x.prazo, x.prazoPedido]);
  expect(s.map.buildings, `${when} buildings`).toEqual(Object.fromEntries(Object.entries(x.predios).map(([k, t]) => [k, B[t as string]])));
  expect(noZero(s.upgrades), `${when} upgrades`).toEqual(noZero(x.nivel));
  expect(Object.keys(s.map.streets).sort(), `${when} streets`).toEqual(x.ruas);
  expect(s.map.lands, `${when} lands`).toEqual(Object.fromEntries(Object.entries(x.terras).map(([k, v]) => [k, v === 'nossa' ? 'ours' : 'seen'])));
  expect(Object.fromEntries(Object.entries(s.fleet).filter(([, f]) => Object.keys(f).length)), `${when} fleet`).toEqual(Object.fromEntries(Object.entries(x.veic as Record<string, Record<string, number>>).filter(([, f]) => Object.keys(f).length).map(([k, f]) => [k, Object.fromEntries(Object.entries(f).map(([v, n]) => [V[v], n]))])));
  expect(s.tariffMargin, `${when} margins`).toEqual(x.tarifa);
  expect(Object.keys(s.families).sort(), `${when} families`).toEqual(x.fams);
  expect(s.homeRating, `${when} ratings`).toEqual(x.notaCasa);
  expect(s.firstHarvest, `${when} harvests`).toEqual(x.plantio);
  expect(Object.keys(s.map.trees).length, `${when} trees`).toBe(x.arv);
  expect(s.seasonWork.buildings, `${when} built`).toEqual(x.pend);
  expect(Object.fromEntries(Object.entries(s.seasonWork.upgrades).map(([k, v]) => [k, v!.cost])), `${when} upgrades paid`).toEqual(x.pendNivel);
  expect(s.seasonWork.streets, `${when} streets paid`).toEqual(x.pendRua);
  expect(Object.fromEntries(Object.entries(s.seasonWork.swaps).map(([k, v]) => [k, [v!.from, v!.cost, v!.firstHarvest]])), `${when} swaps`).toEqual(Object.fromEntries(Object.entries(x.pendTroca as Record<string, any>).map(([k, v]) => [k, [B[v.de], v.custo, v.plantio]])));
  expect(Object.keys(s.pendingTaxes), `${when} taxes`).toEqual(Object.keys(x.pendentes).map((k) => TAX[k]));
  expect(Object.keys(s.pendingLaws), `${when} laws pending`).toEqual(Object.keys(x.pendC).map((k) => LAW[k]));
  expect(Object.keys(s.laws), `${when} laws`).toEqual(Object.keys(x.leisC).map((k) => LAW[k]));
}

function replay(s: GameState, w: ReturnType<typeof generateWorld>, cmd: any[]): CommandResult {
  const [op, ...a] = cmd;
  const at = (k: string) => parseKey(k) as [number, number];
  switch (op) {
    case 'build': return build(s, w, B[a[0]] as never, ...at(a[1]));
    case 'move': return move(s, w, a[0], ...at(a[1]));
    case 'demolish': return demolish(s, w, a[0]);
    case 'upgrade': return upgrade(s, w, a[0]);
    case 'streets': return streets(s, w, a[0][0], a[0][a[0].length - 1]);
    case 'explore': return explore(s, w, a[0] as LandId);
    case 'annex': return annex(s, w, a[0] as LandId);
    case 'buy': return buyVehicle(s, w, a[0], V[a[1]] as never);
    case 'sell': return sellVehicle(s, w, a[0], V[a[1]] as never);
    case 'margin': return setMargin(s, w, a[0], a[1]);
    case 'swap': return swapCrop(s, w, a[0], B[a[1]] as never);
    case 'tax': return proposeTax(s, TAX[a[0]] as never, { general: a[1].geral, byGood: {} });
    case 'law': return toggleLaw(s, w, LAW[a[0]]!);
    case 'funds': return askProvince(s, 'extraFunds');
    case 'time': return askProvince(s, 'extraTime');
  }
  throw new Error('unknown ' + op);
}

describe('player commands (golden, against the prototype)', () => {
  // the prototype opened a job only at an upgrade's second level; the game opens one at each (balance, beta.9)
  const was = BALANCE.upgradeOpensJobs;
  beforeAll(() => { (BALANCE as { upgradeOpensJobs: boolean }).upgradeOpensJobs = false; });
  afterAll(() => { (BALANCE as { upgradeOpensJobs: boolean }).upgradeOpensJobs = was; });
  for (const [name, c] of Object.entries(fixture as unknown as Record<string, { state: Record<string, any>; script: any[][]; snaps: Snap[] }>)) {
    it(`${name}: a scripted session of commands, then four seasons`, () => {
      const s = legacyState(c.state), w = generateWorld(s.seed, s.mapVersion);
      s.cash = c.state.caixa; s.influence = c.state.influencia; s.level = c.state.nivelC; settle(s, w);
      c.script.forEach((cmd, i) => {
        const r = replay(s, w, cmd);
        expect(r.ok, `${name} ${JSON.stringify(cmd)}: ${JSON.stringify(r)}`).toBe(true);
        compare(s, c.snaps[i]!, `${name} after ${cmd[0]}`);
      });
      for (let i = c.script.length; i < c.snaps.length; i++) {
        const r = passSeason(s, w);
        const want = (c.snaps[i]!.rel?.retorno ?? []) as any[];
        expect(r.returns.map((x) => [x.good, x.net, x.sales, x.upkeep, x.lost, x.paidByWorkshops, x.materials, x.bySeason, x.freight]), `${name} season ${i - c.script.length + 1} returns`)
          .toEqual(want.map((x) => [goodFromLegacy(x[0]), x[1], x[2], x[3], x[4], x[5], x[6], x[7], x[8] ?? 0]));
        while (s.queue.length && !['end', 'victory'].includes(s.queue[0]!.kind)) { const d = defineEvent(s, s.queue[0]!); resolveEvent(s, w, d.options.findIndex((o) => !o.can || o.can(s))); }
        compare(s, c.snaps[i]!, `${name} season ${i - c.script.length + 1}`);
      }
    });
  }
});
void (null as unknown as LotKey);

describe('command texts', () => {
  it('every refusal has a text in both languages', async () => {
    const { createTranslator } = await import('@assunguy/i18n');
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/commands.ts', import.meta.url), 'utf8') + readFileSync(new URL('../src/placement.ts', import.meta.url), 'utf8');
    const codes = new Set<string>();
    for (const name of ['PlacementError', 'CommandError']) { const i = src.indexOf(`export type ${name}`); for (const m of src.slice(i, src.indexOf(';', i)).matchAll(/'([a-zA-Z]+)'/g)) codes.add(m[1]!); }
    expect(codes.size).toBeGreaterThan(40);
    for (const lang of ['pt-BR', 'en'] as const) { const t = createTranslator(lang); for (const c of codes) expect(t.has(`error.${c}`), `${lang} error.${c}`).toBe(true); }
  });
});
