// The interface around the map: top bar, first steps, bottom bar, taps on the map, events and the season.
// The prototype's renderer draws; this module decides what the player sees in the sheets and popups and
// sends the player's decisions to the simulation as commands.
import { MILESTONES, type BuildingId } from '@assunguy/data';
import { computeEconomy, allocate, seasonOf, yearOf, type GameState, type LotKey, type LandId } from '@assunguy/sim';
import * as store from '../store';
import { T, has, num } from '../i18n';
import { api, vars, hooks, show, PT, EN } from '../view';
import { $, K, X_SVG, esc, fmt, hint, popup, closePopup, sheet, sheetWith, setSheetClose } from './kit';

// ---- what the player is doing on the map

export interface Mode { build?: BuildingId | 'street' | 'rail'; move?: LotKey; target?: [number, number]; error?: string; undo?: boolean }
export const ui = { mode: {} as Mode, selection: null as LotKey | null, category: 'housing', screenOpen: false };

/** Hands the renderer the mode in its own ids. */
export function setMode(m: Mode): void {
  ui.mode = m;
  const tipo = m.build === 'street' ? 'rua' : m.build === 'rail' ? 'trilho' : m.build ? PT.building[m.build] : undefined;
  vars.modo = { ...(tipo ? { tipo } : {}), ...(m.move ? { mover: m.move } : {}), ...(m.target ? { alvo: m.target } : {}), ...(m.error ? { erro: m.error } : {}) };
  guide();
}
export function setPreview(p: Record<string, unknown> | null): void { vars.modo = { ...vars.modo, previa: p }; }
export function select(key: LotKey | null): void { ui.selection = key; vars.selecao = key; }

// ---- after every change: the renderer's view, the top bar, the open sheet

let reopen: (() => void) | null = null;
/** What to redraw in the sheet when the state changes (the open panel registers itself). */
export const keepOpen = (f: (() => void) | null): void => { reopen = f; };
export function refresh(): void {
  const g = store.session();
  show(g.s, g.w, store.ratings());
  vars.cacheCaminho = {}; vars.chaoSujo = true; vars.cacheEstrada = null;
  api.refazPescadores();
  top();
}

/** Keeps a lot in view above the sheet (the prototype's `foco`). */
export function focus(a: number, b: number): void {
  const [, y] = api.projT(...api.paraVista(a + 0.5, b + 0.5)) as [number, number];
  const limit = (api.H as number) - $('folha').getBoundingClientRect().height - 60;
  const cam = api.cam as { x: number; y: number; z: number }, base = (vars.camAlvo as { x: number; y: number } | null) ?? cam, yb = y - (base.y - cam.y) * cam.z;
  if (yb > limit) vars.camAlvo = { x: base.x, y: base.y + (yb - limit) / cam.z };
}

// ---- the top bar

const dateText = (s: GameState) => T('ui.date', { year: yearOf(s.market.t), season: T(`season.${seasonOf(s.market.t)}`) });
export function top(): void {
  const { s } = store.session(), r = store.ratings();
  $('numero').textContent = String(Math.round(r.mean));
  $('sNivel').textContent = String(s.level);
  $('medida').style.width = `${Math.round(r.mean)}%`;
  $('sFam').textContent = fmt(Object.keys(s.families).length);
  $('sCaixa').textContent = fmt(s.cash);
  $('sInf').textContent = String(s.influence);
  // the review: "x desempregadas" instead of the lands count
  const idle = allocate(s).idle.length;
  const terr = $('sTer').parentElement as HTMLElement;
  terr.innerHTML = `<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.6-4 3.4-6 7-6s6.4 2 7 6"/><path d="M4 4l16 16"/></svg><b id="sTer">${fmt(idle)}</b> ${esc(T('ui.top.idle'))}`;
  $('mNivel').style.width = `${Math.round((s.progress ?? 0) * 100)}%`;
  const next = MILESTONES[s.milestone + 1], left = s.deadline - s.market.t, bd = $('bData');
  const weather = s.weather && s.weather.t === s.market.t ? T(`weather.${s.weather.kind}`) : '';
  bd.innerHTML = `<b>${esc(dateText(s))}</b><span>${next ? esc(T('ui.top.deadline', { n: Math.max(0, left), milestone: T(`milestone.${next.id}`) })) : esc(T('ui.top.noDeadline'))}</span>${weather ? `<span class="clima">${esc(weather.charAt(0).toUpperCase() + weather.slice(1))}</span>` : ''}`;
  bd.classList.toggle('urg', !!next && left <= 8);
  const label = $('bInacio');
  const name = store.session().meta.advisor;
  label.setAttribute('aria-label', name);
  (label.querySelector('.balao-c b') as HTMLElement).textContent = name.charAt(0).toUpperCase();
  (label.lastElementChild as HTMLElement).textContent = name;
  const badge = $('nInacio'), n = store.advice().filter((a) => a.weight >= 60 && !a.blocked).length;
  badge.textContent = n ? String(Math.min(9, n)) : '';
  guide();
}

