// Building: the list by category, the preview on a lot (what changes if it is built there), streets and
// moving. Previews run the command on a copy of the state, so what they show is what the game will do.
import { BALANCE, BUILDINGS, TRANSPORT_ROLES, type BuildingId, type TransportRoleDef } from '@assunguy/data';
import {
  build, move, streets, measure, rails, undoStreet, demolishStreet, canPlace, computeEconomy, rateHomes, reach, serviceRadius, connected,
  costOf, upkeepOf, def, soilOf, firstHarvest, allocate, streetLimit, streetsThisSeason, STREET_COST, forestFactor, distance, geography,
  type CommandResult, type GameState, type LotKey, type Ratings, type World,
} from '@assunguy/sim';
import * as store from '../store';
import { T, building, goodName, plural } from '../i18n';
import { api, hooks, PT, protoCalc } from '../view';
import { $, K, esc, fmt, hint, confirm, sheet, sheetWith, signedMoney } from './kit';
import { ui, setMode, setPreview, select, cancel, refresh, keepOpen, focus } from './app';

// ---- the list

const ALL = Object.keys(BUILDINGS) as BuildingId[];
const byCat = (c: string) => ALL.filter((t) => (BUILDINGS[t] as { category: string }).category === c);
export const TABS: [string, (BuildingId | 'street' | 'rail')[]][] = [
  ['streets', ['street']],
  ['housing', byCat('housing')],
  ['services', byCat('services')],
  ['commerce', ['store', 'market']],
  ['transport', ['tradingPost', 'landing', 'riverPort', 'waystation', 'steamPier', 'woodYard', 'trainStation', 'railStop', 'rail']],
  ['crops', byCat('crops')],
  ['livestock', byCat('livestock')],
  ['extraction', byCat('extraction')],
  ['workshops', byCat('workshops')],
];
const level = (t: BuildingId) => def(t).minLevel ?? 1;
const late = (t: BuildingId) => !!def(t).lateGame;
const raceOn = (s: GameState) => !!s.race;

let stripScroll = 0;
export function openBuildList(): void {
  const { s } = store.session();
  select(null); setMode({}); setPreview(null); keepOpen(null);
  const tabs = TABS.map(([id]) => [id, id === 'streets' ? T('ui.build.streets') : T(`category.${id}`)] as [string, string]);
  const list = (TABS.find(([id]) => id === ui.category) ?? TABS[1]!)[1].filter((t) => t === 'street' || (t === 'rail' ? raceOn(s) : !late(t) || raceOn(s)));
  const cards = list.map((t) => {
    if (t === 'rail') return `<button type="button" data-t="rail"><i style="background:repeating-linear-gradient(90deg,#5A4330 0 3px,#B9AE98 3px 7px);clip-path:polygon(50% 26%,100% 60%,50% 94%,0 60%)"></i>${esc(T('ui.race.rail'))}<small>${esc(T('ui.race.railDesc'))}</small></button>`;
    if (t === 'street') return `<button type="button" data-t="street"><i style="background:#C9A26E;clip-path:polygon(50% 26%,100% 60%,50% 94%,0 60%)"></i>${esc(T('ui.build.street'))}<small>${esc(T('ui.build.streetDesc'))}</small></button>`;
    const locked = level(t) > s.level;
    const mini = api.miniatura(PT.building[t]) as string;
    return `<button type="button" data-t="${t}" ${locked ? 'disabled class="trava"' : ''}><i style="${mini}"></i>${esc(building(t))}<small><b>${locked ? esc(T('ui.build.level', { n: level(t) })) : `$ ${fmt(costOf(t, s.milestone))}`}</b>${esc(T(`building.${t}.description`))}</small></button>`;
  });
  sheetWith(T('ui.build.title'), '', `${K.tabs(tabs, ui.category, 'cat')}<div class="grade">${cards.join('')}</div>`);
  const strip = sheet().querySelector('.abas') as HTMLElement;
  strip.scrollLeft = stripScroll;
  sheet().querySelectorAll<HTMLElement>('[data-cat]').forEach((b) => { b.onclick = () => { stripScroll = strip.scrollLeft; ui.category = b.dataset.cat as string; openBuildList(); }; });
  sheet().querySelectorAll<HTMLElement>('[data-t]').forEach((b) => { b.onclick = () => chooseBuild(b.dataset.t as BuildingId | 'street' | 'rail'); });
}

