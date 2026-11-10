// Streets: the network that matters is the one touching the river port (or, without a port, the largest).
// A building works only when it is linked to it; fields can link through a neighbouring linked building.
import { BUILDINGS, type BuildingId } from '@assunguy/data';
import { around, occupancy, sizeOf, type MapState } from './map.js';
import { lotKey, parseKey, type LotKey } from './world.js';

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
type Streets = Pick<MapState, 'streets'>;
type Built = Pick<MapState, 'streets' | 'buildings'>;

/** Street lots touching a building. */
export function streetsBeside(map: Built, key: LotKey): LotKey[] {
  const [a, b] = parseKey(key);
  return around(a, b, map.buildings[key] as BuildingId).map(([x, y]) => lotKey(x, y)).filter((v) => map.streets[v]);
}

/** The street network that serves the colony. */
export function mainNetwork(map: Built): Set<LotKey> {
  const seen = new Map<LotKey, Set<LotKey>>();
  const parts: Set<LotKey>[] = [];
  for (const start of Object.keys(map.streets) as LotKey[]) {
    if (seen.has(start)) continue;
    const part = new Set<LotKey>([start]);
    seen.set(start, part);
    const queue = [start];
    while (queue.length) {
      const [a, b] = parseKey(queue.pop() as LotKey);
      for (const [x, y] of NEIGHBOURS) {
        const v = lotKey(a + x, b + y);
        if (map.streets[v] && !seen.has(v)) { seen.set(v, part); part.add(v); queue.push(v); }
      }
    }
    parts.push(part);
  }
  let best: Set<LotKey> | null = null;
  for (const key of Object.keys(map.buildings) as LotKey[]) {
    if (map.buildings[key] !== 'riverPort') continue;
    const [a, b] = parseKey(key);
    for (const [x, y] of around(a, b, 'riverPort')) {
      const part = seen.get(lotKey(x, y));
      if (part && (!best || part.size > best.size)) best = part;
    }
  }
  if (!best) for (const part of parts) if (!best || part.size > best.size) best = part;
  return best ?? new Set();
}

/** Buildings linked to the main network. */
export function connected(map: Built): Set<LotKey> {
  const net = mainNetwork(map);
  const linked = new Set<LotKey>();
  for (const key of Object.keys(map.buildings) as LotKey[]) if (streetsBeside(map, key).some((s) => net.has(s))) linked.add(key);
  // a field needs no street: touching another linked building is enough, and it passes the link on
  const occ = occupancy(map), queue = [...linked];
  while (queue.length) {
    const key = queue.pop() as LotKey;
    const [a, b] = parseKey(key);
    for (const [x, y] of around(a, b, map.buildings[key] as BuildingId)) {
      const o = occ[lotKey(x, y)];
      if (o && !linked.has(o) && (BUILDINGS[map.buildings[o] as BuildingId] as { crop?: boolean }).crop) { linked.add(o); queue.push(o); }
    }
  }
  return linked;
}

/** Street distance from a building to every street lot within the radius (0 for the streets beside it). */
export function reach(map: Built, key: LotKey, radius: number): Map<LotKey, number> {
  const dist = new Map<LotKey, number>();
  let front = streetsBeside(map, key);
  for (const s of front) dist.set(s, 0);
  for (let d = 1; d <= radius && front.length; d++) {
    const next: LotKey[] = [];
    for (const s of front) {
      const [a, b] = parseKey(s);
      for (const [x, y] of NEIGHBOURS) {
        const v = lotKey(a + x, b + y);
        if ((map as Streets).streets[v] && !dist.has(v)) { dist.set(v, d); next.push(v); }
      }
    }
    front = next;
  }
  return dist;
}

/** Chebyshev distance from a lot to a building's footprint. */
export function distanceToFootprint(a: number, b: number, key: LotKey, type: BuildingId): number {
  const [x, y] = parseKey(key), [w, h] = sizeOf(type);
  return Math.max(Math.max(x - a, 0, a - (x + w - 1)), Math.max(y - b, 0, b - (y + h - 1)));
}

export const centreOf = (key: LotKey, type: BuildingId): [number, number] => {
  const [a, b] = parseKey(key), [w, h] = sizeOf(type);
  return [a + w / 2, b + h / 2];
};
