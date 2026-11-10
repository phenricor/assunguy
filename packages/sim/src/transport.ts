// How the harvest reaches commerce and leaves the colony. Each producer sends its surplus to the nearest
// commerce on foot, or to a collection point (landing, trading post) that hauls it for a tariff. Commerce
// sells to families and sends the rest through the gateways (river port, waystation, pier) to the outside
// markets, each paying what it pays. Everything here runs inside one economy computation.
import { BALANCE, TRANSPORT_ROLES, VEHICLES, WORLD, type BuildingId, type GoodId, type TransportRoleDef, type VehicleDef, type VehicleId } from '@assunguy/data';
import { currentPrice, shockFactor } from './market.js';
import { rapidsLimit } from './map.js';
import { def, good, hasRoad, teamEfficiency, upkeepOf, type Counts, type LossCause, type Peak, type PerGood, type Totals } from './economy.js';
import { hasChoice, workDone, type DestinationId, type FamilyId, type GameState } from './state.js';
import { landOf, lotKey, parseKey, type LandId, type LotKey, type World } from './world.js';

export type Mode = 'river' | 'road' | 'rail';
const FREE_CARRY = BALANCE.freeCarryDistance;
const K = BALANCE.routeChoiceSharpness;
const ISOLATED = BALANCE.isolatedCommerceWeight;
const TRAVEL = BALANCE.travelTime as Partial<Record<VehicleId, number>>;
const role = (t: BuildingId): TransportRoleDef | undefined => (TRANSPORT_ROLES as Partial<Record<BuildingId, TransportRoleDef>>)[t];
const vehicle = (v: string): VehicleDef | undefined => (VEHICLES as Partial<Record<string, VehicleDef>>)[v];

/** Outside markets: price multiplier by good and how much demand they hold. */
export const DESTINATIONS: Record<DestinationId, { multiplier: (g: GoodId) => number; demandFactor: number }> = {
  iguape: { multiplier: () => 1, demandFactor: 1 },
  curitiba: { multiplier: (g) => (good(g).food ? 1.15 : 0.95), demandFactor: 1.5 },
  paranagua: { multiplier: (g) => (['yerba', 'mate', 'planks', 'driedCoffee', 'ropeTobacco', 'hide', 'jerky', 'lime'].includes(g) ? 1.35 : 1), demandFactor: 3 },
  saoPaulo: { multiplier: (g) => (['driedCoffee', 'ropeTobacco', 'cloth', 'rapadura', 'shoes'].includes(g) ? 1.4 : 0.9), demandFactor: 3 },
};
const DEST_IDS = Object.keys(DESTINATIONS) as DestinationId[];

export const distance = (k1: LotKey, k2: LotKey): number => { const [a, b] = parseKey(k1), [c, d] = parseKey(k2); return Math.abs(a - c) + Math.abs(b - d); };
export const fleetOf = (s: GameState, key: LotKey): Partial<Record<VehicleId, number>> => s.fleet[key] ?? {};
export const fleetSize = (s: GameState, key: LotKey): number => Object.values(fleetOf(s, key)).reduce((x, y) => x + (y ?? 0), 0);
export const fleetCargo = (s: GameState, key: LotKey): number => Object.entries(fleetOf(s, key)).reduce((x, [v, n]) => x + (vehicle(v) ? (n ?? 0) * (vehicle(v) as VehicleDef).cargo : 0), 0);
export const fleetUpkeep = (s: GameState, key: LotKey): number => Object.entries(fleetOf(s, key)).reduce((x, [v, n]) => x + (vehicle(v) ? (n ?? 0) * (vehicle(v) as VehicleDef).upkeep : 0), 0);
export const fleetSlots = (s: GameState, key: LotKey): number => { const R = role(s.map.buildings[key] as BuildingId); return R?.slots ? (R.slots[Math.min(2, s.upgrades[key] ?? 0)] as number) : 0; };
export const marginOf = (s: GameState, key: LotKey): number => s.tariffMargin[key] || 0;
/** On foot, nothing is lost up to the free distance; then more the farther, faster for perishables. */
export const carryArrives = (d: number, g: GoodId): number => (d <= FREE_CARRY ? 1 : Math.max(0.1, 1 - (d - FREE_CARRY) / (good(g).perishable ? 12 : 22)));

