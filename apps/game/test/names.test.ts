// The names inside texts come out as names: the robot plays a colony and each news item and piece of advice is
// written the way the interface writes it (the game's own translator, with the colony as context). No id may
// show through: a catalog key, a district's id or a placeholder.
import { describe, expect, it } from 'vitest';
import { generateWorld, nameId, parseNameId, type Advice, type GameState, type SeasonReport, type World } from '@assunguy/sim';
import { T, setContext } from '../src/i18n';
import { play } from '../../../tools/bot/src/bot.js';

const LEAK = /\b(district|building|good|news|advice|ui|event|crisis|vehicle|service)\.[A-Za-z]|\|\d|\{\w+\}/;

describe('names in the texts', () => {
  it('a district id reads back as the same name', () => {
    for (const n of [{ key: 'district.hamlet', land: '2,5' }, { key: 'district.upper', n: 3 }, { key: 'district.centre' }, { key: 'district.custom', custom: 'Vila Nova' }])
      expect(parseNameId(nameId(n as never))).toEqual(n);
  });
  it('a district reads as a name in the news, from its id', () => {
    const w = generateWorld(1869), land = Object.keys(w.lands)[0] as string;
    setContext({ s: { map: { buildings: {} } } as unknown as GameState, w });
    for (const n of [{ key: 'district.hamlet', land }, { key: 'district.upper', n: 2 }, { key: 'district.centre' }, { key: 'district.custom', custom: 'Vila Nova' }]) {
      const text = T('news.districtBorn', { district: nameId(n as never), homes: 6 });
      expect(text).not.toMatch(LEAK);
      if (n.custom) expect(text).toContain('Vila Nova');
    }
    setContext(null);
  });
  it('news and advice show no ids', () => {
    const leaks = new Set<string>();
    let w: World | null = null, seen = 0;
    const look = (s: GameState, what: string, text: string) => { seen++; if (LEAK.test(text)) leaks.add(`${what}: ${text}`); };
    for (const seed of [1869, 31]) {
      w = null;
      play(seed, { seasons: 40, observe: {
        report: (r: SeasonReport, s: GameState) => {
          w ??= generateWorld(s.seed, s.mapVersion);
          setContext({ s, w: w as World });
          for (const n of r.news) look(s, n.key, T(n.key, { colony: 'Assunguy', advisor: 'Inácio', ...(n.params as Record<string, string | number>) }));
        },
        advice: (list: Advice[], s: GameState) => {
          w ??= generateWorld(s.seed, s.mapVersion);
          setContext({ s, w: w as World });
          for (const a of list) {
            const p = { at: (a.params.key as string) ?? '', advisor: 'Inácio', ...(a.params as Record<string, string | number>) };
            look(s, a.rule, `${T(`advice.${a.rule}.title`, p)} / ${T(`advice.${a.rule}.body`, p)}`);
          }
        },
      } as never });
    }
    setContext(null);
    expect(seen).toBeGreaterThan(100);
    expect([...leaks].sort()).toEqual([]);
  }, 300_000);
});
