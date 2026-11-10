// Helpers for golden tests against the frozen prototype (see tools/legacy-oracle).
import type { MapState } from '../src/map.js';
import type { Family, FamilyId, GameState, TaxId } from '../src/state.js';
import idMap from '../../../legacy/id-map.json' with { type: 'json' };

export const LEGACY = idMap as unknown as Record<string, Record<string, string>>;

export const goodFromLegacy = (id: string): string => {
  const g = LEGACY.goods?.[id];
  if (!g) throw new Error(`no English id for legacy good ${id}`);
  return g;
};

export const SHOCK_KIND: Record<string, string> = { peste: 'pest', procura: 'demand', preco: 'price', cap: 'capacity' };

const LAND_STATUS: Record<string, 'ours' | 'seen'> = { nossa: 'ours', vista: 'seen' };
const table = (name: string) => LEGACY[name] as Record<string, string>;
const remap = <T extends string>(o: Record<string, string> | undefined, name: string): Record<string, T> =>
  Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => {
    const id = table(name)[v];
    if (!id) throw new Error(`no English id for legacy ${name} ${v}`);
    return [k, id as T];
  }));

/** The map part of a normalized prototype save (as the oracle dumps it). */
export function legacyMap(save: Record<string, unknown>): MapState {
  const s = save as { ruas: Record<string, number>; predios: Record<string, string>; arv?: Record<string, string>; terras: Record<string, string>; natureza?: Record<string, string>; natNomes?: Record<string, string> };
  const caves = ['Gruta da Lancinha', 'Gruta do Monge', 'Gruta das Andorinhas', 'Gruta da Água Santa', 'Gruta do Tigre', 'Gruta dos Morcegos', 'Gruta da Pedra Furada', 'Gruta do Bugre'];
  return {
    streets: Object.fromEntries(Object.keys(s.ruas).map((k) => [k, true])) as MapState['streets'],
    buildings: remap(s.predios, 'buildings'),
    trees: remap(s.arv, 'trees'),
    lands: Object.fromEntries(Object.entries(s.terras).filter(([, v]) => LAND_STATUS[v]).map(([k, v]) => [k, LAND_STATUS[v]])) as MapState['lands'],
    nature: remap(s.natureza, 'nature'),
    natureNames: Object.fromEntries(Object.entries(s.natNomes ?? {}).map(([k, n]) => [k, `nature.cave.place.${caves.indexOf(n)}`])),
  };
}

const GREAT_WORKS: Record<string, string> = { telegrafo: 'telegraph', rodagem: 'macadamRoad', ramal: 'railSpur', escolaNormal: 'normalSchool', charqueada: 'jerkyPlant', usinaCal: 'limeWorks', hospital: 'hospital', serrariaVapor: 'steamSawmill' };
const CRISES: Record<string, string> = { republica: 'republic', encilhamento: 'encilhamento', federalista: 'federalist', mate: 'mate' };
export const DILEMMA: Record<string, string> = { chegada: 'earlyArrival', caixaLage: 'storeBox', cobranca: 'storeDebt', denuncia: 'accusation', divino: 'divino', febre: 'fever', benedito: 'peddler', ferreiro: 'blacksmith', kanhro: 'kaingangVisit', pinheiral: 'fences', trocas: 'barter', comissao: 'committee', promessa: 'promise', engenheiro: 'engineer' };
const FLAGS: Record<string, string> = { caixa: 'storeBox', vogt: 'blacksmith' };
const DISEASE: Record<string, string> = { febre: 'fever', 'cólera': 'cholera' };
/** A queued prototype event as the port's queue entry. */
export function legacyEvent(e: any): any {
  if (e.tipo === 'dilema') return { kind: 'dilemma', id: DILEMMA[e.id] };
  if (e.tipo === 'crise') return { kind: 'crisis', id: e.id === 'geada' ? 'frost' : 'flood' };
  if (e.tipo === 'leva') return { kind: 'immigrants', n: e.n, origin: table('origins')[e.origem] };
  if (e.tipo === 'pedeTroca') return { kind: 'cropSwap', key: e.key, family: e.fam, from: table('buildings')[e.de], to: table('buildings')[e.para], gain: e.ganho, cost: e.custo, losses: (e.perde ?? []).map(([b, v]: [string, number]) => [goodFromLegacy(b), v]) };
  if (e.tipo === 'escolha') return { kind: 'pathChoice', level: e.nivel };
  if (e.tipo === 'decreto') return { kind: 'decree', milestone: e.nome };
  if (e.tipo === 'intervencao') return { kind: 'inspector', milestone: e.nome };
  if (e.tipo === 'fim') return { kind: 'end', milestone: e.nome };
  if (e.tipo === 'vitoria') return { kind: 'victory' };
  if (e.tipo === 'intro') return { kind: 'intro' };
  if (e.tipo === 'fdj' && e.id === 'requisicao') return { kind: 'requisition' };
  return { kind: 'unknown', legacy: e };
}
const TAX_IDS: Record<string, TaxId> = { lote: 'lotInstallment', dizimo: 'tithe', exportacao: 'exportDuty', negocio: 'businessTax' };
const byGood = (o: Record<string, number> | undefined) => Object.fromEntries(Object.entries(o ?? {}).map(([g, v]) => [goodFromLegacy(g), v]));

