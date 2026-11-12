// The panels behind the bottom bar and the header: Colônia, Governo (with its detail tabs), Transporte,
// Nível, Economia and a district's numbers. Same markup and pieces as the prototype's dashboards.
import { BALANCE, BUILDING_IDS, GOOD_IDS, GREAT_WORKS, GREAT_WORK_IDS, LAWS, LEVELS, LEVEL_UNLOCKS, MILESTONES, PATH_CHOICES, type BuildingId, type GoodId, type GreatWorkId } from '@assunguy/data';
import {
  AGENT_COST, allocate, arrivalChance, cityRisks, costOf, currentPrice, def, good, emptySlots, fame, goalPace, lawSlots, levelRequirements, milestoneGaps,
  askProvince, districtFixSteps, splitAdvice, proposeTax, setAgent, setGreatWork, taxEffect, toggleLaw, upkeepPerSeason, wasteShare, seasonOf, yearOf, districtsUnlocked, rivalCost, nextAdvance, raceTime,
  type DistrictAccount, type Fix, type GameState, type GoalItem, type LotKey, type TaxId, type SeriesPoint, type SeasonReport,
} from '@assunguy/sim';
import * as store from '../store';
import { T, goodName, num, pct } from '../i18n';
import { api, hooks, PT } from '../view';
import { K, esc, fmt, confirm, hint, signedMoney, ico, sheetWith, popup, closePopup } from './kit';
import { refresh } from './app';
import { screen, closeScreen, hooks2 } from './report';
import { adviceCard } from './advisor';

const COLORS = ['#23407A', '#14875A', '#A67C12', '#C2562B', '#8A5BB5', '#2F7F8A'];
const short = (t: number) => `${T(`season.${seasonOf(t)}`).charAt(0)}${yearOf(t)}`;
const dash = (title: string, go: string, label: string, note: string, graph: string) => `<div class="dsec"><h3 class="k-sec"><span>${esc(title)}</span></h3>${go ? `<button type="button" class="ver" data-det="${go}">${esc(label)} ›</button>` : ''}</div>${note}${graph}`;
const wireDetails = (p: HTMLElement) => p.querySelectorAll<HTMLElement>('[data-det]').forEach((b) => { b.onclick = () => { const [what, tab] = (b.dataset.det as string).split(':'); DETAIL[what as string]?.(tab); }; });
const DETAIL: Record<string, (tab?: string) => void> = {
  economy: (t) => openEconomy(t), direction: (t) => openDirection(t), transport: () => openTransport(), level: () => openLevel(), districts: () => openDistricts(),
};

// ---- Colônia

export function openColony(): void {
  const { s } = store.session(), c = store.economy(), a = allocate(s), fams = Object.keys(s.families).length;
  const workers = Object.values(a.byBuilding).flatMap((p) => p.families);
  const yieldPct = workers.length ? Math.round((Object.values(a.byBuilding).reduce((x, p) => x + p.efficiency * p.families.length, 0) / workers.length) * 100) : 0;
  let body = K.tiles([{ v: fmt(fams), r: T('ui.colony.families') }, { v: fmt(a.idle.length), r: T('ui.colony.idle'), bad: a.idle.length > fams * 0.25 }, { v: `${yieldPct}%`, r: T('ui.colony.yield') }]);
  // what happens to the production
  const waste = Math.round(wasteShare(c) * 100);
  const parts = [{ name: T('ui.colony.soldHere'), value: c.marketTotal, color: COLORS[1]! }, { name: T('ui.colony.exported'), value: c.exportedTotal, color: COLORS[0]! }, { name: T('ui.colony.ownTable'), value: c.ownTableTotal, color: COLORS[2]! }, { name: T('ui.colony.lost'), value: c.lostTotal, color: COLORS[3]! }];
  const top = GOOD_IDS.filter((g) => c.produced[g] > 0.5).sort((x, y) => c.produced[y] * currentPrice(s.market, y) - c.produced[x] * currentPrice(s.market, x)).slice(0, 3);
  body += dash(T('ui.colony.resources'), 'economy:goods', T('ui.colony.resources'), K.note(esc(T('ui.colony.resourcesNote', { income: fmt(c.incomeTotal), waste, limit: 20 })), waste > 20 ? 'ruim' : 'neutra'), K.pie({ parts, centre: `${waste}%`, centreSub: T('ui.colony.lostShort') }))
    + (top.length ? K.cards(top.map((g) => K.card({ ic: icon(g), title: goodName(g), sub: T('ui.arrobasYear', { n: fmt(c.produced[g]) }), right: `$ ${num(currentPrice(s.market, g), 1)}`, rightSub: trend(s, g), attrs: 'data-det="economy:goods"' }))) : '');
  if (districtsUnlocked(s)) {
    const D = store.districts();
    if (D.info.length) body += dash(T('ui.colony.districts'), 'districts:', T('ui.colony.districts'), K.note(esc(D.info.length === 1 ? T('ui.district.single') : T('ui.colony.districtsNote', { n: D.info.length })), 'neutra'), K.rows(store.accounts().slice(0, 6).map((a) => K.row(esc(districtName(a.name)), esc(T('ui.district.listSub', { families: a.families, idle: a.idle })), a.idle > a.families * 0.3 ? 'menos' : ''))));
  }
  const ser = (s.series ?? []).slice(-12) as SeriesPoint[];
  if (ser.length >= 2) body += dash(T('ui.colony.familiesTitle'), '', '', K.note(esc(T('ui.colony.idleNote', { n: ser.length ? Math.round(((ser.at(-1)!.idle) / Math.max(1, ser.at(-1)!.families)) * 100) : 0 })), 'neutra'), K.chart({ labels: ser.map((p) => short(p.t)), series: [{ name: T('ui.colony.inColony'), color: COLORS[0]!, values: ser.map((p) => p.families) }, { name: T('ui.colony.idle'), color: COLORS[3]!, values: ser.map((p) => p.idle) }] }));
  const fm = fame(s, store.ratings().mean), free = emptySlots(s).length;
  body += dash(T('ui.colony.immigration'), 'direction:immigration', T('ui.colony.immigration'), K.note(esc(free < 2 ? T('ui.colony.noRoom') : T('ui.colony.groups', { n: Math.round(8 * fm.total), chance: Math.round(arrivalChance(s, store.ratings().mean) * 100), free })), free < 2 ? 'ruim' : 'neutra'), K.rows([K.row(T('ui.colony.fame'), `×${num(fm.total, 2)}`)]));
  const SECT: [string, string][] = [['farming', '#14875A'], ['river', '#2F5AA8'], ['commerce', '#A67C12'], ['crafts', '#8A5BB5'], ['mining', '#6B7A8F'], ['services', '#9DA9B8']];
  const sp = SECT.filter(([k]) => (a.bySector as Record<string, { filled: number }>)[k]?.filled).map(([k, col]) => ({ name: T(`ui.sector.${k}`), color: col, value: (a.bySector as Record<string, { filled: number }>)[k]!.filled }));
  sp.push({ name: T('ui.colony.idle'), color: '#C2562B', value: a.idle.length });
  const open = Object.values(a.bySector).reduce((x, w) => x + Math.max(0, w.slots - w.filled), 0);
  body += dash(T('ui.colony.where'), '', '', K.note(esc(open ? T('ui.colony.openJobs', { n: open }) : T('ui.colony.noJobs', { n: a.idle.length })), open || !a.idle.length ? 'neutra' : 'ruim'), K.pie({ parts: sp, centre: `${fams ? Math.round((a.idle.length / fams) * 100) : 0}%`, centreSub: T('ui.colony.idleShort') }));
  const p = screen({ id: 'colony', title: T('ui.bar.colony'), sub: T('ui.colony.sub'), body, button: 'bColonia' });
  wireDetails(p);
}
const icon = (g: GoodId) => { const d = (api.ICONES as Record<string, string> | undefined)?.[PT.good[g] ?? g]; return d ? `<svg viewBox="0 0 512 512" aria-hidden="true"><path d="${d}"/></svg>` : ''; };
function trend(s: GameState, g: GoodId): string {
  const h = (s.market.history as Partial<Record<GoodId, number[]>>)[g];
  if (!h || h.length < 5) return '';
  const now = h[h.length - 1] as number, before = h[h.length - 5] as number, d = now / before - 1;
  return d > 0.04 ? `▲ ${Math.round(d * 100)}%` : d < -0.04 ? `▼ ${Math.round(-d * 100)}%` : '=';
}
const districtName = (n: { key: string; land?: string; n?: number; custom?: string }) => T('ui.districtLabel', { district: JSON.stringify(n) });

