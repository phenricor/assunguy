// The panels behind the bottom bar and the header: Colônia, Governo (with its detail tabs), Transporte,
// Nível, Economia and a district's numbers. Same markup and pieces as the prototype's dashboards.
import { GOOD_IDS, GREAT_WORKS, GREAT_WORK_IDS, LAWS, LEVELS, LEVEL_UNLOCKS, MILESTONES, PATH_CHOICES, type GoodId, type GreatWorkId } from '@assunguy/data';
import {
  AGENT_COST, allocate, arrivalChance, cityRisks, currentPrice, def, emptySlots, fame, goalPace, lawSlots, levelRequirements, milestoneGaps,
  proposeTax, setAgent, setGreatWork, taxEffect, toggleLaw, upkeepPerSeason, wasteShare, seasonOf, yearOf, districtsUnlocked, rivalCost, nextAdvance, raceTime,
  type GameState, type GoalItem, type LotKey, type TaxId, type SeriesPoint, type SeasonReport,
} from '@assunguy/sim';
import * as store from '../store';
import { T, goodName, num, pct } from '../i18n';
import { api, hooks, PT } from '../view';
import { K, esc, fmt, confirm, hint, signedMoney, ico, sheetWith } from './kit';
import { refresh } from './app';
import { screen, closeScreen, hooks2 } from './report';

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
    if (D.info.length) body += dash(T('ui.colony.districts'), 'districts:', T('ui.colony.districts'), K.note(esc(T('ui.colony.districtsNote', { n: D.info.length })), 'neutra'), K.rows(D.info.slice(0, 6).map((d) => K.row(districtName(d.name), T('ui.homesN', { n: d.homes.length })))));
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

export function openEconomy(tab = 'goods'): void {
  const { s } = store.session(), c = store.economy();
  const tabs: [string, string][] = [['goods', T('ui.econ.goods')], ['income', T('ui.econ.income')]];
  let body = '';
  if (tab === 'goods') {
    const gs = GOOD_IDS.filter((g) => c.produced[g] > 0.5 || (c.lost[g] ?? 0) > 0.5);
    body = gs.length ? K.cards(gs.map((g) => {
      const lost = c.lost[g] ?? 0, share = c.produced[g] ? lost / c.produced[g] : 0;
      return K.card({ ic: icon(g), title: goodName(g), sub: T('ui.econ.goodLine', { n: fmt(c.produced[g]), lost: fmt(lost), pct: Math.round(share * 100) }), right: `$ ${num(currentPrice(s.market, g), 1)}`, rightSub: trend(s, g), tone: share > 0.2 ? 'ruim' : '' });
    })) : K.empty(T('ui.econ.none'));
  } else {
    const ser = (s.series ?? []).slice(-12) as SeriesPoint[];
    body = K.tiles([{ v: `$ ${fmt(c.incomeTotal)}`, r: T('ui.econ.incomeYear') }, { v: `$ ${fmt(c.salesTotal)}`, r: T('ui.econ.sales') }, { v: `${Math.round(wasteShare(c) * 100)}%`, r: T('ui.econ.waste'), bad: wasteShare(c) > 0.2 }])
      + (ser.length >= 2 ? K.section(T('ui.econ.evolution'), 'evolution') + K.chart({ labels: ser.map((p) => short(p.t)), series: [{ name: T('ui.econ.sales'), color: COLORS[0]!, values: ser.map((p) => p.sales) }, { name: T('ui.econ.produced'), color: COLORS[1]!, values: ser.map((p) => p.produced) }] }) : '');
  }
  screen({ id: 'economy', title: T('ui.econ.title'), tabs, tab, body, onTab: openEconomy });
}
hooks2.openEconomy = () => openEconomy();

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
    body = K.rows([K.row(T('ui.gov.grantYear'), `$ ${fmt(y.grant)}`), K.row(T('ui.gov.share'), `$ ${fmt(y.share)}`), K.row(T('ui.gov.upkeepYear'), `−$ ${fmt(y.upkeep)}`, 'menos'), ...(pace ? [K.row(T('ui.gov.pace'), T('ui.gov.paceLine', { done: Math.round(pace.done * 100), time: Math.round(pace.time * 100) }), pace.behind > 0.15 ? 'menos' : '')] : [])])
      + (last ? K.section(T('ui.gov.lastReport')) + K.rows(last.reasons.map((r) => K.row(T(`ui.province.${r.reason}`, r.params), ''))) : '')
      + K.note(esc(T('ui.gov.provinceInfo')), 'neutra');
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
  p.querySelectorAll<HTMLElement>('[data-law]').forEach((b) => { b.onclick = () => { if (store.run((x, y) => toggleLaw(x, y, b.dataset.law as string))) { refresh(); openDirection('laws'); } }; });
  p.querySelectorAll<HTMLElement>('[data-work]').forEach((b) => { b.onclick = () => { const id = b.dataset.work as GreatWorkId, on = !s.greatWorks[id]?.active, G = GREAT_WORKS[id]; confirm(T(on ? 'ui.gov.startWork' : 'ui.gov.stopWork', { work: id }), on ? [K.row(T('ui.gov.instalment'), `$ ${fmt(G.cost / G.seasons)}`), K.row(T('ui.seasons'), G.seasons)] : [], T(on ? 'ui.gov.start' : 'ui.gov.stop'), () => { if (store.run((x) => setGreatWork(x, id, on))) { refresh(); openDirection('works'); } }); }; });
  (['tithe', 'exportDuty', 'businessTax'] as TaxId[]).forEach((id) => p.querySelectorAll<HTMLElement>(`[data-tax-${id}]`).forEach((b) => { b.onclick = () => { const v = Number(b.getAttribute(`data-tax-${id}`)) / 100; if (store.run((x) => proposeTax(x, id, v ? { general: v } : null))) { refresh(); openDirection('taxes'); hint(T('ui.gov.proposed'), 2600); } }; }));
  const ag = p.querySelector<HTMLElement>('#agent');
  if (ag) ag.onclick = () => { if (store.run((x) => setAgent(x, !s.immigrationAgent))) { refresh(); openDirection('immigration'); } };
}