/** A whole normalized prototype save as the port's game state. */
export function legacyState(save: Record<string, unknown>): GameState {
  const m = save as any;
  const families: Record<string, Family> = {};
  for (const [id, f] of Object.entries(m.fams ?? {}) as [string, any][]) {
    families[id] = { id: id as FamilyId, surname: f.nome, trade: f.oficio ? (table('sectors')[f.oficio] as Family['trade']) : null, skill: f.hab, newcomer: f.nova, idle: f.parada, arrived: f.chegou, savings: f.fundo ?? 0, ...(f.filho ? { child: true } : {}), ...(f.origem ? { origin: table('origins')[f.origem] } : {}) };
  }
  const taxes = Object.fromEntries(Object.entries(TAX_IDS).map(([pt, en]) => {
    const l = m.leis?.[pt];
    return [en, l ? { general: l.geral ?? 0, ...(l.por ? { byGood: byGood(l.por) } : {}) } : null];
  })) as GameState['taxes'];
  return {
    seed: m.semente, mapVersion: m.mapaV || 1, map: legacyMap(save), upgrades: { ...(m.nivel ?? {}) },
    families: families as GameState['families'], homeRating: { ...(m.notaCasa ?? {}) }, health: m.saude ?? 1, supply: byGood(m.abast),
    firstHarvest: m.plantio ? { ...m.plantio } : null,
    market: {
      t: m.mercadoSim.t, seed: m.mercadoSim.semente, history: byGood(m.mercadoSim.hist as any) as any,
      shocks: (m.mercadoSim.eventos ?? []).map((e: any) => ({ good: e.b === '_porto' ? '_port' : goodFromLegacy(e.b), kind: SHOCK_KIND[e.tipo], factor: e.f, seasonsLeft: e.restam, reason: 'legacy' })),
    },
    cash: m.caixa, influence: m.influencia ?? 3, level: m.nivelC ?? 1, milestone: m.marco ?? 0, deadline: m.prazo, goalStart: m.metaInicio ?? 12,
    taxes, laws: Object.fromEntries(Object.keys(m.leisC ?? {}).filter((k) => m.leisC[k]).map((k) => [table('laws')[k], true])),
    choices: Object.fromEntries(Object.entries(m.escolhas ?? {}).map(([n, c]) => [n, table('choices')[c as string]])),
    greatWorks: Object.fromEntries(Object.entries(m.gobras ?? {}).map(([k, g]: [string, any]) => [GREAT_WORKS[k] ?? k, { ...(g.ativo ? { active: true } : {}), ...(g.feito ? { done: true } : {}), ...(g.pago ? { paid: g.pago } : {}), ...(g.extra ? { extra: g.extra } : {}), ...(g.parou ? { stalled: true } : {}) }])),
    problems: { epidemic: m.prob?.epi ? { disease: DISEASE[m.prob.epi.nome] ?? m.prob.epi.nome, seasonsLeft: m.prob.epi.restam, since: m.prob.epi.desde } : null, disorder: m.prob?.desordem || 0, ...(m.prob?.ultFogo !== undefined ? { lastFire: m.prob.ultFogo } : {}), ...(m.prob?.fogoCasas !== undefined ? { fireHomes: m.prob.fogoCasas } : {}) },
    crisis: m.acont ? { id: CRISES[m.acont.id] ?? m.acont.id, seasonsLeft: m.acont.restam, ...(m.acont.desde !== undefined ? { since: m.acont.desde } : {}) } : null,
    ...(m.acontProx ? { nextCrisis: { id: CRISES[m.acontProx.id] as any, at: m.acontProx.em } } : {}), ...(m.acontUlt !== undefined ? { lastCrisis: m.acontUlt } : {}), ...(m.acontFeitos ? { crisesSeen: m.acontFeitos.map((x: string) => CRISES[x] as any) } : {}),
    queue: (m.fila ?? []).map(legacyEvent), agenda: (m.agenda ?? []).map((a: any) => ({ id: DILEMMA[a.id], t: a.t })),
    used: Object.fromEntries(Object.entries(m.usados ?? {}).map(([k, v]) => [DILEMMA[k] ?? k, v as number])),
    ...(m.ultimoDilema !== undefined ? { lastDilemma: m.ultimoDilema } : {}), ...(m.proxLeva !== undefined ? { nextArrival: m.proxLeva } : {}), ...(m.proxPedidoTroca !== undefined ? { nextSwapAsk: m.proxPedidoTroca } : {}),
    flags: Object.fromEntries(Object.entries(m.flags ?? {}).map(([k, v]) => [FLAGS[k] ?? k, !!v])),
    chronicle: (m.cronica ?? []).map((c: any) => ({ t: c.t, key: 'legacy', params: { text: c.txt } })), log: [],
    ...(m.clima ? { weather: { t: m.clima.t, kind: table('weather')[m.clima.tipo] ?? m.clima.tipo } } : {}),
    ...(m.ruasExtra ? { extraStreets: m.ruasExtra } : {}), warned: !!m.aviso,
    ...(m.atrasos !== undefined ? { misses: m.atrasos } : {}), ...(m.prazoPedido ? { extendedDeadline: true } : {}),
    pendingTaxes: Object.fromEntries(Object.entries(m.pendentes ?? {}).map(([k, l]: [string, any]) => [TAX_IDS[k], l ? { general: l.geral ?? 0, ...(l.por ? { byGood: byGood(l.por) } : {}) } : null])),
    pendingLaws: Object.fromEntries(Object.keys(m.pendC ?? {}).map((k) => [table('laws')[k], true])), taxHistory: [],
    ...(m.saldoSem !== undefined ? { halfYearBalance: m.saldoSem } : {}), cavesSeen: [...(m.grutasVistas ?? [])],
    ...(m.quebraN !== undefined ? { businessStrain: m.quebraN } : {}), reports: [],
    fleet: Object.fromEntries(Object.entries(m.veic ?? {}).map(([k, f]) => [k, Object.fromEntries(Object.entries(f as Record<string, number>).map(([v, n]) => [table('vehicles')[v], n]))])),
    tariffMargin: { ...(m.tarifa ?? {}) },
    transport: { volume: { ...(m.transp?.vol ?? {}) }, firewoodShortage: m.transp?.lenhaFalta ?? 0, ...(m.transp?.ult ? { last: { margin: m.transp.ult.margem, loss: m.transp.ult.perda } } : {}) },
    effects: (m.efeitos ?? []).map((e: any) => ({ satisfaction: e.sat, seasonsLeft: e.restam, reason: 'legacy', params: { text: e.txt } })),
    ...(m.variedade !== undefined ? { variety: m.variedade } : {}),
    freightRelief: m.frenteFrete ?? 0, reliefWorkers: { ...(m.frenteIds ?? {}) }, race: null,
    vacated: { ...(m.vagos ?? {}) }, arrivalCosts: m.chegadasEst ?? 0, immigrationAgent: m.agente ? { ...(m.agente.origem ? { origin: table('origins')[m.agente.origem] } : {}) } : null,
    ...(m.filhosAno !== undefined ? { childrenThisYear: m.filhosAno } : {}), produced: byGood(m.prodBem),
    seasonWork: {
      buildings: { ...(m.pend ?? {}) }, streets: { ...(m.pendRua ?? {}) },
      upgrades: Object.fromEntries(Object.entries(m.pendNivel ?? {}).map(([k, v]) => [k, { cost: v as number, from: (m.pendNv0 ?? {})[k] ?? 0 }])),
      swaps: Object.fromEntries(Object.entries(m.pendTroca ?? {}).map(([k, v]: [string, any]) => [k, { from: table('buildings')[v.de] as never, cost: v.custo ?? 0, firstHarvest: v.plantio ?? 0 }])) as GameState['seasonWork']['swaps'],
    },
    reliefCost: m.frenteCusto ?? 0, buildCosts: m.obrasEst ?? 0, grantFactor: m.verbaMod ?? 1, ...(m.castigoVerba ? { grantCut: m.castigoVerba } : {}),
    intervention: !!m.intervencao, extraDemand: m.exig ?? 0,
    ...(m.histT ? { transportHistory: m.histT.map((h: any) => ({ t: h.t, hauled: h.esc, lost: h.perd, delivered: h.aprov, lostValue: h.perdV })) } : {}),
  };
}
