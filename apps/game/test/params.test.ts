// Every text the interface and the advisor ask for gets a value for each of its placeholders. Reads the source:
// each T(...) / plural(...) call in the game with a written key (or a template key, checked against every key it
// can match) and a literal params object, and each advice rule the advisor adds with its params. Calls whose
// params are spread from elsewhere are left to the robot's audit (tools/bot/test/texts.test.ts).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { catalogKeys, createTranslator, holes } from '@assunguy/i18n';

const ROOT = join(__dirname, '..', '..', '..');
const tr = createTranslator('pt-BR'), KEYS = catalogKeys('pt-BR');
const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []; });

/** The text between a bracket and its match, from `i` (which points at the opening bracket). */
function balanced(src: string, i: number): string {
  const open = src[i] as string, close = ({ '(': ')', '{': '}', '[': ']' } as Record<string, string>)[open] as string;
  let depth = 0, q: string | null = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j] as string;
    if (q) { if (c === '\\') j++; else if (c === q) q = null; else if (q === '`' && c === '$' && src[j + 1] === '{') j += balanced(src, j + 1).length; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return src.slice(i, j + 1);
  }
  return src.slice(i);
}
/** Splits a list at its top-level commas (strings and brackets kept whole). */
function split(body: string): string[] {
  const parts: string[] = [];
  let depth = 0, start = 0, q: string | null = null;
  for (let j = 0; j < body.length; j++) {
    const c = body[j] as string;
    if (q) { if (c === '\\') j++; else if (c === q) q = null; else if (q === '`' && c === '$' && body[j + 1] === '{') j += balanced(body, j + 1).length; continue; }
    if (c === "'" || c === '"' || c === '`') q = c;
    else if ('({['.includes(c)) depth++;
    else if (')}]'.includes(c)) depth--;
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, j)); start = j + 1; }
  }
  parts.push(body.slice(start));
  return parts.map((x) => x.trim()).filter(Boolean);
}
/** The top-level property names of an object literal, and whether it spreads another object in. */
function props(obj: string): { names: Set<string>; open: boolean } {
  const names = new Set<string>();
  let open = false;
  for (const p of split(obj.trim().slice(1, -1))) {
    if (p.startsWith('...')) { open = true; continue; }
    const m = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*(?::|$)/.exec(p);
    if (m) names.add((m[1] ?? m[2] ?? m[3]) as string); else open = true;
  }
  return { names, open };
}
/** The catalog keys a written or template key can name. */
function keysOf(lit: string): string[] {
  if (lit[0] !== '`') return [lit.slice(1, -1)];
  const body = lit.slice(1, -1);
  if (!body.includes('${')) return [body];
  // a key that starts with a value could be any key: nothing to check
  if (body.startsWith('${')) return [];
  let re = '', j = 0;
  while (j < body.length) {
    if (body[j] === '$' && body[j + 1] === '{') { const b = balanced(body, j + 1); re += '[^.]+'; j += b.length + 1; }
    else { re += (body[j] as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); j++; }
  }
  const rx = new RegExp(`^${re}$`);
  return KEYS.filter((k) => rx.test(k));
}

