// The season report (the prototype's "Relatório"), with the review's changes: arrows by satisfaction and
// cash, "Carga parada" as one bar per season, no production chart and no totals over the decisions,
// "Efeito das suas decisões", "Rentabilidade do patrimônio" sorted from most to least worth it, and the
// result per good below it.
import { LEVEL_UNLOCKS, type BuildingId } from '@assunguy/data';
import { assetReturns, cargoStuck, def, good, seasonOf, yearOf, type AssetReturn, type AssetVerdict, type Change, type SeasonReport, type SeriesPoint } from '@assunguy/sim';
import * as store from '../store';
import { T, goodName, has, locale, plural } from '../i18n';
import { api } from '../view';
import { $, K, X_SVG, closePopup, esc, fmt, popup, signedMoney } from './kit';
import { bar, nextEvent, ui } from './app';

const dateOf = (t: number) => T('ui.date', { year: yearOf(t - 1), season: T(`season.${seasonOf(t - 1)}`) });
const arrow = (d: number) => (d > 0.5 ? '\u00a0<span class="seta mais">▲</span>' : d < -0.5 ? '\u00a0<span class="seta menos">▼</span>' : '');

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
export const hooks2 = { openEconomy: () => {}, openTransport: () => {} };

// ---- pieces of the report

const sgn = (v: number) => (v > 0 ? '+' : '−');
const signed = (v: number, money = false) => `${sgn(v)}${money ? '$ ' : ''}${fmt(Math.abs(v))}`;
const COLORS = ['#2F5AA8', '#A67C12', '#8A5BB5', '#C2562B', '#14875A'];
const firstUp = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
const lower = (x: string) => x.toLocaleLowerCase(locale());

/** What a decision changed, one line each, in the colony's terms. */
function effects(c: Change): string[] {
  const t: string[] = [];
  if (c.gateways) t.push(T('ui.report.fx.gateways', { v: signed(c.gateways) }));
  if (c.collections) t.push(T('ui.report.fx.collections', { v: signed(c.collections) }));
  if (c.market) t.push(T('ui.report.fx.market', { v: signed(c.market) }));
  if (c.jobs) t.push(T(Math.abs(c.jobs) > 1 ? 'ui.report.fx.jobs' : 'ui.report.fx.job', { v: signed(c.jobs) }));
  if (c.places) t.push(T(Math.abs(c.places) > 1 ? 'ui.report.fx.places' : 'ui.report.fx.place', { v: signed(c.places) }));
  if (c.linked && Math.abs(c.linked) > 1) t.push(T('ui.report.fx.linked', { v: signed(c.linked) }));
  if (c.income) t.push(T('ui.report.fx.income', { v: signed(c.income, true) }));
  if (c.purse) t.push(T('ui.report.fx.purse', { v: signed(c.purse, true) }));
  if (c.satisfaction) t.push(T('ui.report.fx.satisfaction', { v: signed(Math.round(c.satisfaction)) }));
  return t;
}
const effectList = (tx: string[]) => `<ul class="efeitos">${tx.map((x) => `<li class="${/−/.test(x) ? 'menos' : 'mais'}">${esc(x)}</li>`).join('')}</ul>`;
const neutral = (x: string) => `<ul class="efeitos"><li class="neutro">${esc(x)}</li></ul>`;
function verdict(c: Change, none = 'ui.report.v.none'): [string, string] {
  const good = (['income', 'purse', 'gateways', 'collections', 'market', 'satisfaction', 'places', 'jobs', 'linked'] as const).filter((k) => (c[k] ?? 0) > 0).length;
  const bad = (['income', 'purse', 'gateways', 'collections', 'market', 'satisfaction'] as const).filter((k) => (c[k] ?? 0) < 0).length;
  if (good && bad) return [T('ui.report.v.mixed'), ''];
  if (bad) return [T('ui.report.v.worse'), 'ruim'];
  if (good) return [T('ui.report.v.helped'), 'bom'];
  return [T(none), ''];
}
const nameN = (b: string, n: number) => (b === 'street' ? plural('ui.report.streets', n) : T('ui.report.workN', { n, item: lower(T(n > 1 ? `building.${b}.plural` : `building.${b}`)) }));

