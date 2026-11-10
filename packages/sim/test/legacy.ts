// Helpers for golden tests against the frozen prototype (see tools/legacy-oracle).
import idMap from '../../../legacy/id-map.json' with { type: 'json' };

export const LEGACY = idMap as unknown as Record<string, Record<string, string>>;

export const goodFromLegacy = (id: string): string => {
  const g = LEGACY.goods?.[id];
  if (!g) throw new Error(`no English id for legacy good ${id}`);
  return g;
};

export const SHOCK_KIND: Record<string, string> = { peste: 'pest', procura: 'demand', preco: 'price', cap: 'capacity' };