interface Gap { where: string; key: string; missing: string[] }
function scanCalls(file: string, src: string, extra: string[] = []): Gap[] {
  const gaps: Gap[] = [];
  for (const m of src.matchAll(/(?<![\w.$])(T|plural|tr\.t)\(\s*/g)) {
    const at = (m.index as number) + m[0].length, q = src[at];
    if (q !== "'" && q !== '`') continue;
    const args = split(balanced(src, src.indexOf('(', m.index as number)).slice(1, -1));
    const lit = args[0] as string, paramsArg = m[1] === 'plural' ? args[2] : args[1];
    const names = new Set<string>(extra);
    let open = false;
    if (m[1] === 'plural') { names.add('n'); names.add('count'); }
    if (paramsArg !== undefined) {
      if (paramsArg.startsWith('{')) { const p = props(paramsArg); p.names.forEach((x) => names.add(x)); open = p.open; }
      else open = true;
    }
    if (open) continue;
    for (const key of keysOf(lit)) {
      const text = tr.raw(key);
      if (text === undefined) continue;
      const missing = holes(text).filter((h) => !names.has(h));
      if (missing.length) gaps.push({ where: `${relative(ROOT, file)}:${src.slice(0, m.index).split('\n').length}`, key, missing });
    }
  }
  return gaps;
}

// a template key can match keys the code never asks for there: those pairs are listed here, with why
const NOT_ASKED: Record<string, string> = {
  'apps/game/src/ui/advisor.ts ui.advisor.none': 'the bands are urgent, important and useful',
  'apps/game/src/ui/advisor.ts ui.advisor.upTo': 'the bands are urgent, important and useful',
  'apps/game/src/ui/app.ts ui.traffic.carrying': 'tipo is a vehicle kind',
  'apps/game/src/ui/app.ts ui.traffic.back': 'tipo is a vehicle kind',
};

describe('every placeholder gets a value', () => {
  it('in the interface', () => {
    const gaps = files(join(ROOT, 'apps', 'game', 'src')).filter((f) => !f.endsWith('i18n.ts')).flatMap((f) => scanCalls(f, readFileSync(f, 'utf8')))
      .filter((g) => !NOT_ASKED[`${g.where.split(':')[0]} ${g.key}`]);
    expect(gaps.map((g) => `${g.where} ${g.key}: ${g.missing.join(', ')}`)).toEqual([]);
  });
  it('in the advisor', () => {
    const file = join(ROOT, 'packages', 'sim', 'src', 'advisor.ts'), src = readFileSync(file, 'utf8'), gaps: string[] = [];
    let checked = 0;
    // the advisor screen adds `at` (the lot) and `advisor` (its name)
    const check = (rule: string, obj: string | null, line: number) => {
      if (obj === null) return;
      const p = props(obj);
      if (p.open) return;
      for (const key of keysOf(rule.startsWith('`') ? `\`advice.${rule.slice(1, -1)}.title\`` : `'advice.${rule.slice(1, -1)}.title'`).flatMap((k) => [k, k.replace(/\.title$/, '.body')])) {
        const text = tr.raw(key);
        if (text === undefined) continue;
        checked++;
        const missing = holes(text).filter((h) => !p.names.has(h) && h !== 'at' && h !== 'advisor');
        if (missing.length) gaps.push(`advisor.ts:${line} ${key}: ${missing.join(', ')}`);
      }
    };
    for (const m of src.matchAll(/\badd\(\s*/g)) {
      const call = balanced(src, src.indexOf('(', m.index as number)), line = src.slice(0, m.index).split('\n').length, inner = call.slice(1, -1).trim();
      if (inner.startsWith('{')) {
        const o = balanced(inner, 0), rule = /\brule:\s*('[^']+'|`[^`]+`)/.exec(o)?.[1], pi = o.search(/\bparams:\s*\{/);
        if (rule && pi >= 0) check(rule, balanced(o, o.indexOf('{', pi)), line);
      } else {
        const r = /^[^,]+,\s*('[^']+'|`[^`]+`)\s*,\s*/.exec(inner);
        if (r) { const after = inner.slice(r[0].length); check(r[1] as string, after.startsWith('{') ? balanced(after, 0) : null, line); }
      }
    }
    expect(checked).toBeGreaterThan(60);
    expect(gaps).toEqual([]);
  });
  it('in what the rules emit: news, chronicle entries and the province review', () => {
    const dir = join(ROOT, 'packages', 'sim', 'src'), gaps: string[] = [];
    let checked = 0;
    const check = (where: string, lit: string, obj: string | undefined, prefix = '') => {
      const p = obj === undefined ? { names: new Set<string>(), open: false } : obj.startsWith('{') ? props(obj) : { names: new Set<string>(), open: true };
      if (p.open) return;
      const keys = keysOf(prefix ? `${lit[0]}${prefix}${lit.slice(1)}` : lit);
      for (const key of keys) {
        const text = tr.raw(key);
        if (text === undefined) continue;
        checked++;
        // a news item's reason is written with the item's other params; the screen adds colony and advisor
        const missing = holes(text).filter((h) => !p.names.has(h) && h !== 'colony' && h !== 'advisor');
        if (missing.length) gaps.push(`${where} ${key}: ${missing.join(', ')}`);
      }
    };
    for (const f of files(dir)) {
      const src = readFileSync(f, 'utf8'), name = relative(ROOT, f), line = (i: number) => `${name}:${src.slice(0, i).split('\n').length}`;
      for (const m of src.matchAll(/\bchronicle\(\s*/g)) {
        const args = split(balanced(src, src.indexOf('(', m.index as number)).slice(1, -1));
        if (args[1] && /^['`]/.test(args[1])) check(line(m.index as number), args[1], args[2]);
      }
      for (const m of src.matchAll(/\{\s*(key|reason):\s*(['`])/g)) {
        const o = balanced(src, m.index as number), parts = split(o.slice(1, -1));
        const lit = (parts.find((x) => x.startsWith(`${m[1]}:`)) as string).replace(/^\w+:\s*/, '');
        const pp = parts.find((x) => /^params\s*:/.test(x))?.replace(/^params\s*:\s*/, '');
        if (m[1] === 'key' && !/^['`](news|chronicle)\./.test(lit)) continue;
        check(line(m.index as number), lit, pp, m[1] === 'reason' && name.endsWith('province.ts') ? 'ui.province.' : '');
      }
    }
    expect(checked).toBeGreaterThan(80);
    expect(gaps).toEqual([]);
  });
});