// ---- Economia: goods, prices and results

// goods split as in the prototype: raw materials come from fields, herds, the river, the forest or the mine;
// processed goods went through a workshop. Each card shows where the year's arrobas went.
type GoodClass = 'raw' | 'processed';
let goodsClass: GoodClass = 'raw', showMissing = false;
const RECIPE_OF: Partial<Record<GoodId, { t: BuildingId; from: GoodId; level: number }>> = {};
for (const t of BUILDING_IDS) for (const r of def(t).recipes ?? []) if (!RECIPE_OF[r.to as GoodId]) RECIPE_OF[r.to as GoodId] = { t, from: r.from as GoodId, level: Math.max(def(t).minLevel ?? 1, r.minLevel ?? 1) };
const classOf = (g: GoodId): GoodClass => (RECIPE_OF[g] ? 'processed' : 'raw');
/** The first building that makes a good, and the level it opens at. */
function producerOf(s: GameState, g: GoodId): { t: BuildingId; level: number } | null {
  const out: { t: BuildingId; level: number }[] = [];
  for (const t of BUILDING_IDS) {
    const D = def(t);
    if (D.lateGame && !s.race) continue;
    if (D.category === 'retired') continue;
    if (D.output?.good === g || D.extraOutputs?.some((o) => o.good === g)) out.push({ t, level: D.minLevel ?? 1 });
    const r = (D.recipes ?? []).find((x) => x.to === g);
    if (r) out.push({ t, level: Math.max(D.minLevel ?? 1, r.minLevel ?? 1) });
  }
  if (!out.length && good(g).group === 'mining') out.push({ t: 'mine' as BuildingId, level: def('mine' as BuildingId).minLevel ?? 1 });
  return out.sort((x, y) => x.level - y.level)[0] ?? null;
}
const FLOW: [string, string][] = [['ownTable', '#14875A'], ['market', '#2F5AA8'], ['processed', '#5F5144'], ['exported', '#8A5BB5'], ['stock', '#A67C12'], ['lost', '#C2562B']];
function flowOf(c: ReturnType<typeof store.economy>, g: GoodId): Record<string, number> {
  const p = c.produced[g] ?? 0, f: Record<string, number> = { ownTable: c.ownTable[g] ?? 0, market: c.market[g] ?? 0, processed: c.processed[g] ?? 0, exported: c.exported[g] ?? 0, lost: c.lost[g] ?? 0 };
  f.stock = Math.max(0, p - Object.values(f).reduce((x, y) => x + y, 0));
  return f;
}
const flowBar = (f: Record<string, number>, total: number) => `<span class="fluxo" role="img" aria-label="${esc(FLOW.filter(([k]) => (f[k] ?? 0) > 0.5).map(([k]) => `${T(`ui.econ.flow.${k}`)} ${fmt(f[k] ?? 0)}`).join(', '))}">${FLOW.map(([k, col]) => ((f[k] ?? 0) > 0.5 ? `<i style="flex:${((f[k] ?? 0) / Math.max(1, total)).toFixed(4)};background:${col}"></i>` : '')).join('')}</span>`;
const TAG_ICONS: Record<string, string> = {
  0: '<path d="M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 9V4M12 20v-5M9 12H4M20 12h-5M9.9 9.9L6.3 6.3M17.7 17.7l-3.6-3.6M9.9 14.1l-3.6 3.6M17.7 6.3l-3.6 3.6"/>',
  1: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6L7 7M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  2: '<path d="M5 19c9 1 15-5 15-15C10 4 4 9 5 19zM5 19l8-8"/>',
  3: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2"/>',
  year: '<path d="M20 12a8 8 0 1 1-2.4-5.7M20 3v4h-4"/>',
  workshop: '<path d="M14 6l4 4M12 8l-8 8 3 3 8-8M13 5l3-2 5 5-2 3"/>',
  here: '<path d="M4 11l8-7 8 7M6 10v10h12V10"/>',
  exports: '<path d="M3 15h18l-3 5H6zM12 15V4l6 8"/>',
};
const tag = (ic: string, txt: string) => `<span class="tag">${ico(TAG_ICONS[ic] ?? '')}${esc(txt)}</span>`;
function tagsOf(s: GameState, g: GoodId): string {
  const L: string[] = [], r = RECIPE_OF[g], exports = good(g).exportPrice > 0;
  if (r) L.push(tag('workshop', T('ui.econ.tagMade', { item: goodName(r.from).toLowerCase(), place: T(`building.${r.t}`).toLowerCase() })));
  else {
    const pr = producerOf(s, g), season = pr ? def(pr.t).output?.season : undefined;
    L.push(typeof season === 'number' ? tag(String(season), T('ui.econ.tagHarvest', { season: T(`season.${season}`).toLowerCase() })) : tag('year', T('ui.econ.tagYear')));
  }
  L.push(exports ? tag('exports', T('ui.econ.tagExports')) : tag('here', T('ui.econ.tagLocal')));
  return `<span class="tags">${L.join('')}</span>`;
}
const priceSub = (s: GameState, g: GoodId) => `${T(good(g).exportPrice > 0 ? 'ui.econ.priceExport' : 'ui.econ.priceHere')} ${trend(s, g)}`.trim();

