import { describe, expect, it } from 'vitest';
import { computeEconomy, type Economy, type LossCause } from '../src/economy.js';
import { generateWorld } from '../src/world.js';
import fixture from './fixtures/economy.json' with { type: 'json' };
import { LEGACY, goodFromLegacy, legacyState } from './legacy.js';

type Rec = Record<string, number>;
interface Case {
  state: Record<string, unknown>;
  per: Record<string, Rec>; estoque: Rec; imp: { dizimo: Rec; fora: Rec };
  scalars: Rec; perdaPor: Rec; arrec: Rec;
  e: { n: Rec; fam: number; vagas: number; rend: Rec; mercado: number; tropas: number; somaF: Rec; veios: Rec; semLigacao: number };
  alloc: { setor: Record<string, { vagas: number; ocup: number; ef: number; rend: number }>; livres: string[]; ocupadas: number; por: Record<string, string[]> };
  transp: {
    caps: { key: string; capEst: number; leva: number; lombo: number; tarifa: number; pico: number }[];
    portas: { key: string; capEst: number; vol: number; tarifa: number; pico: number; dests: { d: string; viagem: number; cheio: number }[] }[];
    modo: Rec; aprov: number; perdV: number; tarifas: number; custoEst: number;
    terras: { id: string; prodV: number; perdeV: number; lomboV: number; coberto: boolean }[];
  };
}
const cases = fixture as unknown as Record<string, Case>;
const SECTOR = LEGACY.sectors as Record<string, string>;
const BUILDING = LEGACY.buildings as Record<string, string>;
const DEP = LEGACY.deposits as Record<string, string>;
const LOSS: Record<string, LossCause> = { transporte: 'transport', comprador: 'buyer', estragou: 'spoiled', lombo: 'carrying', semPorta: 'noGateway' };
const PER: Record<string, keyof Economy> = { prod: 'produced', proprio: 'ownTable', mercado: 'market', fora: 'exported', frete: 'freight', perda: 'lost', renda: 'income', proc: 'processed', procura: 'demand', fat: 'sales' };
const SCALAR: Record<string, keyof Economy> = { fome: 'hunger', faltaProdutor: 'producerShortfall', demMercado: 'marketDemand', viaC: 'byRiver', viaT: 'byRoad', rendaTotal: 'incomeTotal', perdaTotal: 'lostTotal', prodTotal: 'producedTotal', foraTotal: 'exportedTotal', mercadoTotal: 'marketTotal', proprioTotal: 'ownTableTotal', fatTotal: 'salesTotal', subsistencia: 'subsistence', excedente: 'surplus' };
const MODE: Record<string, string> = { fluvial: 'river', terrestre: 'road', ferro: 'rail', pe: 'foot', perdida: 'lost' };

/** Equal up to floating-point noise (the port may add in a different order). */
const close = (got: number | undefined, want: number, what: string) => {
  const g = got ?? 0;
  expect(Math.abs(g - want), `${what}: got ${g}, want ${want}`).toBeLessThanOrEqual(1e-7 * Math.max(1, Math.abs(want)));
};
const perGood = (got: Record<string, number>, want: Rec, what: string) => {
  for (const [g, v] of Object.entries(want)) close(got[goodFromLegacy(g)], v, `${what}.${g}`);
  for (const [g, v] of Object.entries(got)) if (Math.abs(v) > 1e-6) expect(Object.keys(want).map(goodFromLegacy), `${what}: unexpected ${g}`).toContain(g);
};

