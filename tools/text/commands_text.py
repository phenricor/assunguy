# Writes the texts the player's commands need into both locales: chronicle lines and the reason a command
# was refused (error.<code>). Names in {braces} are filled by the interface. No middle dots, no dashes.
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[2]
LOC = ROOT / 'packages' / 'i18n' / 'locales'

CHRONICLE = {
  'explored': ('explorou {land}.', 'explored {land}.'),
  'annexed': ('anexou {land}.', 'annexed {land}.'),
  'boughtVehicle': ('comprou um veículo ({vehicle}) para {building}.', 'bought a vehicle ({vehicle}) for {building}.'),
  'lawRepealed': ('revogou a lei {law}.', 'repealed the {law} law.'),
  'agentHired': ('contratou um agente de imigração.', 'hired an immigration agent.'),
  'askedFunds': ('pediu verba extra à província.', 'asked the province for extra funds.'),
  'askedTime': ('pediu mais prazo à província.', 'asked the province for more time.'),
}
ERRORS = {
  # placement
  'outOfMap': ('Fora do mapa', 'Off the map'),
  'notOurLand': ('A terra não é da colônia', 'Not the colony\'s land'),
  'streetHere': ('Já há rua aqui', 'There is a street here'),
  'buildingHere': ('Já há um prédio aqui', 'There is a building here'),
  'bridgeNeedsStreets': ('A ponte precisa de rua nas duas margens', 'A bridge needs a street on both banks'),
  'natureBlocksStreet': ('A natureza não deixa abrir rua aqui', 'Nature blocks a street here'),
  'inRiver': ('Dentro do rio', 'In the river'),
  'streetInWay': ('Há uma rua no caminho', 'A street is in the way'),
  'occupied': ('Lote ocupado', 'Lot taken'),
  'mineNeedsDeposit': ('Mina só sobre um veio', 'A mine goes only on a deposit'),
  'groveNeedsYerba': ('Erval só onde há erva-mate nativa', 'A yerba grove goes only where yerba grows wild'),
  'yerbaOnlyGrove': ('Aqui só cabe um erval', 'Only a yerba grove fits here'),
  'depositOnlyMine': ('Sobre um veio só cabe uma mina', 'Only a mine fits on a deposit'),
  'bedrock': ('Lajedo: não dá para construir', 'Bedrock: nothing can be built'),
  'natureBlocks': ('A natureza não deixa construir aqui', 'Nature blocks building here'),
  'needsRiverOrLake': ('Precisa de rio ou lagoa ao lado', 'Needs a river or lake next to it'),
  'needsRiverOrBrook': ('Precisa de rio ou córrego ao lado', 'Needs a river or brook next to it'),
  'needsRiverOrStream': ('Precisa de rio ou ribeirão ao lado', 'Needs a river or stream next to it'),
  'needsRiver': ('Precisa da beira do rio', 'Needs the river bank'),
  'rapids': ('Corredeira: as canoas não passam', 'Rapids: canoes cannot pass'),
  'needsWaterNear': ('Precisa de água por perto', 'Needs water nearby'),
  'needsNeighbour': ('Precisa de um prédio ao lado', 'Needs a building next to it'),
  'needsStreet': ('Precisa de rua ao lado', 'Needs a street next to it'),
  # commands
  'noCash': ('Falta dinheiro', 'Not enough cash'),
  'noInfluence': ('Falta influência', 'Not enough influence'),
  'locked': ('Ainda não liberado', 'Not unlocked yet'),
  'notHere': ('Não há o que fazer aqui', 'Nothing to do here'),
  'sameLot': ('É o mesmo lote', 'Same lot'),
  'councilHasLaws': ('Antes de demolir a Câmara, revogue impostos e leis', 'Repeal taxes and laws before demolishing the council'),
  'notFamilyPaid': ('As famílias melhoram este prédio por conta própria', 'Families upgrade this building themselves'),
  'maxLevel': ('Já está no nível máximo', 'Already at the top level'),
  'streetLimit': ('As turmas já abriram todos os trechos desta estação', 'The work gangs opened all the streets they can this season'),
  'notNeighbour': ('Longe demais: primeiro anexe uma terra vizinha', 'Too far: annex a neighbouring land first'),
  'alreadyKnown': ('Esta terra já foi explorada', 'This land is already explored'),
  'unknownLand': ('Terra desconhecida: envie uma expedição antes', 'Unknown land: send an expedition first'),
  'alreadyOurs': ('A terra já é da colônia', 'The land is already the colony\'s'),
  'wrongVehicle': ('Este prédio não recebe esse veículo', 'This building does not take that vehicle'),
  'noSlot': ('Sem vaga: melhore o prédio para caber mais', 'No slot: upgrade the building to fit more'),
  'noVehicle': ('Não há esse veículo aqui', 'No such vehicle here'),
  'notCrop': ('Só se troca uma plantação por outra', 'Only a field can be swapped for another'),
  'stillGreen': ('A plantação ainda não colheu', 'The field has not harvested yet'),
  'cropNotFit': ('Essa cultura não cabe neste lote', 'That crop does not fit this lot'),
  'noCouncil': ('Requer Câmara', 'Requires a council'),
  'noLawSlot': ('Sem vaga para outra lei', 'No room for another law'),
  'needsLaw': ('Requer outra lei antes', 'Requires another law first'),
  'badRate': ('Taxa fora do permitido', 'Rate out of range'),
  'alreadyAsked': ('Já pedido nesta meta', 'Already asked for this goal'),
  'inspector': ('Com o inspetor aqui, não há conversa', 'With the inspector here, there is no talking'),
  'noMilestone': ('Não há próxima meta', 'There is no next goal'),
}
src = (ROOT / 'packages/sim/src/commands.ts').read_text() + (ROOT / 'packages/sim/src/placement.ts').read_text()
codes = set(re.findall(r"'([a-zA-Z]+)'", src[src.index('export type PlacementError'):src.index(';', src.index('export type PlacementError'))]))
codes |= set(re.findall(r"'([a-zA-Z]+)'", src[src.index('export type CommandError'):src.index(';', src.index('export type CommandError'))]))
missing = codes - ERRORS.keys()
assert not missing, missing
for i, lang in enumerate(['pt-BR', 'en']):
    p = LOC / f'{lang}.json'
    d = json.loads(p.read_text())
    for k, v in CHRONICLE.items(): d[f'chronicle.{k}'] = v[i]
    for k, v in ERRORS.items():
        assert '·' not in v[i] and '—' not in v[i]
        d[f'error.{k}'] = v[i]
    p.write_text(json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=1) + '\n')
print('errors:', len(ERRORS), 'chronicle:', len(CHRONICLE))
