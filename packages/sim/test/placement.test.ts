import { describe, expect, it } from 'vitest';
import type { BuildingId } from '@assunguy/data';
import { canPlace, canPlaceStreet, type PlacementError } from '../src/placement.js';
import { generateWorld } from '../src/world.js';
import fixture from './fixtures/placement.json' with { type: 'json' };
import { LEGACY, legacyState } from './legacy.js';

const F = fixture as unknown as { state: Record<string, unknown>; box: [number, number, number, number]; msgs: string[]; out: Record<string, string> };
const CODE: Record<string, PlacementError | null> = {
  '': null, 'Esta terra ainda não é da colônia': 'notOurLand', 'Não dá para construir no rio': 'inRiver', 'Lote ocupado': 'occupied', 'Tem rua no caminho': 'streetInWay',
  'Precisa de rua ao lado': 'needsStreet', 'Precisa encostar numa rua ou em outra construção': 'needsNeighbour', 'A mina precisa ficar sobre um veio': 'mineNeedsDeposit',
  'O erval precisa ficar sobre erva-mate nativa': 'groveNeedsYerba', 'Precisa ficar na beira do rio': 'needsRiver', 'Precisa ficar na beira do rio ou de uma lagoa': 'needsRiverOrLake',
  'Precisa ficar na beira do rio ou de um ribeirão': 'needsRiverOrStream', 'Precisa ficar na beira do rio ou de um córrego': 'needsRiverOrBrook', 'Aqui há erva-mate nativa: só cabe um erval': 'yerbaOnlyGrove',
  'A ponte precisa sair de uma rua e atravessar o rio': 'bridgeNeedsStreets', 'Tem um prédio aqui': 'buildingHere', 'Já tem rua aqui': 'streetHere',
  'O arroz precisa ficar perto do rio, de uma lagoa ou de um córrego': 'needsWaterNear', 'Este lote é um veio: só cabe mina': 'depositOnlyMine', 'Fora do mapa': 'outOfMap',
  'Corredeira: o barco não encosta aqui': 'rapids', 'Lajedo: pedra demais para roça': 'bedrock',
};
const code = (m: string): PlacementError | null => (m in CODE ? (CODE[m] as PlacementError | null) : m.endsWith('a rua não passa') ? 'natureBlocksStreet' : 'natureBlocks');

describe('placement rules (golden, against the speedrun save)', () => {
  const s = legacyState(F.state), w = generateWorld(s.seed, s.mapVersion);
  const [a0, a1, b0, b1] = F.box;
  for (const [legacy, out] of Object.entries(F.out)) {
    it(`agrees on every lot for ${legacy}`, () => {
      let i = 0;
      const wrong: string[] = [];
      for (let a = a0; a <= a1; a++) for (let b = b0; b <= b1; b++) {
        const want = code(F.msgs[out.charCodeAt(i++) - 65] as string);
        const got = legacy === 'rua' ? canPlaceStreet(s.map, w, a, b) : canPlace(s.map, w, (LEGACY.buildings as Record<string, string>)[legacy] as BuildingId, a, b);
        if (got !== want) wrong.push(`${a},${b}: ${got} vs ${want}`);
      }
      expect(wrong.slice(0, 5)).toEqual([]);
    });
  }
});
