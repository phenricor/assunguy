// The advisor's screen (the player names the advisor; the role is `advisor` in code): what weighs most now,
// each item with the action that answers it. Advice above the cash in hand is shown blocked.
import { TRANSPORT_ROLES, VEHICLES, type BuildingId, type VehicleId } from '@assunguy/data';
import {
  askProvince, build, buyVehicle, collectionLot, costOf, districtAlerts, planSteps, splitAdvice, proposeTax, sellVehicle, streets, swapCrop, upgrade,
  type Advice, type AdviceAction, type DistrictAlert, type LevelPlan, type LotKey,
} from '@assunguy/sim';
import * as store from '../store';
import { T } from '../i18n';
import { api, hooks } from '../view';
import { K, esc, fmt, confirm, hint, signedMoney } from './kit';
import { cancel, refresh } from './app';
import { screen, closeScreen } from './report';

const BANDS: [number, string][] = [[80, 'urgent'], [60, 'important'], [0, 'useful']];

/** One piece of advice as a card, with its button (used here and on a district's screen). */
export function adviceCard(a: Advice): string {
  const name = store.session().meta.advisor, p = { at: a.params.key ?? '', ...a.params, advisor: name };
  const btn = a.action ? (a.blocked ? `<p class="nota ruim">${esc(T('advice.blocked', { cost: fmt(a.cost) }))}</p>` : `<div class="acoes">${K.go(T('ui.do'), a.action, 'pri')}</div>`) : '';
  return K.card({ title: esc(T(`advice.${a.rule}.title`, p)), sub: esc(T(`advice.${a.rule}.body`, p)), body: btn, dim: a.blocked });
}

const districtName = (n: { key: string }) => T('ui.districtLabel', { district: JSON.stringify(n) });
type Item = { weight: number; advice?: Advice; alert?: DistrictAlert & { more: number; gain?: number } };
/**
 * What the advisor shows: the colony's own advice, and for each district only what is critical there (one card
 * that opens the district, where its actions are). A district with urgent actions but no critical number gets
 * one card too.
 */
export function advisorItems(): Item[] {
  const list = store.advice().filter((a) => a.weight > 0), D = store.districts();
  const { colony, byDistrict } = splitAdvice(list, D);
  const alerts = districtAlerts(store.accounts());
  const items: Item[] = colony.map((a) => ({ weight: a.weight, advice: a }));
  const shown = new Set<string>();
  for (const x of alerts) {
    if (shown.has(`${x.district}|${x.problem}`)) continue;
    shown.add(`${x.district}|${x.problem}`);
    items.push({ weight: x.weight, alert: { ...x, more: (byDistrict[x.district] ?? []).length } });
  }
  for (const [d, xs] of Object.entries(byDistrict) as [LotKey, Advice[]][]) {
    if (alerts.some((x) => x.district === d)) continue;
    const urgent = xs.filter((a) => a.weight >= 75 && !a.blocked);
    if (!urgent.length) continue;
    const gain = Math.max(0, ...urgent.map((a) => Number(a.params.gain) || 0));
    items.push({ weight: Math.max(...urgent.map((a) => a.weight)), alert: { district: d, problem: 'advice' as never, weight: 0, n: urgent.length, more: 0, gain } });
  }
  return items.sort((p, q) => q.weight - p.weight);
}

function alertCard(x: NonNullable<Item['alert']>): string {
  const d = store.districts().info.find((y) => y.id === x.district);
  if (!d) return '';
  const pr = x.problem as string, p = { district: districtName(d.name), n: fmt(x.n), share: x.share ?? 0, service: x.service ?? '', homes: x.homes ?? 0, gain: fmt(x.gain ?? 0) };
  const body = pr === 'advice' ? T(x.gain ? 'ui.alert.advice.body' : 'ui.alert.adviceNoGain.body', p) : T(`ui.alert.${pr}.body`, p) + (x.more ? ` ${T('ui.alert.more', { n: x.more })}` : '');
  return K.card({ title: esc(T(`ui.alert.${pr}.title`, p)), sub: esc(body), body: `<div class="acoes">${K.go(T('ui.alert.open'), { kind: 'district', id: x.district }, 'pri')}</div>` });
}

export function openAdvisor(): void {
  const g = store.session();
  g.s.flags.sawAdvisor = true;
  const name = g.meta.advisor, all = advisorItems();
  const groups = BANDS.map(([min, id], i) => {
    const max = i ? (BANDS[i - 1] as [number, string])[0] : Infinity;
    const xs = all.filter((a) => a.weight >= min && a.weight < max);
    if (!xs.length) return '';
    return K.section(T(`ui.advisor.${id}`)) + K.cards(xs.map((x) => (x.advice ? adviceCard(x.advice) : alertCard(x.alert!))));
  }).join('');
  const p = screen({ id: 'advisor', title: name, sub: T('ui.advisor.sub'), body: `<div id="planBox">${planBlock(null)}</div>` + (groups || K.empty(T('ui.advisor.none', { advisor: name }))) });
  hooks.atualizaTopo?.();
  startPlan(p);
}