export function openEconomy(tab = 'goods'): void {
  const { s } = store.session(), c = store.economy();
  const tabs: [string, string][] = [['goods', T('ui.econ.goods')], ['income', T('ui.econ.income')]];
  let body = '';
  if (tab === 'goods') {
    const made = GOOD_IDS.filter((g) => (c.produced[g] ?? 0) > 0.5);
    const missing = GOOD_IDS.filter((g) => (c.produced[g] ?? 0) <= 0.5 && producerOf(s, g));
    const ofClass = made.filter((g) => classOf(g) === goodsClass).sort((x, y) => (c.produced[y] ?? 0) - (c.produced[x] ?? 0));
    const missingOfClass = missing.filter((g) => classOf(g) === goodsClass).sort((x, y) => (producerOf(s, x)!.level - producerOf(s, y)!.level) || currentPrice(s.market, y) - currentPrice(s.market, x));
    const card = (g: GoodId) => { const f = flowOf(c, g), lost = f.lost ?? 0; return K.card({ ic: icon(g), title: goodName(g), sub: T('ui.arrobasYear', { n: fmt(c.produced[g] ?? 0) }), right: `$ ${num(currentPrice(s.market, g), 1)}`, rightSub: priceSub(s, g), tone: lost > (c.produced[g] ?? 0) * 0.2 ? 'ruim' : '', attrs: `data-good="${g}"`, body: tagsOf(s, g) + flowBar(f, c.produced[g] ?? 1) }); };
    const missingCard = (g: GoodId) => { const pr = producerOf(s, g)!; return K.card({ ic: icon(g), title: goodName(g), dim: true, sub: pr.level <= s.level ? T('ui.econ.buildFor', { building: T(`building.${pr.t}`), cost: fmt(costOf(pr.t, s.milestone)) }) : T('ui.econ.atLevel', { building: T(`building.${pr.t}`), n: pr.level }), right: `$ ${num(currentPrice(s.market, g), 1)}`, rightSub: priceSub(s, g), attrs: `data-good="${g}"`, body: tagsOf(s, g) }); };
    const section = (name: string, f: (g: GoodId) => boolean) => { const a = ofClass.filter(f).map(card), b = showMissing ? missingOfClass.filter(f).map(missingCard) : []; return a.length || b.length ? K.section(name) + K.cards([...a, ...b]) : ''; };
    const ser = (s.series ?? []) as SeriesPoint[], before = ser.length >= 5 ? ser[ser.length - 5] : undefined;
    const arrow = before && before.sales ? (() => { const v = Math.round((c.salesTotal / before.sales - 1) * 100); return ` ${v > 0 ? '▲' : v < 0 ? '▼' : '='} ${Math.abs(v)}%`; })() : '';
    body = K.tiles([{ v: `$ ${fmt(c.salesTotal)}`, r: T('ui.econ.salesYear') + arrow }, { v: fmt(c.producedTotal), r: T('ui.econ.producedYear') }, { v: fmt(c.marketTotal + c.exportedTotal), r: T('ui.econ.soldYear') }])
      + K.section(T('ui.econ.goods'), 'resources')
      + K.chips([['raw', T('ui.econ.raw')], ['processed', T('ui.econ.processed')]], goodsClass, 'classe')
      + K.toggle('verFut', T('ui.econ.showMissing', { n: missingOfClass.length }), showMissing)
      + section(T('ui.econ.food'), (g) => !!good(g).food) + section(T('ui.econ.other'), (g) => !good(g).food)
      + (ofClass.length || (showMissing && missingOfClass.length) ? '' : K.empty(T(showMissing ? 'ui.econ.nothing' : 'ui.econ.noneHere')))
      + K.legend(FLOW.map(([k, col]) => [col, T(`ui.econ.flow.${k}`)] as [string, string]));
  } else {
    const ser = (s.series ?? []).slice(-12) as SeriesPoint[];
    body = K.tiles([{ v: `$ ${fmt(c.incomeTotal)}`, r: T('ui.econ.incomeYear') }, { v: `$ ${fmt(c.salesTotal)}`, r: T('ui.econ.sales') }, { v: `${Math.round(wasteShare(c) * 100)}%`, r: T('ui.econ.waste'), bad: wasteShare(c) > 0.2 }])
      + (ser.length >= 2 ? K.section(T('ui.econ.evolution'), 'evolution') + K.chart({ labels: ser.map((p) => short(p.t)), series: [{ name: T('ui.econ.sales'), color: COLORS[0]!, values: ser.map((p) => p.sales) }, { name: T('ui.econ.produced'), color: COLORS[1]!, values: ser.map((p) => p.produced) }], unit: '' }) : '');
  }
  const p = screen({ id: 'economy', title: T('ui.econ.title'), tabs, tab, body, onTab: openEconomy });
  p.querySelectorAll<HTMLElement>('[data-classe]').forEach((b) => { b.onclick = () => { goodsClass = b.dataset.classe as GoodClass; openEconomy('goods'); }; });
  const vf = p.querySelector<HTMLElement>('#verFut');
  if (vf) vf.onclick = () => { showMissing = !showMissing; openEconomy('goods'); };
  p.querySelectorAll<HTMLElement>('[data-good]').forEach((b) => { b.onclick = () => openGood(b.dataset.good as GoodId); });
}
/** One good: its price over the last seasons, where the year's arrobas went, or how to start making it. */
function openGood(g: GoodId): void {
  const { s } = store.session(), c = store.economy(), h = ((s.market.history as Partial<Record<GoodId, number[]>>)[g] ?? []).slice(-12);
  const r = RECIPE_OF[g], exports = good(g).exportPrice > 0;
  let chart = '';
  if (h.length >= 2) {
    const now = h.at(-1) as number, ago = (h.length >= 5 ? h[h.length - 5] : h[0]) as number, lo = Math.min(...h), hi = Math.max(...h);
    const labels = h.map((_, i) => short(s.market.t - (h.length - 1 - i)));
    chart = K.chart({ labels, series: [{ name: T(exports ? 'ui.econ.priceExportLine' : 'ui.econ.priceHereLine'), color: COLORS[0]!, values: h.map((x) => Math.round(x * 10) / 10) }], digits: 1, base: Math.max(0, Math.floor(lo * 0.8 * 2) / 2) })
      + K.rows([K.row(T('ui.econ.today'), `$ ${num(now, 1)}`), K.row(T('ui.econ.yearAgo'), `$ ${num(ago, 1)}`), K.row(T('ui.econ.range'), T('ui.econ.rangeValue', { lo: `$ ${num(lo, 1)}`, hi: `$ ${num(hi, 1)}` }))]);
  }
  const origin = r ? T('ui.econ.madeFrom', { item: goodName(r.from).toLowerCase(), place: T(`building.${r.t}`).toLowerCase() }) : '';
  const text = [origin, exports ? '' : T('ui.econ.localOnly')].filter(Boolean).join(' ');
  if ((c.produced[g] ?? 0) <= 0.5) {
    const pr = producerOf(s, g);
    const how = !pr ? '' : pr.level <= s.level
      ? K.section(T('ui.econ.howTo')) + K.actions([{ kind: 'pri', text: T('ui.econ.build', { place: T(`building.${pr.t}`).toLowerCase() }), attrs: `data-acao='${JSON.stringify({ kind: 'build', building: pr.t })}'` }])
      : K.section(T('ui.econ.howTo')) + K.note(esc(T('ui.econ.unlocks', { item: goodName(g), n: pr.level, place: T(`building.${pr.t}`).toLowerCase(), level: s.level })), 'neutra');
    popup(esc(goodName(g)), esc(text), chart + how);
    return;
  }
  const f = flowOf(c, g);
  popup(esc(goodName(g)), esc(text), chart + K.section(T('ui.econ.where')) + K.rows([K.row(T('ui.econ.supply'), fmt(c.produced[g] ?? 0)), ...FLOW.filter(([k]) => (f[k] ?? 0) > 0.5).map(([k]) => K.row(T(`ui.econ.flow.${k}`), fmt(f[k] ?? 0)))]) + K.actions([{ text: T('ui.close'), attrs: 'data-fecha-pop' }]));
  document.querySelector<HTMLElement>('#infoPop [data-fecha-pop]')?.addEventListener('click', () => closePopup());
}
hooks2.openEconomy = () => openEconomy();
hooks2.openTransport = () => openTransport();