/** "Efeito das suas decisões": one card per work, demolition, law, tax and event, with a verdict. */
function decisionsBlock(r: SeasonReport, g: { meta: { colony: string; advisor: string } }): string {
  const cards: string[] = [];
  for (const x of r.decisions.works) {
    const b = x.building, tx = effects(x.change), d = b !== 'street' ? def(b as BuildingId) : null;
    const idle = !!d?.jobs && !tx.length;
    const v = b === 'street' && !tx.length ? [T('ui.report.v.path'), ''] : verdict(x.change, idle ? 'ui.report.v.idle' : 'ui.report.v.none');
    const title = x.kind === 'upgraded' ? (x.n > 1 ? T('ui.report.upgradedMany', { n: x.n, item: lower(T(`building.${b}`)) }) : T('ui.report.upgradedN', { item: lower(T(`building.${b}`)) })) : nameN(b, x.n);
    const se = d?.output?.season;
    const when = x.kind === 'built' && d?.crop ? neutral(se === undefined || se === null ? T('ui.report.startsNext') : T('ui.report.startsAt', { season: lower(T(`season.${se}`)) })) : '';
    cards.push(K.card({ title: esc(title), sub: `$ ${fmt(x.cost)}`, right: v[0], tone: v[1], body: when + (tx.length ? effectList(tx) : idle ? neutral(T('ui.report.idleNote')) : '') }));
  }
  for (const x of r.decisions.demolished) {
    const tx = effects(x.change), v = verdict(x.change);
    cards.push(K.card({ title: esc(T('ui.report.demolishedN', { n: x.n, item: lower(T(x.n > 1 ? `building.${x.building}.plural` : `building.${x.building}`)) })), right: v[0], tone: v[1], body: tx.length ? effectList(tx) : '' }));
  }
  for (const x of r.passed.laws) { const tx = effects(x.change); cards.push(K.card({ title: esc(T(`law.${x.id}`)), sub: T('ui.report.inForce'), right: T('ui.report.v.law'), body: tx.length ? effectList(tx) : '' })); }
  for (const x of r.passed.taxes) cards.push(K.card({ title: esc(T(`ui.tax.${x.id}`)), sub: x.revenue ? esc(T('ui.report.taxSub', { year: signedMoney(x.revenue), season: fmt(x.revenue / 4) })) : T('ui.report.inForce'), right: T('ui.report.v.law') }));
  for (const x of r.decisions.events) {
    const p = { colony: g.meta.colony, advisor: g.meta.advisor, ...(x.params ?? {}) }, tx = effects(x.change), v = verdict(x.change, 'ui.report.v.decided');
    const eff = has(`event.${x.event}.option.${x.option}.effect`) ? T(`event.${x.event}.option.${x.option}.effect`, p) : '';
    cards.push(K.card({ title: esc(T(`event.${x.event}.title`, p)), sub: esc(T(`event.${x.event}.option.${x.option}`, p)), right: v[0], tone: v[1], body: tx.length ? effectList(tx) : eff ? neutral(eff) : '' }));
  }
  return cards.length ? K.cards(cards) : K.empty(T('ui.report.noDecisions'));
}

