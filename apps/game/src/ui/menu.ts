// The start menu over the prototype's painted landscape (new game with the colony's and the advisor's names,
// continue, load with the yearly autosaves, import), and the settings sheet in game.
import type { Locale } from '@assunguy/i18n';
import * as store from '../store';
import { T, locale, setLocale, num } from '../i18n';
import { api, vars, hooks } from '../view';
import { $, K, esc, hint, sheetWith, sheet, ico } from './kit';
import { cancel } from './app';
import { APP_VERSION } from '../version';

type Screen = 'start' | 'new' | 'load';
let screen: Screen = 'start', openCol: string | null = null;

export const menuOpen = (): boolean => { const el = document.getElementById('menuIni'); return !!(el && !el.hidden); };
const date = (ms: number) => new Date(ms).toLocaleDateString(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
const year = (t: number) => Math.max(1, Math.floor((t - 12) / 4) + 1);
const NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';

export function startMenu(): void { void openMenu('start'); }
export async function openMenu(which: Screen = 'start'): Promise<void> {
  screen = which;
  let el = document.getElementById('menuIni');
  if (!el) { el = document.createElement('div'); el.id = 'menuIni'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); ($('app') ?? document.body).appendChild(el); }
  el.hidden = false;
  api.Paisagem.liga(el);
  const saves = await store.listSaves();
  if (screen !== which) return;
  const playing = store.hasGame() && store.session().s.market.t > 12;
  const last = !playing ? saves[0] : undefined;
  let h = '', brand = '';
  if (screen === 'start') {
    brand = `<div class="mi-marca"><h1>ASSUNGUY</h1><p>${esc(T('ui.menu.tagline'))}</p><i></i></div>`;
    const cur = playing ? store.session().meta : last;
    h = '<div class="mi-acoes">'
      + (cur ? `<button type="button" class="pri" data-mi="continue"><b>${esc(T('ui.menu.continue'))}</b><small>${esc(T('ui.menu.saveLine', { name: cur.colony, year: year(cur.t), n: num(cur.families) }))}</small></button>` : '')
      + `<button type="button" class="${cur ? '' : 'pri'}" data-mi="new"><b>${esc(T('ui.menu.new'))}</b><small>${esc(T('ui.menu.newSub'))}</small></button>`
      + `<button type="button" data-mi="load"><b>${esc(T('ui.menu.load'))}</b><small>${esc(T('ui.menu.loadSub'))}</small></button></div>`;
  } else if (screen === 'new') {
    h = `<div class="mi-topo"><h1>${esc(T('ui.menu.new'))}</h1><p>${esc(T('ui.menu.newIntro'))}</p></div>
      <form class="mi-form" id="miForm"><label>${esc(T('ui.menu.colonyName'))}<input id="miNome" maxlength="40" value="${esc(T('ui.menu.defaultColony'))}" autocomplete="off"></label>
      <label>${esc(T('ui.menu.advisorName'))}<input id="miCons" maxlength="10" value="Inácio" autocomplete="off"></label>
      <div class="mi-acoes"><button type="submit" class="pri"><b>${esc(T('ui.menu.begin'))}</b></button><button type="button" data-mi="start"><b>${esc(T('ui.back'))}</b></button></div></form>`;
  } else {
    const cols = await Promise.all(saves.map(async (c) => ({ c, autos: openCol === c.id ? await store.listAutosaves(c.id) : [] })));
    h = `<div class="mi-topo"><h1>${esc(T('ui.menu.load'))}</h1><p>${esc(T('ui.menu.loadIntro', { n: 5 }))}</p></div><div class="mi-lista">`
      + (cols.length ? cols.map(({ c, autos }) => {
        const open = openCol === c.id, here = store.hasGame() && store.session().meta.id === c.id;
        return `<div class="mi-col${open ? ' aberta' : ''}"><button type="button" class="mi-colt" data-mic="${esc(c.id)}"><b>${esc(c.colony)}</b><small>${esc(T('ui.menu.colLine', { year: year(c.t), n: num(c.families), milestone: T(`milestone.${['settlement', 'parish', 'village', 'town'][c.milestone] ?? 'settlement'}`), date: date(c.saved) }))}${here ? `, ${esc(T('ui.menu.playing'))}` : ''}</small></button>`
          + (open ? `<div class="mi-sub"><button type="button" class="pri" data-mis="${esc(c.id)}"><b>${esc(T('ui.menu.playFrom'))}</b><small>${esc(T('ui.menu.latest', { year: year(c.t) }))}</small></button>${autos.map((x) => `<button type="button" data-mia="${esc(x.k)}"><b>${esc(T('ui.menu.autosave', { year: year(x.t) }))}</b><small>${esc(T('ui.menu.autoLine', { n: num(x.meta.families), date: date(x.saved) }))}</small></button>`).join('')}<button type="button" class="per" data-mid="${esc(c.id)}"><b>${esc(T('ui.menu.delete'))}</b></button></div>` : '')
          + '</div>';
      }).join('') : `<p class="mi-vazio">${esc(T('ui.menu.none'))}</p>`)
      + `</div><div class="mi-acoes"><label class="mi-arq"><b>${esc(T('ui.menu.openFile'))}</b><input type="file" id="miArq" accept=".json,application/json"></label><button type="button" data-mi="start"><b>${esc(T('ui.back'))}</b></button></div>`;
  }
  const cv = el.querySelector('.mi-paisagem');
  const on = api.Musica.ligada || api.Sons.ligado;
  el.innerHTML = `${brand}<div class="mi-caixa">${h}</div><p class="mi-versao">v${esc(APP_VERSION)}</p><div class="mi-musica"><button type="button" class="mi-som mi-nota" data-som aria-pressed="${on}" aria-label="${esc(T(on ? 'ui.menu.soundOff' : 'ui.menu.soundOn'))}">${NOTE}</button><button type="button" class="mi-lang" data-lang>${locale() === 'pt-BR' ? 'EN' : 'PT'}</button></div>`;
  if (cv) el.insertBefore(cv, el.firstChild);
  wireMenu(el);
}