// ---- Governo

function yearly(s: GameState) {
  const c = store.economy(), m = MILESTONES[s.milestone]!;
  const taxes = c.revenue.total, grant = m.grant * 4 * (s.grantFactor || 1), share = c.incomeTotal * (m.shareOfTrade || 0), upkeep = upkeepPerSeason(s) * 4;
  return { taxes, grant, share, upkeep, net: taxes + grant + share - upkeep };
}
const hasCouncil = (s: GameState) => Object.values(s.map.buildings).includes('council');

export function openGovernment(tab?: string): void {
  if (tab) { openDirection(tab); return; }
  const { s } = store.session(), y = yearly(s);
  let body = K.tiles([{ v: `$ ${fmt(s.cash)}`, r: T('ui.gov.cash'), bad: s.cash < 0 }, { v: signedMoney(y.net), r: T('ui.gov.perYear'), bad: y.net < 0 }, { v: s.influence, r: T('ui.gov.influence') }]);
  const reps = (s.reports as SeasonReport[]).slice(-8);
  if (reps.length >= 2) body += dash(T('ui.gov.flow'), '', '', '', K.columns({ parts: [{ name: T('ui.gov.in'), values: reps.map((r) => r.cash.taxes + r.cash.grant + r.cash.share), color: COLORS[1]! }], labels: reps.map((r) => short(r.t - 1)) }) + K.chart({ labels: reps.map((r) => short(r.t - 1)), series: [{ name: T('ui.gov.cash'), color: COLORS[0]!, values: reps.map((r) => r.cash.after) }] }));
  if (s.crisis) body += K.cards([K.card({ title: T(`crisis.${s.crisis.id}`), sub: T('ui.gov.crisisOn'), right: s.crisis.seasonsLeft, rightSub: T('ui.seasons'), tone: 'ruim' })]);
  const card = (title: string, right: string | number, sub: string, tone: string, inner: string, det: string) => K.card({ title, right, rightSub: sub, tone, body: inner, attrs: `data-det="direction:${det}"` });
  const last = (s.reports as SeasonReport[]).filter((r) => r.province).at(-1)?.province;
  const cards = [card(T('ui.gov.province'), last ? T(last.factor > 1 ? 'ui.gov.praise' : last.factor < 1 ? 'ui.gov.charge' : 'ui.gov.noChange') : '-', last ? T('ui.gov.lastReport') : T('ui.gov.firstSoon'), last && last.factor < 1 ? 'ruim' : last && last.factor > 1 ? 'bom' : '', K.rows([K.row(T('ui.gov.grantYear'), `$ ${fmt(y.grant)}`), K.row(T('ui.gov.share'), `$ ${fmt(y.share)}`)]), 'province')];
  if (hasCouncil(s)) cards.push(card(T('ui.gov.taxes'), `$ ${fmt(y.taxes)}`, T('ui.perYearShort'), '', K.rows((['tithe', 'exportDuty', 'businessTax'] as TaxId[]).map((id) => K.row(T(`ui.tax.${id}`), s.taxes[id] ? `${Math.round((s.taxes[id]!.general || 0) * 100)}%` : T('ui.gov.none')))), 'taxes'));
  const going = GREAT_WORK_IDS.find((id) => s.greatWorks[id]?.active && !s.greatWorks[id]?.done), avail = GREAT_WORK_IDS.filter((id) => workOpen(s, id));
  if (going || avail.length) { const g = going ?? avail[0]!, G = GREAT_WORKS[g], st = s.greatWorks[g]; cards.push(card(T('ui.gov.works'), T(`greatWork.${g}`), going ? T('ui.gov.workProgress', { n: st?.paid ?? 0, of: G.seasons }) : T('ui.gov.canStart'), going ? '' : 'bom', going ? K.bar((st?.paid ?? 0) / G.seasons) : '', 'works')); }
  if (hasCouncil(s)) cards.push(card(T('ui.gov.laws'), `${Object.keys(s.laws).length + Object.keys(s.pendingLaws).length}/${lawSlots(s)}`, T('ui.gov.inUse'), '', '', 'laws'));
  if (s.milestone >= 2 || Object.keys(s.families).length >= 120) { const r = cityRisks(s, store.session().w, store.ratings()); const on = [s.problems.epidemic ? T('ui.gov.epidemic') : '', s.problems.disorder ? T('ui.gov.disorder') : ''].filter(Boolean); cards.push(card(T('ui.gov.problems'), on.length || T('ui.gov.noneShort'), on.length ? on.join(', ') : T('ui.gov.underWay'), on.length ? 'ruim' : 'bom', K.rows([K.row(T('ui.gov.epidemicChance'), `${num(r.epidemic * 100, 1)}%`), K.row(T('ui.gov.fireChance'), `${num(r.fire * 100, 1)}%`)]), 'problems')); }
  const ch = chronicled(s).slice(-3).reverse();
  cards.push(card(T('ui.gov.chronicle'), ch.length ? T('ui.yearN', { n: yearOf(ch[0]!.t) }) : '-', T('ui.gov.lastEntry'), '', K.rows(ch.map((x) => K.row(chronicleText(x), T('ui.yearN', { n: yearOf(x.t) })))), 'chronicle'));
  if (s.milestone >= 2) cards.push(card(T('ui.gov.immigration'), s.immigrationAgent ? T('ui.gov.agentOn') : T('ui.gov.agentOff'), T('ui.gov.agent'), '', '', 'immigration'));
  body += K.section(T('ui.gov.section')) + K.cards(cards);
  const p = screen({ id: 'government', title: T('ui.bar.government'), sub: T('ui.gov.sub'), body, button: 'bGoverno' });
  wireDetails(p);
}
const workOpen = (s: GameState, id: GreatWorkId) => { const G = GREAT_WORKS[id] as { milestone?: number; level?: number }; return !s.greatWorks[id]?.done && (G.milestone === undefined || s.milestone >= G.milestone) && (G.level === undefined || s.level >= G.level); };
const chronicleText = (x: { key: string; params?: Record<string, string | number> }) => { const t = T(x.key, x.params); return t.charAt(0).toUpperCase() + t.slice(1); };
const chronicled = (s: GameState) => s.chronicle.filter((x) => T(x.key, x.params).trim());