export function chooseBuild(t: BuildingId | 'street' | 'rail'): void {
  select(null); setPreview(null);
  setMode({ build: t });
  if (t === 'street') { streetSheet(); return; }
  if (t === 'rail') { first = null; sheetWith(T('ui.race.rail'), T('ui.race.railHow'), K.actions([{ id: 'fimR', kind: 'pri', text: T('ui.street.done') }])); $('fimR').onclick = () => { first = null; cancel(); }; return; }
  sheetWith(building(t), T('ui.build.pickLot'), '');
}

// ---- preview: run the command on a copy

const clone = (s: GameState): GameState => structuredClone(s);
function trial(fn: (s: GameState, w: World) => CommandResult): { r: CommandResult; s2: GameState } {
  const { s, w } = store.session(), s2 = clone(s);
  return { r: fn(s2, w), s2 };
}
const errorText = (r: CommandResult) => (r.ok ? '' : T(`error.${r.error}`));

/** What the renderer highlights for a building at a lot: its reach, its nuisance, its catchment. */
// notas: every home's rating after the change, which the map shows over the homes while the player chooses the lot
function highlight(t: BuildingId, key: LotKey, s2: GameState, r1: Ratings, flow: Flow | null): Record<string, unknown> {
  const tp = api.TIPOS[PT.building[t] as string] ?? {}, tr = api.TRANSP[PT.building[t] as string];
  return { key, dist: tp.serv ? reach(s2.map, key, serviceRadius(s2, key)) : new Map(), cor: tp.serv ? tp.cor : '#9C3A20', ruim: tp.ruim, serv: tp.serv, alcT: tr && tr.alcance, tipoT: PT.building[t],
    // the homes' expected ratings; a transport building shows its cargo instead, so the two sets of badges do not pile up
    notas: flow ? undefined : protoCalc(s2, r1).notas,
    // what would send its cargo here: a line and the arrobas a year over each one
    fontes: flow?.list.map((x) => ({ key: x.key, tipo: PT.building[s2.map.buildings[x.key] as BuildingId], novo: x.fresh, n: x.n, ...(x.via ? { ate: x.via, tipoAte: PT.building[s2.map.buildings[x.via] as BuildingId] } : {}) })) };
}

