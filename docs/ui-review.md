# Interface review (playtester, November 2026)

Decisions from the 71 comments on the interface catalog. The new UI (`packages/ui`) follows these, and
the catalog artboards show them applied.

## Rules for every screen

- Never use the middle dot "·" to join pieces of text. Use separate lines, labels or a comma.
- "A pé", never "lombo", everywhere (UI, advisor, guide). One term per idea across the game.
- Never put a price in a button. The cost is shown in the body of the modal; the button is a bare
  imperative verb ("Construir", "Enviar expedição").
- No redundant descriptions: if a field shows it (season, families, capacity), the description line
  does not repeat it. Each building has one short description.
- Explanations ("O que resolve", what is not unlocked yet, how something works) go in an info box or
  in the guide, not in the body of the screen.
- What is not unlocked is hidden, not shown as locked text (taxes, town laws, the immigration agent,
  resources and districts layers).
- Formal, plain register: no "umas", no "alguns segundos, sem risco". Prefer "em torno de".
- "Satisfação", never "Nota", for home ratings.
- "Capacidade" for slots and families a building holds ("2 famílias"); never "Equipe", never
  "com a próxima leva".
- A requirement reads "Requer Ferraria (nível 7)".
- Show a line (satisfaction, income) in a preview only when it changes.
- Actions with consequences (moving a field, buying or selling a canoe) open a confirmation popup
  that lists the effects before the player confirms.
- The advisor's name is chosen by the player and is limited to 10 characters; its initial is the badge.

## Rule changes

- Lot installments and their collection policy are removed (Direção: lotes).
- Works are always automatic; the "Desligada" option is removed.
- Extra time and extra funds from the province are no longer buttons in Direção: província; the advisor
  suggests them when they are available.
- Advice whose cost is above the cash in hand is shown blocked.
- Walking to commerce is lossless only within 6 lots of it; the whole-land exception is gone.

## Routes (approved)

Tapping a commerce, collection point or gateway shows the whole network it belongs to, from the fields to
the gateway: its reach as an area, lines from fields (on foot or to a collection point), from collection
points to commerce (thickness by share), from commerce to gateway, and the gateway's destination and how
full it is. A "Rotas" map layer shows the whole network at once.

## Screen by screen

| Screen | Change |
|---|---|
| Home (first time) | Music is a single note icon toggling music and sounds; "Música ligada", "Próxima" and "Sons" go. |
| Map, start | Date line without the dot: "Ano 1, Primavera" and the weather on its own. |
| Settings | A list of buttons with icons, no columns: Menu inicial, Salvar jogo, Exportar jogo, Música, Sons. No map number. |
| Map layers | Each layer with an icon. Resources and districts only when unlocked. "Satisfação" instead of "Nota das casas". Each problem layer (Água and the rest) has an icon and an info button saying what solves it ("Construa poços para levar água às casas"). Soil cards with an icon per crop. |
| Map, grown colony | Settings icon is a cog. "x/42 terras" becomes "x desempregadas". Government icon is a Greek temple; transport icon is rails. |
| Build list | Bug: tapping a tab scrolled off screen resets the strip; the strip keeps its position. |
| Build preview | Satisfaction only when it changes. "Capacidade: 2 famílias". Description without the family count. Button "Construir". |
| Build, no money | "Custa $ 200 (orçamento insuficiente)". |
| Building: house | "Requer Ferraria (nível 7)". |
| Building: field | Description without the harvest season (it has its own field). "Capacidade 1/1" and yield in its own field. Moving opens a confirmation popup with the effects. |
| Building: workshop | "Produção" instead of "Capacidade". |
| Neighbouring land | Body: "A expedição é realizada nesta mesma estação. Depois de explorar, ainda é preciso anexar a terra para usá-la." Cost highlighted in the body; button "Enviar expedição". |
| Immigration | "Modificadores da fama". Agent hidden until available. "em torno de" instead of "umas". "Histórico de chegadas". |
| Government panel | Taxes hidden until available. |
| Direção: província | Extra time and extra funds move to the advisor. |
| Direção: obras | Short explanation, the rest in the guide. No on/off switch. |
| Direção: lotes | Removed. |
| Direção: impostos, leis | Hidden until the level that opens them. |
| City costs | The per-milestone street price list is replaced by the current price only. |
| City problems | "Não há" instead of "-" and "Não". "Chance de epidemia". "Casas sem água decente". "Casas de madeira próximas". "O que resolve" in an info box. |
| Event (Acontecimento) | Removed. |
| Economy: summary | Lost arrobas with the percentage. |
| Economy: resources | No "Iguape" before the price change; no "Exporta" tag. |
| Economy: invest | Removed (the screen no longer exists). |
| Transport panel | "a pé" instead of "lombo". |
| Transport: pier and tariff | No dot in "Cais, Sede". Vehicles as a row with icon, label, quantity and − / + like a shopping cart; each tap opens a popup with cost, capacity and price effects to confirm. |
| Transport: haulage | "A pé". |
| Transport: fleet | "Ainda não: carroça (Vila)…" moves to an info box. |
| Level: next | Level number in a medal outside the card. The next title (Freguesia) highlighted on the screen, outside the card. Seasons left below the title, outside the card. |
| Advisor | Advice above cash in hand is blocked. |
| Season report | Up or down arrow beside satisfaction and cash by change since last season. "Para onde vai a carga" becomes "Carga parada", a bar chart with one bar per season, oldest to newest. "Produção: o que mudou em um ano" removed. The three cards (income, …) removed. "O que suas escolhas fizeram" becomes "Efeito das suas decisões". "Resultado por recurso no ano" goes below the assets section. Investment lines sorted from most to least worth it. "Patrimônio hoje" becomes "Rentabilidade do patrimônio". |
| Interface kit | The internal note at the top is removed (never shown to the player). |
