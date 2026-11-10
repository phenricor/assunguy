// Where a building or a street can go. Returns null when it can, or the reason it cannot (an i18n key).
import { type BuildingId } from '@assunguy/data';
import { def } from './economy.js';
import { around, cellsOf, occupancy, sizeOf, type MapState, type NatureKind } from './map.js';
import { inBounds, landOf, lotKey, type LotKey, type World } from './world.js';

const RUNNING: Partial<Record<NatureKind, true>> = { stream: true, brook: true, waterfall: true, rapids: true };
const WATER_NATURE: Partial<Record<NatureKind, true>> = { stream: true, brook: true, waterfall: true, oxbow: true, wetSinkhole: true };
const ours = (map: Pick<MapState, 'lands'>, a: number, b: number) => map.lands[landOf(a, b)] === 'ours';

export type PlacementError =
  | 'outOfMap' | 'notOurLand' | 'streetHere' | 'buildingHere' | 'bridgeNeedsStreets' | 'natureBlocksStreet' | 'inRiver' | 'streetInWay'
  | 'occupied' | 'mineNeedsDeposit' | 'groveNeedsYerba' | 'yerbaOnlyGrove' | 'depositOnlyMine' | 'bedrock' | 'natureBlocks'
  | 'needsRiverOrLake' | 'needsRiverOrBrook' | 'needsRiverOrStream' | 'needsRiver' | 'rapids' | 'needsWaterNear' | 'needsNeighbour' | 'needsStreet';

/** A street lot: on our land, free, and a bridge only from a street across the river. */
export function canPlaceStreet(map: MapState, w: World, a: number, b: number): PlacementError | null {
  const key = lotKey(a, b);
  if (!inBounds(a, b)) return 'outOfMap';
  if (!ours(map, a, b)) return 'notOurLand';
  if (map.streets[key]) return 'streetHere';
  if (occupancy(map)[key]) return 'buildingHere';
  if (w.water.has(key) && !(map.streets[lotKey(a, b - 1)] || map.streets[lotKey(a, b + 1)])) return 'bridgeNeedsStreets';
  const n = map.nature[key];
  if (n && !RUNNING[n] && n !== 'bedrock') return 'natureBlocksStreet';
  return null;
}

/** A building with its anchor at (a, b). `ignore` is a building being moved or swapped in place. */
export function canPlace(map: MapState, w: World, type: BuildingId, a: number, b: number, ignore?: LotKey): PlacementError | null {
  const T = def(type), occ = occupancy(map);
  for (const [x, y] of cellsOf(a, b, type)) {
    const c = lotKey(x, y);
    if (!inBounds(x, y)) return 'outOfMap';
    if (!ours(map, x, y)) return 'notOurLand';
    if (w.water.has(c)) return 'inRiver';
    if (map.streets[c]) return 'streetInWay';
    if (occ[c] && occ[c] !== ignore) return 'occupied';
    const on = T.onDeposit as readonly string[] | undefined, dep = w.deposits[c];
    if (on && !(dep && on.includes(dep))) return type === 'mine' ? 'mineNeedsDeposit' : 'groveNeedsYerba';
    if (!on && dep) return dep === 'yerba' ? 'yerbaOnlyGrove' : 'depositOnlyMine';
    const nt = map.nature[c];
    if (nt === 'bedrock' && T.crop) return 'bedrock';
    if (nt && nt !== 'bedrock') return 'natureBlocks';
  }
  const ring = around(a, b, type);
  // a fishery also works by a lake; a mill also by a brook; a landing also by a stream
  const waterSide = (x: number, y: number) => {
    const k = lotKey(x, y), n = map.nature[k];
    return (w.water.has(k) && !map.streets[k]) || (type === 'fishery' && n === 'oxbow') || (type === 'mill' && (n === 'brook' || n === 'waterfall' || n === 'stream') && !map.streets[k]) || (type === 'landing' && n === 'stream' && !map.streets[k]);
  };
  if (T.riverside && !ring.some(([x, y]) => waterSide(x, y))) return type === 'fishery' ? 'needsRiverOrLake' : type === 'mill' ? 'needsRiverOrBrook' : type === 'landing' ? 'needsRiverOrStream' : 'needsRiver';
  if ((type === 'riverPort' || type === 'steamPier') && ring.some(([x, y]) => map.nature[lotKey(x, y)] === 'rapids')) return 'rapids';
  if (T.nearWater) {
    const r = T.nearWater, [w0] = sizeOf(type);
    let found = false;
    for (let x = -r; x <= r + w0 && !found; x++) for (let y = -r; y <= r + w0; y++) { const k = lotKey(a + x, b + y), n = map.nature[k]; if (w.water.has(k) || (n && WATER_NATURE[n])) { found = true; break; } }
    if (!found) return 'needsWaterNear';
  }
  if (T.crop) { if (!ring.some(([x, y]) => map.streets[lotKey(x, y)] || occ[lotKey(x, y)])) return 'needsNeighbour'; }
  else if (!ring.some(([x, y]) => map.streets[lotKey(x, y)])) return 'needsStreet';
  return null;
}