/** Government detail: province, taxes, laws, great works, immigration, problems, chronicle. */
export function openDirection(tab = 'province'): void {
  const { s, w } = store.session();
  const tabs: [string, string][] = [['province', T('ui.gov.province')], ...(hasCouncil(s) ? [['taxes', T('ui.gov.taxes')], ['laws', T('ui.gov.laws')]] as [string, string][] : []), ['works', T('ui.gov.works')], ...(s.milestone >= 2 ? [['immigration', T('ui.gov.immigration')]] as [string, string][] : []), ['chronicle', T('ui.gov.chronicle')]];
  let body = '';
  if (tab === 'province') {
    const y = yearly(s), last = (s.reports as SeasonReport[]).filter((r) => r.province).at(-1)?.province, pace = goalPace(s, w);
    const timeLocked = s.influence < 6 || !MILESTONES[s.milestone + 1] || !!s.extendedDeadline || s.intervention;
    body = K.rows([K.row(T('ui.gov.grantYear'), `$ ${fmt(y.grant)}`), K.row(T('ui.gov.share'), `$ ${fmt(y.share)}`), K.row(T('ui.gov.upkeepYear'), `−$ ${fmt(y.upkeep)}`, 'menos'), ...(pace ? [K.row(T('ui.gov.pace'), T('ui.gov.paceLine', { done: Math.round(pace.done * 100), time: Math.round(pace.time * 100) }), pace.behind > 0.15 ? 'menos' : '')] : [])])
      + (last ? K.section(T('ui.gov.lastReport')) + K.rows(last.reasons.map((r) => K.row(T(`ui.province.${r.reason}`, r.params), ''))) : '')
      + K.section(T('ui.gov.ask'), 'influence') + K.cards([
        K.card({ title: T('ui.gov.askFunds'), sub: esc(T(s.extraDemand ? 'ui.gov.askFundsSubNow' : 'ui.gov.askFundsSub', { n: s.extraDemand * 5 })), right: 4, rightSub: T('ui.gov.influence'), attrs: `data-pede="extraFunds" ${s.influence < 4 ? 'disabled' : ''}`, dim: s.influence < 4 }),
        K.card({ title: T('ui.gov.askTime'), sub: esc(T(s.extendedDeadline ? 'ui.gov.askTimeDone' : s.intervention ? 'ui.gov.askTimeInspector' : 'ui.gov.askTimeSub')), right: 6, rightSub: T('ui.gov.influence'), attrs: `data-pede="extraTime" ${timeLocked ? 'disabled' : ''}`, dim: timeLocked }),
      ]);
  } else if (tab === 'taxes' && hasCouncil(s)) {
    const eff = taxEffect(s, w);
    body = K.tiles([{ v: `$ ${fmt(store.economy().revenue.total)}`, r: T('ui.gov.taxesYear') }, { v: eff.familiesAtRisk, r: T('ui.gov.atRisk'), bad: eff.familiesAtRisk > 0 }])
      + (['tithe', 'exportDuty', 'businessTax'] as TaxId[]).map((id) => {
        const cur = Math.round(((s.pendingTaxes[id] !== undefined ? s.pendingTaxes[id]?.general : s.taxes[id]?.general) ?? 0) * 100);
        return K.section(T(`ui.tax.${id}`), `tax_${id}`) + K.chips([0, 5, 8, 10, 15, 20].map((v) => [String(v), v ? `${v}%` : T('ui.gov.none')] as [string, string]), String(cur), `tax-${id}`) + (s.pendingTaxes[id] !== undefined ? K.note(esc(T('ui.gov.pending')), 'neutra') : '');
      }).join('');
  } else if (tab === 'laws' && hasCouncil(s)) {
    body = K.note(esc(T('ui.gov.lawSlots', { n: Object.keys(s.laws).length + Object.keys(s.pendingLaws).length, of: lawSlots(s) })), 'neutra')
      + K.cards(Object.keys(LAWS).map((id) => { const on = !!s.laws[id], pend = !!s.pendingLaws[id]; return K.card({ title: T(`law.${id}`), sub: `${T(`law.${id}.gain`)}. ${T(`law.${id}.cost`)}`, right: on ? T('ui.gov.inForce') : pend ? T('ui.gov.next') : '', tone: on ? 'bom' : '', attrs: `data-law="${id}"`, active: on || pend }); }));
  } else if (tab === 'works') {
    body = K.note(esc(T('ui.gov.worksInfo')), 'neutra') + K.cards(GREAT_WORK_IDS.filter((id) => workOpen(s, id) || s.greatWorks[id]?.done).map((id) => {
      const G = GREAT_WORKS[id], st = s.greatWorks[id];
      return K.card({ title: T(`greatWork.${id}`), sub: `${T(`greatWork.${id}.description`)} ${T(`greatWork.${id}.effect`)}`, right: st?.done ? T('ui.gov.done') : `$ ${fmt(G.cost / G.seasons)}`, rightSub: st?.done ? '' : T('ui.gov.perSeasonFor', { n: G.seasons }), body: st?.active && !st.done ? K.bar((st.paid ?? 0) / G.seasons) : '', attrs: st?.done ? undefined : `data-work="${id}"`, active: !!st?.active });
    }));
  } else if (tab === 'immigration') {
    const fm = fame(s, store.ratings().mean);
    body = K.section(T('ui.gov.fame')) + K.rows([K.row(T('ui.gov.fameSize'), `×${num(fm.size, 2)}`), K.row(T('ui.gov.fameMood'), `×${num(fm.mood, 2)}`), ...(fm.agent !== 1 ? [K.row(T('ui.gov.agent'), `×${num(fm.agent, 2)}`)] : []), ...(fm.hospital !== 1 ? [K.row(T('greatWork.hospital'), `×${num(fm.hospital, 2)}`)] : []), K.row(T('ui.gov.fameTotal'), `×${num(fm.total, 2)}`)])
      + K.section(T('ui.gov.agent')) + K.rows([K.row(T('ui.build.cost'), T('ui.gov.perSeason', { cost: fmt(AGENT_COST(s)) }))]) + K.actions([{ id: 'agent', kind: s.immigrationAgent ? 'per' : 'pri', text: T(s.immigrationAgent ? 'ui.gov.fireAgent' : 'ui.gov.hireAgent') }]);
  } else if (tab === 'problems') {
    const r = cityRisks(s, w, store.ratings());
    body = K.rows([K.row(T('ui.gov.epidemicChance'), `${num(r.epidemic * 100, 1)}%`, r.epidemic >= 0.015 ? 'menos' : ''), K.row(T('ui.gov.noWater'), `${r.noWater}/${r.homes}`), K.row(T('ui.gov.fireChance'), `${num(r.fire * 100, 1)}%`, r.fire >= 0.012 ? 'menos' : ''), K.row(T('ui.gov.woodHomes'), r.inGroups), K.row(T('ui.gov.disorder'), s.problems.disorder ? T('ui.gov.underWay') : T('ui.gov.noneShort'), s.problems.disorder ? 'menos' : '')]);
  } else {
    body = chronicled(s).length ? K.rows(chronicled(s).slice().reverse().map((x) => K.row(chronicleText(x), T('ui.yearN', { n: yearOf(x.t) })))) : K.empty(T('ui.gov.noChronicle'));
  }
  const p = screen({ id: 'direction', title: T('ui.gov.direction'), tabs, tab, body, onTab: openDirection, button: 'bGoverno' });
  p.querySelectorAll<HTMLElement>('[data-pede]').forEach((b) => {
    const req = b.dataset.pede as 'extraFunds' | 'extraTime';
    b.onclick = () => confirm(T(`ui.advisor.province.${req}`), [K.row(T(`ui.advisor.province.${req}.effect`), '')], T('ui.advisor.ask'), () => { if (store.run((x) => askProvince(x, req))) { refresh(); openDirection('province'); hint(T('ui.advisor.asked'), 2600); } });
  });
  p.querySelectorAll<HTMLElement>('[data-law]').forEach((b) => { b.onclick = () => { if (store.run((x, y) => toggleLaw(x, y, b.dataset.law as string))) { refresh(); openDirection('laws'); } }; });
  p.querySelectorAll<HTMLElement>('[data-work]').forEach((b) => { b.onclick = () => { const id = b.dataset.work as GreatWorkId, on = !s.greatWorks[id]?.active, G = GREAT_WORKS[id]; confirm(T(on ? 'ui.gov.startWork' : 'ui.gov.stopWork', { work: id }), on ? [K.row(T('ui.gov.instalment'), `$ ${fmt(G.cost / G.seasons)}`), K.row(T('ui.seasons'), G.seasons)] : [], T(on ? 'ui.gov.start' : 'ui.gov.stop'), () => { if (store.run((x) => setGreatWork(x, id, on))) { refresh(); openDirection('works'); } }); }; });
  (['tithe', 'exportDuty', 'businessTax'] as TaxId[]).forEach((id) => p.querySelectorAll<HTMLElement>(`[data-tax-${id}]`).forEach((b) => { b.onclick = () => { const v = Number(b.getAttribute(`data-tax-${id}`)) / 100; if (store.run((x) => proposeTax(x, id, v ? { general: v } : null))) { refresh(); openDirection('taxes'); hint(T('ui.gov.proposed'), 2600); } }; }));
  const ag = p.querySelector<HTMLElement>('#agent');
  if (ag) ag.onclick = () => { if (store.run((x) => setAgent(x, !s.immigrationAgent))) { refresh(); openDirection('immigration'); } };
}