/** "Evolução": families over three years, and the cargo that stood still, one bar per season. */
function evolutionBlock(upTo: number, latest: boolean): string {
  const all = ((store.session().s.series ?? []) as SeriesPoint[]).filter((x) => x.t <= upTo);
  if (all.length < 2) return K.note(esc(T('ui.report.chartsLater')), 'neutra');
  const ss = all.slice(-12), end = ss[ss.length - 1] as SeriesPoint, ago = (all.length >= 5 ? all[all.length - 5] : all[0]) as SeriesPoint;
  const pc = (x: SeriesPoint) => (x.families ? Math.round((x.idle / x.families) * 100) : 0), p1 = pc(end), p0 = pc(ago), dF = end.families - ago.families;
  const famParams = { n: fmt(end.families), d: dF >= 0 ? `+${fmt(dF)}` : signed(dF), idle: fmt(end.idle), p: p1, was: p0 };
  const fam = T(p1 !== p0 ? 'ui.report.famLineWas' : 'ui.report.famLine', famParams) + (end.relief ? ` ${T('ui.report.famRelief', { n: end.relief })}` : '');
  const anyRelief = ss.some((x) => x.relief);
  let h = `<p class="graf-tit">${esc(T('ui.report.famTitle'))}</p>` + K.note(esc(fam), p1 > p0 + 3 ? 'ruim' : 'neutra')
    + K.chart({ labels: ss.map((x) => dateOf(x.t)), summary: T('ui.report.famSummary'), series: [{ name: T('ui.report.inColony'), color: COLORS[0] as string, values: ss.map((x) => x.families) }, { name: T('ui.report.outOfWork'), color: COLORS[3] as string, values: ss.map((x) => x.idle) }, ...(anyRelief ? [{ name: T('ui.report.onRelief'), color: COLORS[4] as string, values: ss.map((x) => x.relief) }] : [])] });
  // carga parada: one bar per season, oldest to newest
  const cs = all.slice(-8), u = cs[cs.length - 1] as SeriesPoint, a0 = cs[0] as SeriesPoint;
  const share = (x: SeriesPoint) => { const tot = x.soldHere + x.byRiver + x.byRoad + x.stuck; return tot ? Math.round((x.stuck / tot) * 100) : 0; };
  const pp = share(u), pa = cs.length >= 2 ? share(a0) : pp;
  let line = pp < 1 ? T('ui.report.stuckAll') : T(pa !== pp ? 'ui.report.stuckPctWas' : 'ui.report.stuckPct', { p: pp, was: pa });
  if (pp >= 1 && latest && cargoStuck(store.economy())) line += ` ${T('ui.report.bottleneck')}`;
  if (u.noBuyer >= 10) line += ` ${T('ui.report.noBuyerLine', { n: fmt(u.noBuyer) })}`;
  h += `<p class="graf-tit">${esc(T('ui.report.stuckTitle'))}</p>` + K.note(esc(line), pp >= 10 ? 'ruim' : 'neutra')
    + K.columns({ parts: [{ name: T('ui.report.stuck'), values: cs.map((p) => p.stuck), color: '#C2562B' }, { name: T('ui.report.noBuyer'), values: cs.map((p) => p.noBuyer), color: '#9C7A3A' }], labels: cs.map((p) => dateOf(p.t)), summary: T('ui.report.stuckTitle') });
  return h;
}