function closeMenu(): void {
  const el = document.getElementById('menuIni'); if (el) el.hidden = true;
  api.Paisagem.desliga();
  hooks.enter();
  if (!document.getElementById('preparo')) { const v = document.createElement('div'); v.id = 'preparo'; v.setAttribute('role', 'status'); v.innerHTML = `<span>${esc(T('ui.menu.preparing'))}</span>`; ($('app') ?? document.body).appendChild(v); }
  vars.preparo = { ate: performance.now() + 9000 };
}

function wireMenu(el: HTMLElement): void {
  el.querySelectorAll<HTMLElement>('[data-som]').forEach((b) => { b.onclick = () => { const on = !(api.Musica.ligada || api.Sons.ligado); if (api.Musica.ligada !== on) api.Musica.alterna(); if (api.Sons.ligado !== on) api.Sons.alterna(); b.setAttribute('aria-pressed', String(on)); }; });
  el.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => { b.onclick = () => { setLocale((locale() === 'pt-BR' ? 'en' : 'pt-BR') as Locale); void openMenu(screen); }; });
  el.querySelectorAll<HTMLElement>('[data-mi]').forEach((b) => { b.onclick = async () => {
    const a = b.dataset.mi as string;
    if (a === 'continue') { if (!(store.hasGame() && store.session().s.market.t > 12)) { const s0 = (await store.listSaves())[0]; if (!s0 || !(await store.load(s0.id))) return; } closeMenu(); return; }
    void openMenu(a as Screen);
  }; });
  el.querySelectorAll<HTMLElement>('[data-mic]').forEach((b) => { b.onclick = () => { openCol = openCol === b.dataset.mic ? null : (b.dataset.mic as string); void openMenu('load'); }; });
  el.querySelectorAll<HTMLElement>('[data-mis]').forEach((b) => { b.onclick = async () => { if (await store.load(b.dataset.mis as string)) closeMenu(); }; });
  el.querySelectorAll<HTMLElement>('[data-mia]').forEach((b) => { b.onclick = async () => { if (await store.loadAutosave(b.dataset.mia as string)) { closeMenu(); hint(T('ui.menu.backTo', { year: year(store.session().s.market.t) }), 3000); } }; });
  el.querySelectorAll<HTMLElement>('[data-mid]').forEach((b) => { b.onclick = async () => {
    if (b.dataset.conf !== '1') { b.dataset.conf = '1'; (b.querySelector('b') as HTMLElement).textContent = T('ui.menu.deleteAgain'); return; }
    await store.remove(b.dataset.mid as string); openCol = null; void openMenu('load');
  }; });
  const f = el.querySelector<HTMLFormElement>('#miForm');
  if (f) f.onsubmit = (ev) => {
    ev.preventDefault();
    const colony = (el.querySelector('#miNome') as HTMLInputElement).value.trim() || T('ui.menu.defaultColony');
    const advisor = ((el.querySelector('#miCons') as HTMLInputElement).value.trim() || 'Inácio').slice(0, 10);
    store.start({ colony, advisor });
    closeMenu();
  };
  const file = el.querySelector<HTMLInputElement>('#miArq');
  if (file) file.onchange = () => { const fl = file.files?.[0]; if (!fl) return; void fl.text().then(async (txt) => { const r = await store.importSave(txt); if (r === 'ok') closeMenu(); else hint(T(r === 'newer' ? 'ui.menu.newerFile' : 'ui.menu.badFile'), 4000); }); };
}

