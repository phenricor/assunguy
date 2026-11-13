// The golden tests replay the prototype, so they run on its rules: twelve levels, homes for two to six families,
// milestones that count every family, districts from the village, and the starting village of a house and three
// huts. The game's tables are changed in place for the test file (each test file runs in its own module scope);
// the returned function puts them back.
import { BALANCE, BUILDINGS, GREAT_WORKS, LEVELS, LEVEL_UNLOCKS, MILESTONES, PATH_CHOICES, VEHICLES } from '@assunguy/data';
import old from './fixtures/prototype-rules.json' with { type: 'json' };

type Bag = Record<string, unknown>;
const swapArray = (a: readonly unknown[], b: readonly unknown[]) => { const was = [...a]; (a as unknown[]).splice(0, a.length, ...b); return was; };
const swapRecord = (a: object, b: object) => { const was = { ...a }; for (const k of Object.keys(a)) delete (a as Bag)[k]; Object.assign(a, b); return was; };

export function applyPrototypeRules(): () => void {
  const undo: (() => void)[] = [];
  const set = (o: object, k: string, v: unknown) => { const r = o as Bag, had = k in r, was = r[k]; r[k] = v; undo.push(() => { if (had) r[k] = was; else delete r[k]; }); };
  set(BALANCE, 'milestoneWorkers', false); set(BALANCE, 'smallHomes', false); set(BALANCE, 'districtsFromStart', false); set(BALANCE, 'titheSpare', 3); set(BALANCE, 'adviseExportDuty', false); set(BALANCE, 'taxFloorAfterTown', 60);
  for (const [t, h] of Object.entries(old.housing)) set(BUILDINGS[t as keyof typeof BUILDINGS], 'housing', h);
  for (const [t, l] of Object.entries(old.minLevel)) set(BUILDINGS[t as keyof typeof BUILDINGS], 'minLevel', l);
  for (const [t, ls] of Object.entries(old.recipes)) (BUILDINGS[t as keyof typeof BUILDINGS] as unknown as { recipes: Bag[] }).recipes.forEach((r, i) => { if (ls[i] != null) set(r, 'minLevel', ls[i]); });
  for (const [v, l] of Object.entries(old.vehicles)) set(VEHICLES[v as keyof typeof VEHICLES], 'minLevel', l);
  set(GREAT_WORKS.railSpur, 'level', old.railSpur);
  const L = swapArray(LEVELS, old.levels), M = swapArray(MILESTONES, old.milestones), U = swapRecord(LEVEL_UNLOCKS, old.unlocks), P = swapRecord(PATH_CHOICES, old.paths);
  undo.push(() => { swapArray(LEVELS, L); swapArray(MILESTONES, M); swapRecord(LEVEL_UNLOCKS, U); swapRecord(PATH_CHOICES, P); });
  return () => { for (const f of undo.reverse()) f(); };
}