// ---- first steps: they go away as the player does them

interface Step { key: string; done: (s: GameState) => boolean; go: () => void }
const count = (s: GameState, f: (t: BuildingId) => boolean) => Object.values(s.map.buildings).filter((t) => f(t as BuildingId)).length;
const STEPS: Step[] = [
  { key: 'jobs', done: (s) => count(s, (t) => t.endsWith('Field')) > 3, go: () => hooks.chooseBuild('beanField') },
  { key: 'homes', done: (s) => count(s, (t) => t === 'hut' || t === 'house' || t === 'whitewashedHouse' || t === 'townhouse') > 4, go: () => hooks.chooseBuild('hut') },
  { key: 'season', done: (s) => s.market.t > 12, go: () => passSeason() },
  { key: 'advisor', done: (s) => !!s.flags.sawAdvisor, go: () => hooks.openAdvisor() },
  { key: 'level', done: (s) => s.level >= 2, go: () => hooks.openLevel() },
];
export function guide(): void {
  const g = $('guia');
  if (!store.hasGame()) { g.hidden = true; return; }
  const { s } = store.session();
  if (s.flags.guideOff || ui.mode.build || ui.mode.move) { g.hidden = true; return; }
  const i = STEPS.findIndex((x) => !x.done(s));
  if (i < 0) { g.hidden = true; return; }
  const x = STEPS[i] as Step;
  $('guiaAc').innerHTML = `<small>${esc(T('ui.guide.count', { n: i + 1, of: STEPS.length }))}</small><b>${esc(T(`ui.guide.${x.key}.title`, { advisor: store.session().meta.advisor }))}</b><span>${esc(T(`ui.guide.${x.key}.body`))}</span>`;
  $('guiaAc').onclick = x.go;
  const fx = $('guiaX'); fx.innerHTML = X_SVG;
  fx.onclick = () => { s.flags.guideOff = true; store.save(); guide(); };
  g.hidden = false;
}

// ---- the bottom bar

export function bar(): void {
  const f = sheet();
  f.className = 'folhinha barra-so';
  const item = (id: string, txt: string, d: string, cls = '') => `<button type="button" id="${id}" class="aba ${cls}"><svg viewBox="0 0 24 24">${d}</svg>${esc(txt)}</button>`;
  f.innerHTML = '<nav class="abasb">' +
    item('bColonia', T('ui.bar.colony'), '<circle cx="9" cy="8" r="3.500"/><path d="M3 20c.5-4 3-6 6-6s5.500 2 6 6M16 5a3.500 3.500 0 0 1 0 7M18 14c2 .7 3 3 3.500 6"/>') +
    item('bGoverno', T('ui.bar.government'), '<path d="M3 9l9-5 9 5M4 9h16M6 9v8M10 9v8M14 9v8M18 9v8M3 20h18M4 17h16"/>') +
    item('bTransp', T('ui.bar.transport'), '<path d="M7 3l-3 18M17 3l3 18M5.5 8h13M5 13h14M4.3 18h15.4"/>') +
    item('bPassa', T('ui.bar.season'), '<path d="M6 4l11 8-11 8z"/><path d="M20 4v16"/>', 'prin') + '</nav>';
  $('bColonia').onclick = () => hooks.openColony();
  $('bGoverno').onclick = () => hooks.openGovernment();
  $('bTransp').onclick = () => hooks.openTransport();
  $('bPassa').onclick = () => passSeason();
}
/** Back to the map with nothing chosen. */
export function cancel(): void { setMode({}); setPreview(null); select(null); keepOpen(null); hint(''); bar(); }
setSheetClose(() => cancel());