// ---- settings, in game: a list of buttons with icons

export function openSettings(): void {
  const on = api.Musica.ligada, sounds = api.Sons.ligado;
  const row = (id: string, ic: string, title: string, sub = '') => K.card({ ic: ico(ic), title, sub, attrs: `data-set="${id}"` });
  sheetWith(T('ui.settings.title'), store.session().meta.colony, K.cards([
    row('menu', '<path d="M4 11l8-7 8 7M6 10v10h12V10"/>', T('ui.settings.menu')),
    row('save', '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>', T('ui.settings.save')),
    row('export', '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', T('ui.settings.export')),
    row('music', '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', T('ui.settings.music'), T(on ? 'ui.on' : 'ui.off')),
    row('sounds', '<path d="M4 9h4l5-4v14l-5-4H4zM17 9c1 1 1 5 0 6M19.5 6.5c2.500 3 2.500 8 0 11"/>', T('ui.settings.sounds'), T(sounds ? 'ui.on' : 'ui.off')),
    row('lang', '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', T('ui.settings.language'), locale() === 'pt-BR' ? 'Português' : 'English'),
  ]) + K.note(esc(T('ui.settings.version', { version: APP_VERSION })), 'neutra'));
  sheet().querySelectorAll<HTMLElement>('[data-set]').forEach((b) => { b.onclick = async () => {
    const a = b.dataset.set;
    if (a === 'menu') { await store.save(); cancel(); void openMenu('start'); return; }
    if (a === 'save') { hint((await store.save()) ? T('ui.settings.saved') : T('ui.settings.saveFailed'), 2400); return; }
    if (a === 'export') { await exportFile(); return; }
    if (a === 'music') api.Musica.alterna();
    if (a === 'sounds') api.Sons.alterna();
    if (a === 'lang') { setLocale(locale() === 'pt-BR' ? 'en' : 'pt-BR'); hooks.relabel?.(); }
    openSettings();
  }; });
}

async function exportFile(): Promise<void> {
  const data = store.exportSave(), name = `assunguy-${store.session().meta.colony.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${year(store.session().s.market.t)}.json`;
  let dl: { save: (o: { filename: string; data: string }) => Promise<void> } | null = null;
  try { const c = (globalThis as unknown as { claude?: { use: (n: string) => Promise<typeof dl> } }).claude; dl = c?.use ? await c.use('downloads') : null; } catch { dl = null; }
  if (dl) { try { await dl.save({ filename: name, data }); } catch { /* declined */ } return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name; a.click();
}
