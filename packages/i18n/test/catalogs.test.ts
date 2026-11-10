import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, GOOD_IDS, VEHICLE_IDS } from '@assunguy/data';
import { catalogKeys, createTranslator } from '../src/index.js';

describe('locale catalogs', () => {
  it('Portuguese and English have exactly the same keys', () => {
    const pt = new Set(catalogKeys('pt-BR'));
    const en = new Set(catalogKeys('en'));
    expect([...pt].filter((k) => !en.has(k)), 'missing in English').toEqual([]);
    expect([...en].filter((k) => !pt.has(k)), 'missing in Portuguese').toEqual([]);
  });

  it('every good, building and vehicle has a name in both languages', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const tr = createTranslator(locale);
      for (const g of GOOD_IDS) expect(tr.has(`good.${g}`), `${locale} good.${g}`).toBe(true);
      for (const b of BUILDING_IDS) expect(tr.has(`building.${b}`), `${locale} building.${b}`).toBe(true);
      for (const v of VEHICLE_IDS) expect(tr.has(`vehicle.${v}`), `${locale} vehicle.${v}`).toBe(true);
    }
  });

  it('placeholders in both languages match', () => {
    const pt = createTranslator('pt-BR');
    const en = createTranslator('en');
    const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    for (const key of catalogKeys('pt-BR')) expect(holes(en.t(key)), key).toBe(holes(pt.t(key)));
  });

  it('display text avoids em dashes', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const tr = createTranslator(locale);
      for (const key of catalogKeys(locale)) expect(tr.t(key).includes('—'), `${locale} ${key}`).toBe(false);
    }
  });

  it('formats money in each language', () => {
    expect(createTranslator('pt-BR').money(1500)).toBe('$ 1.500');
    expect(createTranslator('en').money(-1500)).toBe('−$ 1,500');
  });
});