// ---- taps on the map (the prototype's `toque`)

export function tap(px: number, py: number): void {
  vars.camAlvo = null;
  const [a, b] = api.loteDaTela(px, py) as [number, number];
  if (ui.mode.build === 'street') { hooks.streetTap(a, b); return; }
  if (ui.mode.build === 'rail') { hooks.railTap(a, b); return; }
  if (ui.mode.build) { hooks.previewAt(ui.mode.build, a, b); return; }
  if (ui.mode.move) { hooks.previewMove(ui.mode.move, a, b); return; }
  const district = api.bairroNaTela(px, py);
  if (district) { hooks.openDistrict(district); return; }
  const tr = api.tropaNaTela(px, py);
  if (tr) { select(null); sheetWith(T(`ui.traffic.${tr.tipo}`, { name: tr.nome ?? '', destination: tr.destino ?? 'Curitiba' }), tr.volta ? T('ui.traffic.back') : tr.carga ? T('ui.traffic.carrying', { n: tr.arrobas ?? '', good: tr.carga }) : '', ''); return; }
  const person = api.pessoaNaTela(px, py);
  if (person) {
    select(null);
    const at = store.session().s.map.buildings[person.d as LotKey];
    sheetWith(T('ui.person.title', { name: api.familia(person.casa) }), person.volta ? T('ui.person.home') : at ? T('ui.person.going', { building: at }) : '', K.actions([{ id: 'verCasa', text: T('ui.person.seeHome') }]));
    $('verCasa').onclick = () => hooks.openBuilding(person.casa);
    return;
  }
  const p = api.predioNaTela(px, py);
  if (p) { hooks.openBuilding(p); return; }
  const { s, w } = store.session();
  if (a >= 0 && b >= 0 && a < 90 && b < 105 && s.map.lands[landOfLot(a, b)] !== 'ours') { hooks.openLand(landOfLot(a, b)); return; }
  const key = `${a},${b}` as LotKey;
  if (s.map.streets[key]) { hooks.openStreet(key); return; }
  if (w.deposits[key]) { sheetWith(T(`ui.deposit.${w.deposits[key]}`), T('ui.deposit.body'), ''); return; }
  cancel();
}
const landOfLot = (a: number, b: number) => `${Math.floor(a / 15)},${Math.floor(b / 15)}` as LandId;

// ---- events

export function nextEvent(): void {
  const box = $('evento');
  if (!store.hasGame()) { box.hidden = true; return; }
  const { s, meta } = store.session();
  if (!$('econ').hidden || !s.queue.length || hooks.menuAberto()) { box.hidden = true; return; }
  const ev = s.queue[0]!;
  const d = hooks.defineEvent(ev);
  const id: string = d.id, p = { colony: meta.colony, advisor: meta.advisor, ...d.params };
  if (nextEvent.last !== ev) { api.Sons.toca('sino', 400); nextEvent.last = ev; }
  const k = (x: string) => `event.${id}.${x}`;
  const lines: string[] = [];
  for (let i = 0; has(k(`line.${i}.text`)); i++) lines.push(`<li><b>${esc(T(k(`line.${i}.who`), p))}:</b> ${esc(T(k(`line.${i}.text`), p))}</li>`);
  const opts = (d.options as { can?: (s: GameState) => boolean; params?: Record<string, string | number> }[]).map((o, i) => {
    const q = { ...p, ...(o.params ?? {}) };
    const effect = has(k(`option.${i}.effect`)) ? T(k(`option.${i}.effect`), q) : '';
    return `<button type="button" data-op="${i}" ${o.can && !o.can(s) ? 'disabled' : ''}>${esc(T(k(`option.${i}`), q))}${effect ? `<small>${esc(effect)}</small>` : ''}</button>`;
  });
  box.hidden = false;
  box.innerHTML = `<div>${has(k('who')) ? `<small class="quem">${esc(T(k('who'), p))}</small>` : ''}<h2>${esc(T(k('title'), p))}</h2>${has(k('body')) ? `<p>${esc(T(k('body'), p))}</p>` : ''}${lines.length ? `<ul class="falas">${lines.join('')}</ul>` : ''}<div class="ops">${opts.join('')}</div></div>`;
  box.querySelectorAll<HTMLElement>('[data-op]').forEach((b) => { b.onclick = () => {
    const kind = ev.kind, option = Number(b.dataset.op);
    store.choose(option); box.hidden = true;
    if (kind === 'victory' && option === 1) { hooks.openMenu(); return; }
    if (kind === 'end') { hooks.openMenu(); return; }
    if (kind === 'raceLost') { if (option === 0) void store.restartRace().then((ok) => { if (ok) hooks.enter(); else hooks.openMenu(); }); else hooks.openMenu(); return; }
    refresh(); if (reopen) reopen(); nextEvent();
  }; });
}
nextEvent.last = null as unknown;

