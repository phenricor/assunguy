// The saved game. Everything the rules need between seasons lives here; the world is rebuilt from the seed.
import type { DistrictMemory } from './districts.js';
import type { BuildingId, GoodId, Sector, VehicleId } from '@assunguy/data';
import type { MapState } from './map.js';
import type { MarketState } from './market.js';
import type { LandId, LotKey } from './world.js';
import type { DilemmaId, LongCrisisId, QueuedEvent } from './events.js';

/** A home slot: the house's anchor lot and the family's place in it. */
export type FamilyId = `${LotKey}#${number}`;
export type Trade = Exclude<Sector, 'services'>;
export type TaxId = 'lotInstallment' | 'tithe' | 'exportDuty' | 'businessTax';
export type DestinationId = 'iguape' | 'curitiba' | 'paranagua' | 'saoPaulo';

export interface Family {
  id: FamilyId;
  /** Surname, a proper name shown as is in both languages. */
  surname: string;
  trade: Trade | null;
  /** 0 to 100. */
  skill: number;
  /** Seasons left with the newcomer wage. */
  newcomer: number;
  /** Seasons in a row without work and with a poor home. */
  idle: number;
  /** Season the family arrived. */
  arrived: number;
  savings: number;
  origin?: string;
  /** Formed by children of the colony, not by immigrants. */
  child?: boolean;
}

/** A tax in force: a general rate (or amount) and optional rates per good. */
export interface TaxLaw { general: number; byGood?: Partial<Record<GoodId, number>> }

/** A great work under way: seasons paid, relief-work advance banked, and whether it stalled for lack of cash. */
export interface GreatWork { active?: boolean; done?: boolean; paid?: number; extra?: number; stalled?: boolean }

/** A passing effect on the colony's mood (a festival, a scandal), with an i18n key for its reason. */
export interface Effect { satisfaction?: number; seasonsLeft: number; reason: string; params?: Record<string, string | number> }

