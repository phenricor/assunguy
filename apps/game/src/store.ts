// The game in play: the simulation's state and world, the player's names for it, what is derived from them
// (economy, ratings, advice, districts), and the saves. Each colony keeps its current game and its last five
// yearly autosaves, in the browser's IndexedDB; a save can also be exported to a file and imported back.
import {
  advise, computeDistricts, computeEconomy, generateWorld, newGame, passSeason, rateHomes, resolveEvent,
  type Advice, type CommandResult, type Districts, type Economy, type GameState, type Ratings, type SeasonReport, type World,
} from '@assunguy/sim';
import { setContext, T } from './i18n';
import { readSave, writeSave } from './saveFormat';
import { APP_VERSION } from './version';

export interface Meta { id: string; colony: string; advisor: string; seed: number; created: number; saved: number; t: number; milestone: number; families: number }
export interface Session { s: GameState; w: World; meta: Meta }
export interface Autosave { k: string; col: string; t: number; saved: number; meta: Meta; save: string }

type Listener = (why: string) => void;
const listeners = new Set<Listener>();
export const on = (f: Listener): (() => void) => { listeners.add(f); return () => listeners.delete(f); };
const emit = (why: string) => { for (const f of [...listeners]) f(why); };

let game: Session | null = null;
let version = 0;
const cache: { v: number; economy?: Economy; ratings?: Ratings; advice?: Advice[]; districts?: Districts } = { v: -1 };

export const session = (): Session => { if (!game) throw new Error('no game'); return game; };
export const hasGame = (): boolean => !!game;
const fresh = () => { if (cache.v !== version) { cache.v = version; delete cache.economy; delete cache.ratings; delete cache.advice; delete cache.districts; } };
export const economy = (): Economy => { fresh(); return (cache.economy ??= computeEconomy(game!.s, game!.w)); };
export const ratings = (): Ratings => { fresh(); return (cache.ratings ??= rateHomes(game!.s, game!.w)); };
export const advice = (): Advice[] => { fresh(); return (cache.advice ??= advise(game!.s, game!.w)); };
export const districts = (): Districts => { fresh(); return (cache.districts ??= computeDistricts(game!.s, game!.w)); };
export const changed = (why = 'state'): void => { version++; emit(why); };

// ---- commands: run one against the state, show the error when it fails

let onError: (msg: string) => void = () => {};
export const setErrorSink = (f: (msg: string) => void): void => { onError = f; };
export function run(fn: (s: GameState, w: World) => CommandResult, why = 'command'): boolean {
  const g = session(), r = fn(g.s, g.w);
  if (!r.ok) { onError(T(`error.${r.error}`)); return false; }
  changed(why);
  void save();
  return true;
}

// ---- seasons and events

export function nextSeason(): SeasonReport {
  const g = session(), racing = !!g.s.race;
  const r = passSeason(g.s, g.w);
  changed('season');
  void save(g.s.market.t % 4 === 0);
  // the day the race starts is kept, so a colony that withers can start the race again
  if (!racing && g.s.race) void tx('autos', 'readwrite', (o) => o.put({ k: `${g.meta.id}|race`, col: `${g.meta.id}|race`, t: g.s.market.t, saved: Date.now(), meta: { ...g.meta }, save: text() }));
  return r;
}
export const restartRace = async (): Promise<boolean> => loadAutosave(`${session().meta.id}|race`);
export function choose(option: number): void {
  const g = session();
  resolveEvent(g.s, g.w, option);
  changed('event');
  void save();
}

// ---- IndexedDB

