// The advisor's notebook: the game explained in chapters that open as their subject enters the game (the screen and
// the levels from the start, the outlet at level 3, the parish, the village, the race). Some chapters also have
// steps the banner on the map walks through; each step goes away when the player does it. A chapter that opens
// shows once on the banner as new; the notebook (in Settings) keeps them all to read again.
import { railExits, type GameState, type LotKey } from '@assunguy/sim';
import type { BuildingId } from '@assunguy/data';
import * as store from '../store';
import { T, has } from '../i18n';
import { api, hooks } from '../view';
import { K, esc } from './kit';
import { screen } from './report';

export interface Step { key: string; done: (s: GameState) => boolean; go: () => void }
export interface Chapter { id: string; opens: (s: GameState) => boolean; sections: string[]; steps?: Step[] }

const count = (s: GameState, f: (t: BuildingId) => boolean) => Object.values(s.map.buildings).filter((t) => f(t as BuildingId)).length;
const keysOf = (s: GameState, t: BuildingId) => (Object.keys(s.map.buildings) as LotKey[]).filter((k) => s.map.buildings[k] === t);
const stations = (s: GameState) => keysOf(s, 'trainStation');
const goTo = (k: LotKey | undefined) => { if (!k) return; const [x, y] = k.split(',').map(Number) as [number, number]; api.vaiPara(x, y); hooks.openBuilding(k); };

export const CHAPTERS: Chapter[] = [
  { id: 'start', opens: () => true, sections: ['life', 'season'], steps: [
    { key: 'jobs', done: (s) => count(s, (t) => t.endsWith('Field')) > 3, go: () => hooks.chooseBuild('beanField') },
    { key: 'homes', done: (s) => count(s, (t) => t === 'hut' || t === 'house' || t === 'whitewashedHouse' || t === 'townhouse') > 4, go: () => hooks.chooseBuild('hut') },
    { key: 'season', done: (s) => s.market.t > 12, go: () => hooks.passSeason() },
    { key: 'advisor', done: (s) => !!s.flags.sawAdvisor, go: () => hooks.openAdvisor() },
    { key: 'level', done: (s) => s.level >= 2, go: () => hooks.openLevel() },
    { key: 'openNotebook', done: (s) => !!s.flags.sawNotebook, go: () => openNotebook() },
  ] },
  { id: 'screen', opens: () => true, sections: ['top', 'colony', 'government', 'transport', 'season', 'advisor', 'build', 'map'] },
  { id: 'levels', opens: () => true, sections: ['levels', 'milestones', 'deadline', 'province'] },
  { id: 'outlet', opens: (s) => s.level >= 3 || s.milestone >= 1, sections: ['path', 'foot', 'store', 'collect', 'gates', 'tariff', 'harvest', 'see', 'advisor'] },
  { id: 'parish', opens: (s) => s.milestone >= 1, sections: ['what', 'next', 'tip'] },
  { id: 'village', opens: (s) => s.milestone >= 2, sections: ['what', 'road', 'next'] },
  { id: 'race', opens: (s) => !!s.race, sections: ['what', 'share', 'advances', 'leave', 'decline', 'victory'], steps: [
    { key: 'race.station', done: (s) => stations(s).length > 0, go: () => hooks.chooseBuild('trainStation') },
    { key: 'race.rails', done: (s) => stations(s).some((k) => Object.keys(railExits(s, k)).length > 0), go: () => hooks.chooseBuild('rail') },
    { key: 'race.train', done: (s) => stations(s).some((k) => Object.values(s.fleet[k] ?? {}).some((n) => (n ?? 0) > 0)), go: () => goTo(stations(store.session().s)[0]) },
    { key: 'race.panel', done: (s) => !!s.flags.sawRace, go: () => hooks.openTransport() },
    { key: 'race.win', done: (s) => !!s.race?.won, go: () => hooks.openAdvisor() },
  ] },
];

const offFlag = (id: string) => (id === 'start' ? 'guideOff' : `guideOff:${id}`);
export const chapterOff = (s: GameState, id: string): boolean => !!s.flags[offFlag(id)];
export function setChapterOff(s: GameState, id: string, off: boolean): void { if (off) s.flags[offFlag(id)] = true; else delete s.flags[offFlag(id)]; }
const seenFlag = (id: string) => `guideSeen:${id}`;

