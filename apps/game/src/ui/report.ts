// The season report (the prototype's "Relatório"), with the review's changes: arrows by satisfaction and
// cash, "Carga parada" as one bar per season, "Efeito das suas decisões", results per good below.
import { LEVEL_UNLOCKS, MILESTONES, type GoodId } from '@assunguy/data';
import { seasonOf, yearOf, type Change, type GameState, type SeasonReport, type SeriesPoint } from '@assunguy/sim';
import * as store from '../store';
import { T, goodName, num } from '../i18n';
import { api } from '../view';
import { $, K, X_SVG, esc, fmt, popup, signedMoney } from './kit';
import { bar, nextEvent, ui } from './app';

const dateOf = (t: number) => T('ui.date', { year: yearOf(t - 1), season: T(`season.${seasonOf(t - 1)}`) });
const arrow = (d: number) => (d > 0.5 ? '<span class="seta mais">▲</span>' : d < -0.5 ? '<span class="seta menos">▼</span>' : '');

// ---- the full-screen panel (the prototype's K.tela)

export interface Screen { id: string; title: string; sub?: string; tabs?: [string, string][] | null; tab?: string; body: string; nav?: string; onTab?: (t: string) => void; button?: string }
export function screen(o: Screen): HTMLElement {
  const p = $('econ');
  const same = p.dataset.tela === `${o.id}:${o.tab ?? ''}` && p.querySelector('.ec-corpo');
  const y0 = same ? (p.querySelector('.ec-corpo') as HTMLElement).scrollTop : 0;
  const x0 = p.querySelector('.ec-abas .abas') && p.dataset.tela?.split(':')[0] === o.id ? (p.querySelector('.ec-abas .abas') as HTMLElement).scrollLeft : 0;
  p.dataset.tela = `${o.id}:${o.tab ?? ''}`;
  p.hidden = false; ui.screenOpen = true;
  p.classList.toggle('com-barra', !!o.button);
  if (o.button) bar();
  document.querySelectorAll('#folha .aba').forEach((b) => b.classList.toggle('on', b.id === o.button));
  const g = store.session();
  p.innerHTML = `<header class="ec-t"><div><h2>${esc(o.title)}</h2><small>${esc(o.sub ?? T('ui.date', { year: yearOf(g.s.market.t), season: T(`season.${seasonOf(g.s.market.t)}`) }))}</small></div>${o.nav ?? ''}<button type="button" class="x" id="econFecha" aria-label="${esc(T('ui.close'))}">${X_SVG}</button></header>${o.tabs ? `<div class="ec-abas">${K.tabs(o.tabs, o.tab ?? '')}</div>` : ''}<div class="ec-corpo">${o.body}</div>`;
  (p.querySelector('.ec-corpo') as HTMLElement).scrollTop = y0;
  if (o.tabs) (p.querySelector('.ec-abas .abas') as HTMLElement).scrollLeft = x0;
  $('econFecha').onclick = closeScreen;
  if (o.onTab) p.querySelectorAll<HTMLElement>('.ec-abas [data-aba]').forEach((b) => { b.onclick = () => o.onTab!(b.dataset.aba as string); });
  return p;
}
export function closeScreen(): void {
  const p = $('econ');
  p.hidden = true; p.dataset.tela = ''; p.classList.remove('com-barra'); ui.screenOpen = false;
  document.querySelectorAll('#folha .aba').forEach((b) => b.classList.remove('on'));
  nextEvent();
}

// ---- the report

export function openReport(_r?: SeasonReport, _before?: unknown): void { openReportAt(store.session().s.reports.length - 1); }
export function openReports(): void { const n = store.session().s.reports.length; if (n) openReportAt(n - 1); else hooks2.openEconomy(); }
export const hooks2 = { openEconomy: () => {} };

