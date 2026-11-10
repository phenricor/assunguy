// Two languages from day one: Portuguese (Brazil) and English. Every string the player reads lives in
// locales/<lang>.json under a dotted key; code never holds display text.
import ptBR from '../locales/pt-BR.json' with { type: 'json' };
import en from '../locales/en.json' with { type: 'json' };

export type Locale = 'pt-BR' | 'en';
export const LOCALES: readonly Locale[] = ['pt-BR', 'en'];

const CATALOGS: Record<Locale, Record<string, string>> = { 'pt-BR': ptBR, en };

export type Params = Record<string, string | number>;

export interface Translator {
  readonly locale: Locale;
  /** Looks a key up and fills {name} placeholders. A missing key returns the key itself, in brackets. */
  t(key: string, params?: Params): string;
  /** Picks `${key}.one` or `${key}.other` by count, and passes {count} along. */
  plural(key: string, count: number, params?: Params): string;
  has(key: string): boolean;
  number(value: number, digits?: number): string;
  money(value: number): string;
}

const fill = (text: string, params?: Params): string =>
  params ? text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole)) : text;

export function createTranslator(locale: Locale): Translator {
  const catalog = CATALOGS[locale];
  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const self: Translator = {
    locale,
    has: (key) => key in catalog,
    t: (key, params) => {
      const text = catalog[key];
      return text === undefined ? `[${key}]` : fill(text, params);
    },
    plural: (key, count, params) => self.t(`${key}.${count === 1 ? 'one' : 'other'}`, { count, ...params }),
    number: (value, digits = 0) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value),
    money: (value) => `${value < 0 ? '−' : ''}$ ${numbers.format(Math.abs(Math.round(value)))}`,
  };
  return self;
}

export const catalogKeys = (locale: Locale): string[] => Object.keys(CATALOGS[locale]);
