import { BUILDINGS, GOODS, VEHICLES } from './content.generated.js';

export type GoodId = keyof typeof GOODS;
export type BuildingId = keyof typeof BUILDINGS;
export type VehicleId = keyof typeof VEHICLES;

export const GOOD_IDS = Object.keys(GOODS) as GoodId[];
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
export const VEHICLE_IDS = Object.keys(VEHICLES) as VehicleId[];

export const isGood = (id: string): id is GoodId => id in GOODS;
export const isBuilding = (id: string): id is BuildingId => id in BUILDINGS;
export const isVehicle = (id: string): id is VehicleId => id in VEHICLES;
