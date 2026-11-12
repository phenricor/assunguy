import { describe, expect, it } from 'vitest';
import { ADVICE_RULES, advise, ruleAdvice, producerFix, type AdviceAction } from '../src/advisor.js';
import { createTranslator, LOCALES } from '@assunguy/i18n';
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
/** Prototype advice the port replaced with measured advice of its own. */
const PORTED_AWAY = (tit: string) => /(roças sem comércio|produção sem captação|sem vaga|sem veículos|sem porta)$/.test(tit);
const MEASURED = new Set(['noCollection', 'noSlot', 'noVehicles.collection', 'noVehicles.gateway', 'noGateway', 'levelWorkers', 'levelWorkers.upgrade', 'idle.upgrade', 'service.upgrade']);
const SERVICE_BUILDINGS = new Set(['chapel', 'school', 'apothecary', 'store', 'well', 'theater']);
/** Where an upgrade now beats the new building the prototype advised, the prototype's advice is left out (beta.10). */
const replacedBy = (all: { rule: string; weight: number }[]) => {
  const idle = all.some((x) => x.rule === 'idle.upgrade'), sw = new Set(all.filter((x) => x.rule === 'service.upgrade').map((x) => x.weight.toFixed(6)));
  return (x: { tit: string; w: number }, a: AdviceAction | null) => (idle && /^\d+ famílias sem trabalho$/.test(x.tit) && a?.kind === 'build') || (a?.kind === 'build' && SERVICE_BUILDINGS.has(a.building) && sw.has(x.w.toFixed(6)));
};
/** The list keeps one advice per building: a building the jobs advice names leaves the prototype's for it out. */
const takenBy = (all: { rule: string; action: AdviceAction | null }[]) => {
  const b = new Set(all.filter((x) => x.rule === 'levelWorkers' && x.action?.kind === 'build').map((x) => (x.action as { building: string }).building));
  return (a: AdviceAction | null) => a?.kind === 'build' && b.has(a.building);
};
const key = (weight: number, a: AdviceAction | null) => `${weight.toFixed(6)} ${JSON.stringify(a)}`;

