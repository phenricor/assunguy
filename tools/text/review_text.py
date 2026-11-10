# Text fixes from the interface review that change imported texts: building descriptions without the
# family count (the Capacidade line shows it) and the store without the whole-land rule (removed in the
# review).
import json, pathlib

LOC = pathlib.Path(__file__).resolve().parents[2] / 'packages' / 'i18n' / 'locales'
T = {
  'building.hut.description': ('Sapê', 'Thatch'),
  'building.house.description': ('Madeira', 'Timber'),
  'building.whitewashedHouse.description': ('Cal e telha', 'Lime and tile'),
  'building.townhouse.description': ('Dois andares', 'Two storeys'),
  'building.store.description': ('Recebe a produção a até 6 lotes e vende às famílias. Mercado +40', 'Takes produce within 6 lots and sells to families. Market +40'),
}
for i, name in enumerate(['pt-BR', 'en']):
    p = LOC / f'{name}.json'
    data = json.loads(p.read_text(encoding='utf-8'))
    for k, v in T.items(): data[k] = v[i]
    p.write_text(json.dumps(dict(sorted(data.items())), ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
print(f'{len(T)} texts revised')
