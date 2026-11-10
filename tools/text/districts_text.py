# District names and the news of a new district, in both locales. {land} is a land's name, {name} a district's.
import json, pathlib
LOC = pathlib.Path(__file__).resolve().parents[2] / 'packages' / 'i18n' / 'locales'
T = {
  'district.centre': ('Centro', 'Centre'), 'district.mainSquare': ('Largo da Matriz', 'Mother Church Square'), 'district.churchSquare': ('Largo da Igreja', 'Church Square'),
  'district.marketSquare': ('Largo do Mercado', 'Market Square'), 'district.port': ('Bairro do Porto', 'Port Quarter'), 'district.storeStreet': ('Rua da Venda', 'Store Street'),
  'district.school': ('Bairro da Escola', 'School Quarter'), 'district.apothecary': ('Bairro da Botica', 'Apothecary Quarter'), 'district.mills': ('Bairro dos Engenhos', 'Mills Quarter'),
  'district.sawmill': ('Bairro da Serraria', 'Sawmill Quarter'), 'district.monjolo': ('Bairro do Monjolo', 'Monjolo Quarter'), 'district.councilSquare': ('Largo da Câmara', 'Council Square'),
  'district.riverside': ('Beira-Rio', 'Riverside'), 'district.upper': ('Rua de Cima', 'Upper Street'), 'district.lower': ('Rua de Baixo', 'Lower Street'),
  'district.east': ('Bairro do Nascente', 'East Quarter'), 'district.west': ('Bairro do Poente', 'West Quarter'),
  'district.hamlet': ('Arraial de {land}', '{land} Hamlet'), 'district.hamletAlone': ('Arraial', 'Hamlet'), 'district.custom': ('{custom}', '{custom}'),
  'district.withLand': ('{name} de {land}', '{name} of {land}'), 'district.numbered': ('{name} {n}', '{name} {n}'),
  'news.districtBorn': ('Nasceu um bairro: {district}, com {homes} casas.', 'A new district: {district}, with {homes} homes.'),
}
for i, lang in enumerate(['pt-BR', 'en']):
    p = LOC / f'{lang}.json'; d = json.loads(p.read_text())
    for k, v in T.items(): d[k] = v[i]
    p.write_text(json.dumps(dict(sorted(d.items())), ensure_ascii=False, indent=1) + '\n')
print(len(T))