interface Commerce { key: LotKey; type: BuildingId | null; reach: number; virtual?: boolean; linked: boolean; families: number }
interface Collection { key: LotKey; type: BuildingId; mode: Mode; reach: number; to: { j: number; share: number }[]; toCommerce: number; distanceFactor: number }
interface Gateway { key: LotKey; type: BuildingId; mode: Mode }
interface Producer { carry: number; carryTo: number; collections: number[]; land: LandId }
export interface Geography { commerce: Commerce[]; collections: Collection[]; gateways: Gateway[]; producers: Record<LotKey, Producer> }

/** Who covers whom. Depends only on buildings, streets and families. */
export function geography(s: GameState, linked: Set<LotKey>): Geography {
  const keys = (Object.keys(s.map.buildings) as LotKey[]).filter((x) => linked.has(x));
  const commerce: Commerce[] = [], cols: Omit<Collection, 'to' | 'toCommerce' | 'distanceFactor'>[] = [], gateways: Gateway[] = [];
  for (const key of keys) {
    const t = s.map.buildings[key] as BuildingId, R = role(t);
    if (!R) continue;
    if (R.role === 'commerce') commerce.push({ key, type: t, reach: R.reach as number, linked: false, families: 0 });
    else if (R.role === 'collection') { if (t !== 'railStop') cols.push({ key, type: t, mode: R.mode as Mode, reach: R.reach as number }); } // rail stops need the late-game rails
    else gateways.push({ key, type: t, mode: R.mode as Mode });
  }
  if (!commerce.length) commerce.push({ key: lotKey(WORLD.startColumn, WORLD.startRow + 6), type: null, reach: 0, virtual: true, linked: false, families: 0 });
  for (const c of commerce) c.linked = gateways.some((p) => distance(c.key, p.key) <= c.reach + 4);
  for (const id of Object.keys(s.families) as FamilyId[]) {
    const h = id.slice(0, id.indexOf('#')) as LotKey;
    let mj = -1, md = 1e9;
    commerce.forEach((c, j) => { const d = distance(h, c.key); if (d <= c.reach && d < md) { md = d; mj = j; } });
    if (mj >= 0) (commerce[mj] as Commerce).families += 1;
  }
  // each collection point splits its load among the commerces; the distance to the best one shortens trips
  const collections: Collection[] = cols.map((c) => {
    const ops = commerce.map((o, j) => ({ j, d: distance(c.key, o.key), v: o.linked ? 1 : ISOLATED })).filter((o) => o.d <= 40);
    if (!ops.length) {
      let mj = 0, md = 1e9;
      commerce.forEach((o, j) => { const d = distance(c.key, o.key); if (d < md) { md = d; mj = j; } });
      ops.push({ j: mj, d: md, v: (commerce[mj] as Commerce).linked ? 1 : ISOLATED });
    }
    const ws = ops.map((o) => Math.exp(K * (o.v - 0.01 * o.d))), sum = ws.reduce((x, y) => x + y, 0);
    const best = ops[ws.indexOf(Math.max(...ws))] as { d: number };
    return { ...c, to: ops.map((o, i) => ({ j: o.j, share: (ws[i] as number) / sum })), toCommerce: best.d, distanceFactor: Math.max(0.5, Math.min(1, 12 / Math.max(1, best.d))) };
  });
  // each producer: the nearest commerce on foot and the collection points that reach it
  const producers: Record<LotKey, Producer> = {};
  for (const key of keys) {
    const t = s.map.buildings[key] as BuildingId, T = def(t);
    if (!(T.output || T.extraOutputs || t === 'mine') || T.recipes) continue;
    let jL = 0, dL = 1e9;
    commerce.forEach((c, j) => { const d = distance(key, c.key); if (d < dL) { dL = d; jL = j; } });
    // the whole land of a commerce is known road: within it, carrying on foot loses nothing
    if (dL > FREE_CARRY) {
      const land = landOf(...parseKey(key));
      let jm = -1, dm = 1e9;
      commerce.forEach((c, j) => { if (landOf(...parseKey(c.key)) === land) { const d = distance(key, c.key); if (d < dm) { dm = d; jm = j; } } });
      if (jm >= 0) { dL = FREE_CARRY; jL = jm; }
    }
    const reach: number[] = [];
    collections.forEach((c, i) => { if (distance(key, c.key) <= c.reach) reach.push(i); });
    producers[key] = { carry: dL, carryTo: jL, collections: reach, land: landOf(...parseKey(key)) };
  }
  return { commerce, collections, gateways, producers };
}

