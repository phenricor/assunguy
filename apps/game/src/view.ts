// What the prototype's renderer reads, built from the new simulation. The renderer (src/legacy/render.js)
// was written against the prototype's state `M` (Portuguese ids) and its calculation `C`; this module
// translates the GameState into that shape after every change, and runs the prototype's world generation
// so the static map (river, lands, relief, deposits) is the one the simulation also generated.
import { BUILDINGS, type BuildingId } from '@assunguy/data';
import {
  computeEconomy, connected, reach, serviceOf, serviceRadius, railExits, railPath,
  type GameState, type LotKey, type Ratings, type World,
} from '@assunguy/sim';
import idMap from '../../../legacy/id-map.json';
import { api, vars, hooks } from './legacy/render.js';
import { T } from './i18n';

type Table = Record<string, string>;
const MAP = idMap as unknown as Record<string, Table>;
const invert = (t: Table): Table => Object.fromEntries(Object.entries(t).map(([pt, en]) => [en, pt]));
export const PT = {
  building: invert(MAP.buildings!), good: invert(MAP.goods!), tree: invert(MAP.trees!), nature: invert(MAP.nature!),
  weather: invert(MAP.weather!), choice: invert(MAP.choices!), vehicle: invert(MAP.vehicles!), biome: invert(MAP.biomes!),
};
export const EN = { building: MAP.buildings!, vehicle: MAP.vehicles!, good: MAP.goods! };
const GREAT_WORKS: Table = { telegraph: 'telegrafo', macadamRoad: 'rodagem', railSpur: 'ramal', normalSchool: 'escolaNormal', jerkyPlant: 'charqueada', limeWorks: 'usinaCal', hospital: 'hospital', steamSawmill: 'serrariaVapor' };
const SERVICE_PT: Table = { water: 'Água', faith: 'Igreja', school: 'Escola', health: 'Botica', commerce: 'Comércio', culture: 'Cultura', government: 'Governo', order: 'Ordem', fire: 'Fogo' };
const remap = (o: Record<string, string>, t: Table) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, t[v] ?? v]));

let worldSeed = '';
/** Runs the prototype's world generation for this seed (static map), once per world. */
export function useWorld(s: GameState): void {
  const id = `${s.seed}|${s.mapVersion}`;
  if (id === worldSeed) return;
  worldSeed = id;
  api.geraMundo(s.seed, s.mapVersion);
}

/** The prototype-shaped state the renderer reads. */
export function protoState(s: GameState, w: World): Record<string, unknown> {
  const names: Record<string, string> = {};
  for (const [k, key] of Object.entries(s.map.natureNames)) names[k] = T(key);
  return {
    semente: s.seed, mapaV: s.mapVersion,
    predios: remap(s.map.buildings, PT.building), ruas: Object.fromEntries(Object.keys(s.map.streets).map((k) => [k, 1])),
    nivel: { ...s.upgrades }, arv: remap(s.map.trees, PT.tree),
    terras: Object.fromEntries(Object.entries(s.map.lands).map(([k, v]) => [k, v === 'ours' ? 'nossa' : 'vista'])),
    natureza: remap(s.map.nature, PT.nature), natNomes: names,
    mercadoSim: { t: s.market.t }, caixa: s.cash, marco: s.milestone, nivelC: s.level, influencia: s.influence,
    fams: Object.fromEntries(Object.values(s.families).map((f) => [f.id, { nome: f.surname, oficio: f.trade, hab: f.skill }])),
    gobras: Object.fromEntries(Object.entries(s.greatWorks).map(([k, g]) => [GREAT_WORKS[k] ?? k, { ativo: !!g?.active, feito: !!g?.done }])),
    clima: s.weather ? { t: s.weather.t, tipo: PT.weather[s.weather.kind] ?? s.weather.kind } : null,
    pend: { ...s.seasonWork.buildings }, pendRua: { ...s.seasonWork.streets }, obrasEst: s.buildCosts,
    plantio: s.firstHarvest ? { ...s.firstHarvest } : null,
    escolhas: remap(s.choices as Record<string, string>, PT.choice),
    veic: Object.fromEntries(Object.entries(s.fleet).map(([k, f]) => [k, Object.fromEntries(Object.entries(f).map(([v, n]) => [PT.vehicle[v] ?? v, n]))])),
    nucleos: [], trilhos: Object.fromEntries(Object.keys(s.race?.rails ?? {}).map((k) => [k, 1])), corrida: raceView(s), frenteIds: { ...s.reliefWorkers }, frenteFrete: s.freightRelief, frenteCusto: s.reliefCost,
    efeitos: [], fila: [], leis: {}, leisC: {}, w: undefined, _w: w, _s: s,
  };
}

const EDGE: Record<string, string> = { south: 'sul', east: 'leste', north: 'norte' };
/** The race as the renderer animates it: one train line per station and edge its rails reach. */
function raceView(s: GameState): Record<string, unknown> | null {
  if (!s.race) return null;
  const linhas: Record<string, unknown>[] = [];
  for (const [k, t] of Object.entries(s.map.buildings)) {
    if (t !== 'trainStation') continue;
    const ex = railExits(s, k as LotKey), v = Object.values(s.fleet[k as LotKey] ?? {}).reduce((x, n) => x + (n ?? 0), 0);
    if (!v) continue;
    for (const e of Object.keys(ex)) linhas.push({ id: `${k}|${e}`, est: k, modo: 'trem', dest: e === 'north' ? 'saopaulo' : e === 'east' ? 'paranagua' : 'curitiba', saida: EDGE[e], v: Array.from({ length: v }, () => 1) });
  }
  return { t0: s.race.t0, linhas };
}
hooks.caminhoTrilho = (_m: unknown, est: LotKey, edge: string) => {
  const s = (vars.M as { _s?: GameState })._s;
  const e = Object.entries(EDGE).find(([, pt]) => pt === edge)?.[0] as 'south' | 'east' | 'north' | undefined;
  return s && e ? railPath(s, est, e) : null;
};

/** The prototype's `C`: which lots reach the street network, each service's reach, and the home ratings. */
export function protoCalc(s: GameState, r: Ratings): Record<string, unknown> {
  const lig = connected(s.map), alc: Record<string, Map<LotKey, number>> = {}, notas: Record<string, unknown> = {};
  for (const key of Object.keys(s.map.buildings) as LotKey[]) {
    const t = s.map.buildings[key] as BuildingId;
    if (serviceOf(t)) alc[key] = reach(s.map, key, serviceRadius(s, key));
  }
  for (const [key, h] of Object.entries(r.homes)) {
    notas[key] = { nota: Math.round(h.rating), itens: h.items.map((i) => (i.kind === 'outOfReach' ? { txt: `${SERVICE_PT[i.service] ?? i.service} fora de alcance`, v: 0 } : { txt: i.kind, v: 'value' in i ? i.value : 0 })) };
  }
  return { alc, notas, lig, media: Math.round(r.mean), fams: r.families };
}

/** Hands the renderer the current state. */
export function show(s: GameState, w: World, r: Ratings): void {
  useWorld(s);
  vars.M = protoState(s, w);
  vars.NAT = remap(s.map.nature, PT.nature);
  vars.C = protoCalc(s, r);
}

export { api, vars, hooks };
export const _unused = [computeEconomy, BUILDINGS];