/** "Resultado por recurso no ano": each good's year, net of upkeep, materials, freight and losses. */
function returnsBlock(r: SeasonReport): { html: string; all: SeasonReport['returns'] } {
  const ord = r.returns.slice().sort((a, b) => b.net - a.net);
  if (!ord.length) return { html: K.empty(T('ui.report.noReturns')), all: ord };
  const money = (v: number) => `${v < 0 ? '−' : '+'}$ ${fmt(Math.abs(v))}`;
  const total = ord.reduce((a, x) => a + x.net, 0), upkeep = ord.reduce((a, x) => a + x.upkeep, 0), lost = ord.reduce((a, x) => a + x.lost, 0), lostValue = ord.reduce((a, x) => a + x.lost * good(x.good).localPrice, 0);
  const max = Math.max(50, ...ord.map((x) => Math.abs(x.net))), now = seasonOf(r.t - 1);
  const line = (x: SeasonReport['returns'][number]) => {
    const parts = [T('ui.report.r.sold', { v: fmt(x.sales) }), x.paidByWorkshops ? T('ui.report.r.paid', { v: fmt(x.paidByWorkshops) }) : '', x.materials ? T('ui.report.r.materials', { v: fmt(x.materials) }) : '', x.freight ? T('ui.report.r.freight', { v: fmt(x.freight) }) : '', x.upkeep ? T('ui.report.r.upkeepPart', { v: fmt(x.upkeep) }) : '', x.lost ? T('ui.report.r.lostPart', { v: fmt(x.lost) }) : ''].filter(Boolean);
    // keep each amount whole: never break between the sign, the $ and the figure
    const sub = esc(firstUp(parts.join('; '))).replace(/(−?\$) (\S+)/g, '<span style="white-space:nowrap">$1\u00a0$2</span>');
    return K.barValue({ title: esc(goodName(x.good)), right: [money(x.net), x.net >= 0.5 ? 'bom' : x.net <= -0.5 ? 'ruim' : ''], f: Math.abs(x.net) / max, color: x.net >= 0 ? '#14875A' : '#C2562B', sub, value: K.seasons(x.bySeason, now) });
  };
  const vis = ord.length > 7 ? [...ord.slice(0, 4), ...ord.slice(-3)] : ord;
  const buys = ord.filter((x) => x.net <= -0.5 && x.materials > 0).map((x) => goodName(x.good));
  const html = K.tiles([{ v: money(total), r: T('ui.report.r.total') }, { v: `−$ ${fmt(upkeep)}`, r: T('ui.report.r.upkeep') }, { v: fmt(lost), r: T('ui.report.r.lost', { value: fmt(lostValue) }), bad: lostValue > Math.abs(total) * 0.25 }])
    + `<div style="margin-top:8px">${vis.map(line).join('')}</div>`
    + (ord.length > vis.length ? K.actions([{ id: 'verRet', text: T('ui.report.seeAll', { n: ord.length }) }]) : '')
    + (buys.length ? K.note(esc(T(buys.length > 1 ? 'ui.report.r.buysN' : 'ui.report.r.buys', { list: buys.join(', ') })), 'neutra') : '');
  return { html, all: ord };
}

/** "Rentabilidade do patrimônio": each kind of building with a verdict, from most to least worth it. */
const VERDICT_COLOR: Record<AssetVerdict, string> = { worth: '#14875A', limit: '#2F5AA8', outlet: '#A67C12', people: '#8A5BB5', not: '#C2562B' };
const VERDICT_ORDER: AssetVerdict[] = ['worth', 'limit', 'outlet', 'people', 'not'];
let assetCache: { t: number; n: number; list: AssetReturn[] } | null = null;
const perYear = (v: number) => T('ui.perYear', { value: `${v < 0 ? '−' : '+'}$ ${fmt(Math.abs(v))}` });
function sortedAssets(list: AssetReturn[]): AssetReturn[] {
  return list.slice().sort((a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict) || b.next - a.next);
}
function assetsBlock(list: AssetReturn[]): string {
  if (!list.length) return K.empty(T('ui.report.nothingYet'));
  const count: Partial<Record<AssetVerdict, number>> = {};
  for (const p of list) count[p.verdict] = (count[p.verdict] ?? 0) + 1;
  const order = VERDICT_ORDER.filter((v) => count[v]);
  const strip = `<div class="fatias">${order.map((v) => `<i style="flex:${count[v]};background:${VERDICT_COLOR[v]}"></i>`).join('')}</div>` + K.legend(order.map((v) => [VERDICT_COLOR[v], esc(T('ui.report.assetCount', { label: T(`ui.report.asset.${v}`), n: count[v] as number }))]));
  const ord = sortedAssets(list), shown = ord.length > 6 ? [...ord.slice(0, 3), ...ord.slice(-3)] : ord, max = Math.max(50, ...list.map((p) => Math.abs(p.next)));
  const sub = (p: AssetReturn) => (p.noTeam ? T('ui.report.noTeam', { n: p.noTeam }) : p.noLot ? T('ui.report.noLot') : Math.abs(p.last - p.next) > 40 ? T('ui.report.oneMoreLast', { value: `${p.last < 0 ? '−' : '+'}$ ${fmt(Math.abs(p.last))}` }) : T('ui.report.oneMore'));
  return strip + `<div style="margin-top:8px">${shown.map((p) => K.barValue({ title: esc(`${T(`building.${p.type}.plural`)} (${p.n})`), right: [T(`ui.report.asset.${p.verdict}`), p.verdict === 'worth' ? 'bom' : p.verdict === 'not' ? 'ruim' : ''], f: Math.abs(p.next) / max, color: VERDICT_COLOR[p.verdict], value: perYear(p.next), sub: esc(sub(p)), attrs: `data-patr="${list.indexOf(p)}"` })).join('')}</div>`
    + (ord.length > shown.length ? K.actions([{ id: 'verPat', text: T('ui.report.seeAll', { n: ord.length }) }]) : '');
}
function openAsset(p: AssetReturn): void {
  const L: string[] = [];
  if (p.goods) L.push(K.row(T('ui.report.a.produced'), fmt(p.goods.produced)), K.row(T('ui.report.a.soldHere'), fmt(p.goods.soldHere)), K.row(T('ui.report.a.exported'), fmt(p.goods.exported)), K.row(T('ui.report.a.lost'), fmt(p.goods.lost), p.goods.lost > p.goods.produced * 0.3 ? 'menos' : ''), K.row(T('ui.report.a.income'), `$ ${fmt(p.goods.income)}`));
  L.push(K.row(T('ui.report.a.upkeep'), T('ui.perYear', { value: `$ ${fmt(p.upkeep)}` })), K.row(T('ui.report.a.jobs'), fmt(p.jobs)));
  if (p.noTeam) L.push(K.row(T('ui.report.a.noTeam'), fmt(p.noTeam), 'menos'));
  const intro = p.verdict === 'people' ? T('ui.report.assetPeople') : p.verdict === 'outlet' ? T('ui.report.assetOutlet') : '';
  const pop = popup(esc(T(`building.${p.type}.plural`)), esc(intro), K.rows(L) + (p.verdict === 'outlet' ? K.actions([{ id: 'patTr', text: T('ui.report.seeTransport') }]) : ''));
  const b = pop.querySelector<HTMLElement>('#patTr');
  if (b) b.onclick = () => { closePopup(); hooks2.openTransport(); };
}