// ---- the season

export function passSeason(): void {
  if (store.session().s.queue.length) { nextEvent(); hint(T('ui.season.decideFirst'), 2600); return; }
  api.Sons.toca('estacao');
  cancel();
  const before = { cash: store.session().s.cash, sat: store.ratings().mean };
  const r = store.nextSeason();
  refresh();
  hooks.openReport(r, before);
}

// ---- wiring the header and the map's own buttons

export function wire(): void {
  $('bNivel').onclick = () => hooks.openLevel();
  $('bData').onclick = () => hooks.openReports();
  $('bInacio').onclick = () => hooks.openAdvisor();
  $('bObras').onclick = () => hooks.openBuildList();
  $('menu').onclick = () => hooks.openSettings();
  $('btSat').onclick = () => hooks.openLayers();
  document.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const go = el.closest<HTMLElement>('[data-acao]');
    if (go) { e.stopPropagation(); closePopup(); hooks.runAction(JSON.parse(go.dataset.acao as string)); return; }
    const info = el.closest<HTMLElement>('[data-info]');
    if (info) { e.stopPropagation(); const key = info.dataset.info as string; popup(T(`ui.info.${key}.title`), T(`ui.info.${key}.body`)); return; }
    if (el.closest('[data-graf]')) { readChart(e as MouseEvent); return; }
    if (el.closest('#infoPop') && !el.closest('button')) closePopup();
  });
  document.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') readChart(e); });
  hooks.toque = tap;
  hooks.aviso = (txt: string, ms?: number) => hint(txt, ms);
  hooks.atualizaTopo = () => top();
  hooks.salva = () => store.save();
  hooks.mudou = () => refresh();
  hooks.cronica = () => {};
  hooks.registra = () => {};
  hooks.alocar = () => ({ livres: [], por: {}, ocupadas: 0 });
}

function readChart(e: MouseEvent | PointerEvent): void {
  const fig = (e.target as HTMLElement).closest?.<HTMLElement>('[data-graf]');
  if (!fig) return;
  const d = JSON.parse(fig.dataset.graf as string), svg = fig.querySelector('svg') as SVGSVGElement, q = svg.getBoundingClientRect();
  const x = ((e.clientX - q.left) / q.width) * d.W, n = d.r.length;
  const i = Math.max(0, Math.min(n - 1, Math.round(((x - d.x0) / Math.max(1, d.x1 - d.x0)) * (n - 1))));
  const cx = d.x0 + (n > 1 ? (i / (n - 1)) * (d.x1 - d.x0) : 0), cr = fig.querySelector('.gr-c') as SVGLineElement;
  cr.setAttribute('x1', String(cx)); cr.setAttribute('x2', String(cx)); cr.style.display = '';
  (fig.querySelector('.graf-ler') as HTMLElement).textContent = `${d.r[i]}: ${d.s.map((y: { n: string; v: (number | null)[] }) => `${y.n} ${y.v[i] === null ? '-' : num(y.v[i] as number, d.k)}`).join(', ')}`;
}

export { computeEconomy, EN };