/** What would send its cargo through a new transport building, and whether it already had a way out. */
interface Flow { list: { key: LotKey; fresh: boolean; n: number; /** the commerce its cargo passes through first (a collection point behind a gateway) */ via?: LotKey }[]; role: 'collection' | 'commerce' | 'gateway' }
function flowInto(t: BuildingId, key: LotKey, s: GameState, s2: GameState): Flow | null {
  const R = roleOf(t);
  if (!R) return null;
  const G0 = geography(s, connected(s.map)), G1 = geography(s2, connected(s2.map)), c0 = store.economy(), list: Flow['list'] = [];
  const sent = (k: LotKey) => Math.round(c0.outlet[k]?.sent ?? 0);
  const carried = (k: LotKey) => Math.round(c0.transport.collections.find((x) => x.key === k)?.carried ?? 0);
  // the commerce a collection point sends most of its load to
  const mainCommerce = (G: typeof G1, i: number) => { const to = G.collections[i]!.to.slice().sort((a, b) => b.share - a.share)[0]; return to ? G.commerce[to.j] : undefined; };
  if (R.role === 'collection') {
    // the fields and herds beyond the free walk that the new point reaches; those another point already reached keep it
    const j = G1.collections.findIndex((c) => c.key === key);
    if (j >= 0) for (const [k, p] of Object.entries(G1.producers) as [LotKey, (typeof G1.producers)[LotKey]][]) if (p.collections.includes(j)) list.push({ key: k, fresh: !G0.producers[k]?.collections.length, n: sent(k) });
  } else if (R.role === 'commerce') {
    // the producers for whom this becomes the nearest commerce; it helps the ones that walked beyond the free distance
    const j = G1.commerce.findIndex((c) => c.key === key);
    if (j >= 0) for (const [k, p] of Object.entries(G1.producers) as [LotKey, (typeof G1.producers)[LotKey]][]) {
      if (p.carryTo !== j) continue;
      const before = G0.producers[k]?.carry ?? Infinity;
      list.push({ key: k, fresh: before > BALANCE.freeCarryDistance && p.carry < before, n: sent(k) });
    }
    // the collection points that would unload here: they gain when their trip to a commerce gets shorter
    G1.collections.forEach((c, i) => {
      if (mainCommerce(G1, i)?.key !== key) return;
      const i0 = G0.collections.findIndex((x) => x.key === c.key), before = i0 >= 0 ? G0.collections[i0]!.toCommerce : Infinity;
      list.push({ key: c.key, fresh: c.toCommerce < before, n: carried(c.key) });
    });
  } else {
    // the commerces whose surplus would go out here; those already linked to another gateway keep theirs
    for (const c of G1.commerce) if (c.key && !c.virtual && c.type && distance(c.key, key) <= c.reach + 4) {
      const was = G0.commerce.find((x) => x.key === c.key);
      list.push({ key: c.key, fresh: !was?.linked, n: Math.round(c0.transport.commerce.find((x) => x.key === c.key)?.in ?? 0) });
    }
    // and the collection points behind those commerces: their cargo reaches the gateway through the commerce
    const reached = new Set(list.map((x) => x.key));
    G1.collections.forEach((c, i) => { const m = mainCommerce(G1, i); if (m && reached.has(m.key)) list.push({ key: c.key, fresh: !!list.find((x) => x.key === m.key)?.fresh, n: carried(c.key), via: m.key }); });
  }
  return { list: list.sort((a, b) => Number(b.fresh) - Number(a.fresh) || b.n - a.n), role: R.role as Flow['role'] };
}
const roleOf = (t: BuildingId) => (TRANSPORT_ROLES as Partial<Record<BuildingId, TransportRoleDef>>)[t];
const makesGoods = (t: BuildingId) => { const D = def(t); return !!(D.output || D.extraOutputs || D.recipes); };
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
/** The rows that go with the lines on the map: how many would start sending here, their arrobas, and the rest. */
function flowRows(flow: Flow | null, L: string[]): void {
  if (!flow) return;
  // a collection point behind a commerce is listed for the map; its cargo is already counted in the commerce's
  const direct = flow.list.filter((x) => !x.via), fresh = direct.filter((x) => x.fresh), kept = direct.length - fresh.length, arrobas = fresh.reduce((a, x) => a + x.n, 0);
  const behind = flow.list.filter((x) => x.via && x.fresh).length;
  L.push(K.row(T(`ui.build.flow.${flow.role}.new`), fresh.length, fresh.length ? 'mais' : 'menos'));
  if (fresh.length) L.push(K.row(T('ui.build.flow.arrobas'), T('ui.perYear', { value: fmt(arrobas) })));
  if (kept) L.push(K.row(T(`ui.build.flow.${flow.role}.kept`), kept));
  if (behind) L.push(K.row(T('ui.build.flow.behind'), behind));
}
/** What a transport building would do on this lot, as the prototype showed it. Returns a note when the place is poor. */
function transportRows(t: BuildingId, key: LotKey, s2: GameState, L: string[], flow: Flow | null): string {
  const R = roleOf(t);
  if (!R) return '';
  const lig = connected(s2.map);
  if (R.role === 'collection') {
    const reachN = R.reach ?? 0, prods = (Object.keys(s2.map.buildings) as LotKey[]).filter((x) => x !== key && lig.has(x) && makesGoods(s2.map.buildings[x] as BuildingId) && distance(x, key) <= reachN);
    const same = (Object.keys(s2.map.buildings) as LotKey[]).filter((x) => x !== key && s2.map.buildings[x] === t);
    const covered = prods.filter((x) => same.some((c) => distance(x, c) <= reachN)).length;
    L.push(K.row(T('ui.build.reach'), T('ui.lotsN', { n: reachN })));
    flowRows(flow, L);
    if (prods.length && same.length) L.push(K.row(T('ui.build.alreadyNear', { place: building(t).toLowerCase() }), T('ui.nOfM', { n: covered, m: prods.length }), covered > prods.length / 2 ? 'menos' : ''));
    if (!prods.length) return K.note(T('ui.build.noProducers'), 'ruim');
    if (covered > prods.length / 2) return K.note(T('ui.build.mostCovered'), 'ruim');
  } else if (R.role === 'commerce') {
    const gw = (Object.keys(s2.map.buildings) as LotKey[]).some((x) => roleOf(s2.map.buildings[x] as BuildingId)?.role === 'gateway' && distance(x, key) <= (R.reach ?? 0) + 4);
    L.push(K.row(T('ui.build.receivesUpTo'), T('ui.lotsN', { n: R.reach ?? 0 })));
    flowRows(flow, L);
    L.push(K.row(T('ui.build.gatewayInReach'), gw ? T('ui.yes') : T('ui.build.noGatewayInReach'), gw ? 'mais' : 'menos'));
  } else {
    L.push(K.row(T('ui.build.carriesTo'), T(R.mode === 'road' ? 'ui.build.toCuritiba' : R.mode === 'rail' ? 'ui.build.toRailEdge' : 'ui.build.toIguape')));
    flowRows(flow, L);
    if (flow && !flow.list.length) return K.note(T('ui.build.flow.gateway.none'), 'ruim');
  }
  return '';
}

