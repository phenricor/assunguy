// What the player sees on tapping a building or a land: the prototype's selection sheet, with the review's
// changes (Satisfação, Capacidade, Produção; no prices in buttons; confirmations for vehicles and moves).
import { BUILDINGS, MILESTONES, TRANSPORT_ROLES, VEHICLES, type BuildingId, type GoodId, type VehicleId } from '@assunguy/data';
import {
  HOME_UPGRADE, allocate, annex, annexCost, buyVehicle, connected, costOf, def, demolish, explore, EXPEDITION_COST, fleetOf, fleetSize, fleetSlots,
  marginOf, producerFix, sellVehicle, serviceRadius, setMargin, soilOf, swapCrop, swapOptions, undoUpgrade, upgrade, upgradeCost, upkeepOf,
  homeOf, reach, streetsBeside,
  type FamilyId, type GameState, type LandId, type LotKey, type RatingItem,
} from '@assunguy/sim';
import * as store from '../store';
import { T, building, goodName, money, pct, nameOf, plural } from '../i18n';
import { api, hooks } from '../view';
import { $, K, esc, fmt, hint, confirm, sheet, sheetWith, signedMoney } from './kit';
import { ui, select, setMode, setPreview, cancel, refresh, keepOpen, focus } from './app';

const MARGINS = [-0.3, 0, 0.15, 0.3, 0.6];
let tab = 'main';

/** Production of one building per year: its share of what its good's producers made. */
function perYear(s: GameState, key: LotKey): [GoodId, number][] {
  const c = store.economy(), t = s.map.buildings[key] as BuildingId, D = def(t), f = c.counts.factor[key] ?? 0;
  if (!D.output || !f) return [];
  const out: [GoodId, number][] = [];
  for (const o of [D.output, ...(D.extraOutputs ?? [])]) {
    const g = o.good as GoodId;
    let tot = 0;
    for (const [k, x] of Object.entries(s.map.buildings)) { const d = def(x as BuildingId); for (const p of [d.output, ...(d.extraOutputs ?? [])]) if (p && p.good === g) tot += (c.counts.factor[k as LotKey] ?? 0) * p.perSeason; }
    if (tot > 0) out.push([g, (c.produced[g] ?? 0) * (f * o.perSeason) / tot]);
  }
  return out;
}

