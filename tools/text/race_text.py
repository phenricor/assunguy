# Writes the late-game race's texts (news.race.*, chronicle.race*, event.race*, ui.race.*) into both locales.
# Plain register, no middle dots, no dashes. {advisor} and {colony} are filled by the interface.
import json, pathlib

LOC = pathlib.Path(__file__).resolve().parents[2] / 'packages' / 'i18n' / 'locales'
ADV = {
  'carts': ('as colônias de Curitiba põem carroças na estrada', 'the Curitiba colonies put wagons on the road'),
  'pontaGrossa': ('o trem chega a Ponta Grossa', 'the train reaches Ponta Grossa'),
  'steamers': ('vapores de Iguape sobem o Ribeira', 'steamers from Iguape come up the Ribeira'),
  'secondWave': ('chega a segunda onda de trilhos e estradas', 'the second wave of rails and roads arrives'),
}
DEST = {'carts': ('Curitiba', 20), 'pontaGrossa': ('Paranaguá', 40), 'steamers': ('Iguape', 30), 'secondWave': ('Curitiba e Paranaguá', 30)}
T = {
  'news.race.start': ('A colônia é cidade, e começou a corrida dos transportes. Quem entregar mais barato vende; quem não acompanhar vai definhar.', 'The colony is a town, and the transport race has begun. Whoever delivers cheaper sells; whoever falls behind will wither.'),
  'news.race.incomeFell': ('A renda por família caiu {share}% desde o melhor momento: {n} famílias partiram para colônias mais bem ligadas.', 'Income per family fell {share}% from its best: {n} families left for better linked colonies.'),
  'news.race.freight': ('Com o frete caro, {n} famílias foram embora.', 'With freight so dear, {n} families left.'),
  'news.race.decline': ('A província declarou a colônia em decadência: 8 estações para reverter.', 'The province declared the colony in decline: 8 seasons to turn it around.'),
  'news.race.recovered': ('A colônia saiu da decadência.', 'The colony is out of decline.'),
  'chronicle.raceStarted': ('virou cidade e entrou na corrida dos transportes.', 'became a town and entered the transport race.'),
  'chronicle.race.decline': ('foi declarada em decadência.', 'was declared in decline.'),
  'chronicle.race.lost': ('definhou: as famílias foram para colônias mais bem ligadas.', 'withered: the families went to better linked colonies.'),
  'chronicle.race.won': ('ficou ligada ao mundo: venceu a corrida dos transportes.', 'became linked to the world: it won the transport race.'),
  'event.raceIntro.who': ('{advisor}', '{advisor}'), 'event.raceIntro.title': ('A corrida dos transportes', 'The transport race'),
  'event.raceIntro.body': ('Agora que somos cidade, outras colônias disputam os mesmos mercados. Em um ano as colônias de Curitiba põem carroças na estrada; depois vêm o trem e os vapores. Quem entregar mais barato vende. Estações de trem e trilhos até a borda do mapa abrem Curitiba, Paranaguá e, mais tarde, São Paulo.', 'Now that we are a town, other colonies compete for the same markets. In a year the Curitiba colonies put wagons on the road; then come the train and the steamers. Whoever delivers cheaper sells. Train stations and rails to the edge of the map open Curitiba, Paranaguá and, later, São Paulo.'),
  'event.raceIntro.option.0': ('Entendido', 'Understood'), 'event.raceIntro.option.0.effect': ('', ''), 'event.raceIntro.option.0.chronicle': ('', ''),
  'event.raceLost.who': ('A província', 'The province'), 'event.raceLost.title': ('A colônia definhou', 'The colony withered'),
  'event.raceLost.body': ('As famílias foram para colônias mais bem ligadas e a província desistiu de {colony}.', 'The families went to better linked colonies and the province gave up on {colony}.'),
  'event.raceLost.option.0': ('Recomeçar a corrida', 'Restart the race'), 'event.raceLost.option.0.effect': ('Volta ao dia em que a colônia virou cidade', 'Back to the day the colony became a town'), 'event.raceLost.option.0.chronicle': ('', ''),
  'event.raceLost.option.1': ('Menu inicial', 'Start menu'), 'event.raceLost.option.1.effect': ('', ''), 'event.raceLost.option.1.chronicle': ('', ''),
  'event.raceWon.who': ('{advisor}', '{advisor}'), 'event.raceWon.title': ('Ligada ao mundo', 'Linked to the world'),
  'event.raceWon.body': ('A carga da colônia chega a Curitiba e ao mar mais barato que a dos rivais. {colony} fez o que a história não fez.', 'The colony\'s cargo reaches Curitiba and the sea cheaper than the rivals\'. {colony} did what history did not.'),
  'event.raceWon.option.0': ('Seguir jogando', 'Keep playing'), 'event.raceWon.option.0.effect': ('A corrida continua: os rivais não param', 'The race goes on: the rivals do not stop'), 'event.raceWon.option.0.chronicle': ('', ''),
  # the race panel and rails
  'ui.race.title': ('Corrida dos transportes', 'Transport race'), 'ui.race.sub': ('Os mercados e os rivais', 'Markets and rivals'),
  'ui.race.market': ('Mercado', 'Market'), 'ui.race.rival': ('Rival entrega por $ {cost} a arroba', 'Rival delivers at $ {cost} an arroba'),
  'ui.race.ours': ('Nós: $ {cost} a arroba', 'Us: $ {cost} an arroba'), 'ui.race.none': ('Nenhuma porta chega aqui', 'No gateway reaches it'),
  'ui.race.comp': ('Competitividade', 'Competitiveness'), 'ui.race.next': ('Próximo avanço dos rivais', 'Rivals\' next advance'), 'ui.race.inSeasons': ('em {n} estações: {what}', 'in {n} seasons: {what}'),
  'ui.race.decline': ('Em decadência: {n} estações para reverter', 'In decline: {n} seasons to turn it around'), 'ui.race.winning': ('Liderando dois mercados há {n} estações (8 vencem, no nível 12)', 'Leading two markets for {n} seasons (8 win, at level 12)'),
  'ui.race.info': ('Abaixo de 80% de competitividade, o mercado leva menos da sua carga, e o preço acompanha a competitividade. Trilhos da estação de trem até a borda sul abrem Curitiba e Paranaguá; pela borda leste, Paranaguá; pela norte, mais tarde, São Paulo.', 'Under 80% competitiveness, a market takes less of your cargo, and prices follow competitiveness. Rails from a train station to the south edge open Curitiba and Paranaguá; through the east edge, Paranaguá; through the north, later, São Paulo.'),
  'ui.race.rail': ('Trilho', 'Rail'), 'ui.race.railDesc': ('Da estação até uma borda do mapa; na serra custa mais', 'From the station to an edge of the map; dearer in the hills'),
  'ui.race.railHow': ('Toque em dois lotes alinhados. Um lote comum custa em torno de $ 160; sobre a água vira ponte de ferro ($ 2.000).', 'Tap two aligned lots. A plain lot costs about $ 160; over water it becomes an iron bridge ($ 2,000).'),
  'ui.race.dest.iguape': ('Iguape', 'Iguape'), 'ui.race.dest.curitiba': ('Curitiba', 'Curitiba'), 'ui.race.dest.paranagua': ('Paranaguá', 'Paranaguá'), 'ui.race.dest.saoPaulo': ('São Paulo', 'São Paulo'),
  'ui.info.race.title': ('Corrida dos transportes', 'Transport race'), 'ui.info.race.body': ('Abaixo de 80% de competitividade, o mercado leva menos da sua carga, e o preço acompanha a competitividade. Trilhos da estação de trem até a borda sul abrem Curitiba e Paranaguá; pela borda leste, Paranaguá; pela norte, mais tarde, São Paulo.', 'Under 80% competitiveness, a market takes less of your cargo, and prices follow competitiveness. Rails from a train station to the south edge open Curitiba and Paranaguá; through the east edge, Paranaguá; through the north, later, São Paulo.'),
  'ui.race.laid': ('{n} lotes de trilho por $ {cost}', '{n} rail lots for $ {cost}'), 'ui.race.button': ('Corrida', 'Race'),
}
for k, (pt, en) in ADV.items():
    d, pct = DEST[k]
    T[f'news.race.soon.{k}'] = (f'{{advisor}}: em um ano, {pt}.', f'{{advisor}}: in a year, {en}.')
    T[f'news.race.now.{k}'] = (f'{pt[0].upper() + pt[1:]}. Em {d}, o rival entrega {pct}% mais barato.', f'{en[0].upper() + en[1:]}. In {d}, the rival delivers {pct}% cheaper.')
    T[f'chronicle.race.{k}'] = (f'viu: {pt}.', f'saw: {en}.')
    T[f'ui.race.advance.{k}'] = (pt[0].upper() + pt[1:], en[0].upper() + en[1:])

for i, name in enumerate(['pt-BR', 'en']):
    p = LOC / f'{name}.json'
    data = json.loads(p.read_text(encoding='utf-8'))
    for k, v in T.items(): data[k] = v[i]
    p.write_text(json.dumps(dict(sorted(data.items())), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'{len(T)} race keys written')
