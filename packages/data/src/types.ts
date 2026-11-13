// Shapes of the game's content tables. Everything the rules read comes from data of these shapes,
// so balancing a number never means touching simulation code.

export type Season = 0 | 1 | 2 | 3; // spring, summer, autumn, winter
export type GoodGroup = 'farming' | 'river' | 'crafts' | 'mining';
export type Sector = 'farming' | 'river' | 'commerce' | 'crafts' | 'mining' | 'services';
export type Category = 'housing' | 'services' | 'commerce' | 'transport' | 'crops' | 'livestock' | 'extraction' | 'workshops' | 'retired';
export type TransportMode = 'river' | 'road' | 'rail';

export interface GoodDef {
  group: GoodGroup;
  /** Price paid inside the colony, per arroba. */
  localPrice: number;
  /** Reference price at the outside market, before freight. */
  exportPrice: number;
  /** Arrobas per year the outside market absorbs before prices sag. */
  baseDemand?: number;
  food?: boolean;
  /** Cannot be stored between seasons at all (fresh fish). */
  spoils?: boolean;
  /** Loses more when carried far on foot. */
  perishable?: boolean;
  /** Arrobas each family buys per season, for non-food consumer goods. */
  perFamily?: number;
  /** Relative share in a family's meals. */
  dietWeight?: number;
}

export interface Recipe {
  from: string;
  to: string;
  /** Arrobas of output per arroba of input. */
  ratio: number;
  minLevel?: number;
}

export interface BuildingDef {
  category: Category;
  cost: number;
  /** Who pays upkeep and wages: the families themselves or the colony's purse. */
  payer: 'families' | 'colony';
  minLevel?: number;
  /** Families it houses. */
  housing?: number;
  jobs?: number;
  sector?: Sector;
  service?: string;
  /** Street distance the service reaches. */
  radius?: number;
  color?: string;
  size?: readonly [number, number];
  riverside?: boolean;
  /** Must have water (river, lake, brook) within this many lots. */
  nearWater?: number;
  /** Yields more with trees around (up to 4 lots away). */
  nearForest?: boolean;
  crop?: boolean;
  output?: { good: string; perSeason: number; season?: Season | number };
  extraOutputs?: readonly { good: string; perSeason: number }[];
  /** How much it bothers the neighbours (smell, noise). */
  nuisance?: number;
  /** Arrobas of input per worker per season. */
  processingCapacity?: number;
  recipes?: readonly Recipe[];
  capacity?: Readonly<Record<string, number>>;
  onDeposit?: readonly string[];
  lateGame?: boolean;
  fixed?: boolean;
  teaches?: boolean;
}

export interface VehicleDef {
  mode: TransportMode;
  /** Arrobas per season. */
  cargo: number;
  price: number;
  /** Per season. */
  upkeep: number;
  minLevel?: number;
  firewood?: number;
  lateGame?: boolean;
}

export interface TransportRoleDef {
  role: 'commerce' | 'collection' | 'gateway';
  mode?: TransportMode;
  /** Lots (Manhattan) it collects from. */
  reach?: number;
  vehicles?: readonly string[];
  /** Vehicle slots by building level 0, 1, 2. */
  slots?: readonly number[];
  /** The vehicle a new building comes with, so it carries from the first season. */
  starter?: string;
}

export interface LevelDef {
  level: number;
  workers: number;
  income: number;
  milestone?: number;
  requires?: Readonly<Record<string, number>>;
  /** At most this share of families without work (0 to 1). */
  idle?: number;
  /** At least this many districts (hamlets do not count). */
  districts?: number;
}

export interface MilestoneDef {
  id: string;
  /** Province grant per season. */
  grant: number;
  shareOfTrade: number;
  families?: number;
  satisfaction?: number;
  lands?: number;
  /** Seasons allowed since the previous milestone. */
  deadline?: number;
  road?: boolean;
  requires?: Readonly<Record<string, number>>;
}

export interface LawDef {
  satisfaction: number;
  requires?: string;
}

export interface BiomeDef {
  forest: number;
  soil: Readonly<Record<string, number>>;
  deposits: Readonly<Record<string, number>>;
}

export interface BalanceDef {
  subsistencePerSeason: number;
  subsistenceIncomeShare: number;
  storageKeep: { none: number; grain: number; fresh: number };
  riverFreight: number;
  freeCarryDistance: number;
  /** Each upgrade the colony pays for opens one more job (the prototype opened one at level 2 only). */
  upgradeOpensJobs: boolean;
  /** Milestones count families at work, not all families (the prototype counted all). */
  milestoneWorkers: boolean;
  /** The colony starts in four houses (homes hold one to four families); off, the prototype's house and three huts. */
  smallHomes: boolean;
  /** Districts from the first season (the first called the Colony while alone), holding production as well as homes;
   *  the prototype had districts of homes only, from the village. */
  districtsFromStart: boolean;
  /** Points of satisfaction above the milestone's the advisor keeps when it suggests a tithe (the prototype kept 3). */
  titheSpare: number;
  /** The advisor also suggests the export duty (the prototype suggested only the tithe). */
  adviseExportDuty: boolean;
  routeChoiceSharpness: number;
  isolatedCommerceWeight: number;
  lotPrice: number;
  seedAid: number;
  arrivalAid: number;
  newcomerWage: number;
  wasteLimit: number;
  firewoodPrice: number;
  expeditionCost: number;
  autosaves: number;
  travelTime: Readonly<Record<string, number>>;
  tariffMargins: readonly number[];
  depositYield: Readonly<Record<string, number>>;
  milestoneCostFactor: readonly number[];
}

export interface WorldDef {
  width: number;
  height: number;
  regionSize: number;
  regionCols: number;
  regionRows: number;
  startColumn: number;
  startRow: number;
}