// ---- the way to the next level: what is missing and the works that close it, measured after the screen opens

let planCache: { sig: string; plan: LevelPlan | null } | null = null;
let planRun = 0;
const planSig = () => { const s = store.session().s; return `${s.market.t}|${s.level}|${Object.keys(s.map.buildings).length}|${JSON.stringify(s.upgrades).length}|${Object.keys(s.families).length}|${store.session().meta.id}`; };

function planBlock(plan: LevelPlan | null | undefined): string {
  const { s } = store.session();
  if (plan === undefined) return '';
  const head = (lv: number) => K.section(esc(T('ui.plan.title', { level: lv })));
  if (plan === null) return s.level >= 12 ? '' : head(s.level + 1) + K.note(esc(T('ui.plan.computing')), 'neutra');
  const lacks = [
    plan.workers.current < plan.workers.target ? K.row(esc(T('ui.plan.workers', { n: plan.workers.target - plan.workers.current })), '', 'menos') : '',
    plan.income.current < plan.income.target ? K.row(esc(T('ui.plan.income', { n: fmt(plan.income.target - plan.income.current) })), '', 'menos') : '',
    ...plan.missing.map((m) => K.row(esc(T('ui.plan.building', { building: m.building })), '', 'menos')),
  ].filter(Boolean);
  if (!lacks.length) return head(plan.level) + K.note(esc(T('ui.plan.ready', { level: plan.level })), 'bom') + (s.race && plan.level === 12 ? K.note(esc(T('ui.plan.wins')), 'neutra') : '');
  const name = (i: LevelPlan['items'][number]) => T(i.n > 1 ? `building.${i.building}.plural` : `building.${i.building}`);
  const items = plan.items.map((i) => K.row(esc(i.upgrade ? T(i.n > 1 ? 'ui.plan.upgradeN' : 'ui.plan.upgrade', { n: i.n, what: name(i) }) : T('ui.plan.item', { n: i.n, what: name(i) })), `$ ${fmt(i.cost)}`));
  const totals = plan.items.length ? K.rows([K.row(esc(T('ui.plan.cost')), `$ ${fmt(plan.cost)}`), K.row(esc(T('ui.tr.income')), esc(T('ui.perYear', { value: signedMoney(plan.gain) })), plan.gain > 0 ? 'mais' : '')]) : '';
  return head(plan.level) + K.rows(lacks)
    + (plan.items.length ? K.section(esc(T('ui.plan.works'))) + K.rows(items) + totals : '')
    + (plan.families ? K.note(esc(T('ui.plan.families', { n: plan.families })), 'neutra') : !plan.reached ? K.note(esc(T('ui.plan.short')), 'neutra') : '')
    + (s.race && plan.level === 12 ? K.note(esc(T('ui.plan.wins')), 'neutra') : '');
}

/** Runs the plan a few steps per frame, so the screen stays responsive; keeps it for the season. */
function startPlan(p: HTMLElement): void {
  const box = () => p.querySelector<HTMLElement>('#planBox');
  const { s, w } = store.session();
  if (s.level >= 12) { const b = box(); if (b) b.innerHTML = ''; return; }
  const sig = planSig();
  if (planCache?.sig === sig) { const b = box(); if (b) b.innerHTML = planBlock(planCache.plan); return; }
  const run = ++planRun, gen = planSteps(structuredClone(s), w);
  const tick = () => {
    const b = box();
    if (run !== planRun || !b || !b.isConnected) return;
    const t0 = performance.now();
    while (performance.now() - t0 < 24) {
      const r = gen.next();
      if (r.done) { planCache = { sig, plan: r.value }; b.innerHTML = planBlock(r.value); return; }
    }
    setTimeout(tick, 0);
  };
  setTimeout(tick, 30);
}