/** Destinations of a gateway, with the trip cost per arroba out of the map. */
function destinationsOf(s: GameState, key: LotKey, road: boolean, rapids: number): { d: DestinationId; trip: number }[] {
  const t = s.map.buildings[key] as BuildingId, f = fleetOf(s, key), cargo = fleetCargo(s, key) || 1;
  const mean = (vs: VehicleId[]) => vs.reduce((x, v) => x + (f[v] ?? 0) * (vehicle(v) as VehicleDef).cargo * (TRAVEL[v] as number), 0) / Math.max(1, vs.reduce((x, v) => x + (f[v] ?? 0) * (vehicle(v) as VehicleDef).cargo, 0));
  if (t === 'riverPort') return [{ d: 'iguape', trip: (TRAVEL.canoe as number) * (rapids >= 0 && parseKey(key)[0] <= rapids ? 1.3 : 1) }];
  if (t === 'steamPier') return [{ d: 'iguape', trip: TRAVEL.steamboat as number }];
  if (t === 'waystation') { const v = cargo > 0 && fleetSize(s, key) ? mean(['muleTrain', 'wagon']) : (TRAVEL.muleTrain as number); return [{ d: 'curitiba', trip: v * (road ? 0.65 : 1) }]; }
  return []; // the train station belongs to the late-game race
}

interface Accumulators {
  mode: { river: number; road: number; rail: number; foot: number; lost: number };
  delivered: number; lostValue: number; tariffs: number;
  byCollection: Record<LotKey, { carried: number; foot: number; lost: number; tariff: number; peak: number }>;
  byGateway: Record<LotKey, { volume: number; tariff: number; dest: Partial<Record<DestinationId, number>>; peak?: number }>;
  byCommerce: Record<LotKey, { in: number; lost: number; sold: number }>;
  byLand: Record<LandId, { producedValue: number; lostValue: number; footValue: number; covered: boolean }>;
  destVolume: Partial<Record<DestinationId, number>>; destValue: Partial<Record<DestinationId, number>>;
  exportByMode: { river: number; road: number; rail: number };
}
interface CollectionRun extends Collection { capacity: number; tariff: number; margin: number; demand: number }
interface GatewayRun extends Gateway { capacity: number; tariff: number; margin: number; dests: { d: DestinationId; trip: number; full: number }[] }
interface Flow { key: LotKey; share: number; good: GoodId; carryArrives: number; collectArrives: number; carryTo: number; carryShare: number; viaCollections: [number, number][]; price: number; land: LandId }
export interface TransportRun {
  s: GameState; G: Geography; collections: CollectionRun[]; gateways: GatewayRun[];
  competitiveness: Record<DestinationId, number>;
  shares: Record<string, { key: LotKey; f: number }[]>;
  acc: Accumulators;
  flows: Record<string, { used: number; items: Flow[] }>;
}