export interface GameState {
  seed: number;
  mapVersion: number;
  map: MapState;
  /** Building upgrade level, 0 when missing. */
  upgrades: Record<LotKey, number>;
  families: Record<FamilyId, Family>;
  /** Home rating per house, written at the end of each season and read by the next allocation. */
  homeRating: Record<LotKey, number>;
  /** Share of families with water and an apothecary nearby (1 before the parish). */
  health: number;
  /** Whether each consumer good was found for sale last season (0 to 1). */
  supply: Partial<Record<GoodId, number>>;
  /** Season of each field's first harvest; fields are idle until then. */
  firstHarvest: Record<LotKey, number> | null;
  market: MarketState;
  cash: number;
  influence: number;
  level: number;
  milestone: number;
  deadline: number;
  goalStart: number;
  taxes: Record<TaxId, TaxLaw | null>;
  /** Town laws in force. */
  laws: Partial<Record<string, true>>;
  /** Path choices taken at each level. */
  choices: Partial<Record<number, string>>;
  greatWorks: Partial<Record<string, GreatWork>>;
  /** City problems: an epidemic under way, the disorder level, the last fire. */
  problems: { epidemic?: { disease: string; seasonsLeft: number; since: number } | null; disorder?: number; lastFire?: number; fireHomes?: number };
  /** The long crisis under way (republic, encilhamento, federalist revolution, mate cycle), if any. */
  crisis: { id: string; seasonsLeft: number; since?: number } | null;
  nextCrisis?: { id: LongCrisisId; at: number } | null;
  lastCrisis?: number;
  crisesSeen?: LongCrisisId[];
  /** Events waiting for the player's decision, oldest first. */
  queue: QueuedEvent[];
  /** Consequences scheduled for a later season. */
  agenda: { id: DilemmaId; t: number }[];
  /** Season each dilemma was last drawn. */
  used: Partial<Record<string, number>>;
  lastDilemma?: number;
  nextArrival?: number;
  nextSwapAsk?: number;
  flags: Partial<Record<string, boolean>>;
  chronicle: { t: number; key: string; params?: Record<string, string | number> }[];
  /** What happened this season, for the report: buildings, swaps, decisions. */
  log: { t: number; kind: string; [k: string]: unknown }[];
  weather?: { t: number; kind: string };
  /** Extra street lots the works crews can lay this season (the engineer). */
  extraStreets?: number;
  /** A missed deadline was already announced. */
  warned: boolean;
  /** Deadlines missed for the current milestone. */
  misses?: number;
  /** The province already granted one extension for this milestone. */
  extendedDeadline?: boolean;
  /** Taxes and town laws passed this season; they come into force at the turn. */
  pendingTaxes: Partial<Record<TaxId, TaxLaw | null>>;
  pendingLaws: Partial<Record<string, true>>;
  taxHistory: { id: TaxId; t: number }[];
  /** Cash change since the last province report. */
  halfYearBalance?: number;
  lastProvinceReport?: unknown;
  cavesSeen: LotKey[];
  /** Seasons in a row a business has been crushed by taxes. */
  businessStrain?: number;
  /** Progress toward the next level, 0 to 1. */
  progress?: number;
  reports: unknown[];
  /** Vehicles at each transport building. */
  fleet: Record<LotKey, Partial<Record<VehicleId, number>>>;
  /** Tariff margin set at each transport building. */
  tariffMargin: Record<LotKey, number>;
  transport: { volume: Record<LotKey, number>; firewoodShortage: number; last?: { margin: number; loss: number }; fullNoted?: Partial<Record<LotKey, 1>> };
  transportHistory?: { t: number; hauled: number; lost: number; delivered: number; lostValue: number }[];
  effects: Effect[];
  /** How many dishes the families' table had last season. */
  variety?: number;
  /** Freight cut bought by the relief works (0 to 1). */
  freightRelief: number;
  /** Families employed by the relief works. */
  reliefWorkers: Partial<Record<FamilyId, true>>;
  /** Home slots freed this season (a family lost its lot); no group moves in until next season. */
  vacated: Partial<Record<FamilyId, true>>;
  /** Arrival aid and seed paid this season, shown in the report. */
  arrivalCosts: number;
  /** The immigration agent under contract, if any, and the origin it recruits from. */
  immigrationAgent: { origin?: string } | null;
  childrenThisYear?: number;
  /** Last season's production by good, for screens and home upgrades. */
  produced: Partial<Record<GoodId, number>>;
  /** What the player built this season (relief works staff them). */
  /** What the player did this season, with what it cost, so it can be undone until the season passes (and relief works staff it). */
  seasonWork: {
    buildings: Partial<Record<LotKey, number>>;
    streets: Partial<Record<LotKey, number>>;
    upgrades: Partial<Record<LotKey, { cost: number; from: number }>>;
    swaps: Partial<Record<LotKey, { from: BuildingId; cost: number; firstHarvest: number }>>;
  };
  reliefCost: number;
  /** Spent on building this season, shown in the report. */
  buildCosts: number;
  /** Grant multiplier set by the last province report. */
  grantFactor: number;
  /** Seasons left of a grant cut imposed by an event. */
  grantCut?: number;
  /** The inspector is in charge after a missed deadline. */
  intervention: boolean;
  /** Extra families the next milestone asks for, in steps of 5%. */
  extraDemand: number;
  /** Districts remembered between seasons (from the village on). */
  districts?: DistrictMemory;
  /** The late-game transport race; not ported yet. */
  race: null;
}

export const upgradeOf = (s: Pick<GameState, 'upgrades'>, key: LotKey): number => s.upgrades[key] ?? 0;
export const hasLaw = (s: Pick<GameState, 'laws'>, id: string): boolean => !!s.laws[id];
export const hasChoice = (s: Pick<GameState, 'choices'>, id: string): boolean => Object.values(s.choices).includes(id);
export const workDone = (s: Pick<GameState, 'greatWorks'>, id: string): boolean => !!s.greatWorks[id]?.done;
export const crisisOn = (s: Pick<GameState, 'crisis'>, id: string): boolean => !!s.crisis && s.crisis.id === id && s.crisis.seasonsLeft > 0;
export const homeOf = (id: FamilyId): LotKey => id.slice(0, id.indexOf('#')) as LotKey;
export const taxRate = (s: Pick<GameState, 'taxes'>, id: TaxId, good?: GoodId): number => {
  const l = s.taxes[id];
  if (!l) return 0;
  return good && l.byGood && l.byGood[good] !== undefined ? (l.byGood[good] as number) : l.general || 0;
};
export type { BuildingId, LandId };