export function previewAt(t: BuildingId, a: number, b: number, from?: LotKey): void {
  const { s, w } = store.session(), key = `${a},${b}` as LotKey;
  const { r, s2 } = trial((x, y) => (from ? move(x, y, from, a, b) : build(x, y, t, a, b)));
  setMode({ ...ui.mode, target: [a, b], ...(r.ok ? {} : { error: errorText(r) }) });
  const T0 = def(t), cost = costOf(t, s.milestone), L: string[] = [];
  let h = '';
  if (!r.ok) {
    setPreview(null);
    h += `<p class="erro">${esc(r.error === 'noCash' ? T('ui.build.noCash', { cost: fmt(cost) }) : errorText(r))}</p>`;
  } else {
    const r0 = store.ratings(), r1 = rateHomes(s2, w), m0 = Math.round(r0.mean), m1 = Math.round(r1.mean);
    const flow = flowInto(t, key, s, s2);
    setPreview(highlight(t, key, s2, r1, flow));
    if (!from) L.push(K.row(T('ui.build.cost'), `$ ${fmt(cost)}`));
    const up = upkeepOf(t, s.milestone);
    if (!from && up) L.push(K.row(T('ui.build.upkeep'), `$ ${fmt(up)}`));
    L.push(K.row(T('ui.satisfaction'), `${m0} → ${m1}`, m1 > m0 ? 'mais' : m1 < m0 ? 'menos' : ''));
    // a new home: the rating it would have here, also shown over it on the map
    if (T0.housing && r1.homes[key]) L.push(K.row(T('ui.build.thisHome'), Math.round(r1.homes[key]!.rating), r1.homes[key]!.rating >= m0 ? 'mais' : 'menos'));
    if (T0.crop && T0.output) L.push(K.row(T('ui.build.soil'), `${Math.round(soilOf(w, key, T0.output.good as never) * 100)}%`));
    if (!T0.housing && !from) {
      const d = from ? 0 : measure(s, w, { [t]: 1 }).incomeTotal - measure(s, w).incomeTotal;
      if (Math.abs(d) >= 1 && !api.TRANSP[PT.building[t] as string]) L.push(K.row(T0.crop ? T('ui.build.incomeAfterHarvest') : T('ui.build.income'), T('ui.perYear', { value: signedMoney(d) }), d >= 0 ? 'mais' : 'menos'));
      if (T0.crop) { const n = firstHarvest(t, s.market.t) - s.market.t; L.push(K.row(T('ui.build.firstHarvest'), T('ui.inSeasons', { n }), n >= 3 ? 'menos' : '')); }
    }
    if (T0.housing) L.push(K.row(T('ui.capacity'), plural('ui.families', T0.housing)));
    else if (T0.jobs) L.push(K.row(T('ui.capacity'), plural('ui.families', T0.jobs)));
    if (T0.nearForest) L.push(K.row(T('ui.build.forestAround'), `${Math.round(forestFactor(s2, a, b) * 100)}%`));
    const trNote = transportRows(t, key, s2, L, flow);
    if (T0.service) {
      let better = 0;
      for (const k of Object.keys(r1.homes)) { const x = r0.homes[k as LotKey]; if (x && (r1.homes[k as LotKey]?.rating ?? 0) > x.rating) better++; }
      L.push(K.row(T('ui.build.homesBetter'), better));
      // homes in reach that already had this service: how much the new one repeats what exists (striped on the map)
      const dist = reach(s2.map, key, serviceRadius(s2, key)), svc = T0.service as string;
      let inReach = 0, repeats = 0;
      for (const h of Object.keys(r0.homes) as LotKey[]) {
        const [x, y] = h.split(',').map(Number) as [number, number];
        if (!SIDES.some(([i, j]) => dist.has(`${x + i},${y + j}` as LotKey))) continue;
        inReach++;
        if (!r0.homes[h]!.items.some((it) => it.kind === 'outOfReach' && it.service === svc)) repeats++;
      }
      if (inReach) L.push(K.row(T('ui.build.alreadyHad', { what: T(`service.${svc}`).toLowerCase() }), T('ui.nOfM', { n: repeats, m: inReach }), repeats > inReach / 2 ? 'menos' : ''));
    }
    if (T0.nuisance) { let worse = 0; for (const k of Object.keys(r1.homes)) { const x = r0.homes[k as LotKey]; if (x && (r1.homes[k as LotKey]?.rating ?? 0) < x.rating) worse++; } if (worse) L.push(K.row(T('ui.build.homesBothered'), worse, 'menos')); }
    h += K.rows(L) + trNote;
    if (!connected(s2.map).has(key)) h += K.note(T('ui.build.unlinked'), 'ruim');
  }
  if (!from && T0.jobs && !allocate(s).idle.length) h += K.note(T('ui.build.nobodyIdle'), 'neutra');
  h += K.actions([{ id: 'confirmar', kind: 'pri', text: from ? T('ui.build.moveHere') : T('ui.build.build'), disabled: !r.ok }]);
  sheetWith(from ? T('ui.build.moveTitle', { building: t }) : building(t), T(`building.${t}.description`), h);
  $('confirmar').onclick = () => {
    const go = () => {
      const ok = store.run((x, y) => (from ? move(x, y, from, a, b) : build(x, y, t, a, b)));
      if (!ok) return;
      api.efx('obra', key, { txt: from ? '' : `−$ ${fmt(cost)}` });
      api.Sons.toca('obra');
      setMode({}); setPreview(null);
      refresh();
      hooks.openBuilding(key, undefined, from ? '' : T('ui.build.undoNote'));
    };
    // moving a field restarts the wait for its first harvest: ask first
    if (from && T0.crop) confirm(T('ui.build.moveTitle', { building: t }), [K.row(T('ui.build.firstHarvest'), plural('ui.inSeasons', firstHarvest(t, s.market.t) - s.market.t), 'menos')], T('ui.build.move'), go);
    else go();
  };
  focus(a, b);
}
export const previewMove = (from: LotKey, a: number, b: number): void => previewAt(store.session().s.map.buildings[from] as BuildingId, a, b, from);