/** Tariffs, capacities and the year's accumulators. */
export function startTransport(s: GameState, w: World, e: Counts): TransportRun {
  const G = geography(s, e.linked), a = e.work, vol = s.transport.volume ?? {}, short = s.transport.firewoodShortage ?? 0;
  const rapids = rapidsLimit(s.map);
  const capKey = (key: LotKey, fd = 1) => {
    let q = 0;
    for (const [v, n] of Object.entries(fleetOf(s, key))) { const V = vehicle(v); if (V) q += (n ?? 0) * V.cargo * (V.firewood ? 1 - short * 0.4 : 1); }
    return q * teamEfficiency(a, s, key) * fd;
  };
  const tariffOf = (key: LotKey, t: BuildingId, cap: number) => {
    if (cap <= 0) return 0;
    const cost = fleetUpkeep(s, key) + upkeepOf(t, s.milestone), v = (vol[key] ?? 0) > 0 ? (vol[key] as number) : cap * 0.7;
    return (cost / Math.max(v, cap * 0.15)) * (1 + marginOf(s, key));
  };
  const collections = G.collections.map((c) => { const capacity = capKey(c.key, c.distanceFactor); return { ...c, capacity, tariff: tariffOf(c.key, c.type, capacity), margin: marginOf(s, c.key), demand: 0 }; });
  const road = G.gateways.some((p) => p.type === 'waystation') ? hasRoad(s) : false;
  const gateways = G.gateways.map((p) => {
    const capacity = capKey(p.key), tariff = tariffOf(p.key, p.type, capacity), full = capacity > 0 ? fleetUpkeep(s, p.key) / capacity : 0;
    return { ...p, capacity, tariff, margin: marginOf(s, p.key), dests: destinationsOf(s, p.key, road, rapids).map((d) => ({ ...d, full: d.trip + full })) };
  });
  // competitiveness against rivals only matters in the late-game race
  const competitiveness = Object.fromEntries(DEST_IDS.map((d) => [d, 1])) as Record<DestinationId, number>;
  // each building's share of its type's production
  const shares: Record<string, { key: LotKey; f: number }[]> = {}, depositSum: Record<string, number> = {};
  for (const key of Object.keys(e.factor) as LotKey[]) {
    const t = s.map.buildings[key] as BuildingId;
    if (!G.producers[key]) continue;
    if (t === 'mine') {
      const d = w.deposits[key];
      if (d) { depositSum[d] = (depositSum[d] ?? 0) + (e.factor[key] as number); (shares[`mine:${d}`] ??= []).push({ key, f: e.factor[key] as number }); }
      continue;
    }
    if ((e.factorSum[t] ?? 0) > 0) (shares[t] ??= []).push({ key, f: (e.factor[key] as number) / (e.factorSum[t] as number) });
  }
  for (const d of Object.keys(depositSum)) for (const x of shares[`mine:${d}`] ?? []) x.f /= depositSum[d] as number;
  const acc: Accumulators = {
    mode: { river: 0, road: 0, rail: 0, foot: 0, lost: 0 }, delivered: 0, lostValue: 0, tariffs: 0,
    byCollection: {}, byGateway: {}, byCommerce: {}, byLand: {}, destVolume: {}, destValue: {}, exportByMode: { river: 0, road: 0, rail: 0 },
  };
  return { s, G, collections, gateways, competitiveness, shares, acc, flows: {} };
}

const lose = (tot: Totals, g: GoodId, cause: LossCause, x: number) => {
  tot.lost[g] += x; tot.lostBy[cause] += x; tot.lostByGood[cause][g] = (tot.lostByGood[cause][g] ?? 0) + x;
};

