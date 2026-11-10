// Helpers for golden tests against the frozen prototype (see tools/legacy-oracle).
import type { MapState } from '../src/map.js';
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
