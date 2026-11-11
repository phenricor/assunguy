// The advisor's screen (the player names the advisor; the role is `advisor` in code): what weighs most now,
// each item with the action that answers it. Advice above the cash in hand is shown blocked.
import { TRANSPORT_ROLES, VEHICLES, type BuildingId, type VehicleId } from '@assunguy/data';
import {
  askProvince, build, buyVehicle, collectionLot, costOf, proposeTax, sellVehicle, streets, swapCrop, upgrade,
  type AdviceAction, type LotKey,
} from '@assunguy/sim';
import * as store from '../store';
import { T } from '../i18n';
import { api, hooks } from '../view';
import { K, esc, fmt, confirm, hint } from './kit';
import { cancel, refresh } from './app';
import { screen, closeScreen } from './report';

const BANDS: [number, string][] = [[80, 'urgent'], [60, 'important'], [0, 'useful']];

export function openAdvisor(): void {
  const g = store.session();
  g.s.flags.sawAdvisor = true;
  const list = store.advice().filter((a) => a.weight > 0);
  const name = g.meta.advisor;
  const groups = BANDS.map(([min, id], i) => {
    const max = i ? (BANDS[i - 1] as [number, string])[0] : Infinity;
    const xs = list.filter((a) => a.weight >= min && a.weight < max);
    if (!xs.length) return '';
    return K.section(T(`ui.advisor.${id}`)) + K.cards(xs.map((a, n) => {
      const p = { at: a.params.key ?? '', ...a.params, advisor: name };
      const btn = a.action ? (a.blocked ? `<p class="nota ruim">${esc(T('advice.blocked', { cost: fmt(a.cost) }))}</p>` : `<div class="acoes">${K.go(T('ui.do'), a.action, 'pri')}</div>`) : '';
      return K.card({ title: esc(T(`advice.${a.rule}.title`, p)), sub: esc(T(`advice.${a.rule}.body`, p)), body: btn, dim: a.blocked, attrs: undefined }) + (n < 0 ? '' : '');
    }));
  }).join('');
  screen({ id: 'advisor', title: name, sub: T('ui.advisor.sub'), body: groups || K.empty(T('ui.advisor.none', { advisor: name })) });
  hooks.atualizaTopo?.();
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