/** One season: each producer's surplus reaches (or not) a commerce. Returns what arrives at the linked commerce. */
export function haulSeason(TR: TransportRun, bySource: [string, GoodId, number][], fresh: PerGood, harvest: Partial<PerGood>, tot: Totals | null): Partial<PerGood> {
  const G = TR.G, main: Partial<PerGood> = {}, isolated: Record<number, Partial<PerGood>> = {}, flows: [Flow, number][] = [], A = TR.acc;
  for (const c of TR.collections) c.demand = 0;
  for (const [t, g, raw] of bySource) {
    const left = (harvest[g] ?? 0) > 0 ? fresh[g] / (harvest[g] as number) : 0, q = raw * left;
    if (q <= 1e-6) continue;
    // each producer's choices depend only on the good and the tariffs: worked out once per computation
    let L = TR.flows[`${t}|${g}`];
    if (!L) {
      const P = good(g).localPrice || 1, collectArrives = good(g).perishable ? 0.9 : 0.95;
      L = TR.flows[`${t}|${g}`] = { used: 0, items: [] };
      for (const { key, f } of TR.shares[t] ?? []) {
        const p = G.producers[key];
        if (!p) continue;
        L.used += f;
        const onFoot = carryArrives(p.carry, g), ws = [Math.exp(K * onFoot)], cs: number[] = [];
        p.collections.forEach((ci) => { const C = TR.collections[ci] as CollectionRun; if (C.capacity <= 0) return; cs.push(ci); ws.push(Math.exp(K * (collectArrives - C.tariff / P))); });
        const sw = ws.reduce((x, y) => x + y, 0);
        L.items.push({ key, share: f, good: g, carryArrives: onFoot, collectArrives, carryTo: p.carryTo, carryShare: (ws[0] as number) / sw, viaCollections: cs.map((ci, i) => [ci, (ws[i + 1] as number) / sw]), price: P, land: p.land });
      }
    }
    for (const it of L.items) { const qq = q * it.share; for (const [ci, sh] of it.viaCollections) (TR.collections[ci] as CollectionRun).demand += qq * sh; flows.push([it, qq]); }
    if (L.used < 0.999) main[g] = (main[g] ?? 0) + q * (1 - L.used);
  }
  const fill = TR.collections.map((c) => (c.demand > 0 ? Math.min(1, c.capacity / c.demand) : 1));
  const deliver = (j: number, g: GoodId, x: number) => {
    const c = G.commerce[j] as Commerce;
    if (c.linked) main[g] = (main[g] ?? 0) + x;
    else { const o = (isolated[j] ??= {}); o[g] = (o[g] ?? 0) + x; }
    if (tot) { const pc = (A.byCommerce[c.key] ??= { in: 0, lost: 0, sold: 0 }); pc.in += x; }
  };
  const byCol = (key: LotKey) => (A.byCollection[key] ??= { carried: 0, foot: 0, lost: 0, tariff: 0, peak: 0 });
  const byLand = (land: LandId) => (A.byLand[land] ??= { producedValue: 0, lostValue: 0, footValue: 0, covered: false });
  for (const [fl, qq] of flows) {
    let foot = qq * fl.carryShare;
    if (tot && fl.viaCollections.length) for (const [ci] of fl.viaCollections) byCol((TR.collections[ci] as CollectionRun).key).foot += (qq * fl.carryShare) / fl.viaCollections.length;
    for (const [ci, sh] of fl.viaCollections) {
      const C = TR.collections[ci] as CollectionRun, carried = qq * sh * (fill[ci] as number);
      foot += qq * sh * (1 - (fill[ci] as number));
      if (tot) byCol(C.key).foot += qq * sh * (1 - (fill[ci] as number));
      if (carried <= 0) continue;
      const arrives = carried * fl.collectArrives;
      for (const { j, share } of C.to) deliver(j, fl.good, arrives * share);
      if (tot) {
        const tf = carried * C.tariff;
        tot.income[fl.good] -= tf; tot.freight[fl.good] += tf; A.tariffs += tf;
        const pc = byCol(C.key);
        pc.carried += carried; pc.tariff += tf; pc.lost += carried - arrives;
        A.mode[C.mode] += arrives; A.mode.lost += carried - arrives; A.delivered += arrives * fl.price; A.lostValue += (carried - arrives) * fl.price;
        lose(tot, fl.good, 'carrying', carried - arrives);
      }
    }
    if (foot > 0) {
      const arrives = foot * fl.carryArrives;
      deliver(fl.carryTo, fl.good, arrives);
      if (tot) {
        A.mode.foot += arrives; A.mode.lost += foot - arrives; A.delivered += arrives * fl.price; A.lostValue += (foot - arrives) * fl.price;
        lose(tot, fl.good, 'carrying', foot - arrives);
        const pt = byLand(fl.land);
        pt.footValue += foot * fl.price; pt.lostValue += (foot - arrives) * fl.price;
      }
    }
    if (tot) { const pt = byLand(fl.land); pt.producedValue += qq * fl.price; if (fl.viaCollections.length) pt.covered = true; }
  }
  if (tot) TR.collections.forEach((c) => { const pc = byCol(c.key); pc.peak = Math.max(pc.peak, c.capacity > 0 ? Math.min(1.5, c.demand / c.capacity) : 0); });
  // a commerce with no gateway sells only to the families around it; the rest is lost
  for (const [jStr, o] of Object.entries(isolated)) {
    const C0 = G.commerce[Number(jStr)] as Commerce, total = Object.values(o).reduce((x, y) => x + (y ?? 0), 0), room = C0.families * 1.2, f = total > 0 ? Math.min(1, room / total) : 0;
    for (const g of Object.keys(o) as GoodId[]) {
      const sold = (o[g] as number) * f, lost = (o[g] as number) - sold;
      if (!tot) continue;
      tot.market[g] += sold; tot.income[g] += sold * good(g).localPrice; tot.sales[g] += sold * good(g).localPrice;
      lose(tot, g, 'noGateway', lost);
      A.mode.lost += lost; A.lostValue += lost * good(g).localPrice; A.delivered -= lost * good(g).localPrice;
      const pc = A.byCommerce[C0.key];
      if (pc) { pc.lost += lost; pc.sold += sold; }
    }
  }
  return main;
}