/** What the banner shows: the latest opened chapter with steps still to do, or else a chapter that opened unread. */
export function banner(s: GameState): { chapter: Chapter; step?: number } | null {
  for (const ch of CHAPTERS.slice().reverse()) {
    if (!ch.steps || !ch.opens(s) || chapterOff(s, ch.id)) continue;
    const i = ch.steps.findIndex((x) => !x.done(s));
    if (i >= 0) return { chapter: ch, step: i };
  }
  // the screen and the levels are part of the first steps (their last step opens the notebook)
  const fresh = CHAPTERS.find((ch) => !ch.steps && ch.id !== 'screen' && ch.id !== 'levels' && ch.opens(s) && !s.flags[seenFlag(ch.id)]);
  return fresh ? { chapter: fresh } : null;
}
export function markSeen(s: GameState, id: string): void { s.flags[seenFlag(id)] = true; }

const adv = () => store.session().meta.advisor;
const paras = (key: string) => T(key, { advisor: adv() }).split('\n').map((p) => `<p>${esc(p)}</p>`).join('');

/** The notebook: every chapter, open ones to read and the rest with when they open. */
export function openNotebook(): void {
  const { s } = store.session();
  s.flags.sawNotebook = true;
  const cards = CHAPTERS.map((ch) => {
    const open = ch.opens(s), steps = ch.steps ?? [], done = steps.filter((x) => x.done(s)).length;
    const sub = !open ? T(`ui.guide.lock.${ch.id}`) : steps.length ? T('ui.guide.stepsDone', { n: done, of: steps.length }) : !s.flags[seenFlag(ch.id)] && ch.id !== 'screen' && ch.id !== 'levels' ? T('ui.guide.new') : '';
    return K.card({ title: esc(T(`ui.guide.chapter.${ch.id}`)), sub: esc(sub), dim: !open, attrs: open ? `data-ch="${ch.id}"` : '' });
  });
  const p = screen({ id: 'notebook', title: T('ui.guide.notebook', { advisor: adv() }), sub: T('ui.guide.notebookSub'), body: K.cards(cards) });
  p.querySelectorAll<HTMLElement>('[data-ch]').forEach((b) => { b.onclick = () => openChapter(b.dataset.ch as string); });
  hooks.guide?.();
}

/** One chapter: its steps (with a mark when done) and its sections to read. */
export function openChapter(id: string): void {
  const { s } = store.session(), ch = CHAPTERS.find((x) => x.id === id);
  if (!ch) return;
  markSeen(s, id);
  const steps = ch.steps ?? [];
  let body = '';
  if (steps.length) {
    body += K.section(esc(T('ui.guide.steps'))) + K.rows(steps.map((x) => K.row(`<b>${esc(T(`ui.guide.${x.key}.title`, { advisor: adv() }))}</b><br><small>${esc(T(`ui.guide.${x.key}.body`, { advisor: adv() }))}</small>`, x.done(s) ? '✓' : '', x.done(s) ? 'mais' : '')));
    if (chapterOff(s, id) && steps.some((x) => !x.done(s))) body += K.actions([{ id: 'nbAgain', text: T('ui.guide.again') }] as never);
  }
  for (const k of ch.sections) {
    const key = `ui.guide.${id}.${k}`;
    if (!has(`${key}.title`)) continue;
    body += K.section(esc(T(`${key}.title`, { advisor: adv() }))) + `<div class="nb-texto">${paras(`${key}.body`)}</div>`;
  }
  body += K.actions([{ id: 'nbBack', text: T('ui.guide.back') }] as never);
  const p = screen({ id: `notebook:${id}`, title: T(`ui.guide.chapter.${id}`), sub: T('ui.guide.notebook', { advisor: adv() }), body });
  const again = p.querySelector<HTMLElement>('#nbAgain');
  if (again) again.onclick = () => { setChapterOff(s, id, false); store.save(); hooks.guide?.(); openChapter(id); };
  const back = p.querySelector<HTMLElement>('#nbBack');
  if (back) back.onclick = () => openNotebook();
  void store.save();
  hooks.guide?.();
}
