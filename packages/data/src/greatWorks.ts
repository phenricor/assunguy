// Great works: multi-year projects paid in instalments, with a permanent effect and upkeep.
// Order matters: it is the order relief works are assigned and works advance each season.
export interface GreatWorkDef {
  /** Milestone that unlocks it (parish 1, village 2, town 3), or a colony level. */
  milestone?: number;
  level?: number;
  /** Needs the road to Curitiba. */
  road?: boolean;
  /** Needs a deposit of this kind on the colony's lands. */
  deposit?: string;
  cost: number;
  /** Seasons of instalments. */
  seasons: number;
  /** Upkeep per season once done. */
  upkeep: number;
}

export const GREAT_WORKS = {
  telegraph: { milestone: 2, road: true, cost: 4000, seasons: 8, upkeep: 20 },
  macadamRoad: { milestone: 3, road: true, cost: 12000, seasons: 12, upkeep: 40 },
  railSpur: { level: 11, cost: 40000, seasons: 16, upkeep: 120 },
  normalSchool: { milestone: 2, cost: 7000, seasons: 8, upkeep: 40 },
  jerkyPlant: { milestone: 2, cost: 5000, seasons: 6, upkeep: 30 },
  limeWorks: { milestone: 2, cost: 6000, seasons: 6, upkeep: 40, deposit: 'lime' },
  hospital: { milestone: 3, cost: 9000, seasons: 8, upkeep: 60 },
  steamSawmill: { milestone: 3, cost: 6500, seasons: 6, upkeep: 40 },
} as const satisfies Record<string, GreatWorkDef>;
export type GreatWorkId = keyof typeof GREAT_WORKS;
export const GREAT_WORK_IDS = Object.keys(GREAT_WORKS) as GreatWorkId[];