// ---- Transporte

export function openTransport(): void {
  const { s } = store.session(), c = store.economy(), R = c.transport;
  if (s.race) s.flags.sawRace = true;
  const waste = Math.round(wasteShare(c) * 100);
  let body = K.tiles([{ v: `${waste}%`, r: T('ui.tr.waste'), bad: waste > 20 }, { v: fmt(c.exportedTotal), r: T('ui.tr.exported') }, { v: fmt(c.marketTotal), r: T('ui.tr.soldHere') }]);
  const causes = c.lostByGood as unknown as Record<string, Partial<Record<GoodId, number>>>;
  const sum = (k: string) => Object.values(causes[k] ?? {}).reduce<number>((x, y) => x + (y ?? 0), 0);
  const lost = [['carrying', 'onFoot'], ['noGateway', 'noGateway'], ['transport', 'gatewayFull'], ['buyer', 'noBuyer'], ['spoiled', 'spoiled']].map(([k, label]) => [label, sum(k as string)] as [string, number]).filter(([, v]) => v >= 1);
  if (lost.length) body += K.section(T('ui.tr.whereLost')) + K.rows(lost.map(([k, v]) => K.row(T(`ui.outlet.lost.${k}`), T('ui.arrobasYear', { n: fmt(v) }), 'menos')));
  const card = (key: LotKey, sub: string, f: number, tone: string) => K.card({ title: T(`building.${s.map.buildings[key]}`), sub, right: pct(Math.min(1, f)), tone, body: K.bar(f, f >= 0.85 ? '#C2562B' : undefined), attrs: `data-key="${key}"` });
  if (R.gateways.length) body += K.section(T('ui.tr.gateways'), 'gateways') + K.cards(R.gateways.map((g) => card(g.key, T('ui.tr.gatewayLine', { n: fmt(g.capacity), v: Object.values(g.fleet).reduce((x, y) => x + (y ?? 0), 0) }), g.occupancy, g.occupancy >= 0.85 ? 'ruim' : '')));
  if (R.collections.length) body += K.section(T('ui.tr.collections'), 'collections') + K.cards(R.collections.map((g) => card(g.key, T('ui.tr.collectionLine', { n: fmt(g.capacity), v: Object.values(g.fleet).reduce((x, y) => x + (y ?? 0), 0) }), g.peak, g.peak >= 0.9 ? 'ruim' : '')));
  if (R.commerce.length) body += K.section(T('ui.tr.commerce')) + K.cards(R.commerce.filter((x) => x.type).map((x) => K.card({ title: T(`building.${x.type}`), sub: T('ui.tr.commerceLine', { n: fmt(x.in), f: fmt(x.families) }), right: x.linked ? T('ui.tr.linked') : T('ui.tr.noGatewayShort'), tone: x.linked ? 'bom' : 'ruim', attrs: `data-key="${x.key}"` })));
  if (s.race) body = raceBlock(s) + body;
  const p = screen({ id: 'transport', title: T('ui.bar.transport'), sub: T('ui.tr.sub'), body, button: 'bTransp' });
  p.querySelectorAll<HTMLElement>('[data-key]').forEach((b) => { b.onclick = () => { const key = b.dataset.key as LotKey; closeScreen(); const [x, y] = key.split(',').map(Number) as [number, number]; api.vaiPara(x, y); hooks.openBuilding(key); }; });
}

