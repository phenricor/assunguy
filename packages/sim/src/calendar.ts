// Time is counted in seasons. The game starts at season 12 because prices need a history first;
// for the player that season is Year 1, Spring.
export const FIRST_SEASON = 12;

export type SeasonIndex = 0 | 1 | 2 | 3; // spring, summer, autumn, winter

export const seasonOf = (t: number): SeasonIndex => (((t % 4) + 4) % 4) as SeasonIndex;
export const yearOf = (t: number): number => Math.max(1, Math.floor((t - FIRST_SEASON) / 4) + 1);
