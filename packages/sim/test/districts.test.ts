import { describe, expect, it } from 'vitest';
import { createTranslator, districtName, landName } from '@assunguy/i18n';
import { computeDistricts } from '../src/districts.js';
import type { LotKey } from '../src/world.js';
import { generateWorld } from '../src/world.js';
import districts from './fixtures/districts.json' with { type: 'json' };
import seasons from './fixtures/seasons.json' with { type: 'json' };
import { legacyState } from './legacy.js';
import { applyPrototypeRules } from './prototypeRules.js';

applyPrototypeRules();

type Snap = { celula: Record<string, string>; info: { id: string; nome: string; cor: number; casas: string[]; centro: [number, number]; arraial: boolean }[]; lacos: Record<string, [number, number][][]> };
const t = createTranslator('pt-BR');

describe('districts (golden, against the prototype)', () => {
  for (const [name, c] of Object.entries(districts as unknown as Record<string, { first: Snap; extra: string[]; remembered: Snap; named: Snap; seen: string[]; hamlets: string[] }>)) {
    it(`${name}: as they come, remembered after new homes, and with a player's name`, () => {
      const s = legacyState((seasons as unknown as Record<string, { state: Record<string, unknown> }>)[name]!.state), w = generateWorld(s.seed, s.mapVersion);
      const check = (want: Snap, when: string) => {
        const d = computeDistricts(s, w);
        expect(d.cell, `${when} cells`).toEqual(want.celula);
        expect(d.info.map((x) => [x.id, districtName(t, x.name, (id) => landName(t, w.lands[id as never]!)), x.color, x.homes, x.centre, x.hamlet]), `${when} districts`).toEqual(want.info.map((x) => [x.id, x.nome, x.cor, x.casas, x.centro, x.arraial]));
        expect(d.outlines, `${when} outlines`).toEqual(want.lacos);
      };
      check(c.first, 'first');
      s.districts = { seen: c.seen as LotKey[], hamlets: c.hamlets as LotKey[] };
      for (const k of c.extra) s.map.buildings[k as LotKey] = 'hut';
      check(c.remembered, 'remembered');
      s.districts!.names = { [c.first.info[0]!.id]: 'Praça Velha' };
      check(c.named, 'named');
    });
  }
});
