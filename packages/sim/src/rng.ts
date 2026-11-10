// Seeded random sources. The simulation never calls Math.random: every draw comes from a seed kept in
// the game state, so the same seed and the same commands always produce the same colony.

/** Mulberry32: used for world generation and anything drawn once from the map seed. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Linear congruential step kept inside a mutable holder (the market and the season roll carry their
 * own seed in the state). Returns a value in [0, 1].
 */
export function lcgNext(holder: { seed: number }): number {
  holder.seed = (Math.imul(holder.seed, 1664525) + 1013904223) | 0;
  return ((holder.seed >>> 8) & 65535) / 65535;
}

/** Stable hash of a string key (lot keys, names), for per-lot variation without a draw. */
export function hashKey(key: string): number {
  let h = 7;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** Deterministic value in [0, 1) for a lot and a salt. */
export function lotNoise(a: number, b: number, salt: number): number {
  let h = Math.imul(a + 1, 73856093) ^ Math.imul(b + 1, 19349663) ^ Math.imul(salt + 1, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