describe('season economy (golden, against the playtester saves)', () => {
  for (const [name, c] of Object.entries(cases)) {
    describe(name, () => {
      const s = legacyState(c.state);
      const w = generateWorld(s.seed, s.mapVersion);
      const eco = computeEconomy(s, w);

      it('allocates families to the same jobs', () => {
        const a = eco.counts.work;
        expect(a.employed).toBe(c.alloc.ocupadas);
        expect(a.idle.map((f) => f.id)).toEqual(c.alloc.livres);
        expect(Object.fromEntries(Object.entries(a.byBuilding).map(([k, t]) => [k, t.families.map((f) => f.id)]))).toEqual(c.alloc.por);
        for (const [sec, x] of Object.entries(c.alloc.setor)) {
          const y = a.bySector[SECTOR[sec] as keyof typeof a.bySector];
          expect([y.slots, y.filled], sec).toEqual([x.vagas, x.ocup]);
          close(y.efficiency, x.ef, `${sec}.ef`); close(y.yield, x.rend, `${sec}.rend`);
        }
      });

      it('counts the same buildings, families, yields and capacities', () => {
        const e = eco.counts;
        expect(e.n).toEqual(Object.fromEntries(Object.entries(c.e.n).map(([t, n]) => [BUILDING[t], n])));
        expect(e.families).toBe(c.e.fam);
        expect(e.slots).toBe(c.e.vagas);
        expect(e.unlinked).toBe(c.e.semLigacao);
        for (const [sec, v] of Object.entries(c.e.rend)) close(e.sectorYield[SECTOR[sec] as keyof typeof e.sectorYield], v, `rend.${sec}`);
        for (const [t, v] of Object.entries(c.e.somaF)) close(e.factorSum[BUILDING[t] as keyof typeof e.factorSum], v, `somaF.${t}`);
        for (const [d, v] of Object.entries(c.e.veios)) close(e.deposits[DEP[d] as keyof typeof e.deposits], v, `veios.${d}`);
        close(e.market, c.e.mercado, 'market capacity');
        close(e.muleTrains, c.e.tropas, 'mule trains');
      });

      it('hauls and exports the same way', () => {
        const t = eco.transport;
        expect(t.gateways.map((p) => p.key)).toEqual(c.transp.portas.map((p) => p.key));
        c.transp.portas.forEach((p, i) => {
          const q = t.gateways[i]!;
          close(q.capacity, p.capEst, `${p.key}.capacity`); close(q.volume, p.vol, `${p.key}.volume`); close(q.tariff, p.tarifa, `${p.key}.tariff`); close(q.peak, p.pico, `${p.key}.peak`);
          expect(q.dests.map((d) => [d.d, d.trip, d.full])).toEqual(p.dests.map((d) => [d.d === 'saopaulo' ? 'saoPaulo' : d.d, d.viagem, d.cheio]));
        });
        expect(t.collections.map((x) => x.key)).toEqual(c.transp.caps.map((x) => x.key));
        c.transp.caps.forEach((x, i) => { const y = t.collections[i]!; close(y.capacity, x.capEst, 'cap'); close(y.carried, x.leva, 'carried'); close(y.foot, x.lombo, 'foot'); close(y.tariff, x.tarifa, 'tariff'); close(y.peak, x.pico, 'peak'); });
        for (const [m, v] of Object.entries(c.transp.modo)) close(t.mode[MODE[m] as keyof typeof t.mode], v, `mode.${m}`);
        close(t.delivered, c.transp.aprov, 'delivered'); close(t.lostValue, c.transp.perdV, 'lost value'); close(t.tariffs, c.transp.tarifas, 'tariffs'); close(t.fleetCost, c.transp.custoEst, 'fleet cost');
        expect(t.lands.map((l) => [l.id, l.covered])).toEqual(c.transp.terras.map((l) => [l.id, l.coberto]));
        c.transp.terras.forEach((l, i) => { close(t.lands[i]!.producedValue, l.prodV, `${l.id}.prodV`); close(t.lands[i]!.lostValue, l.perdeV, `${l.id}.perdeV`); close(t.lands[i]!.footValue, l.lomboV, `${l.id}.lomboV`); });
      });

      it('produces, feeds, transforms, sells and loses the same arrobas', () => {
        for (const [k, key] of Object.entries(PER)) perGood(eco[key] as Record<string, number>, c.per[k] as Rec, k);
        perGood(eco.stock, c.estoque, 'stock');
        perGood(eco.tax.tithe, c.imp.dizimo, 'tithe'); perGood(eco.tax.export, c.imp.fora, 'export duty');
        for (const [k, key] of Object.entries(SCALAR)) close(eco[key] as number, c.scalars[k] as number, k);
        for (const [k, v] of Object.entries(c.perdaPor)) close(eco.lostBy[LOSS[k] as LossCause], v, `lost by ${k}`);
        close(eco.revenue.total, c.arrec.total as number, 'revenue');
      });
    });
  }
});