/** Carries out an advice's action, or opens what the player needs to do it. */
export function runAction(a: AdviceAction | { construir?: string }): void {
  const g = store.session();
  closeScreen();
  if (!('kind' in a)) return;
  const at = (key: LotKey) => { const [x, y] = key.split(',').map(Number) as [number, number]; api.vaiPara?.(x, y); };
  switch (a.kind) {
    case 'screen':
      if (a.screen === 'level') hooks.openLevel();
      else if (a.screen === 'transport') hooks.openTransport();
      else if (a.screen === 'economy') hooks.openEconomy?.();
      else if (a.law === 'tithe' && a.value !== undefined) {
        confirm(T('ui.advisor.titheTitle'), [K.row(T('ui.tax.tithe'), `${a.value}%`)], T('ui.gov.propose'), () => { if (store.run((s) => proposeTax(s, 'tithe', a.value ? { general: a.value } : null))) { refresh(); hint(T('ui.gov.proposed'), 2600); } });
      } else hooks.openGovernment(a.tab);
      return;
    case 'build': if (a.near) at(a.near); hooks.chooseBuild(a.building); return;
    case 'district': hooks.openDistrict(a.id); return;
    case 'select': at(a.key); if (a.upgrade) { const t = g.s.map.buildings[a.key] as BuildingId; confirm(T('ui.sel.upgrade'), [K.row(T(`building.${t}`), '')], T('ui.sel.upgrade'), () => { if (store.run((x, y) => upgrade(x, y, a.key))) { refresh(); hooks.openBuilding(a.key); } }); } else hooks.openBuilding(a.key); return;
    case 'swap': at(a.key); confirm(T('ui.swap.confirm', { building: a.to }), [K.row(T('ui.swap.from'), T(`building.${a.from}`))], T('ui.swap.do'), () => { if (store.run((x, y) => swapCrop(x, y, a.key, a.to))) { refresh(); hooks.openBuilding(a.key); } }); return;
    case 'land': hooks.openLand(a.land); return;
    case 'buyVehicle': case 'sellVehicle': {
      at(a.key);
      const V = VEHICLES[a.vehicle as VehicleId] as { price: number; cargo: number }, buy = a.kind === 'buyVehicle';
      confirm(T(buy ? 'ui.tr.buyTitle' : 'ui.tr.sellTitle', { vehicle: a.vehicle }), [K.row(buy ? T('ui.build.cost') : T('ui.tr.back'), `$ ${fmt(buy ? V.price : V.price / 2)}`), K.row(T('ui.tr.capacity'), T(buy ? 'ui.tr.plusCargo' : 'ui.tr.minusCargo', { n: V.cargo }))], T(buy ? 'ui.tr.buy' : 'ui.tr.sell'), () => { if (store.run((x, y) => (buy ? buyVehicle : sellVehicle)(x, y, a.key, a.vehicle))) { refresh(); hooks.openBuilding(a.key); } });
      return;
    }
    case 'collect': {
      const lot = a.lot ?? collectionLot(g.s, g.w, a.building, a.land ?? null, a.near);
      if (!lot) { hooks.chooseBuild(a.building); return; }
      at(lot);
      const fleet = Object.entries(a.fleet ?? {}) as [VehicleId, number][];
      const cost = costOf(a.building, g.s.milestone) + (a.with ?? []).reduce((x, t) => x + costOf(t, g.s.milestone), 0) + fleet.reduce((x, [v, n]) => x + (VEHICLES[v] as { price: number }).price * n, 0);
      // each new collection point or gateway already comes with one vehicle; the fleet lines are the ones bought with it
      const starterOf = (t: string) => (TRANSPORT_ROLES as Record<string, { starter?: string }>)[t]?.starter;
      const withOne = (t: string) => (starterOf(t) ? T('ui.build.withOne', { item: T(`vehicle.${starterOf(t)}`).toLocaleLowerCase() }) : '');
      const lines = [K.row(T(`building.${a.building}`), withOne(a.building)), ...(a.with ?? []).map((t) => K.row(T(`building.${t}`), withOne(t))), ...fleet.map(([v, n]) => K.row(T(`vehicle.${v}`), `× ${n}`)), K.row(T('ui.build.cost'), `$ ${fmt(cost)}`)];
      confirm(T('ui.advisor.collectTitle'), lines, T('ui.build.build'), () => {
        const [x0, y0] = lot.split(',').map(Number) as [number, number];
        if (!store.run((x, y) => build(x, y, a.building, x0, y0))) return;
        let fleetAt: LotKey = lot;
        for (const extra of a.with ?? []) { const s2 = store.session(); const l2 = collectionLot(s2.s, s2.w, extra, null, lot); if (!l2) break; const [p, q] = l2.split(',').map(Number) as [number, number]; if (!store.run((x, y) => build(x, y, extra, p, q))) break; fleetAt = l2; }
        for (const [v, n] of fleet) for (let i = 0; i < n; i++) store.run((x, y) => buyVehicle(x, y, fleetAt, v));
        api.Sons.toca('obra'); refresh(); hooks.openBuilding(lot);
      });
      return;
    }
    case 'province': confirm(T(`ui.advisor.province.${a.request}`), [K.row(T(`ui.advisor.province.${a.request}.effect`), '')], T('ui.advisor.ask'), () => { if (store.run((s) => askProvince(s, a.request))) { refresh(); hint(T('ui.advisor.asked'), 2600); } }); return;
    case 'streets': {
      const n = Math.abs(a.to[0] - a.from[0]) + Math.abs(a.to[1] - a.from[1]) + 1;
      api.vaiPara?.(...a.from);
      confirm(T('ui.advisor.streetsTitle'), [K.row(T('ui.advisor.streetsLots'), n), K.row(T('ui.build.cost'), T('ui.advisor.upTo', { cost: fmt(n * 5) }))], T('ui.street.open'), () => { const s2 = store.session(); const r = streets(s2.s, s2.w, a.from, a.to); if (r.ok) { store.changed(); refresh(); cancel(); hint(T('ui.street.opened', { n: r.opened, cost: fmt(r.opened * 5) }), 2600); } else hint(T(`error.${r.error}`), 2600); });
      return;
    }
  }
}

