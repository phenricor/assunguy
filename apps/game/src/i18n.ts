// The interface's words: the shared catalogs (pt-BR and en), plus how names inside parameters are written out.
import { createTranslator, landName, districtName, setMissingHandler, type Locale, type Params, type Translator } from '@assunguy/i18n';

// a placeholder left empty shows a fallback (0 or an ellipsis); say which one, once, so it gets fixed
const warned = new Set<string>();
setMissingHandler((key, hole) => { const k = `${key}:${hole}`; if (!warned.has(k)) { warned.add(k); console.warn(`[i18n] ${key} has no value for {${hole}}`); } });
import type { GameState, World, LotKey, LandId } from '@assunguy/sim';

let tr: Translator = createTranslator(pickLocale());
const listeners: (() => void)[] = [];

function pickLocale(): Locale {
  try { const saved = localStorage.getItem('assunguy.locale'); if (saved === 'en' || saved === 'pt-BR') return saved; } catch { /* storage may be blocked */ }
  return 'pt-BR';
}
export const locale = (): Locale => tr.locale;
export function setLocale(l: Locale): void {
  tr = createTranslator(l);
  try { localStorage.setItem('assunguy.locale', l); } catch { /* ignore */ }
  document.documentElement.lang = l;
  for (const f of listeners) f();
}
export const onLocale = (f: () => void): void => { listeners.push(f); };

/** The game the names refer to (lands and lots are named from the state). */
let ctx: { s: GameState; w: World } | null = null;
export const setContext = (c: { s: GameState; w: World } | null): void => { ctx = c; };

const NS: Record<string, string> = {
  building: 'building', from: 'building', to: 'building', type: 'building', crop: 'building', target: 'building',
  good: 'good', service: 'service', vehicle: 'vehicle', milestone: 'milestone', work: 'greatWork', cause: 'cause', chain: 'advice.chain',
  destination: 'ui.race.dest', origin: 'origin', choice: 'choice', a: 'choice', b: 'choice', law: 'law', disease: 'disease', crisis: 'crisis', weather: 'weather', tax: 'tax',
};
const isLot = (v: string) => /^\d+,\d+$/.test(v);

/** A parameter value as the player reads it: ids become names, numbers get the locale's separators. */
export function nameOf(k: string, v: string | number, rest?: Record<string, string | number>): string {
  if (typeof v === 'number') return Number.isInteger(v) ? tr.number(v) : tr.number(v, Math.abs(v) < 10 ? 1 : 0);
  if (k === 'land' && ctx && isLot(v)) { const L = ctx.w.lands[v as LandId]; return L ? landName(tr, L) : v; }
  if ((k === 'at' || k === 'key') && ctx && isLot(v)) { const t = ctx.s.map.buildings[v as LotKey]; return t ? tr.t(`building.${t}`) : v; }
  if (k === 'district' && ctx) { try { return districtName(tr, JSON.parse(v), (id) => (ctx!.w.lands[id as LandId] ? landName(tr, ctx!.w.lands[id as LandId]!) : id)); } catch { return v; } }
  // a value that is itself a key (a news item's reason) is written with the other parameters
  if (v.includes('.') && tr.has(v)) return tr.t(v, rest && fmtParams(Object.fromEntries(Object.entries(rest).filter(([x, y]) => x !== k && !(typeof y === 'string' && y.includes('.'))))));
  const ns = NS[k];
  if (ns && tr.has(`${ns}.${v}`)) return tr.t(`${ns}.${v}`);
  return v;
}
export function fmtParams(p?: Record<string, string | number>): Params | undefined {
  if (!p) return p;
  const out: Params = {};
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null) out[k] = nameOf(k, v, p);
  return out;
}

/** Looks a key up, with the names in its parameters written out. */
export const T = (key: string, p?: Record<string, string | number>): string => tr.t(key, fmtParams(p));
export const has = (key: string): boolean => tr.has(key);
// the catalogs write the count as {n}
export const plural = (key: string, n: number, p?: Record<string, string | number>): string => tr.plural(key, n, fmtParams({ n, ...p }));
export const money = (v: number): string => tr.money(v);
export const num = (v: number, d = 0): string => tr.number(v, d);
export const pct = (v: number): string => `${tr.number(Math.round(v * 100))}%`;
export const building = (t: string): string => tr.t(`building.${t}`);
export const goodName = (g: string): string => tr.t(`good.${g}`);
