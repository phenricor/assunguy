// Measuring a building as if it existed: the advisor places it on a real free lot of a copy of the colony,
// so its team comes from where it would come from and a field uses that lot's soil.
import type { BuildingId } from '@assunguy/data';
import { computeEconomy, def, soilOf, type Economy, type Extra } from './economy.js';
import { canPlace } from './placement.js';
import type { GameState } from './state.js';
import { lotKey, parseKey, type LotKey, type World } from './world.js';

/** Free lots next to streets where a building of this type fits, in street order. */
/** Free lots beside the streets where a building fits; `only` keeps them to a place (a district). */
export function lotsFor(s: GameState, w: World, type: BuildingId, n: number, only?: (k: LotKey) => boolean): LotKey[] {
  const want = def(type).crop ? 12 : 1, seen = new Set<LotKey>(), out: LotKey[] = [];
  for (const r of Object.keys(s.map.streets) as LotKey[]) {
    const [a, b] = parseKey(r);
    for (const [x, y] of [[a + 1, b], [a - 1, b], [a, b + 1], [a, b - 1]] as const) {
      const key = lotKey(x, y);
      if (seen.has(key)) continue;
      seen.add(key);
      if (only && !only(key)) continue;
      if (!canPlace(s.map, w, type, x, y)) out.push(key);
      if (out.length >= Math.max(n, want)) break;
    }
    if (out.length >= Math.max(n, want)) break;
  }
  return out;
}

/** A copy of the colony with the hypothetical buildings placed, and what could not be placed. */
export function withWorks(s: GameState, w: World, extra: Extra, only?: (k: LotKey) => boolean): [GameState, Extra | undefined] | null {
  const rest: Extra = {}, buildings = { ...s.map.buildings };
  let used = false;
  for (const t of Object.keys(extra) as (BuildingId | 'yield')[]) {
    const n = extra[t] as number;
    if (t === 'yield' || !(n > 0) || def(t).housing) { (rest as Record<string, unknown>)[t] = extra[t]; continue; }
    const lots = lotsFor(s, w, t, n, only).filter((key) => !buildings[key]);
    if (lots.length < n) { (rest as Record<string, unknown>)[t] = n; continue; }
    const g = def(t).output?.good;
    const chosen = def(t).crop && g ? lots.map((key) => [key, soilOf(w, key, g as never)] as const).sort((x, y) => y[1] - x[1]).slice(0, n).map((x) => x[0]) : lots.slice(0, n);
    for (const key of chosen) buildings[key] = t;
    used = true;
  }
  return used ? [{ ...s, map: { ...s.map, buildings } }, Object.keys(rest).length ? rest : undefined] : null;
}

/** The economy with hypothetical buildings, placed on real lots when there is room. */
export function measure(s: GameState, w: World, extra?: Extra): Economy {
  if (extra) { const cp = withWorks(s, w, extra); if (cp) return computeEconomy(cp[0], w, cp[1]); }
  return computeEconomy(s, w, extra);
}
