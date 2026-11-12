export * from './types.js';
export * from './content.generated.js';
export * from './ids.js';
export * from './greatWorks.js';

import { LEVELS as _LEVELS } from './content.generated.js';
/** The last level: reaching it wins the game, and the race is won only there. */
export const topLevel = (): number => Math.max(..._LEVELS.map((l) => l.level));
/** The level that carries each milestone (1 parish, 2 village, 3 town). */
export const milestoneLevel = (m: number): number => (_LEVELS.find((l) => l.milestone === m) ?? { level: topLevel() }).level;
