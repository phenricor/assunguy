// A robot player for balance work: each season it resolves the events by a fixed policy, then follows the
// advisor, taking the heaviest advice it can pay for and act on, a few times, before passing the season.
// It records what a designer needs to judge the balance: goals against deadlines, cash, idle families,
// income, satisfaction, how full the gateways are and how much is wasted.
import { MILESTONES, type BuildingId } from '@assunguy/data';
import {
  advise, allocate, annex, canPlace, streetLine, streets, askProvince, build, buyVehicle, collectionLot, computeEconomy, def, defineEvent, explore, lotsFor, newGame,
  passSeason, proposeTax, resolveEvent, sellVehicle, soilOf, swapCrop, upgrade, wasteShare,
  type Advice, type AdviceAction, type CommandResult, type GameState, type LandId, type LotKey, type SeasonReport, type World,
} from '@assunguy/sim';

export interface SeasonLog {
  t: number; level: number; milestone: number; deadlineLeft: number | null; cash: number; families: number; idle: number; income: number;
  satisfaction: number; gatewayFull: number; waste: number; actions: string[]; news: string[];
  /** Where the purse's money came from and went this season. */
  purse: SeasonReport['cash'];
}
export interface Run { policy: string; seed: number; seasons: SeasonLog[]; milestones: { milestone: number; t: number; deadline: number }[]; ended: 'victory' | 'end' | 'limit'; missed: number }

const parse = (k: string) => k.split(',').map(Number) as [number, number];

/** Every free lot on our lands where a building of this type fits. */
function freeLots(s: GameState, w: World, t: BuildingId): [number, number][] {
  const out: [number, number][] = [];
  for (const id of Object.keys(s.map.lands) as LandId[]) {
    if (s.map.lands[id] !== 'ours') continue;
    const [c, l] = parse(id);
    for (let a = c * 15; a < c * 15 + 15; a++) for (let b = l * 15; b < l * 15 + 15; b++) if (!canPlace(s.map, w, t, a, b)) out.push([a, b]);
  }
  return out;
}
/** The lot the bot builds on: next to where the advice points, the best soil for a field, else the free lot closest to the streets' centre. */
function lotFor(s: GameState, w: World, t: BuildingId, near?: LotKey): [number, number] | null {
  const lots = freeLots(s, w, t);
  if (!lots.length) return null;
  if (near) { const [nx, ny] = parse(near); return lots.slice().sort((p, q) => Math.abs(p[0] - nx) + Math.abs(p[1] - ny) - (Math.abs(q[0] - nx) + Math.abs(q[1] - ny)))[0]!; }
  const g = def(t).output?.good;
  if (def(t).crop && g) return lots.slice().sort((p, q) => soilOf(w, `${q[0]},${q[1]}`, g as never) - soilOf(w, `${p[0]},${p[1]}`, g as never))[0]!;
  const ks = Object.keys(s.map.streets).map(parse), cx = ks.reduce((x, k) => x + k[0], 0) / ks.length, cy = ks.reduce((x, k) => x + k[1], 0) / ks.length;
  return lots.slice().sort((p, q) => Math.abs(p[0] - cx) + Math.abs(p[1] - cy) - (Math.abs(q[0] - cx) + Math.abs(q[1] - cy)))[0]!;
}

/** Out of lots: opens the advisor's best street line. */
export function extendStreets(s: GameState, w: World): boolean {
  const line = streetLine(s, w);
  return !!line && streets(s, w, line.from, line.to).opened > 0;
}

