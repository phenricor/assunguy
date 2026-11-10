// Every text the rules hand to the player fills all its placeholders: the robot plays a few colonies and each
// piece of advice, event, report line and chronicle entry is checked against the Portuguese catalog with the
// same params the interface passes. A placeholder left empty would show its fallback (0 or an ellipsis).
import { describe, expect, it } from 'vitest';
import { createTranslator, unfilled, type Params } from '@assunguy/i18n';
import type { GameState, SeasonReport } from '@assunguy/sim';
import { play } from '../src/bot.js';

const tr = createTranslator('pt-BR');
const ui = { colony: 'Assunguy', advisor: 'Inácio' };

/** Records `key: holes` for each text whose params leave a placeholder empty, following keys passed as values. */
function checker() {
  const gaps = new Set<string>(), seen = new Set<string>();
  const check = (key: string, params: Params = {}) => {
    const text = tr.raw(key);
    if (text === undefined) return;
    const sig = `${key}|${Object.keys(params).sort().join(',')}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    const miss = unfilled(text, params);
    if (miss.length) gaps.add(`${key}: ${miss.join(', ')}`);
    // a value that is itself a key (a news item's reason) is written with the other params
    for (const [k, v] of Object.entries(params)) if (typeof v === 'string' && v.includes('.') && tr.raw(v) !== undefined) {
      const rest = Object.fromEntries(Object.entries(params).filter(([x]) => x !== k)) as Params;
      check(v, rest);
    }
  };
  return { gaps, check };
}

function observe(c: ReturnType<typeof checker>) {
  const chronicled = new Set<unknown>();
  const chronicle = (s: GameState) => { for (const x of s.chronicle) if (!chronicled.has(x)) { chronicled.add(x); c.check(x.key, x.params as Params); } };
  return {
    advice: (list: { rule: string; params: Record<string, unknown> }[], s: GameState) => {
      for (const a of list) { const p = { at: (a.params.key as string) ?? '', ...(a.params as Params), advisor: ui.advisor }; c.check(`advice.${a.rule}.title`, p); c.check(`advice.${a.rule}.body`, p); }
      chronicle(s);
    },
    event: (d: { id: string; params?: Params; options: { params?: Params }[] }) => {
      const p = { ...ui, ...d.params }, k = (x: string) => `event.${d.id}.${x}`;
      for (const x of ['who', 'title', 'body']) c.check(k(x), p);
      for (let i = 0; tr.has(k(`line.${i}.text`)); i++) { c.check(k(`line.${i}.who`), p); c.check(k(`line.${i}.text`), p); }
      d.options.forEach((o, i) => { const q = { ...p, ...o.params }; c.check(k(`option.${i}`), q); c.check(k(`option.${i}.effect`), q); c.check(k(`option.${i}.chronicle`), { ...d.params }); });
    },
    report: (r: SeasonReport, s: GameState) => {
      for (const n of r.news) c.check(n.key, { ...ui, ...(n.params as Params) });
      for (const x of r.province?.reasons ?? []) c.check(`ui.province.${x.reason}`, x.params as Params);
      for (const x of r.decisions.events) {
        const p = { ...ui, ...x.params };
        c.check(`event.${x.event}.title`, p); c.check(`event.${x.event}.option.${x.option}`, p); c.check(`event.${x.event}.option.${x.option}.effect`, p);
      }
      chronicle(s);
    },
  };
}

describe('texts from the rules fill every placeholder', () => {
  // TEXT_AUDIT=full plays longer colonies, into the railway race (a few minutes)
  const full = process.env.TEXT_AUDIT === 'full';
  it('advice, events, reports and the chronicle over a few colonies', () => {
    const c = checker();
    for (const seed of full ? [1869, 7, 31, 2024] : [1869, 31]) play(seed, { seasons: full ? 120 : 36, observe: observe(c) as never });
    expect([...c.gaps].sort()).toEqual([]);
  }, 900_000);
});
