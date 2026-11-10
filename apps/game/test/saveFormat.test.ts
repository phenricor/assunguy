import { describe, expect, it } from 'vitest';
import { readSave, SAVE_FORMAT, writeSave } from '../src/saveFormat';

const colony = { meta: { colony: 'Assunguy' }, s: { map: {} } };

describe('save format', () => {
  it('writes the format and the game version, and reads it back', () => {
    const text = writeSave(colony.meta, colony.s, '1.0.0-beta.1');
    expect(JSON.parse(text)).toMatchObject({ v: SAVE_FORMAT, game: '1.0.0-beta.1' });
    const r = readSave(text);
    expect(r.ok && r.save.meta.colony).toBe('Assunguy');
  });
  it('reads saves written before the format was named as format 1', () => {
    expect(readSave(JSON.stringify(colony)).ok).toBe(true);
  });
  it('refuses saves from a newer format and files that are not colonies', () => {
    expect(readSave(JSON.stringify({ ...colony, v: SAVE_FORMAT + 1 }))).toEqual({ ok: false, reason: 'newer' });
    expect(readSave('{"v":1}')).toEqual({ ok: false, reason: 'invalid' });
    expect(readSave('not json')).toEqual({ ok: false, reason: 'invalid' });
  });
  it('runs the migrations in order up to the current format', () => {
    const steps: number[] = [];
    const migrations = { 1: (d: Record<string, unknown>) => { steps.push(1); return { ...d, a: 1 }; }, 2: (d: Record<string, unknown>) => { steps.push(2); return { ...d, b: 2 }; } };
    const r = readSave<typeof colony & { a: number; b: number; v: number }>(JSON.stringify({ ...colony, v: 1 }), migrations, 3);
    expect(steps).toEqual([1, 2]);
    expect(r.ok && [r.save.a, r.save.b, r.save.v]).toEqual([1, 2, 3]);
  });
  it('refuses a save when a migration is missing', () => {
    expect(readSave(JSON.stringify({ ...colony, v: 1 }), {}, 2)).toEqual({ ok: false, reason: 'invalid' });
  });
});