// ---- streets: two taps on aligned lots

let first: [number, number] | null = null;
function streetSheet(): void {
  const { s } = store.session(), left = Math.max(0, streetLimit(s) - streetsThisSeason(s));
  sheetWith(T('ui.street.title'), T('ui.street.howTo'), `<p class="sub" id="restaRuas">${esc(T('ui.street.left', { n: left, of: streetLimit(s), cost: STREET_COST }))}</p><div class="seg" id="modoRua"><button type="button" class="${ui.mode.undo ? '' : 'on'}" data-m="open">${esc(T('ui.street.open'))}</button><button type="button" class="${ui.mode.undo ? 'on' : ''}" data-m="undo">${esc(T('ui.street.undo'))}</button></div><p class="sub">${esc(T('ui.street.dashed'))}</p>${K.actions([{ id: 'fimR', kind: 'pri', text: T('ui.street.done') }])}`);
  $('fimR').onclick = () => { first = null; cancel(); };
  document.querySelectorAll<HTMLElement>('#modoRua button').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); first = null; setMode({ build: 'street', undo: b.dataset.m === 'undo' }); streetSheet(); }; });
}
export function streetTap(a: number, b: number): void {
  const { s } = store.session(), key = `${a},${b}` as LotKey;
  if (ui.mode.undo) {
    if (s.seasonWork.streets[key] === undefined) { hint(T('ui.street.notNew'), 2200); return; }
    store.run((x, y) => undoStreet(x, y, key)); refresh(); streetSheet(); return;
  }
  if (!first) { first = [a, b]; setMode({ build: 'street', target: [a, b] }); hint(T('ui.street.second'), 2600); return; }
  const from = first; first = null;
  if (from[0] !== a && from[1] !== b) { hint(T('ui.street.aligned'), 2600); return; }
  const g = store.session(), r = streets(g.s, g.w, from, [a, b]);
  if (!r.ok) hint(T(`error.${r.error}`), 2600);
  else { store.changed(); api.Sons.toca('rua'); hint(T('ui.street.opened', { n: r.opened, cost: fmt(r.opened * STREET_COST) }), 2600); }
  setMode({ build: 'street' });
  refresh(); streetSheet();
}

