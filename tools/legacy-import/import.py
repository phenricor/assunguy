#!/usr/bin/env python3
"""One-way import of the prototype's content tables into the typed data package.

Reads legacy/prototype-data.json (dumped from the running prototype) and writes:
  packages/data/src/content.generated.ts   typed tables with English ids and fields
  packages/i18n/locales/pt-BR.json          Portuguese strings (merged, existing keys kept)
  packages/i18n/locales/en.json             English strings (merged, existing keys kept)

After the first import the generated tables are the source of truth; re-running only
refreshes the generated file and fills locale keys that are still missing.
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'legacy', 'prototype-data.json')

GOODS = {
    'milho': 'corn', 'feijao': 'beans', 'mandioca': 'cassava', 'arroz': 'rice', 'trigo': 'wheat',
    'pinhao': 'pineNut', 'peixe': 'fish', 'salgado': 'saltFish', 'arrozP': 'huskedRice', 'charque': 'jerky',
    'fuba': 'cornmeal', 'farinha': 'cassavaFlour', 'farinhaT': 'wheatFlour', 'toucinho': 'lard', 'carne': 'meat',
    'cana': 'sugarcane', 'rapadura': 'rapadura', 'aguardente': 'cachaca', 'acucar': 'sugar', 'erva': 'yerba',
    'mate': 'mate', 'fumo': 'tobaccoLeaf', 'fumoC': 'ropeTobacco', 'algodao': 'cotton', 'pano': 'cloth',
    'cafe': 'coffee', 'cafeS': 'driedCoffee', 'couro': 'hide', 'sola': 'leather', 'calcados': 'shoes',
    'tabuas': 'planks', 'telhas': 'rooftiles', 'moveis': 'furniture', 'barricas': 'barrels', 'cal': 'lime',
    'ferro': 'iron', 'ferramentas': 'tools', 'chumbo': 'lead', 'ouro': 'gold', 'lenha': 'firewood',
}
GOODS_EN = {
    'corn': 'Corn', 'beans': 'Beans', 'cassava': 'Cassava', 'rice': 'Rice', 'wheat': 'Wheat', 'pineNut': 'Pine nuts',
    'fish': 'Fresh fish', 'saltFish': 'Salt fish', 'huskedRice': 'Husked rice', 'jerky': 'Jerky', 'cornmeal': 'Cornmeal',
    'cassavaFlour': 'Cassava flour', 'wheatFlour': 'Wheat flour', 'lard': 'Lard', 'meat': 'Meat', 'sugarcane': 'Sugarcane',
    'rapadura': 'Rapadura', 'cachaca': 'Cachaça', 'sugar': 'Sugar', 'yerba': 'Yerba leaf', 'mate': 'Mate',
    'tobaccoLeaf': 'Tobacco leaf', 'ropeTobacco': 'Rope tobacco', 'cotton': 'Cotton', 'cloth': 'Cloth', 'coffee': 'Coffee',
    'driedCoffee': 'Dried coffee', 'hide': 'Hides', 'leather': 'Leather', 'shoes': 'Shoes', 'planks': 'Planks',
    'rooftiles': 'Roof tiles', 'furniture': 'Furniture', 'barrels': 'Barrels', 'lime': 'Lime', 'iron': 'Iron',
    'tools': 'Tools', 'lead': 'Lead', 'gold': 'Gold', 'firewood': 'Firewood',
}
BUILDINGS = {
    'rancho': 'hut', 'casa': 'house', 'caiada': 'whitewashedHouse', 'sobrado': 'townhouse', 'igreja': 'chapel',
    'matriz': 'church', 'escola': 'school', 'botica': 'apothecary', 'santacasa': 'hospital', 'teatro': 'theater',
    'poco': 'well', 'oficina': 'workshop', 'diretoria': 'directorate', 'camara': 'council', 'armazem': 'store',
    'mercado': 'market', 'porto': 'riverPort', 'pouso': 'waystation', 'invernada': 'pasture', 'rMilho': 'cornField',
    'rFeijao': 'beanField', 'rMandioca': 'cassavaField', 'rArroz': 'riceField', 'rTrigo': 'wheatField',
    'rCana': 'caneField', 'rFumo': 'tobaccoField', 'rAlgodao': 'cottonField', 'rCafe': 'coffeeField',
    'curral': 'corral', 'chiqueiro': 'pigsty', 'pesqueiro': 'fishery', 'coleta': 'pineNutGrove',
    'erval': 'yerbaGrove', 'serraria': 'sawmill', 'olaria': 'pottery', 'mina': 'mine', 'monjolo': 'monjolo',
    'farinheira': 'flourHouse', 'salga': 'saltery', 'moinho': 'mill', 'engenho2': 'sugarMill',
    'alambique': 'distillery', 'barbaqua': 'yerbaDryer', 'paiolfumo': 'tobaccoShed', 'curtume': 'tannery',
    'carpintaria': 'carpentry', 'tanoaria': 'cooperage', 'ferraria': 'smithy', 'terreiro': 'coffeeYard',
    'tear': 'loom', 'sapataria': 'shoemaker', 'chafariz': 'fountain', 'cadeia': 'jail', 'bombeiros': 'fireStation',
    'deposito': 'depot', 'oficinaCarrocas': 'cartWorkshop', 'depositoLenha': 'woodYard', 'entreposto': 'warehouse',
    'estacaoTrem': 'trainStation', 'oficinaFerro': 'railWorkshop', 'cais': 'steamPier', 'estaleiro': 'shipyard',
    'venda': 'tradingPost', 'embarcadouro': 'landing', 'parada': 'railStop',
}
BUILDINGS_EN = {
    'hut': ('Hut', 'Huts'), 'house': ('House', 'Houses'), 'whitewashedHouse': ('Whitewashed house', 'Whitewashed houses'),
    'townhouse': ('Townhouse', 'Townhouses'), 'chapel': ('Chapel', 'Chapels'), 'church': ('Parish church', 'Parish churches'),
    'school': ('School', 'Schools'), 'apothecary': ('Apothecary', 'Apothecaries'), 'hospital': ('Hospital', 'Hospitals'),
    'theater': ('Theater', 'Theaters'), 'well': ('Well', 'Wells'), 'workshop': ('Workshop', 'Workshops'),
    'directorate': ('Directorate', 'Directorates'), 'council': ('Town council', 'Town councils'), 'store': ('Store', 'Stores'),
    'market': ('Market', 'Markets'), 'riverPort': ('River port', 'River ports'), 'waystation': ('Waystation', 'Waystations'),
    'pasture': ('Pasture', 'Pastures'), 'cornField': ('Corn field', 'Corn fields'), 'beanField': ('Bean field', 'Bean fields'),
    'cassavaField': ('Cassava field', 'Cassava fields'), 'riceField': ('Rice paddy', 'Rice paddies'),
    'wheatField': ('Wheat field', 'Wheat fields'), 'caneField': ('Cane field', 'Cane fields'),
    'tobaccoField': ('Tobacco field', 'Tobacco fields'), 'cottonField': ('Cotton field', 'Cotton fields'),
    'coffeeField': ('Coffee grove', 'Coffee groves'), 'corral': ('Corral', 'Corrals'), 'pigsty': ('Pigsty', 'Pigsties'),
    'fishery': ('Fishery', 'Fisheries'), 'pineNutGrove': ('Pine nut gathering', 'Pine nut gatherings'),
    'yerbaGrove': ('Yerba grove', 'Yerba groves'), 'sawmill': ('Sawmill', 'Sawmills'), 'pottery': ('Pottery', 'Potteries'),
    'mine': ('Mine', 'Mines'), 'monjolo': ('Monjolo', 'Monjolos'), 'flourHouse': ('Flour house', 'Flour houses'),
    'saltery': ('Saltery and smokehouse', 'Salteries'), 'mill': ('Mill', 'Mills'), 'sugarMill': ('Sugar mill', 'Sugar mills'),
    'distillery': ('Still', 'Stills'), 'yerbaDryer': ('Barbaquá', 'Barbaquás'), 'tobaccoShed': ('Tobacco shed', 'Tobacco sheds'),
    'tannery': ('Tannery', 'Tanneries'), 'carpentry': ('Carpentry', 'Carpentries'), 'cooperage': ('Cooperage', 'Cooperages'),
    'smithy': ('Smithy', 'Smithies'), 'coffeeYard': ('Coffee yard', 'Coffee yards'), 'loom': ('Loom', 'Looms'),
    'shoemaker': ('Shoemaker', 'Shoemakers'), 'fountain': ('Fountain', 'Fountains'), 'jail': ('Jail', 'Jails'),
    'fireStation': ('Fire brigade', 'Fire brigades'), 'depot': ('Depot', 'Depots'), 'cartWorkshop': ('Cart workshop', 'Cart workshops'),
    'woodYard': ('Wood yard', 'Wood yards'), 'warehouse': ('Warehouse', 'Warehouses'), 'trainStation': ('Train station', 'Train stations'),
    'railWorkshop': ('Rail workshop', 'Rail workshops'), 'steamPier': ('Steamboat pier', 'Steamboat piers'),
    'shipyard': ('Shipyard', 'Shipyards'), 'tradingPost': ('Trading post', 'Trading posts'), 'landing': ('Landing', 'Landings'),
    'railStop': ('Rail stop', 'Rail stops'),
}
CATEGORY = {'Moradia': 'housing', 'Serviços': 'services', 'Comércio': 'commerce', 'Transporte': 'transport',
            'Plantações': 'crops', 'Criação': 'livestock', 'Extração': 'extraction', 'Oficinas': 'workshops', 'Retirado': 'retired'}
CATEGORY_EN = {'housing': 'Housing', 'services': 'Services', 'commerce': 'Commerce', 'transport': 'Transport', 'crops': 'Crops',
               'livestock': 'Livestock', 'extraction': 'Extraction', 'workshops': 'Workshops', 'retired': 'Retired'}
SECTOR = {'lavoura': 'farming', 'rio': 'river', 'comercio': 'commerce', 'oficio': 'crafts', 'mina': 'mining', 'servicos': 'services'}
GROUP = {'lavoura': 'farming', 'rio': 'river', 'oficio': 'crafts', 'mina': 'mining'}
BIOMES = {'varzea': 'floodplain', 'campo': 'grassland', 'mata': 'forest', 'erval': 'yerbaForest', 'serra': 'highlands', 'lavras': 'diggings'}
BIOMES_EN = {'floodplain': 'Floodplain', 'grassland': 'Grassland', 'forest': 'Araucaria forest', 'yerbaForest': 'Yerba forest',
             'highlands': 'Highlands', 'diggings': 'Diggings'}
VEHICLES = {'canoa': 'canoe', 'tropa': 'muleTrain', 'carroca': 'wagon', 'vapor': 'steamboat', 'vagao': 'railcar',
            'trem1': 'lightTrain', 'trem2': 'mediumTrain', 'trem3': 'heavyTrain'}
VEHICLES_EN = {'canoe': ('Canoe', 'canoes'), 'muleTrain': ('Mule train', 'mule trains'), 'wagon': ('Wagon', 'wagons'),
               'steamboat': ('Steamboat', 'steamboats'), 'railcar': ('Railcar', 'railcars'), 'lightTrain': ('Light train', 'light trains'),
               'mediumTrain': ('Medium train', 'medium trains'), 'heavyTrain': ('Heavy train', 'heavy trains')}
MODE = {'fluvial': 'river', 'terrestre': 'road', 'ferro': 'rail'}
LAWS = {'posturas': 'healthCode', 'feira': 'weeklyFair', 'tabelado': 'foodPriceCap', 'registro': 'landRegistry',
        'escolaOb': 'compulsorySchool', 'mutirao': 'workParty', 'domingo': 'sundayWork', 'longa': 'longHours'}
LAWS_EN = {'healthCode': ('Health code', 'Epidemics 50% rarer', 'Satisfaction −1'),
           'weeklyFair': ('Weekly fair', 'Market 15% larger; satisfaction +2', 'Freight 5% dearer: the store loses customers'),
           'foodPriceCap': ('Food price cap', 'Satisfaction +3', 'Exported food earns 15% less'),
           'landRegistry': ('Land registry', 'Taxes yield 10% more', 'Satisfaction −3'),
           'compulsorySchool': ('Compulsory school', 'Families learn faster; satisfaction +2', 'Production 4% lower'),
           'workParty': ('Work party', '12 more street segments per season', 'Satisfaction −2'),
           'sundayWork': ('Sunday work', 'Production 10% higher', 'Satisfaction −5'),
           'longHours': ('Long hours', 'Production another 10% higher', 'Satisfaction −7')}
TAXES = {'lote': 'lotInstallment', 'dizimo': 'tithe', 'exportacao': 'exportDuty', 'negocio': 'businessTax'}
CHOICES = {'policult': 'polyculture', 'monocult': 'monoculture', 'familiar': 'familyWorkshop', 'manufat': 'manufacture',
           'livres': 'freeMuleteers', 'lage': 'storeContract', 'publica': 'publicSchool', 'missao': 'brotherhoods'}
COLLECTION = {'branda': 'lenient', 'normal': 'standard', 'rigida': 'strict'}
DESTINATIONS = {'iguape': 'iguape', 'curitiba': 'curitiba', 'paranagua': 'paranagua', 'saopaulo': 'saoPaulo'}
ORIGINS = {'alemã': 'german', 'sueca': 'swedish', 'suíça': 'swiss', 'italiana': 'italian', 'brasileira': 'brazilian',
           'francesa': 'french', 'belga': 'belgian', 'inglesa': 'english', 'espanhola': 'spanish'}
ORIGINS_EN = {'german': 'German', 'swedish': 'Swedish', 'swiss': 'Swiss', 'italian': 'Italian', 'brazilian': 'Brazilian',
              'french': 'French', 'belgian': 'Belgian', 'english': 'English', 'spanish': 'Spanish'}
SEASONS_EN = ['Spring', 'Summer', 'Autumn', 'Winter']
WEATHER = {'limpo': 'clear', 'nublado': 'cloudy', 'chuva': 'rain', 'temporal': 'storm', 'neblina': 'fog', 'geada': 'frost', 'cheia': 'flood'}
WEATHER_EN = {'clear': 'clear skies', 'cloudy': 'cloudy', 'rain': 'rain', 'storm': 'storms', 'fog': 'fog', 'frost': 'frost', 'flood': 'flood'}
NATURE = {'ribeirao': 'stream', 'corrego': 'brook', 'cachoeira': 'waterfall', 'corredeira': 'rapids', 'lagoa': 'oxbow', 'calcario': 'limestone', 'gruta': 'cave', 'dolina': 'sinkhole', 'dolinaAgua': 'wetSinkhole', 'lajedo': 'bedrock'}
TREES = {'pin1': 'araucaria1', 'pin2': 'araucaria2', 'mat1': 'thicket1', 'mat2': 'thicket2'}
DEPOSITS = {'cal': 'lime', 'chumbo': 'lead', 'ouro': 'gold', 'ferro': 'iron', 'erval': 'yerba'}
SERVICE = {'Igreja': 'faith', 'Escola': 'school', 'Botica': 'health', 'Água': 'water', 'Comércio': 'commerce', 'Cultura': 'culture',
           'Ordem': 'order', 'Fogo': 'fire', 'Governo': 'government', 'Diretoria': 'government'}
SERVICE_EN = {'faith': 'Faith', 'school': 'School', 'health': 'Health', 'water': 'Water', 'commerce': 'Commerce', 'culture': 'Culture',
              'order': 'Order', 'fire': 'Fire', 'government': 'Government'}
PAYER = {'familias': 'families', 'colonia': 'colony'}
DIRECTION_KEYS = {'ruim': 'nuisance'}


def mapping_or_fail(table, key, what):
    if key not in table:
        sys.exit(f'missing {what} mapping for {key!r}')
    return table[key]


def goods_id(k):
    return mapping_or_fail(GOODS, k, 'good')


def building_id(k):
    return mapping_or_fail(BUILDINGS, k, 'building')


def ts(value):
    return json.dumps(value, ensure_ascii=False, indent=2)


def main():
    d = json.load(open(SRC, encoding='utf-8'))
    pt, en = {}, {}

    # ---- goods
    goods = {}
    for k, g in d['BENS'].items():
        gid = goods_id(k)
        out = {'group': GROUP[g['grupo']], 'localPrice': g['base'], 'exportPrice': g['fora']}
        if 'fundo' in g: out['baseDemand'] = g['fundo']
        if g.get('comida'): out['food'] = True
        if g.get('estraga'): out['spoils'] = True
        if 'consumo' in g: out['perFamily'] = g['consumo']
        if k in d['PERECIVEL']: out['perishable'] = True
        if k in d['DIETA']: out['dietWeight'] = d['DIETA'][k]
        goods[gid] = out
        pt[f'good.{gid}'] = g['nome']
        en[f'good.{gid}'] = GOODS_EN[gid]

    # ---- buildings
    buildings = {}
    for k, t in d['TIPOS'].items():
        bid = building_id(k)
        out = {'category': CATEGORY[t['cat']], 'cost': t['custo'], 'payer': PAYER[t['paga']]}
        if t.get('nv'): out['minLevel'] = t['nv']
        if t.get('moradia'): out['housing'] = t['fam']
        if t.get('vagas'): out['jobs'] = t['vagas']
        if t.get('setor'): out['sector'] = SECTOR[t['setor']]
        if t.get('serv'): out['service'] = mapping_or_fail(SERVICE, t['serv'], 'service')
        if t.get('raio'): out['radius'] = t['raio']
        if t.get('cor'): out['color'] = t['cor']
        if t.get('tam'): out['size'] = t['tam']
        if t.get('beira'): out['riverside'] = True
        if t.get('plantacao'): out['crop'] = True
        if t.get('bem'): out['output'] = {'good': goods_id(t['bem']), 'perSeason': t['y'], **({'season': t['est']} if t.get('est') is not None else {})}
        if t.get('bens'): out['extraOutputs'] = [{'good': goods_id(b), 'perSeason': y} for b, y in t['bens']]
        if t.get('matas'): out['nearForest'] = True
        if t.get('ruim'): out['nuisance'] = t['ruim']
        if t.get('capO'): out['processingCapacity'] = t['capO']
        if t.get('receitas'):
            out['recipes'] = [{'from': goods_id(r['de']), 'to': goods_id(r['para']), 'ratio': r['f'], **({'minLevel': r['nv']} if r.get('nv') else {})} for r in t['receitas']]
        if t.get('cap'): out['capacity'] = {('market' if a == 'mercado' else a): v for a, v in t['cap'].items()}
        if t.get('sobre'): out['onDeposit'] = [DEPOSITS[x] for x in t['sobre']]
        if t.get('corrida'): out['lateGame'] = True
        if t.get('fixo'): out['fixed'] = True
        if t.get('ensina'): out['teaches'] = True
        buildings[bid] = out
        pt[f'building.{bid}'] = t['nome']
        pt[f'building.{bid}.plural'] = t['plural']
        pt[f'building.{bid}.description'] = t['desc']
        en_name, en_plural = BUILDINGS_EN[bid]
        en[f'building.{bid}'] = en_name
        en[f'building.{bid}.plural'] = en_plural

    for pid, eid in CATEGORY.items():
        pt[f'category.{eid}'] = pid
        en[f'category.{eid}'] = CATEGORY_EN[eid]
    for pid, eid in SERVICE.items():
        pt.setdefault(f'service.{eid}', pid)
        en[f'service.{eid}'] = SERVICE_EN[eid]

    # ---- vehicles and transport roles
    vehicles = {}
    for k, v in d['VEIC'].items():
        vid = VEHICLES[k]
        out = {'mode': MODE[v['modo']], 'cargo': v['carga'], 'price': v['compra'], 'upkeep': v['custo']}
        if v.get('nv'): out['minLevel'] = v['nv']
        if v.get('lenha'): out['firewood'] = v['lenha']
        if v.get('corrida'): out['lateGame'] = True
        vehicles[vid] = out
        pt[f'vehicle.{vid}'] = v['nome']; pt[f'vehicle.{vid}.plural'] = v['pl']
        en[f'vehicle.{vid}'], en[f'vehicle.{vid}.plural'] = VEHICLES_EN[vid]
    transport = {}
    for k, v in d['TRANSP'].items():
        out = {'role': {'comercio': 'commerce', 'captacao': 'collection', 'porta': 'gateway'}[v['papel']]}
        if v.get('modo'): out['mode'] = MODE[v['modo']]
        if v.get('alcance'): out['reach'] = v['alcance']
        if v.get('veic'): out['vehicles'] = [VEHICLES[x] for x in v['veic']]
        if v.get('vagas'): out['slots'] = v['vagas']
        transport[building_id(k)] = out

    # ---- progression
    levels = []
    for n, nv in enumerate(d['NIVEIS']):
        if nv is None: continue
        out = {'level': n, 'workers': nv['trab'], 'income': nv['renda']}
        if nv.get('marco'): out['milestone'] = nv['marco']
        if nv.get('pre'): out['requires'] = {building_id(a): q for a, q in nv['pre'].items()}
        levels.append(out)
    milestone_ids = ['settlement', 'parish', 'village', 'town']
    milestones = []
    for n, m in enumerate(d['MARCOS']):
        out = {'id': milestone_ids[n], 'grant': m['verba'], 'shareOfTrade': m['repasse']}
        for a, b in [('fam', 'families'), ('sat', 'satisfaction'), ('terras', 'lands'), ('prazo', 'deadline')]:
            if a in m: out[b] = m[a]
        if m.get('estrada'): out['road'] = True
        if m.get('pre'): out['requires'] = {building_id(a): q for a, q in m['pre'].items()}
        milestones.append(out)
        pt[f'milestone.{milestone_ids[n]}'] = m['nome']
    for i, e in enumerate(['Settlement', 'Parish', 'Village', 'Town']):
        en[f'milestone.{milestone_ids[i]}'] = e
    unlocks = {int(n): [building_id(x) for x in lst] for n, lst in d['NV_LIBERA'].items()}

    # ---- policies
    laws = {}
    for k, l in d['LEIS_C'].items():
        lid = LAWS[k]
        out = {'satisfaction': l.get('sat', 0)}
        if l.get('req'): out['requires'] = LAWS[l['req']]
        laws[lid] = out
        pt[f'law.{lid}'] = l['nome']; pt[f'law.{lid}.gain'] = l['ganho']; pt[f'law.{lid}.cost'] = l['custo']
        en[f'law.{lid}'], en[f'law.{lid}.gain'], en[f'law.{lid}.cost'] = LAWS_EN[lid]
    choices = {}
    for lvl, c in d['ESCOLHAS'].items():
        choices[int(lvl)] = [CHOICES[c['a']['id']], CHOICES[c['b']['id']]]
        pt[f'path.{lvl}.title'] = c['tit']
        for side in ('a', 'b'):
            cid = CHOICES[c[side]['id']]
            pt[f'choice.{cid}'] = c[side]['txt']; pt[f'choice.{cid}.effect'] = c[side]['ef']

    # ---- world
    biomes = {}
    for k, b in d['BIOMAS'].items():
        bid = BIOMES[k]
        biomes[bid] = {'forest': b['mata'], 'soil': {goods_id(c): v for c, v in b['solo'].items()},
                       'deposits': {DEPOSITS[v]: q for v, q in b.get('veios', {}).items()}}
        pt[f'biome.{bid}.description'] = b['txt']
        en[f'biome.{bid}'] = BIOMES_EN[bid]
        for i, nome in enumerate(b['nomes']):
            pt[f'biome.{bid}.place.{i}'] = nome
            en[f'biome.{bid}.place.{i}'] = nome  # place names stay as they are

    for pid, eid in ORIGINS.items():
        pt[f'origin.{eid}'] = pid; en[f'origin.{eid}'] = ORIGINS_EN[eid]
    for i, s in enumerate(d['EST_NOME']):
        pt[f'season.{i}'] = s; en[f'season.{i}'] = SEASONS_EN[i]
    for pid, eid in WEATHER.items():
        pt[f'weather.{eid}'] = d['CLIMA_NOME'][pid]; en[f'weather.{eid}'] = WEATHER_EN[eid]
    weather_odds = [{WEATHER[k]: v for k, v in s.items()} for s in d['CLIMA_P']]
    origin_trade = {ORIGINS[o]: SECTOR[s] for o, s in d['PERFIL'].items()}

    c = d['CONST']
    balance = {
        'subsistencePerSeason': c['CONSUMO_ROCA'], 'subsistenceIncomeShare': c['VALOR_MESA'],
        'storageKeep': {'none': c['GUARDA']['sem'], 'grain': c['GUARDA']['grao'], 'fresh': c['GUARDA']['fresco']},
        'riverFreight': c['FRETE_RIO'], 'freeCarryDistance': c['LOMBO_LIVRE'], 'routeChoiceSharpness': c['K_ESCOLHA'],
        'isolatedCommerceWeight': c['PESO_COM_ISOLADO'], 'lotPrice': c['PRECO_LOTE'], 'seedAid': c['SEMENTES'],
        'arrivalAid': c['AJUDA'], 'newcomerWage': c['SALARIO_NOVO'], 'wasteLimit': c['LIMITE_PERDA'],
        'firewoodPrice': c['LENHA_PRECO'], 'expeditionCost': c['CUSTO_EXPEDICAO'], 'autosaves': c['AUTOSAVES'],
        'travelTime': {VEHICLES[k]: v for k, v in d['VIAGEM'].items()}, 'tariffMargins': d['MARGENS'],
        'depositYield': {DEPOSITS[k]: v for k, v in d['Y_VEIO'].items()},
        'milestoneCostFactor': d['FATOR_CUSTO_MARCO'],
    }
    world = {'width': c['NX'], 'height': c['NY'], 'regionSize': c['REG'], 'regionCols': c['COLS'], 'regionRows': c['LINS'],
             'startColumn': c['A0'], 'startRow': c['M0']}

    header = ('// Generated once from the prototype by tools/legacy-import/import.py.\n'
              '// From here on these tables are the source of truth: edit them by hand.\n'
              "import type { GoodDef, BuildingDef, VehicleDef, TransportRoleDef, LevelDef, MilestoneDef, LawDef, BiomeDef, BalanceDef, WorldDef } from './types.js';\n\n")
    body = ''
    body += f'export const GOODS = {ts(goods)} as const satisfies Record<string, GoodDef>;\n\n'
    body += f'export const BUILDINGS = {ts(buildings)} as const satisfies Record<string, BuildingDef>;\n\n'
    body += f'export const VEHICLES = {ts(vehicles)} as const satisfies Record<string, VehicleDef>;\n\n'
    body += f'export const TRANSPORT_ROLES = {ts(transport)} as const satisfies Record<string, TransportRoleDef>;\n\n'
    body += f'export const LEVELS: readonly LevelDef[] = {ts(levels)};\n\n'
    body += f'export const MILESTONES: readonly MilestoneDef[] = {ts(milestones)};\n\n'
    body += f'export const LEVEL_UNLOCKS: Readonly<Record<number, readonly string[]>> = {ts(unlocks)};\n\n'
    body += f'export const LAWS = {ts(laws)} as const satisfies Record<string, LawDef>;\n\n'
    body += f'export const PATH_CHOICES: Readonly<Record<number, readonly [string, string]>> = {ts(choices)};\n\n'
    body += f'export const BIOMES = {ts(biomes)} as const satisfies Record<string, BiomeDef>;\n\n'
    body += f'export const WEATHER_ODDS: readonly Readonly<Record<string, number>>[] = {ts(weather_odds)};\n\n'
    body += f'export const ORIGIN_TRADE: Readonly<Record<string, string>> = {ts(origin_trade)};\n\n'
    body += f'export const BALANCE: BalanceDef = {ts(balance)};\n\n'
    body += f'export const WORLD: WorldDef = {ts(world)};\n'
    out_path = os.path.join(ROOT, 'packages', 'data', 'src', 'content.generated.ts')
    open(out_path, 'w', encoding='utf-8').write(header + body)

    for lang, table in (('pt-BR', pt), ('en', en)):
        path = os.path.join(ROOT, 'packages', 'i18n', 'locales', f'{lang}.json')
        cur = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
        for key, val in table.items():
            cur.setdefault(key, val)
        json.dump(dict(sorted(cur.items())), open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print(lang, len(cur), 'keys')
    print('wrote', out_path)

    # legacy id map: lets tests compare with the prototype and lets old saves be migrated
    id_map = {'goods': GOODS, 'buildings': BUILDINGS, 'vehicles': VEHICLES, 'biomes': BIOMES, 'laws': LAWS, 'taxes': TAXES,
              'choices': CHOICES, 'collection': COLLECTION, 'destinations': DESTINATIONS, 'origins': ORIGINS,
              'weather': WEATHER, 'deposits': DEPOSITS, 'nature': NATURE, 'trees': TREES, 'sectors': SECTOR, 'milestones': dict(zip(range(4), milestone_ids))}
    json.dump(id_map, open(os.path.join(ROOT, 'legacy', 'id-map.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote legacy/id-map.json')


if __name__ == '__main__':
    main()
