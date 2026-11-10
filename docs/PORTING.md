# Porting the prototype's rules

Every slice is checked by a golden test: `tools/legacy-oracle` runs the frozen prototype, records what it
computes, and the TypeScript port must match it number for number. Inputs are fixed seeds or the
playtester's saves in `legacy/saves`.

## Done

| Slice | Module | Prototype | Golden input |
|---|---|---|---|
| Random sources, calendar | `sim/rng`, `sim/calendar` | `acaso`, `acasoMercado`, `anoDo` | |
| Outside market | `sim/market` | `mercadoInicial`, `passaMercado`, `precoAtual` | fixed seed, 36 seasons |
| World | `sim/world` | `geraMundo`, `geraRio`, `geraTerras`, `geraRelevo`, `ruido` | 6 seeds, map v1 and v2 |
| Starting map, trees, nature | `sim/map` | `mapaInicial`, `arvoresIniciais`, `geraNatureza` | 4 seeds |
| Street network, service reach | `sim/network` | `redePrincipal`, `ligados`, `alcance`, `distRet` | both saves |

## Next: the season economy

The prototype computes one season's economy through a web of functions that read each other's cached
results from the state object. The port has to make that order explicit.

```
calcula(m)            house ratings; writes m.notaCasa, m.saude
  satGlobal(m)        colony-wide satisfaction items (laws, events, choices)
  quedaPorFamilia(m)  tax burden per family  ->  efeitoImpostos(m)  ->  economia(m)
economia(m, extra)    memoized economiaSem; `extra` = hypothetical buildings for the advisor
  comObras            places hypothetical buildings on real lots
  contaEconomia(m)    linked buildings, place and level factors, deposits, families, jobs,
                      sector yields, hauling capacity (market, carts, river port, mule trains)
    alocar(m)         families to jobs; reads m.notaCasa (the PREVIOUS calcula)
  economiaSem         production, recipes, the table (serveMesa), storage, exports, taxes, accounts
```

Cycle to break: `calcula` needs taxes, taxes need `economia`, `economia` needs `alocar`, `alocar` needs the
house ratings from the last `calcula`. In the port the ratings, health and supply (`notaCasa`, `saude`,
`abast`) become explicit fields of the season state, written at the end of a season and read at the
start of the next. The golden test loads a save with those fields as the prototype left them.

State the economy reads, besides the map: `leis` (taxes), `leisC` (laws), `escolhas` (path choices),
`gobras` (great works: telegraph, macadam road, rail spur, plus `usinaCal`, `serrariaVapor`, `charqueada`),
`prob` (epidemic), `efeitos` (events, e.g. `federalista`), `mercadoSim`, `frenteFrete`, `nivelC`, `marco`,
`cobranca`, `plantio` (fields not yet harvested), `nivel` (building upgrades), `fams`.

Order of the slices:

1. Families: `novaFamilia`, `sincronizaFamilias`, `alocar`, `passaFamilias`, installments (`cobraParcelas`).
2. House ratings: `calcula`, `satGlobal`, with taxes stubbed from the recorded `quedaPorFamilia`.
3. Production and capacity: `contaEconomia`, `fatorLugar`, `fatorNivel`, `plantio`.
4. The season: `economiaSem` (recipes, table, storage, exports, taxes), then `efeitoImpostos` closes the cycle.
5. Transport: the export bottleneck (`cartaoEscoamento`, canoes, carts, mule trains).
6. Goals and deadlines: `confereMeta`, `ritmoDaMeta`, intervention.
7. Events as declarative effects; the advisor (`conselhos`, `ondeInvestir`) as the role `advisor`.
8. `tools/bot`: a robot player that follows the advisor, reproducing the canoe and deadline findings.

## Rule changes from the November interface review

These are deliberate departures from the prototype (see `docs/ui-review.md`). The oracle switches the
same rules off in the prototype before recording, so golden tests still compare like with like.

- Lot installments and their collection policy are gone: no `cobraParcelas`, no `parcelas`/`atraso` on
  families, no collection setting, and the province report no longer counts arrears. The oracle replaces
  `cobraParcelas` with a no-op.
- Relief works are always on.
- Extra funds and extra time from the province are offered by the advisor when available, not as
  buttons on the province tab. Advice the colony cannot pay for is listed but blocked.

## Advisor fixes to make when porting it

- "Roças sem comércio" suggests a store in a far land without checking that the store reaches a gateway
  (store reach + 4 lots). Far from the pier, the store is isolated: producers carry to it for free, but it
  only sells to the families around it and the rest spoils. In the speedrun save (Campos do Mate) the store
  alone costs $ 2.498 a year; the follow-up rule then asks for a waystation. The port must offer store +
  waystation + mule trains as one package, measured by the economy (+$ 425 a year with 2 mule trains,
  +$ 565 with 4, most of it from the second exit to Curitiba), or no store at all.
- A collection point alone there is break-even ($ 10 a year with a landing, −$ 60 with a trading post):
  the walking loss it saves is small and the pier is already 84% full.

## Known prototype quirks kept on purpose

- The Kaingang village lands are still drawn and then turned into forest, so seeds build the same maps.
- The world's running random source (`RND`) is not saved by the prototype, so a reloaded game draws
  differently from one played straight through. The port keeps the source in the state; golden tests
  compare fresh games only.