export function railTap(a: number, b: number): void {
  if (!first) { first = [a, b]; setMode({ build: 'rail', target: [a, b] }); hint(T('ui.street.second'), 2600); return; }
  const from = first; first = null;
  if (from[0] !== a && from[1] !== b) { hint(T('ui.street.aligned'), 2600); return; }
  const g = store.session(), r = rails(g.s, g.w, from, [a, b]);
  if (!r.ok) hint(T(`error.${r.error}`), 2600);
  else { store.changed(); api.Sons.toca('obra'); hint(T('ui.race.laid', { n: r.laid, cost: fmt(r.cost) }), 2600); }
  setMode({ build: 'rail' }); refresh();
}

/** A street lot: undo it (money back) if opened this season, or demolish it. */
export function openStreet(key: LotKey): void {
  const { s, w } = store.session();
  const without = clone(s); delete without.map.streets[key];
  const lost = connected(s.map).size - connected(without.map).size;
  const bridge = w.water.has(key), title = bridge ? T('ui.street.bridge') : T('ui.street.street');
  const lostTxt = lost > 0 ? T('ui.street.lose', { n: lost }) : T('ui.street.loseNone');
  if (s.seasonWork.streets[key] !== undefined) {
    sheetWith(title, `${T('ui.street.newThisSeason', { money: fmt(s.seasonWork.streets[key] as number) })} ${lost > 0 ? lostTxt : ''}`, K.actions([{ id: 'desfazR', kind: 'pri', text: T('ui.street.undoOne') }]));
    $('desfazR').onclick = () => { store.run((x, y) => undoStreet(x, y, key)); refresh(); cancel(); };
    return;
  }
  sheetWith(title, lostTxt, K.actions([{ id: 'demolir', kind: 'per' as never, text: T('ui.demolish') }]));
  $('demolir').onclick = () => { store.run((x, y) => demolishStreet(x, y, key)); refresh(); cancel(); };
}

export const _canPlace = canPlace;
export const _good = goodName;
