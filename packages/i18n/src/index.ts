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
  /**
   * Looks a key up and fills {name} placeholders. A missing key returns the key itself, in brackets. A placeholder
   * with no value is never shown as is: a count or amount becomes 0, a name becomes an ellipsis (see `fallback`).
   */
  t(key: string, params?: Params): string;
  /** The text as written in the catalog, placeholders untouched (for checks). */
  raw(key: string): string | undefined;
  /** Picks `${key}.one` or `${key}.other` by count, and passes {count} along. */
  plural(key: string, count: number, params?: Params): string;
  has(key: string): boolean;
  number(value: number, digits?: number): string;
  money(value: number): string;
}

/** Placeholders that hold a name or a phrase; every other placeholder holds a number or an amount. */
const TEXT_HOLES = new Set(['a', 'aEffect', 'advisor', 'at', 'b', 'bEffect', 'building', 'cause', 'cave', 'chain', 'colony', 'crisis', 'custom', 'date', 'destination', 'disease', 'district', 'email', 'family', 'from', 'good', 'item', 'label', 'land', 'lang', 'law', 'list', 'milestone', 'name', 'names', 'origin', 'place', 'product', 'reason', 'season', 'service', 'title', 'to', 'vehicle', 'version', 'what', 'work']);
/** What a placeholder with no value shows: 0 for a number, an ellipsis for a name. */
export const fallback = (name: string): string => (TEXT_HOLES.has(name) ? '…' : '0');
/** The placeholders of a text. */
export const holes = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string);
/** The placeholders of a text that these params leave empty. */
export const unfilled = (text: string, params?: Params): string[] => holes(text).filter((h) => !params || !(h in params) || params[h] === undefined);

type Missing = (key: string, hole: string) => void;
let onMissing: Missing | null = null;
/** Called whenever a placeholder is left without a value (the game logs it; tests collect it). */
export const setMissingHandler = (f: Missing | null): void => { onMissing = f; };

const fill = (key: string, text: string, params?: Params): string =>
  text.indexOf('{') < 0 ? text : text.replace(/\{(\w+)\}/g, (_whole, name: string) => {
    const v = params?.[name];
    if (v !== undefined && v !== null) return String(v);
    onMissing?.(key, name);
    return fallback(name);
  });

export function createTranslator(locale: Locale): Translator {
  const catalog = CATALOGS[locale];
  const numbers = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const self: Translator = {
    locale,
    has: (key) => key in catalog,
    t: (key, params) => {
      const text = catalog[key];
      return text === undefined ? `[${key}]` : fill(key, text, params);
    },
    raw: (key) => catalog[key],
    plural: (key, count, params) => self.t(`${key}.${count === 1 ? 'one' : 'other'}`, { count, ...params }),
    number: (value, digits = 0) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value),
    money: (value) => `${value < 0 ? '−' : ''}$ ${numbers.format(Math.abs(Math.round(value)))}`,
  };
  return self;
}

export const catalogKeys = (locale: Locale): string[] => Object.keys(CATALOGS[locale]);

/** A land's name: its key, or "<name> de Cima" when the biome ran out of names. */
export const landName = (t: Translator, land: { nameKey: string; upper?: boolean }): string => (land.upper ? t.t('land.upper', { name: t.t(land.nameKey) }) : t.t(land.nameKey));

/** A district's name (see the simulation's districts): a key, the land when needed, a number when repeated. */
export function districtName(t: Translator, n: { key: string; land?: string; n?: number; custom?: string }, land: (id: string) => string): string {
  if (n.custom) return n.custom;
  let s = n.key === 'district.hamlet' ? t.t(n.key, { land: n.land ? land(n.land) : '' }) : t.t(n.key);
  if (n.land && n.key !== 'district.hamlet') s = t.t('district.withLand', { name: s, land: land(n.land) });
  if (n.n) s = t.t('district.numbered', { name: s, n: n.n });
  return s;
}
