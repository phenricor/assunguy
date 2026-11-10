import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTranslator } from '@assunguy/i18n';
import { defineEvent, type QueuedEvent } from '../src/events.js';
import type { GameState } from '../src/state.js';
import fixture from './fixtures/seasons.json' with { type: 'json' };
import { legacyState } from './legacy.js';

const SRC = join(__dirname, '..', 'src');
const sources = readdirSync(SRC).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(SRC, f), 'utf8')).join('\n');

describe('every text the rules emit exists in both languages', () => {
  const keys = [...new Set([...sources.matchAll(/'((?:news|mood|chronicle|shock)\.[a-zA-Z.]+)'/g)].map((m) => m[1] as string))];
  for (const locale of ['pt-BR', 'en'] as const) {
    const { has } = createTranslator(locale);
    it(`${locale}: news, mood, chronicle and shock keys`, () => {
      expect(keys.length).toBeGreaterThan(30);
      expect(keys.filter((k) => !has(k))).toEqual([]);
    });
    it(`${locale}: each event has a title, a body and text for every option`, () => {
      const s = legacyState((fixture as any).speedrun.state) as GameState;
      const events: QueuedEvent[] = [
        ...['earlyArrival', 'storeBox', 'storeDebt', 'accusation', 'divino', 'fever', 'peddler', 'blacksmith', 'kaingangVisit', 'fences', 'barter', 'committee', 'promise', 'engineer'].map((id) => ({ kind: 'dilemma', id }) as QueuedEvent),
        { kind: 'crisis', id: 'frost' }, { kind: 'crisis', id: 'flood' }, { kind: 'immigrants', n: 6, origin: 'swiss' }, { kind: 'pathChoice', level: 3 },
        { kind: 'intro' }, { kind: 'decree', milestone: 'parish' }, { kind: 'victory' }, { kind: 'inspector', milestone: 'village' }, { kind: 'end', milestone: 'village' }, { kind: 'requisition' },
      ];
      for (const ev of events) {
        const d = defineEvent(s, ev);
        for (const k of ['title', 'body', 'who']) expect(has(`event.${d.id}.${k}`), `${d.id}.${k}`).toBe(true);
        d.options.forEach((_, i) => expect(has(`event.${d.id}.option.${i}`), `${d.id} option ${i}`).toBe(true));
        expect(has(`event.${d.id}.option.${d.options.length}`), `${d.id} has no extra options`).toBe(false);
      }
    });
  }
});