function ratingLine(i: RatingItem): string {
  switch (i.kind) {
    case 'service': return K.row(T('ui.rating.service', { service: i.service, n: i.streets }), signed(i.value), i.value > 0 ? 'mais' : '');
    case 'naturalWater': return K.row(T(`ui.rating.water.${i.source}`), signed(i.value), 'mais');
    case 'outOfReach': return K.row(T('ui.rating.outOfReach', { service: i.service }), '', 'menos');
    case 'forSale': return K.row(T(i.found ? 'ui.rating.forSale' : 'ui.rating.notForSale', { good: i.good }), signed(i.value), i.value < 0 ? 'menos' : '');
    case 'nuisance': return K.row(T('ui.rating.nuisance', { building: i.building, n: i.lots }), signed(i.value), 'menos');
    case 'colony': return K.row(T(i.reason, i.params), signed(i.value), i.value < 0 ? 'menos' : 'mais');
    case 'taxes': return K.row(T('ui.rating.taxes'), signed(i.value), 'menos');
    case 'milestoneDemand': return K.row(T('ui.rating.demand', { milestone: MILESTONES[i.milestone]?.id ?? '' }), signed(i.value), 'menos');
    case 'unlinked': return K.row(T('ui.rating.unlinked', { n: i.cap }), '', 'menos');
  }
}
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v))}`;

export function openBuilding(key: LotKey, tabWanted?: string, note = ''): void {
  const { s, w } = store.session();
  const t = s.map.buildings[key] as BuildingId | undefined;
  if (!t) { cancel(); return; }
  if (tabWanted) tab = tabWanted; else if (ui.selection !== key) tab = 'main';
  select(key); setMode({}); setPreview(null);
  keepOpen(() => openBuilding(key, undefined));
  const D = def(t), lv = s.upgrades[key] ?? 0, linked = connected(s.map).has(key), L: string[] = [];
  const fams = Object.values(s.families).filter((f) => homeOf(f.id) === key);
  let title = building(t), tabs: [string, string][] | null = null, extra = '';
  if (D.housing) {
    const r = store.ratings().homes[key];
    title = fams.length ? T('ui.home.of', { building: t, family: fams[0]!.surname }) : T('ui.home.empty', { building: t });
    tabs = [['main', T('ui.satisfaction')], ['upgrade', T('ui.home.upgrades')]];
    if (tab === 'upgrade') {
      const up = HOME_UPGRADE[t], savings = fams.reduce((x, f) => x + (f.savings || 0), 0);
      if (!up) extra = K.note(T('ui.home.max'), 'neutra');
      else {
        L.push(K.row(T('ui.home.next', { building: up.to }), plural('ui.families', def(up.to).housing ?? 0)));
        L.push(K.row(T('ui.home.savings'), `$ ${fmt(savings)} / $ ${fmt(up.cost)}`, savings >= up.cost ? 'mais' : ''));
        L.push(K.row(T('ui.satisfaction'), `${Math.round(r?.rating ?? 0)} / ${up.rating}`, (r?.rating ?? 0) >= up.rating ? 'mais' : ''));
        for (const g of up.needs) { const ok = (s.produced[g] ?? 0) > 1; L.push(K.row(goodName(g), ok ? T('ui.home.inColony') : T('ui.home.missing'), ok ? 'mais' : 'menos')); }
        if ((def(up.to).minLevel ?? 1) > s.level) L.push(K.row(T('ui.requires', { building: up.to, n: def(up.to).minLevel ?? 1 }), ''));
      }
    } else if (r) {
      extra = `<div class="medidor"><b>${Math.round(r.rating)}</b>${K.bar(r.rating / 100)}</div>`;
      for (const i of r.items) L.push(ratingLine(i));
      L.push(K.row(T('ui.capacity'), `${fams.length}/${D.housing}`, fams.length < D.housing ? 'fora' : ''));
    }
  } else {
    for (const [g, q] of perYear(s, key)) L.push(K.row(T('ui.sel.produces', { good: g }), T('ui.perYearN', { n: fmt(q) })));
    L.push(K.row(T('ui.sel.level'), T('ui.sel.levelOf', { n: lv + 1 })));
    if (D.service) {
      const rc = reach(s.map, key, serviceRadius(s, key));
      let served = 0; for (const h of Object.keys(store.ratings().homes)) if (streetsBeside(s.map, h as LotKey).some((x) => rc.has(x))) served++;
      L.push(K.row(T('ui.sel.reach'), T('ui.sel.streets', { n: serviceRadius(s, key) })));
      L.push(K.row(T('ui.sel.served'), served));
    }
    const team = allocate(s).byBuilding[key];
    if (team) L.push(K.row(`${D.processingCapacity ? T('ui.sel.production') : T('ui.capacity')}`, `${team.families.length}/${team.slots}, ${T('ui.sel.yields', { n: Math.round(team.efficiency * 100) })}`, team.families.length < team.slots ? 'menos' : ''));
    if (D.crop) {
      const fh = s.firstHarvest?.[key];
      if (fh !== undefined && fh > s.market.t) L.push(K.row(T('ui.build.firstHarvest'), plural('ui.inSeasons', fh - s.market.t), 'menos'));
      if (D.output) L.push(K.row(T('ui.build.soil'), `${Math.round(soilOf(w, key, D.output.good as never) * 100)}%`));
      L.push(K.row(T('ui.sel.harvest'), D.output?.season === undefined ? T('ui.sel.allYear') : T(`season.${D.output.season}`)));
    }
    if (t === 'mine' && w.deposits[key]) L.push(K.row(T('ui.sel.deposit'), T(`ui.deposit.${w.deposits[key]}`)));
    if (t === 'directorate') L.push(K.row(T('ui.sel.streetCrews'), `+${8 + 4 * lv}`));
    if (D.nuisance) { let n = 0; const r = store.ratings(); for (const [h, x] of Object.entries(r.homes)) if (x.items.some((i) => i.kind === 'nuisance' && i.building === t)) n++; L.push(K.row(T('ui.sel.bothered'), n, n ? 'menos' : '')); }
    extra += outlet(key);
  }
  if ((TRANSPORT_ROLES as Record<string, unknown>)[t] && linked) extra += transportBlock(key, L);
  const buttons: { id: string; kind?: string; text: string }[] = [];
  if (D.payer === 'colony' && lv < 2 && !D.housing) buttons.push({ id: 'melhorar', kind: 'pri', text: T('ui.sel.upgrade') });
  const built = s.seasonWork.buildings[key], up = s.seasonWork.upgrades[key], sw = s.seasonWork.swaps[key];
  if (up) buttons.push({ id: 'desfazM', text: T('ui.sel.undoUpgrade') });
  if (sw) buttons.push({ id: 'desfazT', text: T('ui.sel.backTo', { building: sw.from }) });
  if (D.crop) buttons.push({ id: 'trocar', text: T('ui.sel.swap') });
  buttons.push({ id: 'mover', text: T('ui.move') }, { id: 'demolir', kind: 'per', text: built !== undefined ? T('ui.sel.cancelWork') : T('ui.demolish') });
  const warn = linked ? '' : K.note(D.crop ? T('ui.sel.cropUnlinked') : T('ui.sel.unlinked'), 'ruim');
  const how = `<p class="sub">${esc(D.crop ? T('ui.sel.howCrop') : D.housing && fams.length ? T('ui.sel.howHome', { n: fams.length }) : T('ui.sel.how'))}${built !== undefined ? ` ${esc(T('ui.sel.refund', { money: fmt(built + (up?.cost ?? 0)) }))}` : ''}</p>`;
  const upCost = D.payer === 'colony' && lv < 2 ? upgradeCost(t, lv, s.milestone) : 0;
  const upInfo = upCost ? K.note(T('ui.sel.upgradeCost', { cost: fmt(upCost), upkeep: fmt(upkeepOf(t, s.milestone)) }), 'neutra') : '';
  sheetWith(title, T(`building.${t}.description`), `${tabs ? K.tabs(tabs, tab) : ''}${note ? K.note(esc(note)) : ''}${warn}${extra}${K.rows(L)}${upInfo}${K.actions(buttons as never)}${how}`, `building`);
  sheet().querySelectorAll<HTMLElement>('[data-aba]').forEach((b) => { b.onclick = () => openBuilding(key, b.dataset.aba); });
  const go = (id: string, f: () => void) => { const b = document.getElementById(id); if (b) b.onclick = f; };
  go('melhorar', () => { if (store.run((x, y) => upgrade(x, y, key))) { api.efx('melhora', key, { txt: `−$ ${fmt(upCost)}` }); api.Sons.toca('melhora'); refresh(); openBuilding(key); } });
  go('desfazM', () => { if (store.run((x, y) => undoUpgrade(x, y, key))) { refresh(); openBuilding(key); hint(T('ui.sel.upgradeUndone', { money: fmt(up!.cost) }), 2600); } });
  go('desfazT', () => { if (store.run((x, y) => swapCrop(x, y, key, sw!.from))) { refresh(); openBuilding(key); } });
  go('trocar', () => openSwap(key));
  go('mover', () => { select(null); setMode({ move: key }); sheetWith(T('ui.build.moveTitle', { building: t }), T('ui.sel.pickNewLot'), ''); });
  go('demolir', () => {
    const refund = (built ?? 0) + (up?.cost ?? 0) + (sw?.cost ?? 0);
    const lines = [refund ? K.row(T('ui.sel.refundLine'), `+$ ${fmt(refund)}`, 'mais') : K.row(T('ui.sel.noRefund'), ''), ...(D.housing && fams.length ? [K.row(T('ui.sel.familiesLeave'), fams.length, 'menos')] : [])];
    confirm(built !== undefined ? T('ui.sel.cancelWork') : T('ui.demolish'), lines, built !== undefined ? T('ui.sel.cancelWork') : T('ui.demolish'), () => {
      api.efx('demole', key, { t: (api.TIPOS ? undefined : undefined), txt: refund ? `+$ ${fmt(refund)}` : '' });
      if (store.run((x, y) => demolish(x, y, key))) { api.Sons.toca('demole'); refresh(); cancel(); }
    }, true);
  });
  wireTransport(key);
  focus(...(key.split(',').map(Number) as [number, number]));
}

/** For a producer: the share of its surplus that reaches a buyer and where the rest is lost (Escoamento). */
function outlet(key: LotKey): string {
  const c = store.economy(), o = c.outlet[key];
  if (!o || o.sent < 1) return '';
  const { s, w } = store.session(), lost = o.sent - o.delivered;
  const parts = (Object.entries(o.lost) as [string, number][]).filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1]);
  const fix = o.share < 0.9 ? producerFix(s, w, key, c) : null;
  const rows = [K.row(T('ui.outlet.share'), pct(o.share), o.share >= 0.9 ? 'mais' : o.share < 0.75 ? 'menos' : ''), ...(lost >= 0.5 ? parts.map(([k, v]) => K.row(T(`ui.outlet.lost.${k}`), T('ui.arrobas', { n: fmt(v) }), 'menos')) : [])];
  const box = fix ? `<div class="explica"><h4>${esc(T('ui.outlet.fix'))}</h4><p><b>${esc(T(`advice.${fix.rule}.title`, { at: key, share: Math.round(o.share * 100), ...fix.params }))}</b></p><p>${esc(T(`advice.${fix.rule}.body`, { at: key, ...fix.params }))}</p><div class="acoes">${K.go(T('ui.do'), fix.action, 'pri')}</div></div>` : '';
  return K.section(T('ui.outlet.title')) + K.rows(rows) + box;
}

// ---- transport buildings: fleet as a cart (− / +), tariff, capacity

function transportBlock(key: LotKey, L: string[]): string {
  const { s } = store.session(), t = s.map.buildings[key] as BuildingId, role = (TRANSPORT_ROLES as unknown as Record<string, { role: string; vehicles?: VehicleId[]; reach?: number }>)[t]!;
  const R = store.economy().transport;
  if (role.role === 'commerce') {
    const x = R.commerce.find((o) => o.key === key);
    if (x) { L.push(K.row(T('ui.tr.receives'), T('ui.arrobasYear', { n: fmt(x.in) }))); L.push(K.row(T('ui.tr.familiesAround'), fmt(x.families))); L.push(K.row(T('ui.tr.gatewayNear'), x.linked ? T('ui.yes') : T('ui.tr.noGateway'), x.linked ? 'mais' : 'menos')); }
    return '';
  }
  const x = role.role === 'collection' ? R.collections.find((o) => o.key === key) : R.gateways.find((o) => o.key === key);
  const f = fleetOf(s, key), slots = fleetSlots(s, key);
  if (x) {
    if (role.role === 'collection') L.push(K.row(T('ui.tr.fullAtHarvest'), pct(Math.min(1, x.peak)), x.peak >= 0.9 ? 'menos' : ''));
    else L.push(K.row(T('ui.tr.occupancy'), pct(Math.min(1, x.occupancy)), x.occupancy >= 0.85 ? 'menos' : ''));
    L.push(K.row(T('ui.tr.capacity'), T('ui.arrobasSeason', { n: fmt(x.capacity) })));
    if (role.reach) L.push(K.row(T('ui.sel.reach'), T('ui.lots', { n: role.reach })));
  }
  const vs = (role.vehicles ?? []).filter((v) => !(VEHICLES[v] as { lateGame?: boolean }).lateGame && ((VEHICLES[v] as { minLevel?: number }).minLevel ?? 1) <= s.level);
  const rows = vs.map((v) => `<div class="cartao"><div class="cartao-t"><div class="cartao-n"><b>${esc(T(`vehicle.${v}`))}</b><small>${esc(T('ui.tr.vehicleSub', { cargo: (VEHICLES[v] as { cargo: number }).cargo, upkeep: (VEHICLES[v] as { upkeep: number }).upkeep }))}</small></div><div class="qtd"><button type="button" data-sell="${v}" ${f[v] ? '' : 'disabled'} aria-label="−">−</button><b>${f[v] ?? 0}</b><button type="button" data-buy="${v}" ${fleetSize(s, key) < slots ? '' : 'disabled'} aria-label="+">+</button></div></div></div>`).join('');
  const m = marginOf(s, key);
  return K.section(T('ui.tr.fleet', { n: fleetSize(s, key), of: slots })) + `<div class="cartoes">${rows}</div>` + K.section(T('ui.tr.tariff'), 'tariff') + K.chips(MARGINS.map((v) => [String(v), T(`ui.tr.margin.${String(v).replace('.', '_').replace('-', 'm')}`)] as [string, string]), String(m), 'margem');
}
function wireTransport(key: LotKey): void {
  const { s } = store.session();
  sheet().querySelectorAll<HTMLElement>('[data-buy]').forEach((b) => { b.onclick = () => {
    const v = b.dataset.buy as VehicleId, V = VEHICLES[v] as { price: number; cargo: number; upkeep: number };
    confirm(T('ui.tr.buyTitle', { vehicle: v }), [K.row(T('ui.build.cost'), `$ ${fmt(V.price)}`), K.row(T('ui.tr.capacity'), T('ui.tr.plusCargo', { n: V.cargo })), K.row(T('ui.build.upkeep'), `$ ${fmt(V.upkeep)}`)], T('ui.tr.buy'), () => { if (store.run((x, y) => buyVehicle(x, y, key, v))) { api.Sons.toca('obra'); refresh(); openBuilding(key); } });
  }; });
  sheet().querySelectorAll<HTMLElement>('[data-sell]').forEach((b) => { b.onclick = () => {
    const v = b.dataset.sell as VehicleId, V = VEHICLES[v] as { price: number; cargo: number };
    confirm(T('ui.tr.sellTitle', { vehicle: v }), [K.row(T('ui.tr.back'), `+$ ${fmt(Math.round(V.price * 0.5))}`, 'mais'), K.row(T('ui.tr.capacity'), T('ui.tr.minusCargo', { n: V.cargo }), 'menos')], T('ui.tr.sell'), () => { if (store.run((x, y) => sellVehicle(x, y, key, v))) { refresh(); openBuilding(key); } });
  }; });
  sheet().querySelectorAll<HTMLElement>('[data-margem]').forEach((b) => { b.onclick = () => { if (store.run((x, y) => setMargin(x, y, key, Number(b.dataset.margem)))) { refresh(); openBuilding(key); } }; });
  void s;
}

// ---- swapping a field's crop

function openSwap(key: LotKey): void {
  const { s, w } = store.session(), from = s.map.buildings[key] as BuildingId;
  const opts = swapOptions(s, w, key);
  keepOpen(() => openSwap(key));
  const cards = opts.map((o) => K.card({ title: building(o.t), sub: T('ui.swap.sub', { cost: fmt(o.cost), seasons: Math.max(1, 0) }), right: signedMoney(o.gain), rightSub: T('ui.perYearShort'), tone: o.gain >= 0 ? 'mais' : 'ruim', attrs: `data-swap="${o.t}"` }));
  sheetWith(T('ui.swap.title', { building: from }), T('ui.swap.sub0'), opts.length ? K.cards(cards) : K.empty(T('ui.swap.none')));
  sheet().querySelectorAll<HTMLElement>('[data-swap]').forEach((b) => { b.onclick = () => {
    const to = b.dataset.swap as BuildingId, o = opts.find((x) => x.t === to)!;
    confirm(T('ui.swap.confirm', { building: to }), [K.row(T('ui.build.cost'), `$ ${fmt(o.cost)}`), K.row(T('ui.build.incomeAfterHarvest'), T('ui.perYear', { value: signedMoney(o.gain) }), o.gain >= 0 ? 'mais' : 'menos')], T('ui.swap.do'), () => { if (store.run((x, y) => swapCrop(x, y, key, to))) { refresh(); openBuilding(key); } });
  }; });
}

// ---- lands: explore, then annex

export function openLand(id: LandId): void {
  const { s, w } = store.session();
  select(null); setMode({}); setPreview(null); keepOpen(() => openLand(id));
  const land = w.lands[id], status = s.map.lands[id];
  if (!land) { cancel(); return; }
  const neighbour = (Object.entries(s.map.lands) as [LandId, string][]).some(([k, v]) => { if (v !== 'ours') return false; const [a, b] = k.split(',').map(Number) as [number, number], [c, d] = id.split(',').map(Number) as [number, number]; return Math.abs(a - c) + Math.abs(b - d) === 1; });
  if (!status) {
    sheetWith(T('ui.land.unknown'), neighbour ? T('ui.land.exploreBody') : T('ui.land.tooFar'), neighbour ? `${K.rows([K.row(T('ui.build.cost'), `$ ${fmt(EXPEDITION_COST)}`, s.cash < EXPEDITION_COST ? 'menos' : '')])}${K.actions([{ id: 'explora', kind: 'pri', text: T('ui.land.explore'), disabled: s.cash < EXPEDITION_COST }])}` : '');
    const e = document.getElementById('explora');
    if (e) e.onclick = () => { if (store.run((x, y) => explore(x, y, id))) { api.enviaExpedicao?.(id); refresh(); openLand(id); } };
    return;
  }
  const [c, l] = id.split(',').map(Number) as [number, number];
  const inLand = (k: string) => { const [a, b] = k.split(',').map(Number) as [number, number]; return Math.floor(a / 15) === c && Math.floor(b / 15) === l; };
  const deposits: Record<string, number> = {};
  for (const [k, d] of Object.entries(w.deposits)) if (inLand(k)) deposits[d] = (deposits[d] ?? 0) + 1;
  const trees = Object.keys(s.map.trees).filter(inLand).length;
  const river = [...w.water].some(inLand);
  const soil = (Object.entries(land.soil) as [GoodId, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const L = Object.entries(deposits).map(([d, n]) => K.row(T(`ui.land.deposit.${d}`), n));
  L.push(K.row(T('ui.land.forest'), T(trees > 110 ? 'ui.land.forestDense' : trees > 45 ? 'ui.land.forestMid' : 'ui.land.forestLow')));
  L.push(K.row(T('ui.land.river'), river ? T('ui.land.riverYes') : T('ui.land.riverNo')));
  if (soil.length) L.push(K.row(T('ui.land.goodSoil'), soil.map(([g]) => goodName(g).toLowerCase()).join(', ')));
  let buttons = '';
  if (status !== 'ours') {
    if (neighbour) { const ac = annexCost(s); L.push(K.row(T('ui.build.cost'), T('ui.land.annexCost', { influence: ac.influence, cash: fmt(ac.cash) }), s.influence < ac.influence || s.cash < ac.cash ? 'menos' : '')); buttons = K.actions([{ id: 'anexa', kind: 'pri', text: T('ui.land.annex'), disabled: s.influence < ac.influence || s.cash < ac.cash }]); }
    else L.push(K.row(T('ui.land.border'), T('ui.land.far'), 'fora'));
  }
  sheetWith(nameOf('land', id), T(`biome.${land.biome}`), K.rows(L) + buttons, 'land');
  const n = document.getElementById('anexa');
  if (n) n.onclick = () => { if (store.run((x, y) => annex(x, y, id))) { refresh(); cancel(); hint(T('ui.land.annexed', { land: id }), 3000); } };
}

export const _x = { BUILDINGS, costOf, money, homeOf, $ };
export type _F = FamilyId;
