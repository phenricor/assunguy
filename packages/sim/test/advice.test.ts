import { describe, expect, it } from 'vitest';
import { legacyAdvice, type AdviceAction } from '../src/advisor.js';
import { defineEvent, resolveEvent } from '../src/events.js';
import { passSeason } from '../src/season.js';
import { updateRatings } from '../src/ratings.js';
import { generateWorld, type LotKey } from '../src/world.js';
import advice from './fixtures/advice.json' with { type: 'json' };
import seasons from './fixtures/seasons.json' with { type: 'json' };
import variants from './fixtures/adviceVariants.json' with { type: 'json' };
import { LEGACY, legacyState } from './legacy.js';

type LegacyAdvice = { w: number; tit: string; sub: string; ac: Record<string, any> | null };
const B = LEGACY.buildings as Record<string, string>, V = LEGACY.vehicles as Record<string, string>;
const SCREEN: Record<string, string> = { nivel: 'level', economia: 'economy', direcao: 'direction' };
const TAB: Record<string, string> = { capacidade: 'capacity', resumo: 'summary', recursos: 'resources', impostos: 'taxes', obras: 'works' };
/** The prototype's action, in the port's shape. */
function action(ac: LegacyAdvice['ac']): AdviceAction | null {
  if (!ac) return null;
  if (ac.construir) return ac.construir === 'rua' ? { kind: 'build', building: 'street' } : { kind: 'build', building: B[ac.construir] as never };
  if (ac.troca) return { kind: 'swap', key: ac.predio, to: B[ac.troca] as never, from: B[ac.de] as never };
  if (ac.predio) return ac.melhorar ? { kind: 'select', key: ac.predio, upgrade: true } : { kind: 'select', key: ac.predio };
  if (ac.terra && !ac.capta) return { kind: 'land', land: ac.terra };
  if (ac.veic) return { kind: 'buyVehicle', key: ac.veic, vehicle: V[ac.v] as never };
  if (ac.vende) return { kind: 'sellVehicle', key: ac.vende, vehicle: V[ac.v] as never };
  if (ac.capta) return ac.perto ? { kind: 'collect', building: B[ac.capta] as never, near: ac.perto } : { kind: 'collect', building: B[ac.capta] as never, land: ac.terra, fleet: { [B[ac.capta] === 'tradingPost' ? 'muleTrain' : 'canoe']: 2 } };
  if (ac.det === 'transp') return { kind: 'screen', screen: 'transport', tab: 'collections' };
  if (ac.tela) {
    const out: AdviceAction = { kind: 'screen', screen: SCREEN[ac.tela] as never };
    if (ac.aba) out.tab = TAB[ac.aba] ?? ac.aba;
    if (ac.lei) { out.law = 'tithe'; out.value = ac.valor; }
    return out;
  }
  throw new Error('unmapped action ' + JSON.stringify(ac));
}
const key = (weight: number, a: AdviceAction | null) => `${weight.toFixed(6)} ${JSON.stringify(a)}`;

describe('advisor (golden, against the prototype)', () => {
  for (const [name, states] of Object.entries(advice as unknown as Record<string, LegacyAdvice[][]>)) {
    it(`${name}: the advice list matches at the start and after each season`, () => {
      const run = (seasons as unknown as Record<string, { state: Record<string, unknown>; seasons: { picks: number[] }[] }>)[name]!;
      const s = legacyState(run.state), w = generateWorld(s.seed, s.mapVersion);
      states.forEach((want, i) => {
        if (i > 0) { passSeason(s, w); for (const _ of run.seasons[i - 1]!.picks) { const d = defineEvent(s, s.queue[0]!); resolveEvent(s, w, d.options.findIndex((o) => !o.can || o.can(s))); } }
        // the lone store for far fields is replaced by a measured package (see the review)
        const expected = want.filter((x) => !x.tit.endsWith('roças sem comércio')).map((x) => key(x.w, action(x.ac)));
        const mine = legacyAdvice(s, w).map((x) => key(x.weight, x.action));
        expect(mine, `${name} state ${i}: ${want.map((x) => x.tit).join(' | ')}`).toEqual(expected);
      });
    });
  }
});

describe('advisor on variants of the saves (golden)', () => {
  for (const [name, vs] of Object.entries(variants as unknown as Record<string, Record<string, { spec: { caixa?: number; nivelC?: number; add?: Record<string, string>; dizimo?: number }; list: LegacyAdvice[] }>>)) {
    for (const [v, { spec, list }] of Object.entries(vs)) {
      it(`${name}, ${v}`, () => {
        const run = (seasons as unknown as Record<string, { state: Record<string, unknown> }>)[name]!;
        const s = legacyState(run.state), w = generateWorld(s.seed, s.mapVersion);
        if (spec.caixa !== undefined) s.cash = spec.caixa;
        if (spec.nivelC) s.level = spec.nivelC;
        for (const [k, t] of Object.entries(spec.add ?? {})) s.map.buildings[k as LotKey] = B[t] as never;
        if (spec.dizimo) s.taxes.tithe = { general: spec.dizimo, byGood: {} };
        updateRatings(s, w); // the prototype's calcula re-rates the homes
        const expected = list.filter((x) => !x.tit.endsWith('roças sem comércio')).map((x) => key(x.w, action(x.ac)));
        expect(legacyAdvice(s, w).map((x) => key(x.weight, x.action)), list.map((x) => x.tit).join(' | ')).toEqual(expected);
      });
    }
  }
});
