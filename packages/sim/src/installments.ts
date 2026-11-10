// Lot instalments (the prototype's `cobraParcelas`), removed in the November review and kept here behind a
// switch to measure bringing them back. From two years after arriving, once a year for five years, each family
// that can pay ($ 6 a year in income) pays it to the purse, half of it out of its savings; three missed
// payments in a row and the lot goes back to the colony and the home is freed.
import { incomePerFamily } from './families.js';
import { taxEffect } from './ratings.js';
import type { FamilyId, GameState } from './state.js';
import type { World } from './world.js';

export const RULES = { installments: false };
export const INSTALMENT = (20 * 1.2 + 6) / 5;
const MISSES_TO_LOSE = 3;

export function collectInstalments(s: GameState, w: World): { received: number; paid: number; late: number; lost: FamilyId[] } {
  const out = { received: 0, paid: 0, late: 0, lost: [] as FamilyId[] };
  if (!RULES.installments) return out;
  const t = s.market.t, tax = taxEffect(s, w), income = incomePerFamily(s, tax.groups, tax.economy.counts.work);
  for (const f of Object.values(s.families)) {
    const since = t - f.arrived, x = f as typeof f & { instalments?: number; arrears?: number };
    if ((x.instalments ?? 0) >= 5 || since < 8 || since % 4 !== 0) continue;
    if ((income[f.id] ?? 0) >= INSTALMENT) { x.instalments = (x.instalments ?? 0) + 1; out.received += INSTALMENT; out.paid += 1; x.arrears = 0; f.savings = Math.max(0, (f.savings || 0) - INSTALMENT * 0.5); }
    else x.arrears = (x.arrears ?? 0) + 1;
    if (x.arrears) out.late += 1;
    if ((x.arrears ?? 0) >= MISSES_TO_LOSE) out.lost.push(f.id);
  }
  for (const id of out.lost) { s.vacated[id] = true; delete s.families[id]; }
  s.cash += out.received;
  return out;
}
