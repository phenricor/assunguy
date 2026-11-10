import { describe, expect, it } from 'vitest';
import { BUILDING_IDS, GOOD_IDS, VEHICLE_IDS } from '@assunguy/data';
import { catalogKeys, createTranslator, holes } from '../src/index.js';

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
    const set = (s?: string) => holes(s ?? '').sort().join(',');
    for (const key of catalogKeys('pt-BR')) expect(set(en.raw(key)), key).toBe(set(pt.raw(key)));
  });

  it('display text avoids em dashes', () => {
    for (const locale of ['pt-BR', 'en'] as const) {
      const tr = createTranslator(locale);
      for (const key of catalogKeys(locale)) expect(tr.t(key).includes('—'), `${locale} ${key}`).toBe(false);
    }
  });

  it('a placeholder with no value shows 0 for a number and an ellipsis for a name, never the braces', () => {
    const tr = createTranslator('pt-BR');
    expect(tr.t('event.immigrants.title')).toBe('Leva de 0 famílias');
    expect(tr.t('event.immigrants.title', { n: 6 })).toBe('Leva de 6 famílias');
    expect(tr.t('shock.demandDrop')).toBe('Procura por … caiu em Iguape');
  });

  it('formats money in each language', () => {
    expect(createTranslator('pt-BR').money(1500)).toBe('$ 1.500');
    expect(createTranslator('en').money(-1500)).toBe('−$ 1,500');
  });
});
