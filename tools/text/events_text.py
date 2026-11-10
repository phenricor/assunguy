# Event, news and mood texts, Portuguese (from the prototype) and English. Run to merge into the catalogs.
import json, os
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
A = '{advisor}'
# id: (who, title, body, [(speaker, line)], [(option, effect, chronicle)]) for pt and en
EV = {
 'earlyArrival': (
  ('A comissão das famílias', 'A leva chegou antes da hora', 'Seis famílias subiram o rio hoje, com um mês de antecedência. Não há casa para todas e já chove.', [(A, 'Podemos apertar todos nos ranchos. É o mais barato.'), ('Comerciante', 'Empresto madeira. Entre amigos, a conta fica para depois.')],
   [('Apertar todos', 'Satisfação −5', 'apertou a leva nos ranchos.'), ('Aceitar a madeira do armazém', '+$ 150. A conta volta', 'aceitou a madeira do armazém.'), ('Mandar esperar em Curitiba', '−$ 40', 'mandou a leva esperar em Curitiba.')]),
  ("The families' committee", 'The group arrived early', 'Six families came up the river today, a month ahead of time. There is no house for all of them and it is already raining.', [(A, 'We can squeeze everyone into the huts. It is the cheapest way.'), ('Merchant', 'I can lend timber. Between friends, the bill can wait.')],
   [('Squeeze everyone in', 'Satisfaction −5', 'squeezed the group into the huts.'), ("Take the store's timber", '+$ 150. The bill comes back', "took the store's timber."), ('Have them wait in Curitiba', '−$ 40', 'had the group wait in Curitiba.')])),
 'storeBox': (
  ('O dono do armazém', 'Uma caixa do armazém', 'O dono do armazém deixou $ 400 na diretoria, “para as despesas”. Em troca, pede que ninguém olhe as cadernetas das famílias.', [(A, 'Dinheiro sem recibo costuma cobrar depois, senhor.'), ('Comissão das famílias', 'Há família trabalhando só para pagar o que o armazém anota.')],
   [('Aceitar a caixa', '+$ 400. Alguém pode ver', 'aceitou a caixa do armazém.'), ('Devolver e abrir as cadernetas', 'Satisfação +6', 'devolveu a caixa e abriu as cadernetas.')]),
  ('The store owner', 'A box from the store', 'The store owner left $ 400 at the directorate, “for expenses”. In return he asks that nobody look at the families\' ledgers.', [(A, 'Money without a receipt tends to send its bill later, sir.'), ("Families' committee", 'Some families work only to pay what the store writes down.')],
   [('Accept the box', '+$ 400. Someone may notice', "accepted the store's box."), ('Return it and open the ledgers', 'Satisfaction +6', 'returned the box and opened the ledgers.')])),
 'storeDebt': (
  ('O dono do armazém', 'O armazém veio cobrar', 'Passou o tempo, diretor. O armazém quer o pagamento, ou o direito de ser o único a vender às famílias por dois anos.', [(A, 'Pagar dói agora. A exclusividade dói todo ano.')],
   [('Pagar a dívida', '−$ 250', 'pagou a dívida com o armazém.'), ('Dar a exclusividade', 'Satisfação −6 por 2 anos', 'deu exclusividade ao armazém.')]),
  ('The store owner', 'The store wants its money', 'Time is up, director. The store wants payment, or the right to be the only one selling to the families for two years.', [(A, 'Paying hurts now. A monopoly hurts every year.')],
   [('Pay the debt', '−$ 250', 'paid the debt to the store.'), ('Grant the monopoly', 'Satisfaction −6 for 2 years', 'granted the store a monopoly.')])),
 'accusation': (
  ('A comissão das famílias', 'A carta da comissão', 'A comissão escreveu a Curitiba contando sobre a caixa do armazém. Um funcionário quer explicações, e a história já corre entre as famílias.', [('Comissão das famílias', 'Nós avisamos, senhor. Não vamos fingir que não vimos.')],
   [('Devolver à província', '−$ 400; satisfação +4', 'devolveu à província o dinheiro do armazém.'), ('Negar tudo', 'Próxima meta exige 5% mais famílias; satisfação −4', 'negou a história da caixa.')]),
  ("The families' committee", "The committee's letter", "The committee wrote to Curitiba about the store's box. An official wants an explanation, and the story is already going around the families.", [("Families' committee", 'We warned you, sir. We will not pretend we did not see it.')],
   [('Return it to the province', '−$ 400; satisfaction +4', "returned the store's money to the province."), ('Deny everything', 'Next goal asks for 5% more families; satisfaction −4', 'denied the story of the box.')])),
 'divino': (
  ('O padre', 'A Festa do Divino', 'O padre pede ajuda para a festa. As famílias falam disso há semanas.', [('Padre', 'O povo trabalha melhor quando tem por que trabalhar.'), (A, 'A conta também tem dias santos, senhor.')],
   [('Grande festa', '−$ 100; satisfação +8', 'fez uma grande Festa do Divino.'), ('Ajudar com pouco', '−$ 25; satisfação +3', 'ajudou com pouco na festa.'), ('Não ajudar', 'Satisfação −3', 'não ajudou na festa.')]),
  ('The priest', 'The Feast of the Holy Spirit', 'The priest asks for help with the feast. The families have talked about it for weeks.', [('Priest', 'People work better when they have something to work for.'), (A, 'The accounts have holy days too, sir.')],
   [('A great feast', '−$ 100; satisfaction +8', 'held a great Feast of the Holy Spirit.'), ('Help a little', '−$ 25; satisfaction +3', 'helped a little with the feast.'), ('Do not help', 'Satisfaction −3', 'did not help with the feast.')])),
 'fever': (
  ('A comissão das famílias', 'Febre nos ranchos', 'Crianças amanheceram com febre. A comissão pede remédio de Curitiba. O padre pede uma novena.', [('Comissão das famílias', 'Separe os doentes e traga quinino, senhor.'), ('Padre', 'Remédio é caro. Fé, não.')],
   [('Comprar quinino', '−$ 120', 'comprou quinino contra a febre.'), ('Isolar os doentes', 'Satisfação −4; 2 famílias partem', 'isolou os doentes da febre.'), ('Confiar na novena', 'Satisfação +2; 5 famílias partem', 'confiou na novena contra a febre.')]),
  ("The families' committee", 'Fever in the huts', 'Children woke up with fever. The committee asks for medicine from Curitiba. The priest asks for a novena.', [("Families' committee", 'Separate the sick and bring quinine, sir.'), ('Priest', 'Medicine is dear. Faith is not.')],
   [('Buy quinine', '−$ 120', 'bought quinine against the fever.'), ('Isolate the sick', 'Satisfaction −4; 2 families leave', 'isolated the sick.'), ('Trust the novena', 'Satisfaction +2; 5 families leave', 'trusted the novena against the fever.')])),
 'peddler': (
  ('Um tropeiro de Sorocaba', 'Uma tropa de fora', 'Um tropeiro trouxe sal e ferragens mais baratos que os do armazém. Volta todo ano, se a colônia comprar dele.', [('Tropeiro', 'E ninguém me anota em caderneta.'), ('Comerciante', 'Quero ver quem traz sal quando o caminho fechar.')],
   [('Comprar do tropeiro', '−$ 60; satisfação +4', 'comprou da tropa de fora.'), ('Ficar com o armazém', '+$ 30 de agrado do armazém', 'mandou a tropa de fora embora.')]),
  ('A muleteer from Sorocaba', 'An outside mule train', "A muleteer brought salt and hardware cheaper than the store's. He comes back every year if the colony buys from him.", [('Muleteer', 'And nobody writes me down in a ledger.'), ('Merchant', 'Let us see who brings salt when the road closes.')],
   [('Buy from the muleteer', '−$ 60; satisfaction +4', 'bought from the outside mule train.'), ('Stay with the store', '+$ 30 as thanks from the store', 'sent the outside mule train away.')])),
 'blacksmith': (
  ('Um ferreiro recém-chegado', 'Um ferreiro alemão', 'O ferreiro sabe consertar arado, roda e serra, mas só fica se a colônia pagar a bigorna.', [(A, 'Um ferreiro abre muitos caminhos, senhor.'), ('Comissão das famílias', 'E as famílias que esperam casa há mais tempo?')],
   [('Pagar para ele ficar', '−$ 150; satisfação −2', 'pagou a bigorna do ferreiro.'), ('Deixar seguir viagem', 'Satisfação +1', 'deixou o ferreiro seguir.')]),
  ('A newly arrived blacksmith', 'A German blacksmith', 'The blacksmith can mend ploughs, wheels and saws, but he only stays if the colony pays for the anvil.', [(A, 'A blacksmith opens many roads, sir.'), ("Families' committee", 'And the families who have waited longest for a house?')],
   [('Pay for him to stay', '−$ 150; satisfaction −2', "paid for the blacksmith's anvil."), ('Let him move on', 'Satisfaction +1', 'let the blacksmith move on.')])),
 'kaingangVisit': (
  ('Uma liderança Kaingang', 'Os Kaingang vieram à diretoria', 'Uma liderança Kaingang chegou com dois homens e um cesto vazio. O pinheiral está sumindo. Ele quer saber se o diretor manda nos machados.', [('Liderança Kaingang', 'Antes de vocês, ninguém precisava pedir licença para colher pinhão.'), (A, 'O agrimensor diz que ali há terra boa, senhor. Só ele diz.')],
   [('Poupar o pinheiral', '−$ 80; satisfação +2', 'prometeu poupar o pinheiral dos Kaingang.'), ('Dizer que a terra é da colônia', 'Satisfação −1. Eles podem voltar', 'disse aos Kaingang que a terra era da colônia.')]),
  ('A Kaingang leader', 'The Kaingang came to the directorate', 'A Kaingang leader arrived with two men and an empty basket. The pine grove is disappearing. He wants to know whether the director commands the axes.', [('Kaingang leader', 'Before you came, nobody needed permission to gather pine nuts.'), (A, 'The surveyor says the land there is good, sir. Only he says so.')],
   [('Spare the pine grove', '−$ 80; satisfaction +2', "promised to spare the Kaingang's pine grove."), ('Say the land belongs to the colony', 'Satisfaction −1. They may come back', 'told the Kaingang the land belonged to the colony.')])),
 'fences': (
  ('Os colonos da divisa', 'Cercas no chão', 'Na divisa da mata, cercas amanheceram derrubadas e uma roça foi colhida à noite. Os colonos querem que a diretoria faça alguma coisa.', [(A, 'Um acordo custa menos que um inverno de medo, senhor.'), ('Colono', 'Ninguém dorme direito aqui em cima.')],
   [('Buscar um acordo', '−$ 120; satisfação +2', 'fez um acordo com os Kaingang na divisa.'), ('Deixar como está', 'Satisfação −5; 2 famílias partem', 'deixou a divisa como estava.')]),
  ('The settlers on the border', 'Fences on the ground', 'On the forest border, fences were found knocked down and a field was harvested overnight. The settlers want the directorate to do something.', [(A, 'An agreement costs less than a winter of fear, sir.'), ('Settler', 'Nobody sleeps well up here.')],
   [('Seek an agreement', '−$ 120; satisfaction +2', 'made an agreement with the Kaingang on the border.'), ('Leave it as it is', 'Satisfaction −5; 2 families leave', 'left the border as it was.')])),
 'barter': (
  ('Os Kaingang', 'Trocas na beira da mata', 'Um grupo Kaingang trouxe pinhão, mel e cestos. Querem facas, sal e panelas em troca.', [('Comerciante', 'Pinhão no inverno vale ouro, diretor.'), (A, 'Troca boa faz vizinho bom.')],
   [('Trocar com ferramentas da colônia', '−$ 40; satisfação +4', 'trocou ferramentas por pinhão com os Kaingang.'), ('Deixar o armazém negociar', '+$ 50', 'deixou o armazém negociar com os Kaingang.')]),
  ('The Kaingang', 'Barter at the forest edge', 'A Kaingang group brought pine nuts, honey and baskets. They want knives, salt and pots in exchange.', [('Merchant', 'Pine nuts in winter are worth gold, director.'), (A, 'A good trade makes a good neighbour.')],
   [("Trade the colony's tools", '−$ 40; satisfaction +4', 'traded tools for pine nuts with the Kaingang.'), ('Let the store negotiate', '+$ 50', 'let the store negotiate with the Kaingang.')])),
 'committee': (
  ('As famílias', 'Colonos pedem trabalho', 'Um grupo veio em comissão. Não há trabalho para todos, e já se fala em voltar para Curitiba.', [(A, 'Um auxílio acalma. Não resolve.'), ('Comissão das famílias', 'Quem vai embora conta para os outros como foi.')],
   [('Dar um auxílio', '−$ 120; satisfação +6', 'deu auxílio às famílias sem trabalho.'), ('Prometer obras', 'Satisfação +2. A promessa volta', 'prometeu obras às famílias.'), ('Mandar de volta', 'Satisfação −5', 'mandou a comissão de volta.')]),
  ('The families', 'Settlers ask for work', 'A group came as a committee. There is not work for everyone, and there is already talk of going back to Curitiba.', [(A, 'Relief calms things down. It does not solve them.'), ("Families' committee", 'Whoever leaves tells the others how it was.')],
   [('Give relief', '−$ 120; satisfaction +6', 'gave relief to the families without work.'), ('Promise works', 'Satisfaction +2. The promise comes back', 'promised works to the families.'), ('Send them back', 'Satisfaction −5', 'sent the committee back.')])),
 'promise': (
  ('As famílias', 'A comissão voltou', 'Faz um ano. A comissão voltou com o padre e pergunta pelas obras prometidas.', [('Padre', 'Palavra de diretor vale quanto, senhor?')],
   [('Cumprir com dinheiro', '−$ 200; satisfação +7', 'cumpriu a promessa.'), ('Dizer que não há como', 'Satisfação −8', 'não cumpriu a promessa.')]),
  ('The families', 'The committee is back', "A year has passed. The committee came back with the priest and asks about the promised works.", [('Priest', "How much is a director's word worth, sir?")],
   [('Keep it with money', '−$ 200; satisfaction +7', 'kept the promise.'), ('Say it cannot be done', 'Satisfaction −8', 'broke the promise.')])),
 'engineer': (
  ('O engenheiro da província', 'O engenheiro da província', 'O engenheiro passa medindo a estrada para Curitiba. Com um pouco de dinheiro, suas turmas abrem mais caminho nesta estação.', [(A, 'A estrada é o que nos liga ao mundo, senhor.')],
   [('Pagar pelos serviços', '−$ 200; 40 trechos a mais nesta estação', 'contratou o engenheiro.'), ('Agradecer e seguir', 'Nada muda', 'dispensou o engenheiro.')]),
  ("The province's engineer", "The province's engineer", 'The engineer is surveying the road to Curitiba. With a little money, his crews will open more road this season.', [(A, 'The road is what links us to the world, sir.')],
   [('Pay for the work', '−$ 200; 40 more street lots this season', 'hired the engineer.'), ('Thank him and move on', 'Nothing changes', 'sent the engineer away.')])),
 'frost': (
  (A, 'Geada', 'A geada queimou as roças. As próximas colheitas vêm menores.', [],
   [('Ajudar as famílias', '−$ 80; satisfação +3', 'ajudou as famílias depois da geada.'), ('Seguir em frente', 'Satisfação −3', 'não ajudou depois da geada.')]),
  (A, 'Frost', 'Frost burned the fields. The next harvests will be smaller.', [],
   [('Help the families', '−$ 80; satisfaction +3', 'helped the families after the frost.'), ('Carry on', 'Satisfaction −3', 'did not help after the frost.')])),
 'flood': (
  (A, 'Cheia no rio', 'O rio subiu. Portos e arrozais ficaram debaixo d’água nesta estação.', [],
   [('Consertar logo', '−$ 100; satisfação +2', 'consertou os estragos da cheia.'), ('Esperar o rio baixar', 'Satisfação −2', 'esperou o rio baixar.')]),
  (A, 'River flood', 'The river rose. Ports and rice fields were under water this season.', [],
   [('Repair at once', '−$ 100; satisfaction +2', 'repaired the flood damage.'), ('Wait for the river to fall', 'Satisfaction −2', 'waited for the river to fall.')])),
 'immigrants': (
  (A, 'Leva de {n} famílias', 'Famílias de origem {origin} subiram o rio. Hoje: {idle} sem trabalho e {open} vagas abertas.', [],
   [('Receber todas', '−$ {cost}', 'recebeu {n} famílias de origem {origin}.'), ('Receber {half}', '−$ {halfCost}', 'recebeu {half} famílias de origem {origin}.'), ('Recusar', 'Outra leva só daqui a um ano', 'recusou uma leva.')]),
  (A, 'A group of {n} families', '{origin} families came up the river. Today: {idle} without work and {open} open jobs.', [],
   [('Take them all', '−$ {cost}', 'took in {n} {origin} families.'), ('Take {half}', '−$ {halfCost}', 'took in {half} {origin} families.'), ('Refuse', 'No other group for a year', 'refused a group.')])),
 'cropSwap': (
  (A, 'Os {family} querem plantar {to}', 'A família está assentada há seis anos e quer trocar a roça de {from} por {to}. Paga o replantio com a poupança. Depois da colheita, em {seasons} estações, a renda da colônia sobe $ {gain} por ano.', [],
   [('Deixar trocar', '+$ {gain} por ano, sem custo para o caixa', 'deixou os {family} trocarem a roça.'), ('Recusar', 'Satisfação −2', 'recusou o pedido dos {family}.')]),
  (A, 'The {family} want to grow {to}', 'The family has been settled for six years and wants to swap its {from} field for {to}. It pays for replanting with its savings. After the harvest, in {seasons} seasons, the colony earns $ {gain} more a year.', [],
   [('Let them swap', '+$ {gain} a year, nothing from the purse', 'let the {family} swap their field.'), ('Refuse', 'Satisfaction −2', "refused the {family}'s request.")])),
 'cropSwapStale': (
  (A, 'Pedido de troca', 'O pedido já não vale: o lote mudou.', [], [('Seguir', '', '')]),
  (A, 'Swap request', 'The request no longer applies: the lot has changed.', [], [('Continue', '', '')])),
 'pathChoice': (
  ('Nível {level}', '{title}', 'Escolha um caminho. Vale até o fim da partida.', [], [('{a}', '{aEffect}', 'escolheu {a}.'), ('{b}', '{bEffect}', 'escolheu {b}.')]),
  ('Level {level}', '{title}', 'Choose a path. It holds until the end of the game.', [], [('{a}', '{aEffect}', 'chose {a}.'), ('{b}', '{bEffect}', 'chose {b}.')])),
 'intro': (
  ('Decreto da província', '{colony}', 'Dez famílias acabam de chegar à beira do rio. Dê trabalho a elas, leve a produção até Iguape e cumpra as metas da província no prazo. O topo da tela mostra os primeiros passos.', [], [('Começar', '', '')]),
  ('Decree of the province', '{colony}', 'Ten families have just arrived on the riverbank. Give them work, get the produce to Iguape and meet the province\'s goals on time. The top of the screen shows the first steps.', [], [('Begin', '', '')])),
 'decree': (
  ('Decreto da província', '{colony} agora é {milestone}!', 'Sinos, foguetes e muita conversa na porta da venda.', [('Padre', 'Isto pede uma festa, senhor.'), (A, 'E um orçamento.')],
   [('Festa na praça', '−$ 150; satisfação +8', 'virou {milestone} e fez festa.'), ('Guardar o dinheiro', 'Satisfação +2', 'virou {milestone} sem festa.')]),
  ('Decree of the province', '{colony} is now a {milestone}!', 'Bells, fireworks and a lot of talk at the store door.', [('Priest', 'This calls for a celebration, sir.'), (A, 'And a budget.')],
   [('Celebrate in the square', '−$ 150; satisfaction +8', 'became a {milestone} and celebrated.'), ('Keep the money', 'Satisfaction +2', 'became a {milestone} without a celebration.')])),
 'victory': (
  ('Decreto da província', 'Cidade consolidada', 'A colônia chegou ao nível 12. O que era um barranco de rio agora é uma cidade.', [], [('Continuar governando', '', ''), ('Nova colônia', '', '')]),
  ('Decree of the province', 'A city at last', 'The colony reached level 12. What was a riverbank is now a city.', [], [('Keep governing', '', ''), ('New colony', '', '')])),
 'inspector': (
  ('Decreto da província', 'A província mandou um inspetor', 'O prazo para virar {milestone} acabou e a colônia não chegou lá. O inspetor assume as contas: a verba cai pela metade até a meta ser cumprida, a meta passa a pedir 10% mais famílias e há só mais 2 anos. Se falhar de novo, a província encerra a colônia.', [('Inspetor da província', 'Vim ver para onde foi o dinheiro, senhor diretor.')],
   [('Aceitar as condições', 'Verba −50%; influência −3; satisfação −5', 'recebeu o inspetor da província por não virar {milestone}.'), ('Convencer o inspetor', '6 de influência e $ 500; meta +10% famílias; mais 2 anos', 'convenceu o inspetor a manter a verba.')]),
  ('Decree of the province', 'The province sent an inspector', 'The deadline to become a {milestone} has passed and the colony did not make it. The inspector takes over the accounts: the grant is halved until the goal is met, the goal asks for 10% more families, and there are only 2 more years. If it fails again, the province closes the colony.', [("Province's inspector", 'I came to see where the money went, director.')],
   [('Accept the terms', 'Grant −50%; influence −3; satisfaction −5', 'received the inspector for not becoming a {milestone}.'), ('Persuade the inspector', '6 influence and $ 500; goal +10% families; 2 more years', 'persuaded the inspector to keep the grant.')])),
 'end': (
  ('Decreto da província', 'A província encerrou a colônia', 'Pela segunda vez o prazo para virar {milestone} acabou. As famílias serão mandadas para outras colônias.', [], [('Voltar a um autosave', 'Escolha um ano anterior', ''), ('Nova colônia', '', '')]),
  ('Decree of the province', 'The province closed the colony', 'For the second time the deadline to become a {milestone} has passed. The families will be sent to other colonies.', [], [('Go back to an autosave', 'Choose an earlier year', ''), ('New colony', '', '')])),
 'requisition': (
  ('Um coronel federalista', 'Requisição da revolução', 'Com Curitiba tomada, o comando revolucionário pede ajuda da colônia: dinheiro para a tropa ou homens para a coluna.', [],
   [('Pagar $ 1.500', '−$ 1.500', 'pagou a requisição federalista.'), ('Ceder 6 famílias', '6 famílias partem com a coluna', 'cedeu homens à coluna federalista.'), ('Recusar', 'Verba −30% por 8 estações', 'recusou a requisição federalista.')]),
  ('A federalist colonel', "The revolution's requisition", 'With Curitiba taken, the revolutionary command asks the colony for help: money for the troops or men for the column.', [],
   [('Pay $ 1,500', '−$ 1,500', 'paid the federalist requisition.'), ('Give up 6 families', '6 families leave with the column', 'gave men to the federalist column.'), ('Refuse', 'Grant −30% for 8 seasons', 'refused the federalist requisition.')])),
}
MOOD = {  # key: (pt, en)
 'recentDecision': ('Decisão recente', 'Recent decision'), 'crowdedHomes': ('Casas apertadas', 'Crowded homes'), 'ledgersOpened': ('Cadernetas abertas', 'Ledgers opened'),
 'storeMonopoly': ('Exclusividade do armazém', "Store's monopoly"), 'moneyReturned': ('Dinheiro devolvido', 'Money returned'), 'boxRumours': ('Boatos da caixa', 'Rumours about the box'),
 'divino': ('Festa do Divino', 'Feast of the Holy Spirit'), 'noFestival': ('Sem festa', 'No feast'), 'fever': ('Febre', 'Fever'), 'novena': ('Novena', 'Novena'),
 'cheaperSalt': ('Sal mais barato', 'Cheaper salt'), 'blacksmithCost': ('Gasto com o ferreiro', 'Spending on the blacksmith'), 'savedMoney': ('Economia na diretoria', 'Savings at the directorate'),
 'kaingangPeace': ('Paz com os Kaingang', 'Peace with the Kaingang'), 'grovesConflict': ('Conflito no pinheiral', 'Conflict over the pine grove'), 'borderAgreement': ('Acordo na divisa', 'Agreement on the border'),
 'borderFear': ('Medo na divisa', 'Fear on the border'), 'pineNutsOnTable': ('Pinhão na mesa', 'Pine nuts on the table'), 'relief': ('Auxílio', 'Relief'), 'worksPromised': ('Promessa de obras', 'Works promised'),
 'committeeIgnored': ('Comissão ignorada', 'Committee ignored'), 'promiseKept': ('Promessa cumprida', 'Promise kept'), 'promiseBroken': ('Promessa quebrada', 'Promise broken'),
 'frostAid': ('Ajuda na geada', 'Help after the frost'), 'frost': ('Geada', 'Frost'), 'floodRepairs': ('Conserto da cheia', 'Flood repairs'), 'flood': ('Cheia', 'Flood'),
 'swapRefused': ('Troca de cultura recusada', 'Crop swap refused'), 'festival': ('Festa na praça', 'Celebration in the square'), 'inspector': ('Inspetor na colônia', 'Inspector in the colony'),
 'storms': ('Temporais', 'Storms'), 'hunger': ('Falta comida', 'Food shortage'), 'variedTable': ('Mesa variada', 'A varied table'), 'poorTable': ('Mesa pobre: um prato só', 'A poor table: a single dish'),
 'bigCity': ('Cidade grande espera mais', 'A big town expects more'), 'theater': ('Teatro', 'Theatre'), 'hospital': ('Hospital', 'Hospital'), 'epidemic': ('Epidemia', 'Epidemic'), 'disorder': ('Desordem', 'Disorder'),
 'highTariffs': ('Tarifas de transporte altas', 'High transport tariffs'), 'subsidizedFreight': ('Frete subsidiado', 'Subsidized freight'), 'lostOnTheWay': ('Produção perdida no caminho', 'Produce lost on the way'),
}
NEWS = {
 'relief': ('Frente de trabalho: {n} famílias.', 'Relief works: {n} families.'),
 'goodRain': ('Chuva na estação: arroz, milho, feijão, mandioca e cana rendem 10% mais.', 'Rain this season: rice, corn, beans, cassava and sugarcane yield 10% more.'),
 'storms': ('Temporais: 15% menos milho, trigo, feijão, fumo, algodão e café; canoas 30% paradas; consertos de telhado e ponte: −$ {repairs}.', 'Storms: 15% less corn, wheat, beans, tobacco, cotton and coffee; canoes 30% idle; roof and bridge repairs: −$ {repairs}.'),
 'fog': ('Neblina no rio: as canoas esperam a névoa baixar, 15% menos carga no porto.', 'Fog on the river: canoes wait for it to lift, 15% less cargo at the port.'),
 'frost': ('Geada nas roças: 40% menos trigo, café, milho, feijão, fumo e algodão por 2 estações.', 'Frost on the fields: 40% less wheat, coffee, corn, beans, tobacco and cotton for 2 seasons.'),
 'flood': ('Cheia no rio: 40% menos arroz, peixe e canoas nesta estação.', 'River flood: 40% less rice, fish and canoe capacity this season.'),
 'hunger': ('Falta comida. Partiram: {names}.', 'Food is short. Left: {names}.'),
 'idleLeft': ('Sem trabalho e com a casa ruim, partiram: {names}.', 'With no work and a poor home, they left: {names}.'),
 'greatWork.stalled': ('{work}: a obra parou por falta de dinheiro.', '{work}: work stopped for lack of money.'),
 'greatWork.advanced': ('{work}: a frente de trabalho adiantou uma estação.', '{work}: relief works moved it a season ahead.'),
 'greatWork.done': ('{work} pronto.', '{work} is finished.'),
 'agentEnded': ('Sem caixa para pagar o agente de imigração: o contrato acabou.', 'No cash to pay the immigration agent: the contract ended.'),
 'childrenMarried': ('{n} famílias novas formadas por filhos da colônia.', "{n} new families formed by the colony's children."),
 'firewoodShortage': ('Falta lenha: vapores e trens andam pela metade. Um depósito de lenha resolve.', 'Firewood is short: steamboats and trains run at half. A wood yard solves it.'),
 'collectionFull': ('{building} lotada na colheita: parte da carga foi a pé.', '{building} was full at harvest: part of the load went on foot.'),
 'caveExplored': ('Colonos entraram na {cave} e o relato chegou à província: +1 de influência.', 'Settlers explored {cave} and word reached the province: +1 influence.'),
 'storeClosed': ('Sufocada pelos impostos, uma venda fechou as portas.', 'Crushed by taxes, a store closed its doors.'),
 'shock': ('{reason}: {share}% a menos por {seasons} estações.', '{reason}: {share}% less for {seasons} seasons.'),
 'epidemic': ('Epidemia de {disease} nos bairros sem água decente, por {seasons} estações.', 'An epidemic of {disease} in districts without decent water, for {seasons} seasons.'),
 'epidemicDeaths': ('A {disease} levou {n} famílias sem água decente nem botica.', '{disease} took {n} families without decent water or an apothecary.'),
 'epidemicOver': ('A {disease} passou.', 'The {disease} has passed.'),
 'fire': ('Incêndio: {n} casas de madeira queimaram. As famílias foram para casas livres.', 'Fire: {n} wooden houses burned. The families moved to empty homes.'),
 'fireHomeless': ('Incêndio: {n} casas de madeira queimaram. Sem casa livre, partiram: {names}.', 'Fire: {n} wooden houses burned. With no empty home, they left: {names}.'),
 'disorder': ('Desordem na colônia: brigas na venda e furtos. Satisfação −3 e impostos −6% enquanto durar.', 'Disorder in the colony: fights at the store and theft. Satisfaction −3 and taxes −6% while it lasts.'),
 'disorderOver': ('A desordem acalmou.', 'The disorder has calmed down.'),
 'crisisWarning': ('{advisor}: há sinais de {crisis}.', '{advisor}: there are signs of {crisis}.'),
 'crisisOver': ('{crisis}: acabou.', '{crisis}: it is over.'),
 'republicUp': ('República proclamada: a província vira estado; verba +20% daqui em diante e levas maiores por {seasons} estações.', 'The Republic is proclaimed: the province becomes a state; grant +20% from now on and larger groups for {seasons} seasons.'),
 'republicDown': ('República proclamada: a província vira estado; verba −20% daqui em diante e levas maiores por {seasons} estações.', 'The Republic is proclaimed: the province becomes a state; grant −20% from now on and larger groups for {seasons} seasons.'),
 'encilhamento': ('Começou o Encilhamento: {seasons} estações de preços loucos.', 'The Encilhamento has begun: {seasons} seasons of wild prices.'),
 'encilhamentoUp': ('Encilhamento: preços em alta nesta estação.', 'Encilhamento: prices up this season.'),
 'encilhamentoDown': ('Encilhamento: preços despencando nesta estação.', 'Encilhamento: prices crashing this season.'),
 'mateBoom': ('O mate disparou: 8 estações de preço alto.', 'Mate prices soared: 8 seasons of high prices.'),
 'mateBust': ('O preço do mate despencou: o Prata encheu de erva.', 'The mate price crashed: the River Plate is full of yerba.'),
 'federalist': ('Curitiba ocupada pelos federalistas: a saída sul fica fechada por {seasons} estações.', 'Curitiba occupied by the federalists: the south exit is closed for {seasons} seasons.'),
}
CRISIS = {'republic': ('a Proclamação da República', 'the Proclamation of the Republic'), 'encilhamento': ('a Crise do Encilhamento', 'the Encilhamento crisis'), 'federalist': ('a Revolução Federalista', 'the Federalist Revolution'), 'mate': ('o Ciclo do mate', 'the mate cycle')}
SHOCK = {'frost': ('Geada nas roças', 'Frost on the fields'), 'flood': ('Cheia no rio', 'River flood'), 'goodRain': ('Chuva boa', 'Good rain'), 'storm': ('Temporal', 'Storm'), 'fog': ('Neblina no rio', 'Fog on the river'),
 'encilhamento': ('Encilhamento', 'Encilhamento'), 'mateBoom': ('Alta do mate', 'Mate boom'), 'mateBust': ('Queda do mate', 'Mate bust')}
