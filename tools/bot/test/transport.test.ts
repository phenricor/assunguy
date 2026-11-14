// The advisor's transport advice works: the robot plays a few colonies, and every few seasons each piece of
// transport advice is carried out on a copy of the game. Doing what it says must raise the families' income,
// and by about what it promised. (Crop swaps are left out: they pay from the next harvest, not at once.)
import { describe, expect, it } from 'vitest';
import { computeEconomy, generateWorld, type Advice, type GameState, type World } from '@assunguy/sim';
import { act, play } from '../src/bot.js';

const TRANSPORT = /^(noVehicles|full\.|noSlot|noCollection|farLand|noGateway|outlet\.(collect|vehicle))/;

describe('transport advice', () => {
  it('does what it promises when carried out', () => {
    const bad: string[] = [];
    let checked = 0;
    for (const seed of [1869, 31]) {
      let w: World | null = null, i = 0;
      play(seed, { seasons: 44, observe: {
        advice: (list: Advice[], s: GameState) => {
          if (++i % 2) return;
          w ??= generateWorld(s.seed, s.mapVersion);
          const base = computeEconomy(s, w).incomeTotal;
          for (const a of list.filter((x) => TRANSPORT.test(x.rule) && x.action && x.action.kind !== 'select')) {
            const copy = structuredClone(s) as GameState;
            copy.cash = 1e6;
            if (!act(copy, w, a.action!)) continue;
            checked++;
            const got = computeEconomy(copy, w).incomeTotal - base, said = Number(a.params.gain);
            if (got <= 0 || (said > 0 && Math.abs(got - said) > Math.max(15, said * 0.25))) bad.push(`seed ${seed} t ${s.market.t} ${a.rule}: said ${said}, got ${Math.round(got)}`);
          }
        },
      } });
    }
    expect(checked).toBeGreaterThan(5);
    expect(bad).toEqual([]);
  }, 300_000);
});