/** "Contas da estação": the largest income and expense, how satisfaction moved and the year's change. */
function seasonSummary(r: SeasonReport, list: SeasonReport[], i: number): string {
  const c = r.cash, L: string[] = [];
  const ins = ([['ui.report.grant', c.grant], ['ui.report.taxes', c.taxes], ['ui.report.instalments', r.instalments ?? 0], ['ui.report.share', c.share], ['ui.report.tariffs', c.tariffs ?? 0]] as [string, number][]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
  const outs = ([['ui.report.works', c.works], ['ui.report.upkeep', c.upkeep], ['ui.report.arrivals', c.arrivals], ['ui.report.wages', c.wages], ['ui.report.relief', c.relief], ['ui.report.fleet', c.fleet], ['ui.report.agent', c.agent], ['ui.report.greatWorks', c.greatWorks]] as [string, number][]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1])[0];
  if (ins && outs) L.push(T('ui.report.biggest', { a: lower(T(ins[0])), x: fmt(ins[1]), b: lower(T(outs[0])), y: fmt(outs[1]) }));
  const ds = Math.round(r.satisfaction.after) - Math.round(r.satisfaction.before);
  if (ds) L.push(T(ds > 0 ? 'ui.report.satUp' : 'ui.report.satDown', { n: Math.abs(ds) }));
  const ago = list[i - 4];
  if (ago) { const dl = r.summary.lost - ago.summary.lost; L.push(T('ui.report.yearAgo', { income: signedMoney(r.summary.income - ago.summary.income), lost: `${dl > 0 ? '+' : dl < 0 ? '−' : ''}${fmt(Math.abs(dl))}` })); }
  return L.join(' ');
}