CHRON = {'fire': ('perdeu {n} casas num incêndio.', 'lost {n} houses in a fire.'), 'epidemic': ('enfrentou uma epidemia de {disease}.', 'faced an epidemic of {disease}.'), 'crisis': ('viveu {crisis}.', 'lived through {crisis}.'),
 'lawPassed': ('aprovou a lei {law}.', 'passed the law {law}.'), 'agentEnded': ('encerrou o contrato com o agente de imigração por falta de caixa.', 'ended the immigration agent\'s contract for lack of cash.'),
 'childrenMarried': ('viu {n} famílias novas de filhos da colônia.', "saw {n} new families of the colony's children."), 'caveExplored': ('colonos exploraram a {cave}.', 'settlers explored {cave}.'), 'storeClosed': ('viu uma venda fechar por causa dos impostos.', 'saw a store close because of taxes.')}
DISEASE = {'fever': ('febre', 'fever'), 'cholera': ('cólera', 'cholera')}

def build():
    out = {'pt-BR': {}, 'en': {}}
    for eid, langs in EV.items():
        for loc, (who, title, body, lines, ops) in zip(('pt-BR', 'en'), langs):
            o = out[loc]; o[f'event.{eid}.who'] = who; o[f'event.{eid}.title'] = title; o[f'event.{eid}.body'] = body
            for i, (sp, tx) in enumerate(lines): o[f'event.{eid}.line.{i}.who'] = sp; o[f'event.{eid}.line.{i}.text'] = tx
            for i, (lab, eff, chron) in enumerate(ops):
                o[f'event.{eid}.option.{i}'] = lab; o[f'event.{eid}.option.{i}.effect'] = eff; o[f'event.{eid}.option.{i}.chronicle'] = chron
    for k, (pt, en) in MOOD.items(): out['pt-BR'][f'mood.{k}'] = pt; out['en'][f'mood.{k}'] = en
    for k, (pt, en) in NEWS.items(): out['pt-BR'][f'news.{k}'] = pt; out['en'][f'news.{k}'] = en
    for k, (pt, en) in CRISIS.items(): out['pt-BR'][f'crisis.{k}'] = pt; out['en'][f'crisis.{k}'] = en
    for k, (pt, en) in SHOCK.items(): out['pt-BR'][f'shock.{k}'] = pt; out['en'][f'shock.{k}'] = en
    for k, (pt, en) in CHRON.items(): out['pt-BR'][f'chronicle.{k}'] = pt; out['en'][f'chronicle.{k}'] = en
    for k, (pt, en) in DISEASE.items(): out['pt-BR'][f'disease.{k}'] = pt; out['en'][f'disease.{k}'] = en
    for loc, kv in out.items():
        f = os.path.join(ROOT, 'packages', 'i18n', 'locales', f'{loc}.json'); c = json.load(open(f, encoding='utf-8')); c.update(kv)
        json.dump(dict(sorted(c.items())), open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(f, 'a').write('\n')
        print(loc, len(c))
build()
