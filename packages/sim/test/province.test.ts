import { describe, expect, it } from 'vitest';
import { computeEconomy } from '../src/economy.js';
import { advanceGreatWorks, advanceTransport, applyRelief, goalPace, grantFactor, levelRequirements, milestoneGaps, provinceReport, reliefPlan, upkeepPerSeason, type GreatWorkNews } from '../src/province.js';
import { rateHomes } from '../src/ratings.js';
import { generateWorld } from '../src/world.js';
import { MILESTONES } from '@assunguy/data';
import fixture from './fixtures/province.json' with { type: 'json' };
import { legacyState } from './legacy.js';
import { applyPrototypeRules } from './prototypeRules.js';

applyPrototypeRules();

interface Case {
  state: Record<string, unknown>; manut: number; verba: number;
  plan: { itens: [string, number, number][]; q: number; custo: number; frete: number };
  ritmo: null | { tempo: number; feito: number; atraso: number };
  faltas: [boolean, number | string][]; req: [boolean, number | string][];
  conta: { razoes: string[]; mod: number };
  relief: { ids: string[]; caixa: number; frete: number; custo: number };
  transp: { tr: { rede: number; redeRec: number }; transp: { vol: Record<string, number>; lenhaFalta: number; ult: { margem: number; perda: number } }; caixa: number };
  works: { pago: number; gobras: Record<string, { pago?: number; extra?: number; feito?: boolean; ativo?: boolean; parou?: boolean }>; caixa: number; n: number; inf: number };
}
const cases = fixture as unknown as Record<string, Case>;
const REASON: Record<string, string> = { 'colonos satisfeitos': 'satisfied', 'colonos insatisfeitos': 'dissatisfied', 'caixa no vermelho': 'inTheRed', 'caixa caiu mais de $ 500 no semestre': 'cashFell' };
const WORK: Record<string, string> = { telegrafo: 'telegraph', hospital: 'hospital', usinaCal: 'limeWorks' };

describe('purse and province (golden, against the playtester saves)', () => {
  for (const [name, c] of Object.entries(cases)) {
    describe(name, () => {
      const fresh = () => legacyState(c.state);
      const s = fresh(), w = generateWorld(s.seed, s.mapVersion);

      it('charges the same upkeep and grants the same funds', () => {
        expect(upkeepPerSeason(s)).toBeCloseTo(c.manut, 9);
        expect(Math.round((MILESTONES[s.milestone]!.grant) * s.grantFactor * grantFactor(s))).toBe(c.verba);
      });

      it('plans and staffs the relief works the same way', () => {
        const p = reliefPlan(s);
        expect(p.items.map((x) => [x.id, x.need, x.staffed])).toEqual(c.plan.itens.map(([id, q, t]) => [id === 'caminhos' ? 'roads' : id, q, t]));
        expect([p.staffed, p.cost, p.freightCut]).toEqual([c.plan.q, c.plan.custo, c.plan.frete]);
        const s2 = fresh(); applyRelief(s2);
        expect(Object.keys(s2.reliefWorkers).sort()).toEqual(c.relief.ids);
        expect([s2.cash, s2.freightRelief, s2.reliefCost]).toEqual([c.relief.caixa, c.relief.frete, c.relief.custo]);
      });

      it('measures the same goals and pace', () => {
        const mean = rateHomes(s, w).mean;
        const next = MILESTONES[s.milestone + 1]!;
        expect(milestoneGaps(s, w, next, mean).map((x) => [x.ok, x.current])).toEqual(c.faltas);
        const eco = computeEconomy(s, w);
        expect(levelRequirements(s, w, s.level + 1, eco).map((x) => [x.ok, x.kind === 'income' ? x.current : x.current])).toEqual(c.req.map(([ok, v]) => [ok, typeof v === 'string' ? eco.incomeTotal : v]));
        const p = goalPace(s, w, mean);
        if (!c.ritmo) expect(p).toBeNull();
        else { expect(p!.time).toBeCloseTo(c.ritmo.tempo, 12); expect(p!.done).toBeCloseTo(c.ritmo.feito, 12); }
      });

      it('scores the colony like the province did, without the instalment rule', () => {
        const s2 = fresh(), mean = rateHomes(s2, w).mean;
        const r = provinceReport(s2, w, -600, computeEconomy(s2, w), mean);
        const kept = c.conta.razoes.filter((x) => x !== 'parcelas em dia' && x !== 'muitas parcelas atrasadas');
        expect(r.reasons.map((x) => x.reason)).toEqual(kept.map((x) => REASON[x] ?? x));
      });

      it('advances transport: volumes, tariff income, fleet cost', () => {
        const s2 = fresh(), before = s2.cash;
        const t = advanceTransport(s2, computeEconomy(s2, w));
        expect([t.fleetCost, t.tariffIncome]).toEqual([c.transp.tr.rede, c.transp.tr.redeRec]);
        expect(s2.cash).toBeCloseTo(c.transp.caixa, 9);
        expect(s2.transport.volume).toEqual(c.transp.transp.vol);
        expect(s2.transport.last!.margin).toBeCloseTo(c.transp.transp.ult.margem, 12);
        expect(s2.transport.last!.loss).toBeCloseTo(c.transp.transp.ult.perda, 12);
        expect(before).not.toBe(s2.cash);
      });

      it('pays great works the same way', () => {
        const s2 = fresh();
        s2.cash = 5000;
        s2.greatWorks = { telegraph: { active: true, paid: 7, extra: 1.2 }, hospital: { active: true, paid: 0, extra: 0.4 }, limeWorks: { active: true, paid: 2, stalled: true } };
        const news: GreatWorkNews[] = [];
        expect(advanceGreatWorks(s2, news)).toBe(c.works.pago);
        expect(s2.cash).toBe(c.works.caixa);
        expect(news.length).toBe(c.works.n);
        expect(s2.influence).toBe(c.works.inf);
        for (const [k, g] of Object.entries(c.works.gobras)) {
          const y = s2.greatWorks[WORK[k]!]!;
          expect([y.paid ?? 0, y.extra ?? 0, !!y.done, !!y.active, !!y.stalled], k).toEqual([g.pago ?? 0, g.extra ?? 0, !!g.feito, !!g.ativo, !!g.parou]);
        }
      });
    });
  }
});