/** Commerce splits what is left among the gateways, by what each destination leaves in hand. */
export function exportThroughGateways(TR: TransportRun, o: { s: GameState; avail: PerGood; order: GoodId[]; tot: Totals | null; priceFactor: (g: GoodId) => number; yearByDest: Record<string, Partial<PerGood>> }): { peak: Peak } {
  const { s, avail, order, tot, priceFactor, yearByDest } = o, A = TR.acc, mc = s.market;
  const capLeft = TR.gateways.map((p) => p.capacity), peak: Peak = { demand: 0, passed: 0, byGood: {} };
  for (const g of order) {
    let want = avail[g];
    if (want <= 0) continue;
    peak.demand += want;
    const P0 = currentPrice(mc, g) || 1;
    for (let round = 0; round < 3 && want > 0.5; round++) {
      const ops: { i: number; p: GatewayRun; dd: GatewayRun['dests'][number]; price: number; v: number }[] = [];
      TR.gateways.forEach((p, i) => {
        if ((capLeft[i] as number) <= 0.5) return;
        for (const dd of p.dests) {
          const D = DESTINATIONS[dd.d], cp = TR.competitiveness[dd.d];
          if (!D || !cp) continue;
          const base = (good(g).baseDemand || 50) * shockFactor(mc, g, 'demand') * (D.demandFactor || 1), already = yearByDest[dd.d]?.[g] ?? 0;
          const price = P0 * D.multiplier(g) * priceFactor(g) * (workDone(s, 'telegraph') ? 1.05 : 1) * cp * Math.max(0.45, 1 - already / (base * 2));
          const v = price - dd.trip - p.tariff;
          if (v > 0) ops.push({ i, p, dd, price, v });
        }
      });
      if (!ops.length) break;
      const ws = ops.map((x) => Math.exp((K * x.v) / P0)), sw = ws.reduce((x, y) => x + y, 0);
      let out = 0;
      ops.forEach((x, n) => {
        const load = Math.min((want * (ws[n] as number)) / sw, capLeft[x.i] as number);
        if (load <= 0) return;
        capLeft[x.i] = (capLeft[x.i] as number) - load; out += load;
        const ad = (yearByDest[x.dd.d] ??= {}); ad[g] = (ad[g] ?? 0) + load;
        if (tot) {
          tot.exported[g] += load; tot.income[g] += load * x.v; tot.sales[g] += load * x.price; tot.freight[g] += load * (x.dd.trip + x.p.tariff);
          tot.tax.export[g] += load * x.price * (s.taxes.exportDuty ? taxOf(s, g) : 0);
          A.tariffs += load * x.p.tariff;
          const pp = (A.byGateway[x.p.key] ??= { volume: 0, tariff: 0, dest: {} });
          pp.volume += load; pp.tariff += load * x.p.tariff; pp.dest[x.dd.d] = (pp.dest[x.dd.d] ?? 0) + load;
          A.destVolume[x.dd.d] = (A.destVolume[x.dd.d] ?? 0) + load; A.destValue[x.dd.d] = (A.destValue[x.dd.d] ?? 0) + load * x.price;
          A.exportByMode[x.p.mode] += load;
          if (x.p.mode === 'river') tot.byRiver += load; else tot.byRoad += load;
        }
      });
      avail[g] -= out; want -= out;
      if (out < 0.5) break;
    }
  }
  peak.passed = peak.demand - order.reduce((x, g) => x + Math.max(0, avail[g]), 0);
  if (tot) TR.gateways.forEach((p, i) => { const pp = (A.byGateway[p.key] ??= { volume: 0, tariff: 0, dest: {} }); pp.peak = Math.max(pp.peak ?? 0, p.capacity > 0 ? 1 - (capLeft[i] as number) / p.capacity : 0); });
  return { peak };
}
const taxOf = (s: GameState, g: GoodId) => { const l = s.taxes.exportDuty; return l ? (l.byGood?.[g] ?? l.general ?? 0) : 0; };

