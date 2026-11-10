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
| Jobs, production, the season economy | `sim/economy` | `alocar`, `contaEconomia`, `economiaSem`, `serveMesa` | both saves |
| Transport flows | `sim/transport` | `prepGeo`, `transpInicio`, `escoaEstacao`, `exportaPortas`, `transpFim` | both saves |
| Home ratings, mood, taxes | `sim/ratings` | `calcula`, `satGlobal`, `satCidade`, `satTransp`, `efeitoImpostos`, `quedaPorFamilia` | both saves, plus taxes in force |
| Families | `sim/families` | `novaFamilia`, `sincronizaFamilias`, `passaFamilias`, `atualizaAbast`, `familiasInvestem`, `receberLeva`, `filhosQueCasam` | new game, speedrun |
| Province, purse, relief works, great works, goals | `sim/province` | `aplicaFrente`, `manutencaoDe`, `prestaContas`, `avancaGrandesObras`, `faltasDaMeta`, `requisitosDoNivel`, `ritmoDaMeta` | both saves |
| Placement | `sim/placement` | `podeConstruir` | sampled lots, both saves |
| Measuring hypothetical buildings | `sim/measure` | `comObras`, `economia(m, extra)` | both saves |
| Events, crises, city problems | `sim/events` | `rolaAcontecimentos`, `defEvento`, `resolveEvento`, `avancaProblemas`, crises | through the season runs |
| The season | `sim/season` | `passaEstacao`, `confereMeta` | 12 seasons from each save, events resolved by a fixed policy |
| Outlet per producer | `sim/economy` (`outletOf`) | none: new, from the transport run | totals add up to the colony's losses |
| The advisor | `sim/advisor` | `conselhosSem`, `conselhosTransp`, `ondeInvestir`, `sugestaoTroca`, `dizimoSugerido` | 13 states of each save's run, plus 5 variants of each save |

## Next

1. Player commands: build, demolish, move, upgrade, annex, buy and sell vehicles, swap crops, taxes and
   laws, province requests. Golden against the prototype's command functions.
2. `tools/bot`: a robot player that follows the advisor (top advice it can pay for) through these
   commands, with balance checks: milestones against their deadlines, cash, gateway occupancy.
3. Districts (`calculaBairros`), series and graphs, report decision diffs; the late-game race stays for later.

## The advisor

`legacyAdvice` is the prototype's list, number for number. `advise` adds the review rules on top: every
advice carries its cost and is blocked above the cash in hand; a far land gets the better of a collection
point and a store with waystation and mule trains, measured, or nothing (it replaces the prototype's lone
store); the producer losing the most on the way gets its best measured fix (`producerFix`, also used by the
field panel); the province's extra time and extra funds are offered when they apply.

Two prototype quirks are kept out of the comparison by the oracle: its caches (keyed on counts) go stale
when an event changes the colony without changing them, and `fotoColonia` and `faltasDaMeta` re-rate the
live colony in the middle of the advice, so later rules saw different ratings than earlier ones.

## How the season economy was ported

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
same rules off in the prototype before recording (see the patches at the top of the oracle), so golden tests still compare like with like.

- Lot installments and their collection policy are gone: no `cobraParcelas`, no `parcelas`/`atraso` on
  families, no collection setting, and the province report no longer counts arrears. The oracle replaces
  `cobraParcelas` with a no-op.
- A commerce's whole land is no longer lossless on foot; only the free distance (6 lots) from the nearest
  commerce is. On the saves this costs 3% of income (canoes) and 0.4% (speedrun). The advisor must suggest a
  trading post or landing for far fields, and a commerce only where there are families and a gateway.
- A field within the free walking distance (6 lots) of a commerce never sends cargo through a collection
  point: walking there loses nothing, so paying a tariff for it made no sense. The prototype's soft route
  choice sent 5% to 26% of such a field's cargo to any collection point in reach. The oracle guards the
  prototype's collection list the same way. Neither save has such a field, so their numbers are unchanged.
- Relief works are always on.
- Extra funds and extra time from the province are offered by the advisor when available, not as
  buttons on the province tab. Advice the colony cannot pay for is listed but blocked.

## Advisor fixes to make when porting it

- Done (`farLandPlan`). "Roças sem comércio" suggested a store in a far land without checking that the store reaches a gateway
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
