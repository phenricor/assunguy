// The game in play: the simulation's state and world, the player's names for it, what is derived from them
// (economy, ratings, advice), and the saves. One save per colony, kept in the browser; a yearly autosave.
import {
  advise, computeDistricts, computeEconomy, generateWorld, newGame, passSeason, rateHomes, resolveEvent,
  type Advice, type CommandResult, type Districts, type Economy, type GameState, type Ratings, type SeasonReport, type World,
} from '@assunguy/sim';
import { setContext, T } from './i18n';

export interface Meta { id: string; colony: string; advisor: string; seed: number; created: number; saved: number; t: number; milestone: number }
export interface Session { s: GameState; w: World; meta: Meta }

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
  return true;
}

// ---- seasons and events

export function nextSeason(): SeasonReport {
  const g = session();
  const r = passSeason(g.s, g.w);
  changed('season');
  if (g.s.market.t % 4 === 0) save();
  return r;
}
export function choose(option: number): void {
  const g = session();
  resolveEvent(g.s, g.w, option);
  changed('event');
}

// ---- saves: an index of colonies, each with its own state

const INDEX = 'assunguy.saves', PREFIX = 'assunguy.save.';
const read = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string): boolean => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
export function listSaves(): Meta[] {
  try { const x = JSON.parse(read(INDEX) ?? '[]') as Meta[]; return Array.isArray(x) ? x.sort((a, b) => b.saved - a.saved) : []; } catch { return []; }
}
const putIndex = (m: Meta) => write(INDEX, JSON.stringify([m, ...listSaves().filter((x) => x.id !== m.id)]));

export function start(o: { colony: string; advisor: string; seed?: number }): Session {
  const seed = o.seed ?? Math.floor(Math.random() * 1e6) + 1;
  const { s, w } = newGame(seed);
  const now = Date.now();
  game = { s, w, meta: { id: `c${now.toString(36)}`, colony: o.colony, advisor: o.advisor, seed, created: now, saved: now, t: s.market.t, milestone: 0 } };
  setContext(game);
  save();
  changed('load');
  return game;
}
export function save(): boolean {
  if (!game) return false;
  const m = game.meta;
  m.saved = Date.now(); m.t = game.s.market.t; m.milestone = game.s.milestone;
  const ok = write(PREFIX + m.id, JSON.stringify({ v: 1, meta: m, s: game.s }));
  if (ok) putIndex(m);
  return ok;
}
function revive(data: { meta: Meta; s: GameState }): Session {
  const w = generateWorld(data.s.seed, data.s.mapVersion);
  return { s: data.s, w, meta: data.meta };
}
export function load(id: string): boolean {
  const raw = read(PREFIX + id);
  if (!raw) return false;
  try { game = revive(JSON.parse(raw)); } catch { return false; }
  setContext(game);
  changed('load');
  return true;
}
export function remove(id: string): void {
  try { localStorage.removeItem(PREFIX + id); } catch { /* ignore */ }
  write(INDEX, JSON.stringify(listSaves().filter((x) => x.id !== id)));
}
/** The save as a file's text, to keep or carry to another device. */
export const exportSave = (): string => JSON.stringify({ v: 1, meta: session().meta, s: session().s });
export function importSave(text: string): boolean {
  try {
    const data = JSON.parse(text) as { meta: Meta; s: GameState };
    if (!data?.s?.map || !data.meta?.colony) return false;
    game = revive(data);
    game.meta.id = listSaves().some((x) => x.id === game!.meta.id) ? `${game.meta.id}i${Date.now().toString(36)}` : game.meta.id;
    setContext(game);
    save();
    changed('load');
    return true;
  } catch { return false; }
}
export const quit = (): void => { save(); game = null; setContext(null); };