// ---- Transporte

export function openTransport(): void {
  const { s } = store.session(), c = store.economy(), R = c.transport;
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
  const nx = nextAdvance(s);
  const notes = [nx ? K.note(esc(`${T('ui.race.next')}: ${T('ui.race.inSeasons', { n: nx.at - raceTime(s), what: T(`ui.race.advance.${nx.key}`) })}`), 'neutra') : '', R.decline ? K.note(esc(T('ui.race.decline', { n: R.decline.left })), 'ruim') : '', R.winning ? K.note(esc(T('ui.race.winning', { n: R.winning }))) : ''].join('');
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
    case 'families': return T('ui.goal.families');
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
  const D = store.districts();
  screen({ id: 'districts', title: T('ui.colony.districts'), body: K.cards(D.info.map((d) => K.card({ title: districtName(d.name), sub: T('ui.homesN', { n: d.homes.length }), attrs: `data-district="${d.id}"` }))) });
  document.querySelectorAll<HTMLElement>('[data-district]').forEach((b) => { b.onclick = () => openDistrict(b.dataset.district as string); });
}
export function openDistrict(id: string | { id: string }): void {
  const key = typeof id === 'string' ? id : id.id, D = store.districts(), d = D.info.find((x) => x.id === key);
  if (!d) return;
  const r = store.ratings();
  const homes = d.homes.map((h) => r.homes[h]).filter(Boolean);
  const mean = homes.length ? Math.round(homes.reduce((x, h) => x + h!.rating, 0) / homes.length) : 0;
  const missing: Record<string, number> = {};
  for (const h of homes) for (const i of h!.items) if (i.kind === 'outOfReach') missing[i.service] = (missing[i.service] ?? 0) + 1;
  closeScreen();
  sheetWith(districtName(d.name), T('ui.homesN', { n: d.homes.length }), K.rows([K.row(T('ui.satisfaction'), mean), ...Object.entries(missing).map(([sv, n]) => K.row(T('ui.rating.outOfReach', { service: sv }), `${n}/${homes.length}`, 'menos'))]));
}

export const _x = { def, ico, PATH_CHOICES };