function changeText(c: Change): string {
  const out: string[] = [];
  if (c.income) out.push(T('ui.change.income', { value: signedMoney(c.income) }));
  if (c.purse) out.push(T('ui.change.purse', { value: signedMoney(c.purse) }));
  if (c.satisfaction) out.push(T('ui.change.satisfaction', { value: `${c.satisfaction > 0 ? '+' : '−'}${fmt(Math.abs(c.satisfaction))}` }));
  if (c.jobs) out.push(T('ui.change.jobs', { value: `${c.jobs > 0 ? '+' : '−'}${fmt(Math.abs(c.jobs))}` }));
  if (c.places) out.push(T('ui.change.places', { value: `${c.places > 0 ? '+' : '−'}${fmt(Math.abs(c.places))}` }));
  if (c.market) out.push(T('ui.change.market', { value: `${c.market > 0 ? '+' : '−'}${fmt(Math.abs(c.market))}` }));
  if (c.gateways || c.collections) out.push(T('ui.change.transport', { value: `${(c.gateways ?? 0) + (c.collections ?? 0) > 0 ? '+' : '−'}${fmt(Math.abs((c.gateways ?? 0) + (c.collections ?? 0)))}` }));
  return out.join(', ') || T('ui.change.none');
}

function openReportAt(i: number): void {
  const g = store.session(), list = g.s.reports as SeasonReport[], r = list[i];
  if (!r) return;
  const prev = list[i - 1];
  const notes: string[] = [];
  if (r.goal?.levelUp) {
    const unl = (LEVEL_UNLOCKS[r.goal.levelUp] ?? []).map((t) => T(`building.${t}`)).join(', ');
    notes.push(K.note(`${esc(T('ui.report.levelUp', { n: r.goal.levelUp }))}${r.goal.milestone ? ` ${esc(T('ui.report.nowIs', { milestone: r.goal.milestone }))}` : ''}${unl ? ` ${esc(T('ui.report.unlocked', { list: unl }))}` : ''}`));
  }
  if (r.goal?.missed) notes.push(K.note(esc(T('ui.report.missed', { milestone: r.goal.missed })), 'ruim'));
  if (r.province) notes.push(K.note(esc([T(`ui.province.factor.${r.province.factor > 1 ? 'up' : r.province.factor < 1 ? 'down' : 'same'}`), ...r.province.reasons.map((x) => T(`ui.province.${x.reason}`, x.params))].join(' ')), r.province.factor < 1 ? 'ruim' : r.province.factor > 1 ? '' : 'neutra'));
  for (const n of r.news) notes.push(K.note(esc(T(n.key, { advisor: g.meta.advisor, colony: g.meta.colony, ...n.params })), 'neutra'));
  const inv = Object.values(r.invested.homes).reduce((x, y) => x + (y ?? 0), 0);
  if (inv || r.invested.fields) notes.push(K.note(esc(T('ui.report.invested', { homes: inv, fields: r.invested.fields })), 'neutra'));
  const satD = prev ? r.satisfaction.after - prev.satisfaction.after : r.satisfaction.after - r.satisfaction.before;
  const cashD = r.cash.after - r.cash.before;
  const c = r.cash, inMoney = c.taxes + c.grant + c.share + (c.tariffs ?? 0) + (r.instalments ?? 0), outMoney = c.upkeep + c.wages + c.relief + c.works + c.greatWorks + c.agent + c.fleet + c.arrivals;
  const idle = r.summary.families - r.summary.employed;
  // carga parada: one bar per season, oldest to newest
  const series = (g.s.series ?? []).slice(-8) as SeriesPoint[];
  const stuck = series.length ? K.columns({ parts: [{ name: T('ui.report.stuck'), values: series.map((p) => p.stuck), color: '#C2562B' }, { name: T('ui.report.noBuyer'), values: series.map((p) => p.noBuyer), color: '#9C7A3A' }], labels: series.map((p) => dateOf(p.t + 1).replace(/^.*?(\d+).*$/, '$1')), summary: T('ui.report.stuckTitle') }) : '';
  const decisions = [
    ...r.decisions.works.map((x) => K.row(T(x.kind === 'built' ? 'ui.report.built' : 'ui.report.upgraded', { n: x.n, building: x.building }), changeText(x.change))),
    ...r.decisions.demolished.map((x) => K.row(T('ui.report.demolished', { n: x.n, building: x.building }), changeText(x.change))),
    ...r.decisions.events.map((x) => K.row(T(`event.${x.event}.option.${x.option}`, { colony: g.meta.colony, advisor: g.meta.advisor }), changeText(x.change))),
    ...r.passed.laws.map((x) => K.row(T(`law.${x.id}`), changeText(x.change))),
    ...r.passed.taxes.map((x) => K.row(T(`ui.tax.${x.id}`), T('ui.perYear', { value: signedMoney(x.revenue) }))),
  ];
  const returns = r.returns.filter((x) => Math.abs(x.net) >= 1).sort((a, b) => b.net - a.net);
  const body = K.tiles([
    { v: `${idle}/${r.summary.families}`, r: T('ui.report.idle'), bad: idle > r.summary.families * 0.4 },
    { v: `${Math.round(r.satisfaction.after)} ${arrow(satD)}`, r: T('ui.satisfaction') },
    { v: `$ ${fmt(r.cash.after)} ${arrow(cashD)}`, r: T('ui.report.cash') },
  ])
    + K.cards([K.card({ title: T('ui.report.accounts'), sub: T('ui.report.inOut', { in: fmt(inMoney), out: fmt(outMoney) }), right: signedMoney(cashD), tone: cashD < 0 ? 'ruim' : '', attrs: 'data-contas="1"' })])
    + notes.join('')
    + (stuck ? K.section(T('ui.report.stuckTitle'), 'stuck') + stuck : '')
    + K.section(T('ui.report.decisions'), 'decisions') + (decisions.length ? K.rows(decisions) : K.empty(T('ui.report.noDecisions')))
    + K.section(T('ui.report.returns'), 'returns') + (returns.length ? K.rows(returns.map((x) => K.row(goodName(x.good), signedMoney(x.net), x.net >= 0.5 ? 'mais' : x.net <= -0.5 ? 'menos' : ''))) : K.empty(T('ui.report.noReturns')));
  const nav = `${i > 0 ? `<button type="button" class="nav" data-ir="${i - 1}" aria-label="${esc(T('ui.report.prev'))}">‹</button>` : ''}${i < list.length - 1 ? `<button type="button" class="nav" data-ir="${i + 1}" aria-label="${esc(T('ui.report.next'))}">›</button>` : ''}`;
  const p = screen({ id: 'report', title: T('ui.report.title'), sub: dateOf(r.t), body, nav, tab: String(i) });
  p.querySelectorAll<HTMLElement>('[data-ir]').forEach((b) => { b.onclick = () => openReportAt(Number(b.dataset.ir)); });
  const bc = p.querySelector<HTMLElement>('[data-contas]');
  if (bc) bc.onclick = () => {
    const L: string[] = [];
    const plus = (k: string, v: number) => { if (v) L.push(K.row(T(k), `+$ ${fmt(v)}`, 'mais')); };
    const minus = (k: string, v: number) => { if (v) L.push(K.row(T(k), `−$ ${fmt(v)}`, 'menos')); };
    plus('ui.report.taxes', c.taxes); plus('ui.report.grant', c.grant); plus('ui.report.share', c.share); plus('ui.report.tariffs', c.tariffs ?? 0); plus('ui.report.instalments', r.instalments ?? 0);
    minus('ui.report.wages', c.wages); minus('ui.report.relief', c.relief); minus('ui.report.arrivals', c.arrivals); minus('ui.report.upkeep', c.upkeep); minus('ui.report.fleet', c.fleet); minus('ui.report.agent', c.agent); minus('ui.report.greatWorks', c.greatWorks); minus('ui.report.works', c.works);
    popup(T('ui.report.accountsTitle'), '', K.rows(L));
  };
  api.Sons?.toca?.('papel');
}

export const _x = { MILESTONES, num, GOOD: null as unknown as GoodId, S: null as unknown as GameState };