/** The race in one block: each market's rival against our cheapest delivery, the next advance, decline. */
function raceBlock(s: GameState): string {
  const c = store.economy(), R = s.race!, comp = c.transport.competitiveness;
  const cards = (['iguape', 'curitiba', 'paranagua', 'saoPaulo'] as const).map((d) => {
    const costs = c.transport.gateways.filter((g) => g.capacity > 0).flatMap((g) => g.dests.filter((x) => x.d === d).map((x) => x.full));
    const ours = costs.length ? Math.min(...costs) : null, cp = comp[d] ?? 0;
    return K.card({ title: T(`ui.race.dest.${d}`), sub: `${T('ui.race.rival', { cost: num(rivalCost(s, d), 2) })}; ${ours === null ? T('ui.race.none') : T('ui.race.ours', { cost: num(ours, 2) })}`, right: ours === null ? '-' : `${Math.round(cp * 100)}%`, rightSub: T('ui.race.comp'), tone: ours === null ? '' : cp >= 1 ? 'bom' : cp < 0.8 ? 'ruim' : '' });
  });
  const nx = nextAdvance(s), leading = (Object.keys(comp) as (keyof typeof comp)[]).filter((d) => (c.transport.destVolume[d] ?? 0) > 0 && comp[d] >= 1).length;
  const notes = [nx ? K.note(esc(`${T('ui.race.next')}: ${T('ui.race.inSeasons', { n: nx.at - raceTime(s), what: T(`ui.race.advance.${nx.key}`) })}`), 'neutra') : '', R.decline ? K.note(esc(T('ui.race.decline', { n: R.decline.left })), 'ruim') : '', s.level >= 12 && R.winning ? K.note(esc(T('ui.race.winning', { n: R.winning })), 'bom') : K.note(esc(T('ui.race.goal', { n: leading })), 'neutra')].join('');
  return K.section(T('ui.race.title'), 'race') + K.cards(cards) + notes;
}

// ---- Nível: the next level, the next milestone and the path choices

export function openLevel(): void {
  const { s, w } = store.session(), c = store.economy(), n = s.level + 1, next = LEVELS.find((l) => l.level === n);
  const target = MILESTONES[s.milestone + 1], left = s.deadline - s.market.t;
  const item = (g: GoalItem) => K.row(goalLabel(g), g.kind === 'road' ? (g.ok ? T('ui.yes') : T('ui.no')) : `${fmt(g.current)} / ${fmt(g.target)}`, g.ok ? 'mais' : 'menos');
  let body = `<div class="medalha"><b>${s.level}</b><small>${esc(T('ui.level.level'))}</small></div>`;
  if (next) {
    const req = levelRequirements(s, w, n, c);
    body += K.section(T('ui.level.next', { n })) + K.rows(req.map(item));
    const unl = LEVEL_UNLOCKS[n] ?? [];
    if (unl.length) body += K.note(esc(T('ui.level.unlocks', { list: unl.map((t) => T(`building.${t}`)).join(', ') })), 'neutra');
    if (PATH_CHOICES[n]) body += K.note(esc(T('ui.level.choice')), 'neutra');
  } else body += K.note(esc(T('ui.level.top')), 'neutra');
  if (target) {
    const gaps = milestoneGaps(s, w, target);
    body += `<h2 class="meta-t">${esc(T(`milestone.${target.id}`))}</h2><p class="meta-s">${esc(T('ui.level.seasonsLeft', { n: Math.max(0, left) }))}</p>` + K.rows(gaps.map(item));
  }
  const chosen = Object.entries(s.choices);
  if (chosen.length) body += K.section(T('ui.level.paths')) + K.rows(chosen.map(([lv, id]) => K.row(T(`choice.${id}`), T('ui.level.atLevel', { n: lv }))));
  screen({ id: 'level', title: T('ui.level.title'), body });
}
function goalLabel(g: GoalItem): string {
  switch (g.kind) {
    case 'families': return T(BALANCE.milestoneWorkers ? 'ui.goal.workingFamilies' : 'ui.goal.families');
    case 'road': return T('ui.goal.road');
    case 'lands': return T('ui.goal.lands');
    case 'satisfaction': return T('ui.goal.satisfaction');
    case 'building': return T(`building.${g.building}`);
    case 'workers': return T('ui.goal.workers');
    case 'income': return T('ui.goal.income');
  }
}

// ---- districts

export function openDistricts(): void {
  const A = store.accounts();
  const body = (A.length === 1 ? K.note(esc(T('ui.district.single')), 'neutra') : '') + K.cards(A.map((a) => K.card({ title: esc(districtName(a.name)), sub: esc(T('ui.district.listSub', { families: a.families, idle: a.idle })), right: `$ ${fmt(a.income)}`, rightSub: esc(T('ui.perYearShort')), tone: a.idle > a.families * 0.3 ? 'menos' : '', attrs: `data-district="${a.id}"` })));
  screen({ id: 'districts', title: T('ui.colony.districts'), body });
  document.querySelectorAll<HTMLElement>('[data-district]').forEach((b) => { b.onclick = () => openDistrict(b.dataset.district as string); });
}
export function openDistrict(id: string | { id: string }): void {
  // the district as one scope: a dashboard of its numbers, and in each section why what is red happens and one or
  // two ways out (measured after the screen opens)
  const key = typeof id === 'string' ? id : id.id, A = store.accounts(), a = A.find((x) => x.id === key);
  if (!a) return;
  const ay = (n: number) => T('ui.arrobasYear', { n: fmt(n) });
  const idlePct = a.families ? Math.round((a.idle / a.families) * 100) : 0, reach = Math.round(a.reach * 100);
  const tiles = K.tiles([
    { v: a.families, r: T('ui.district.tFamilies') },
    { v: `${idlePct}%`, r: T('ui.district.tIdle'), bad: idlePct > 30 },
    { v: `$ ${fmt(a.income)}`, r: T('ui.district.tIncome') },
    { v: a.satisfaction, r: T('ui.district.tSat'), bad: a.satisfaction < 60 },
    { v: `${reach}%`, r: T('ui.district.tReach'), bad: reach < 85 },
  ]);
  const work = Math.max(0, a.produced - a.ownTable - a.soldHere - a.exported - a.lost);
  const parts = [
    { name: T('ui.district.soldHere'), value: a.soldHere, color: COLORS[1]! }, { name: T('ui.district.exported'), value: a.exported, color: COLORS[0]! },
    { name: T('ui.district.ownTable'), value: a.ownTable, color: COLORS[2]! }, { name: T('ui.district.processed'), value: work, color: '#8A5BB5' },
    { name: T('ui.district.lost'), value: a.lost, color: COLORS[3]! },
  ].filter((x) => x.value > 0);
  const tot = { fam: A.reduce((x, y) => x + y.families, 0), inc: A.reduce((x, y) => x + y.income, 0) };
  const SERV = ['water', 'faith', 'school', 'health', 'commerce'] as const;
  const red = (a.idle > 0 && a.filled >= a.jobs) || reach < 85 || a.satisfaction < 60 || Object.keys(a.missing).length > 0;
  const body = tiles
    + (red ? '' : K.note(esc(T('ui.district.allGood')), 'bom'))
    + K.section(esc(T('ui.district.people'))) + K.rows([
      K.row(esc(T('ui.district.working')), a.working),
      K.row(esc(T('ui.district.idle')), a.idle, a.idle > a.families * 0.3 ? 'menos' : ''),
      K.row(esc(T('ui.district.jobs')), esc(T('ui.district.jobsOf', { filled: a.filled, jobs: a.jobs }))),
    ]) + '<div id="fix-jobs"></div>'
    + (a.homes ? K.section(esc(T('ui.district.services'))) + '<div id="fix-sat"></div>' + K.rows(SERV.map((sv) => { const m = a.missing[sv] ?? 0, f = (a.homes - m) / a.homes; return K.row(esc(T(`service.${sv}`)), `${K.bar(f, f < 0.7 ? '#C2562B' : '#2E6B3E')} ${esc(T('ui.district.covered', { n: a.homes - m, of: a.homes }))}`, f < 0.7 ? 'menos' : ''); })) + '<div id="fix-services"></div>' : '')
    + (a.produced > 0 ? K.section(esc(T('ui.district.whereGoes'))) + K.pie({ parts, centre: fmt(a.produced), centreSub: T('ui.arrobasYearShort') })
      + (a.goods.length ? K.cards(a.goods.map((g) => K.card({ ic: icon(g.good), title: esc(goodName(g.good)), sub: esc(ay(g.produced)), right: `$ ${fmt(g.income)}`, rightSub: esc(T('ui.perYearShort')) }))) : '') : '')
    + K.section(esc(T('ui.district.outlet'))) + K.rows([
      K.row(esc(T('ui.district.reach')), `${reach}%`, reach < 85 ? 'menos' : ''),
      K.row(esc(T('ui.district.lostOnFoot')), esc(ay(a.onFoot)), a.onFoot > 20 ? 'menos' : ''),
      K.row(esc(T('ui.district.upkeep')), `$ ${fmt(a.upkeep)}`),
      K.row(esc(T('ui.district.inColony')), esc(T('ui.district.inColonyValue', { families: tot.fam ? Math.round((a.families / tot.fam) * 100) : 0, income: tot.inc ? Math.round((a.income / tot.inc) * 100) : 0 }))),
    ]) + '<div id="fix-outlet"></div><div id="fix-more"></div>';
  const p = screen({ id: `district:${key}`, title: districtName(a.name), sub: T('ui.district.sub', { homes: a.homes, buildings: a.buildings }), body });
  startFixes(p, a);
}