const AUTOSAVES = 5;
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  return (dbp ??= new Promise((ok) => {
    try {
      const r = indexedDB.open('assunguy-game', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('colonies', { keyPath: 'id' }); r.result.createObjectStore('autos', { keyPath: 'k' }); };
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); r.onblocked = () => ok(null);
    } catch { ok(null); }
  }));
}
async function tx<T>(store: string, mode: IDBTransactionMode, f: (o: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const d = await db(); if (!d) return null;
  return new Promise((ok) => { try { const q = f(d.transaction(store, mode).objectStore(store)); q.onsuccess = () => ok(q.result); q.onerror = () => ok(null); } catch { ok(null); } });
}
export const listSaves = async (): Promise<(Meta & { save?: string })[]> => ((await tx<{ id: string; meta: Meta }[]>('colonies', 'readonly', (o) => o.getAll())) ?? []).map((x) => x.meta).sort((a, b) => b.saved - a.saved);
export const listAutosaves = async (col: string): Promise<Autosave[]> => ((await tx<Autosave[]>('autos', 'readonly', (o) => o.getAll())) ?? []).filter((x) => x.col === col).sort((a, b) => b.t - a.t);

const text = () => writeSave(session().meta, session().s, APP_VERSION);
type SaveData = { meta: Meta; s: GameState };
const parse = (txt: string): SaveData => { const r = readSave<SaveData>(txt); if (!r.ok) throw new Error(r.reason); return r.save; };
export async function save(yearly = false): Promise<boolean> {
  if (!game) return false;
  const m = game.meta;
  m.saved = Date.now(); m.t = game.s.market.t; m.milestone = game.s.milestone; m.families = Object.keys(game.s.families).length;
  const save = text();
  const ok = (await tx('colonies', 'readwrite', (o) => o.put({ id: m.id, meta: { ...m }, save }))) !== null;
  if (yearly) {
    await tx('autos', 'readwrite', (o) => o.put({ k: `${m.id}|${m.t}`, col: m.id, t: m.t, saved: m.saved, meta: { ...m }, save }));
    const old = (await listAutosaves(m.id)).slice(AUTOSAVES);
    for (const x of old) await tx('autos', 'readwrite', (o) => o.delete(x.k));
  }
  return ok;
}

function revive(data: { meta: Meta; s: GameState }): Session {
  const w = generateWorld(data.s.seed, data.s.mapVersion);
  return { s: data.s, w, meta: { ...data.meta, families: data.meta.families ?? Object.keys(data.s.families).length } };
}
function enter(g: Session): Session { game = g; setContext(g); changed('load'); return g; }

export function start(o: { colony: string; advisor: string; seed?: number }): Session {
  const seed = o.seed ?? Math.floor(Math.random() * 2147483000) + 1;
  const { s, w } = newGame(seed);
  const now = Date.now();
  enter({ s, w, meta: { id: `c${now.toString(36)}`, colony: o.colony, advisor: o.advisor, seed, created: now, saved: now, t: s.market.t, milestone: 0, families: Object.keys(s.families).length } });
  void save();
  return game!;
}
export async function load(id: string): Promise<boolean> {
  const r = await tx<{ save: string }>('colonies', 'readonly', (o) => o.get(id));
  if (!r) return false;
  try { enter(revive(parse(r.save))); return true; } catch { return false; }
}
export async function loadAutosave(k: string): Promise<boolean> {
  const r = await tx<Autosave>('autos', 'readonly', (o) => o.get(k));
  if (!r) return false;
  try { enter(revive(parse(r.save))); await save(); return true; } catch { return false; }
}
export async function remove(id: string): Promise<void> {
  await tx('colonies', 'readwrite', (o) => o.delete(id));
  for (const x of await listAutosaves(id)) await tx('autos', 'readwrite', (o) => o.delete(x.k));
}
/** The save as a file's text, to keep or carry to another device. */
export const exportSave = (): string => text();
/** Imports an exported file: 'newer' when it was written by a newer version of the game. */
export async function importSave(txt: string): Promise<'ok' | 'invalid' | 'newer'> {
  const r = readSave<SaveData>(txt);
  if (!r.ok) return r.reason;
  try {
    const g = revive(r.save);
    if ((await listSaves()).some((x) => x.id === g.meta.id)) g.meta.id = `${g.meta.id}i${Date.now().toString(36)}`;
    enter(g);
    await save();
    return 'ok';
  } catch { return 'invalid'; }
}
export const quit = async (): Promise<void> => { await save(); };