describe('advisor (golden, against the prototype)', () => {
  for (const [name, states] of Object.entries(advice as unknown as Record<string, LegacyAdvice[][]>)) {
    it(`${name}: the advice list matches at the start and after each season`, () => {
      const run = (seasons as unknown as Record<string, { state: Record<string, unknown>; seasons: { picks: number[] }[] }>)[name]!;
      const s = legacyState(run.state), w = generateWorld(s.seed, s.mapVersion);
      states.forEach((want, i) => {
        if (i > 0) { passSeason(s, w); for (const _ of run.seasons[i - 1]!.picks) { const d = defineEvent(s, s.queue[0]!); resolveEvent(s, w, d.options.findIndex((o) => !o.can || o.can(s))); } }
        // the lone store for far fields is replaced by a measured package (see the review); a land with no
        // collection point is now measured too, with the vehicle a new one comes with (1.1.0)
        const all = ruleAdvice(s, w), taken = takenBy(all), gone = replacedBy(all);
        const expected = want.filter((x) => !PORTED_AWAY(x.tit) && !taken(action(x.ac)) && !gone(x, action(x.ac))).map((x) => key(x.w, action(x.ac)));
        const mine = all.filter((x) => !MEASURED.has(x.rule)).map((x) => key(x.weight, x.action));
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
        const all = ruleAdvice(s, w), taken = takenBy(all), gone = replacedBy(all);
        const expected = list.filter((x) => !PORTED_AWAY(x.tit) && !taken(action(x.ac)) && !gone(x, action(x.ac))).map((x) => key(x.w, action(x.ac)));
        expect(all.filter((x) => !MEASURED.has(x.rule)).map((x) => key(x.weight, x.action)), list.map((x) => x.tit).join(' | ')).toEqual(expected);
      });
    }
  }
});

describe('advisor: the November review rules', () => {
  const load = (name: string) => { const s = legacyState((seasons as unknown as Record<string, { state: Record<string, unknown> }>)[name]!.state); return { s, w: generateWorld(s.seed, s.mapVersion) }; };
  it('a far land gets a measured store package with a waystation, not a lone store; too dear for the cash, it is blocked', () => {
    const { s, w } = load('speedrun');
    const a = advise(s, w), far = a.find((x) => x.rule.startsWith('farLand'));
    expect(far?.rule).toBe('farLand.storePackage');
    expect(far?.action).toMatchObject({ kind: 'collect', building: 'store', land: '2,3', with: ['waystation'] });
    expect(far!.params.gain as number).toBeGreaterThan(0);
    expect(far!.blocked).toBe(far!.cost > s.cash);
    expect(a.some((x) => x.rule === 'noCollection' && x.params.land === '2,3')).toBe(false);
    for (const x of a) expect(x.blocked).toBe(x.cost > Math.max(0, s.cash));
  });
  it('the province: extra funds when the cash runs out, more time when the deadline is close', () => {
    const { s, w } = load('canoes');
    s.cash = -200; s.influence = 6; s.deadline = s.market.t + 4;
    const rules = advise(s, w).map((x) => x.rule);
    expect(rules).toContain('province.extraFunds');
    expect(rules).toContain('province.extraTime');
    s.extendedDeadline = true; s.influence = 3;
    const again = advise(s, w).map((x) => x.rule);
    expect(again).not.toContain('province.extraTime');
    expect(again).not.toContain('province.extraFunds');
  });
  it('a field losing on the way gets its best measured fix: here, a better crop', () => {
    const { s, w } = load('speedrun');
    s.map.buildings['35,51'] = 'tradingPost'; s.fleet['35,51'] = { muleTrain: 2 };
    const fix = producerFix(s, w, '32,50');
    expect(fix?.action).toMatchObject({ kind: 'swap', key: '32,50', from: 'cassavaField' });
    expect(fix!.gain).toBeGreaterThan(50);
  });
});

describe('advisor texts', () => {
  it('every rule has a title and a body in both languages', () => {
    for (const lang of LOCALES) { const t = createTranslator(lang); for (const r of ADVICE_RULES) for (const part of ['title', 'body']) expect(t.has(`advice.${r}.${part}`), `${lang} advice.${r}.${part}`).toBe(true); }
  });
  it('every advice given on the saves and their variants is a known rule', () => {
    const known = new Set<string>(ADVICE_RULES);
    for (const [name, vs] of Object.entries(variants as unknown as Record<string, Record<string, { spec: { caixa?: number; nivelC?: number; add?: Record<string, string>; dizimo?: number } }>>)) {
      for (const { spec } of Object.values(vs)) {
        const s = legacyState((seasons as unknown as Record<string, { state: Record<string, unknown> }>)[name]!.state), w = generateWorld(s.seed, s.mapVersion);
        if (spec.caixa !== undefined) s.cash = spec.caixa;
        if (spec.nivelC) s.level = spec.nivelC;
        for (const [k, t] of Object.entries(spec.add ?? {})) s.map.buildings[k as LotKey] = B[t] as never;
        for (const a of advise(s, w)) expect(known.has(a.rule), a.rule).toBe(true);
      }
    }
  });
});

describe('advisor: priorities from the balance review', () => {
  const load = (name: string) => { const s = legacyState((seasons as unknown as Record<string, { state: Record<string, unknown> }>)[name]!.state); return { s, w: generateWorld(s.seed, s.mapVersion) }; };
  it('asks for streets before the lots along them run out, with a line the command can open', async () => {
    const { newGame } = await import('../src/game.js'), { streets } = await import('../src/commands.js'), { roomByStreets } = await import('../src/advisor.js');
    const { s, w } = newGame(1869);
    const { canPlace } = await import('../src/placement.js');
    // fill the lots by the streets
    for (let a = 0; a < 90 && roomByStreets(s, w) >= 6; a++) for (let b = 0; b < 105; b++) if (!canPlace(s.map, w, 'hut', a, b)) { s.map.buildings[`${a},${b}` as LotKey] = 'hut'; if (roomByStreets(s, w) < 6) break; }
    const a = advise(s, w).find((x) => x.rule === 'streets.room');
    expect(a?.action?.kind).toBe('streets');
    const act = a!.action as { kind: 'streets'; from: [number, number]; to: [number, number] };
    const len = Math.abs(act.to[0] - act.from[0]) + Math.abs(act.to[1] - act.from[1]) + 1;
    expect(len).toBeGreaterThanOrEqual(2);
    expect(streets(s, w, act.from, act.to).opened).toBe(len);
    expect(roomByStreets(s, w)).toBeGreaterThanOrEqual(6);
  });
  it('near the deadline, what the milestone asks for comes first; behind on families, homes come even with idle hands', () => {
    const { s, w } = load('speedrun');
    const before = advise(s, w).filter((x) => x.rule === 'milestoneBuilding').map((x) => x.weight);
    expect(Math.max(...before)).toBeLessThan(84);
    s.deadline = s.market.t + 10;
    const near = advise(s, w);
    expect(near.filter((x) => x.rule === 'milestoneBuilding').every((x) => x.weight >= 84)).toBe(true);
    expect(near.some((x) => x.rule === 'milestoneFamilies')).toBe(true);
    expect(ruleAdvice(s, w).some((x) => x.rule === 'milestoneFamilies')).toBe(false);
  });
});