/** Carries out one advice; false when there is nothing the bot can do with it. */
export function act(s: GameState, w: World, a: AdviceAction): boolean {
  const okd = (r: CommandResult) => r.ok;
  switch (a.kind) {
    case 'build': {
      if (a.building === 'street') return false;
      let at = lotFor(s, w, a.building, a.near);
      if (!at && extendStreets(s, w)) at = lotFor(s, w, a.building, a.near);
      return !!at && okd(build(s, w, a.building, ...at));
    }
    case 'select': return a.upgrade ? okd(upgrade(s, w, a.key)) : false;
    case 'swap': return s.map.buildings[a.key] === a.from && okd(swapCrop(s, w, a.key, a.to));
    case 'land': {
      if (!s.map.lands[a.land] && !okd(explore(s, w, a.land))) return false;
      return okd(annex(s, w, a.land));
    }
    case 'buyVehicle': return okd(buyVehicle(s, w, a.key, a.vehicle));
    case 'sellVehicle': return okd(sellVehicle(s, w, a.key, a.vehicle));
    case 'collect': {
      const lot = a.lot ?? collectionLot(s, w, a.building, a.land ?? null, a.near);
      if (!lot || !okd(build(s, w, a.building, ...parse(lot)))) return false;
      let fleetAt: LotKey = lot;
      for (const extra of a.with ?? []) {
        const at = collectionLot(s, w, extra, null, lot);
        if (!at || !okd(build(s, w, extra, ...parse(at)))) return true;
        fleetAt = at;
      }
      for (const [v, n] of Object.entries(a.fleet ?? {})) for (let i = 0; i < (n ?? 0); i++) buyVehicle(s, w, fleetAt, v as never);
      return true;
    }
    case 'screen': return a.law === 'tithe' && a.value !== undefined ? okd(proposeTax(s, 'tithe', a.value ? { general: a.value } : null)) : false;
    case 'province': return okd(askProvince(s, a.request));
    case 'streets': return streets(s, w, a.from, a.to).opened > 0;
  }
}

/** Resolves the queued events: the first option the colony can take. Returns how the game ended, if it did. */
function events(s: GameState, w: World): 'victory' | 'end' | null {
  let guard = 0;
  while (s.queue.length && guard++ < 30) {
    const ev = s.queue[0]!;
    if (ev.kind === 'end') return 'end';
    if (ev.kind === 'victory') return 'victory';
    const d = defineEvent(s, ev);
    resolveEvent(s, w, Math.max(0, d.options.findIndex((o) => !o.can || o.can(s))));
  }
  return null;
}

/**
 * greedy: takes the heaviest advice it can pay for, even when a heavier one is waiting for money.
 * patient: when the heaviest advice is blocked by cash, it saves for it instead of spending on the next one.
 */
export interface BotOptions { seasons?: number; actionsPerSeason?: number; reserve?: number; policy?: 'greedy' | 'patient' }
/** Plays a new game from a seed. Deterministic: the same seed and options give the same run. */
export function play(seed: number, o: BotOptions = {}): Run {
  const { s, w } = newGame(seed);
  const limit = o.seasons ?? 96, per = o.actionsPerSeason ?? 4, reserve = o.reserve ?? 0;
  const run: Run = { policy: o.policy ?? 'greedy', seed, seasons: [], milestones: [], ended: 'limit', missed: 0 };
  let ended = events(s, w);
  for (let i = 0; i < limit && !ended; i++) {
    const actions: string[] = [], tried = new Set<string>();
    for (let n = 0; n < per; n++) {
      const list = advise(s, w).filter((x: Advice) => x.action && !tried.has(JSON.stringify(x.action)) && x.action.kind !== 'screen' || (x.action?.kind === 'screen' && x.action.law));
      const top = list[0];
      if (o.policy === 'patient' && top && top.weight >= 60 && (top.blocked || top.cost > s.cash - reserve)) { actions.push(`saving for ${top.rule}`); break; }
      const pick = list.find((x: Advice) => !x.blocked && x.cost <= s.cash - reserve);
      if (!pick) break;
      tried.add(JSON.stringify(pick.action));
      if (act(s, w, pick.action!)) actions.push(pick.rule);
    }
    const before = s.milestone, due = s.deadline;
    const r: SeasonReport = passSeason(s, w);
    if (s.milestone > before) run.milestones.push({ milestone: s.milestone, t: s.market.t, deadline: due });
    if (r.goal?.missed) run.missed += 1;
    ended = events(s, w);
    const c = computeEconomy(s, w), target = MILESTONES[s.milestone + 1];
    run.seasons.push({
      t: s.market.t, level: s.level, milestone: s.milestone, deadlineLeft: target ? s.deadline - s.market.t : null, cash: Math.round(s.cash),
      families: Object.keys(s.families).length, idle: allocate(s).idle.length, income: Math.round(c.incomeTotal), satisfaction: r.satisfaction.after,
      gatewayFull: Math.max(0, ...c.transport.gateways.map((g) => g.occupancy)), waste: wasteShare(c), actions, news: r.news.map((x) => x.key), purse: r.cash,
    });
  }
  run.ended = ended ?? 'limit';
  return run;
}

/** When each milestone was reached against the season it was due, from a run. */
export function goalTimes(run: Run): { milestone: number; reached: number | null }[] {
  return [1, 2, 3].map((m) => ({ milestone: m, reached: run.seasons.find((x) => x.milestone >= m)?.t ?? null }));
}