// ---- why each red number happens and the ways out, measured a few steps per frame after the screen opens

let fixRun = 0;
// an option: what to do and what it brings, with the button beside it
const fixCard = (title: string, sub: string, action: unknown) => `<div class="cartao fix-op"><div><b>${esc(title)}</b><small>${esc(sub)}</small></div>${K.go(T('ui.do'), action, 'pri')}</div>`;
const bname = (t: BuildingId, n = 1) => T(n > 1 ? `building.${t}.plural` : `building.${t}`);
function fixCards(list: Fix[]): string {
  return `<div class="fix-ops">${list.map((f) => {
    const act = f.action as { kind: string };
    if (f.advice) { const p = { at: f.advice.params.key ?? '', ...f.advice.params, advisor: store.session().meta.advisor }; return fixCard(T(`advice.${f.advice.rule}.title`, p), T(`advice.${f.advice.rule}.body`, p), f.action); }
    const t = f.building as BuildingId, eff = f.jobs ? T('ui.fix.jobsEffect', { jobs: f.jobs, gain: signedMoney(f.gain ?? 0), cost: fmt(f.cost) }) : T('ui.fix.gainEffect', { gain: signedMoney(f.gain ?? 0), cost: fmt(f.cost) });
    if (act.kind === 'buildLots') return fixCard(T('ui.fix.lots', { n: f.n ?? 1, what: bname(t, f.n) }), eff, f.action);
    const up = act.kind === 'select' && (f.action as { upgrade?: boolean }).upgrade;
    if (up && f.covers !== undefined) return fixCard(T('ui.fix.upgrade', { building: t }), T('ui.fix.upgradeCovers', { n: f.covers, cost: fmt(f.cost) }), f.action);
    if (up) return fixCard(T('ui.fix.upgrade', { building: t }), eff, f.action);
    if (act.kind === 'select') return fixCard(T('ui.fix.see', { building: t }), T('ui.fix.move'), f.action);
    if (f.covers !== undefined) return fixCard(T('ui.fix.here', { building: t }), T('ui.fix.covers', { n: f.covers, cost: fmt(f.cost) }), f.action);
    return fixCard(T('ui.fix.here', { building: t }), eff, f.action);
  }).join('')}</div>`;
}
function startFixes(p: HTMLElement, a: DistrictAccount): void {
  const { s, w } = store.session(), D = store.districts();
  const { byDistrict } = splitAdvice(store.advice().filter((x) => x.weight > 0), D);
  const mine = byDistrict[a.id] ?? [];
  const run = ++fixRun, gen = districtFixSteps(s, w, D, a, mine, store.economy(), store.ratings());
  const put = (id: string, html: string) => { const b = p.querySelector<HTMLElement>(`#${id}`); if (b) b.innerHTML = html; };
  const why = (txt: string) => `<p class="nota neutra fix-why">${esc(txt)}</p>`;
  const tick = () => {
    if (run !== fixRun || !p.querySelector('#fix-jobs')) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 24) {
      const r = gen.next();
      if (!r.done) continue;
      const f = r.value, used = new Set<unknown>();
      if (f.jobs) put('fix-jobs', why(T('ui.fix.jobs.why', { jobs: f.jobs.jobs, idle: f.jobs.idle }) + (f.jobs.outsiders ? ` ${T('ui.fix.jobs.outsiders', { n: f.jobs.outsiders })}` : '')) + (f.jobs.fixes.length ? fixCards(f.jobs.fixes) : why(T('ui.fix.jobs.none'))));
      if (f.satisfaction?.reasons.length) put('fix-sat', why(T('ui.fix.sat.why', { reasons: f.satisfaction.reasons.map((x) => (x.kind === 'nuisance' ? T('ui.fix.sat.nuisance', { building: x.building ?? '', n: x.homes }) : T('ui.fix.sat.service', { service: x.service ?? '', n: x.homes }))).join('; ') })) + (f.satisfaction.fixes.length ? fixCards(f.satisfaction.fixes) : ''));
      if (f.services.length) put('fix-services', f.services.map((x) => why(T('ui.fix.service.why', { n: x.n, homes: x.homes, service: x.service })) + (x.fixes.length ? fixCards(x.fixes) : why(T('ui.fix.service.none')))).join(''));
      if (f.outlet) { f.outlet.fixes.forEach((x) => used.add(x.advice)); put('fix-outlet', why(T(`ui.fix.outlet.${f.outlet.cause}`, { n: fmt(f.outlet.lost) })) + (f.outlet.fixes.length ? fixCards(f.outlet.fixes) : why(T('ui.fix.outlet.none')))); }
      const rest = mine.filter((x) => !used.has(x) && x.weight >= 40).sort((p2, q) => q.weight - p2.weight).slice(0, 2);
      if (rest.length) put('fix-more', K.section(esc(T('ui.district.more'))) + K.cards(rest.map(adviceCard)));
      return;
    }
    setTimeout(tick, 0);
  };
  setTimeout(tick, 30);
}

export const _x = { def, ico, PATH_CHOICES };