function openReportAt(i: number): void {
  const g = store.session(), list = g.s.reports as SeasonReport[], r = list[i];
  if (!r) return;
  const latest = i === list.length - 1, prev = list[i - 1];
  const notes: string[] = [];
  if (r.goal?.levelUp) {
    const unl = (LEVEL_UNLOCKS[r.goal.levelUp] ?? []).map((t) => T(`building.${t}`)).join(', ');
    notes.push(K.note(`${esc(T('ui.report.levelUp', { n: r.goal.levelUp }))}${r.goal.milestone ? ` ${esc(T('ui.report.nowIs', { milestone: r.goal.milestone }))}` : ''}${unl ? ` ${esc(T('ui.report.unlocked', { list: unl }))}` : ''}`));
  }
  if (r.goal?.missed) notes.push(K.note(esc(T('ui.report.missed', { milestone: r.goal.missed })), 'ruim'));
  if (r.province) notes.push(K.note(esc([T(`ui.province.factor.${r.province.factor > 1 ? 'up' : r.province.factor < 1 ? 'down' : 'same'}`), ...r.province.reasons.map((x) => T(`ui.province.${x.reason}`, x.params))].join(' ')), r.province.factor < 1 ? 'ruim' : r.province.factor > 1 ? '' : 'neutra'));
  for (const n of r.news) notes.push(K.note(esc(T(n.key, { advisor: g.meta.advisor, colony: g.meta.colony, ...n.params })), 'neutra'));
  const homes = Object.values(r.invested.homes).reduce((x, y) => x + (y ?? 0), 0), fam: string[] = [];
  if (homes) fam.push(plural('ui.report.homesImproved', homes));
  if (r.invested.fields) fam.push(plural('ui.report.fieldsImproved', r.invested.fields));
  if (fam.length) notes.push(K.note(esc(T('ui.report.families', { list: fam.join(', ') })), 'neutra'));
  const satBefore = prev ? prev.satisfaction.after : r.satisfaction.before, satD = r.satisfaction.after - satBefore;
  const cashD = r.cash.after - r.cash.before;
  const c = r.cash, inMoney = c.taxes + c.grant + c.share + (c.tariffs ?? 0) + (r.instalments ?? 0), outMoney = c.upkeep + c.wages + c.relief + c.works + c.greatWorks + c.agent + c.fleet + c.arrivals;
  const idle = r.summary.families - r.summary.employed;
  const cards = [K.card({ title: T('ui.report.cash'), sub: esc(T('ui.report.inOut', { in: fmt(inMoney), out: fmt(outMoney) })), right: `$ ${fmt(r.cash.after)}${arrow(cashD)}`, rightSub: signedMoney(cashD), tone: cashD < 0 ? 'ruim' : '', attrs: 'data-contas="1"' })];
  if (latest) {
    const G = store.economy().transport.gateways, cap = G.reduce((x, p) => x + p.perYear, 0), vol = G.reduce((x, p) => x + p.volume, 0), f = cap ? vol / cap : 0;
    cards.push(K.card({ title: T('ui.report.outlet'), sub: esc(cap ? T('ui.report.outletSub', { vol: fmt(vol), cap: fmt(cap) }) : T('ui.report.noOutlet')), right: cap ? `${Math.round(f * 100)}%` : '-', rightSub: T('ui.report.inUse'), tone: f >= 0.85 ? 'ruim' : '', attrs: 'data-escoa="1"' }));
  }
  const ret = returnsBlock(r);
  const fresh = assetCache && assetCache.t === g.s.market.t && assetCache.n === Object.keys(g.s.map.buildings).length ? assetCache.list : null;
  const body = K.tiles([
    { v: `${idle}/${r.summary.families}`, r: T('ui.report.idle'), bad: idle > r.summary.families * 0.4 },
    { v: `${Math.round(r.satisfaction.after)}${arrow(satD)}`, r: T('ui.report.satWas', { n: Math.round(satBefore) }) },
    { v: `$ ${fmt(r.summary.income)}`, r: T('ui.report.income') },
  ])
    + K.cards(cards)
    + notes.join('')
    + K.section(T('ui.report.evolution'), 'evolution') + evolutionBlock(r.t, latest)
    + K.section(T('ui.report.decisions'), 'decisions') + decisionsBlock(r, g)
    + (latest ? K.section(T('ui.report.assets'), 'assets') + `<div id="patBox">${fresh ? assetsBlock(fresh) : K.empty(T('ui.report.computing'))}</div>` : '')
    + K.section(T('ui.report.returns'), 'returns') + ret.html;
  const nav = `${i > 0 ? `<button type="button" class="nav" data-ir="${i - 1}" aria-label="${esc(T('ui.report.prev'))}">‹</button>` : ''}${i < list.length - 1 ? `<button type="button" class="nav" data-ir="${i + 1}" aria-label="${esc(T('ui.report.next'))}">›</button>` : ''}`;
  const p = screen({ id: 'report', title: T('ui.report.title'), sub: dateOf(r.t), body, nav, tab: String(i) });
  p.querySelectorAll<HTMLElement>('[data-ir]').forEach((b) => { b.onclick = () => openReportAt(Number(b.dataset.ir)); });
  const be = p.querySelector<HTMLElement>('[data-escoa]');
  if (be) be.onclick = () => hooks2.openTransport();
  const vr = p.querySelector<HTMLElement>('#verRet');
  if (vr) vr.onclick = () => popup(esc(T('ui.report.returns')), '', K.rows(ret.all.map((x) => K.row(esc(goodName(x.good)), `${x.net < 0 ? '−' : '+'}$ ${fmt(Math.abs(x.net))}`, x.net >= 0.5 ? 'mais' : x.net <= -0.5 ? 'menos' : ''))));
  const bc = p.querySelector<HTMLElement>('[data-contas]');
  if (bc) bc.onclick = () => {
    const L: string[] = [];
    const plus = (k: string, v: number) => { if (v) L.push(K.row(T(k), `+$ ${fmt(v)}`, 'mais')); };
    const minus = (k: string, v: number) => { if (v) L.push(K.row(T(k), `−$ ${fmt(v)}`, 'menos')); };
    if (c.taxes) plus('ui.report.taxes', c.taxes);
    else { const next = r.passed.taxes.reduce((x, t) => x + Math.max(0, t.revenue), 0); if (next) L.push(K.row(T('ui.report.taxes'), esc(T('ui.report.taxesNext', { value: fmt(next / 4) })))); }
    plus('ui.report.grant', c.grant); plus('ui.report.share', c.share); plus('ui.report.tariffs', c.tariffs ?? 0); plus('ui.report.instalments', r.instalments ?? 0);
    minus('ui.report.wages', c.wages); minus('ui.report.relief', c.relief); minus('ui.report.arrivals', c.arrivals); minus('ui.report.upkeep', c.upkeep); minus('ui.report.fleet', c.fleet); minus('ui.report.agent', c.agent); minus('ui.report.greatWorks', c.greatWorks); minus('ui.report.works', c.works);
    popup(esc(T('ui.report.accountsTitle')), esc(seasonSummary(r, list, i)), K.rows(L));
  };
  const wire = (lp: AssetReturn[]) => {
    p.querySelectorAll<HTMLElement>('[data-patr]').forEach((b) => { b.onclick = () => openAsset(lp[Number(b.dataset.patr)] as AssetReturn); });
    const vp = p.querySelector<HTMLElement>('#verPat');
    if (vp) vp.onclick = () => popup(esc(T('ui.report.assets')), '', K.rows(sortedAssets(lp).map((x) => K.row(esc(`${T(`building.${x.type}.plural`)} (${x.n})`), perYear(x.next), x.verdict === 'worth' ? 'mais' : x.verdict === 'not' ? 'menos' : ''))));
  };
  // the assets cost two economies per kind of building, so they come in after the page has opened
  if (latest) {
    if (fresh) wire(fresh);
    else setTimeout(() => {
      const box = p.querySelector<HTMLElement>('#patBox');
      if (!box || !box.isConnected) return;
      const lp = assetReturns(g.s, g.w, store.economy());
      assetCache = { t: g.s.market.t, n: Object.keys(g.s.map.buildings).length, list: lp };
      box.innerHTML = assetsBlock(lp);
      wire(lp);
    }, 30);
  }
  api.Sons?.toca?.('aba');
}