export interface CollectionSummary { key: LotKey; type: BuildingId; mode: Mode; capacity: number; perYear: number; carried: number; foot: number; occupancy: number; peak: number; tariff: number; margin: number; tariffYear: number; fleet: Partial<Record<VehicleId, number>>; slots: number; to: { key: LotKey; share: number }[] }
export interface GatewaySummary { key: LotKey; type: BuildingId; mode: Mode; capacity: number; perYear: number; volume: number; occupancy: number; peak: number; tariff: number; margin: number; tariffYear: number; dests: GatewayRun['dests']; byDest: Partial<Record<DestinationId, number>>; fleet: Partial<Record<VehicleId, number>>; slots: number }
export interface TransportSummary {
  collections: CollectionSummary[]; gateways: GatewaySummary[];
  commerce: { key: LotKey; type: BuildingId | null; linked: boolean; families: number; in: number; lost: number; sold: number }[];
  lands: { id: LandId; producedValue: number; lostValue: number; footValue: number; covered: boolean }[];
  mode: Accumulators['mode']; delivered: number; lostValue: number; tariffs: number; fleetCost: number;
  competitiveness: Record<DestinationId, number>; destVolume: Accumulators['destVolume']; destValue: Accumulators['destValue']; exportByMode: Accumulators['exportByMode']; meanMargin: number;
}

/** The year's summary for screens, advice and the purse. */
export function finishTransport(TR: TransportRun): TransportSummary {
  const A = TR.acc, s = TR.s;
  const collections = TR.collections.map((c) => {
    const pc = A.byCollection[c.key];
    const carried = pc?.carried ?? 0;
    return { key: c.key, type: c.type, mode: c.mode, capacity: c.capacity, perYear: c.capacity * 4, carried, foot: pc?.foot ?? 0, occupancy: c.capacity > 0 ? carried / 4 / c.capacity : 0, peak: pc?.peak ?? 0, tariff: c.tariff, margin: c.margin, tariffYear: pc?.tariff ?? 0, fleet: fleetOf(s, c.key), slots: fleetSlots(s, c.key), to: c.to.map((x) => ({ key: (TR.G.commerce[x.j] as Commerce).key, share: x.share })) };
  });
  const gateways = TR.gateways.map((p) => {
    const pp = A.byGateway[p.key];
    const volume = pp?.volume ?? 0;
    return { key: p.key, type: p.type, mode: p.mode, capacity: p.capacity, perYear: p.capacity * 4, volume, occupancy: p.capacity > 0 ? volume / 4 / p.capacity : 0, peak: pp?.peak ?? 0, tariff: p.tariff, margin: p.margin, tariffYear: pp?.tariff ?? 0, dests: p.dests, byDest: pp?.dest ?? {}, fleet: fleetOf(s, p.key), slots: fleetSlots(s, p.key) };
  });
  const commerce = TR.G.commerce.filter((c) => !c.virtual).map((c) => { const pc = A.byCommerce[c.key]; return { key: c.key, type: c.type, linked: c.linked, families: c.families, in: pc?.in ?? 0, lost: pc?.lost ?? 0, sold: pc?.sold ?? 0 }; });
  const lands = (Object.keys(A.byLand) as LandId[]).map((id) => ({ id, ...(A.byLand[id] as Accumulators['byLand'][LandId]) })).sort((x, y) => y.lostValue - x.lostValue);
  const fleetCost = (Object.keys(s.fleet) as LotKey[]).reduce((x, key) => x + (s.map.buildings[key] && role(s.map.buildings[key] as BuildingId) ? fleetUpkeep(s, key) : 0), 0);
  const volume = collections.reduce((x, c) => x + c.carried, 0) + gateways.reduce((x, p) => x + p.volume, 0);
  const meanMargin = volume ? (collections.reduce((x, c) => x + c.carried * c.margin, 0) + gateways.reduce((x, p) => x + p.volume * p.margin, 0)) / volume : 0;
  return { collections, gateways, commerce, lands, mode: A.mode, delivered: A.delivered, lostValue: A.lostValue, tariffs: A.tariffs, fleetCost, competitiveness: TR.competitiveness, destVolume: A.destVolume, destValue: A.destValue, exportByMode: A.exportByMode, meanMargin };
}

/** A gateway is truly tight only when the whole year cannot cope; at harvest, commerce stores. */
export const gatewayTight = (x: { occupancy: number }): boolean => x.occupancy >= 0.85;
/** A collection point's state for the screens. */
export const collectionState = (c: CollectionSummary): 'idle' | 'full' | 'healthy' => (c.capacity <= 0 ? 'idle' : c.peak >= 0.9 ? 'full' : c.occupancy < 0.5 && c.peak < 0.7 ? 'idle' : 'healthy');
export { hasChoice };
