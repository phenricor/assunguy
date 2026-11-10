// The save file's format, apart from the game's version. A save records the format it was written in (`v`) and
// the version of the game that wrote it (`game`). When the format changes, SAVE_FORMAT goes up by one and a
// migration from the previous format is added below, so older saves keep loading. A save from a newer format
// than this game knows is refused rather than guessed at.

export const SAVE_FORMAT = 1;

type Data = Record<string, unknown>;
/** MIGRATIONS[n] turns a save of format n into format n + 1. */
const MIGRATIONS: Record<number, (d: Data) => Data> = {};

export type ReadResult<T> = { ok: true; save: T } | { ok: false; reason: 'invalid' | 'newer' };

export function writeSave(meta: unknown, s: unknown, game: string): string {
  return JSON.stringify({ v: SAVE_FORMAT, game, meta, s });
}

/** Parses a save, upgrades it to the current format and checks it looks like a colony. */
export function readSave<T extends { meta: { colony: string }; s: { map: unknown } }>(text: string, migrations = MIGRATIONS, current = SAVE_FORMAT): ReadResult<T> {
  let d: Data;
  try { d = JSON.parse(text) as Data; } catch { return { ok: false, reason: 'invalid' }; }
  if (!d || typeof d !== 'object') return { ok: false, reason: 'invalid' };
  // saves from before the format was named were already format 1
  let v = typeof d.v === 'number' ? d.v : 1;
  if (v > current) return { ok: false, reason: 'newer' };
  while (v < current) {
    const up = migrations[v];
    if (!up) return { ok: false, reason: 'invalid' };
    d = { ...up(d), v: v + 1 };
    v++;
  }
  const save = d as unknown as T;
  if (!save.s?.map || !save.meta?.colony) return { ok: false, reason: 'invalid' };
  return { ok: true, save };
}
