# Changelog

All notable changes to the game. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the game uses [Semantic Versioning](https://semver.org/), read in terms of the saves:

- **Major**: older saves no longer load, or the rules change enough to change how the game is played.
- **Minor**: new content or features, or balance changes; older saves still load (migrated if needed).
- **Patch**: fixes to bugs, texts or visuals, with no rule changes.

Pre-releases carry a suffix (`-beta.N`, `-rc.N`) and count up until the stable version.

## [Unreleased]

### Added

- "Rumo ao nível X" at the top of the advisor's screen: only what the next level still lacks (families at work,
  income, buildings) and a package of works that closes it, measured on the colony, with its cost and the income it
  adds. It says when level 12 wins the race.
- The advisor's notebook (in Settings): the game explained in chapters that open as their subject enters the game.
  The screen and each tab, levels and milestones, getting cargo out (the cargo's way, on foot, stores, collection
  points, gateways, tariff, harvest, how to see it), the parish, the village and the race. The first steps and the
  race have steps the banner walks through; a chapter that opens shows once on the banner as new.
- New advice, all measured: a market the colony leads (or keeps above 80%) that the rivals' next advance takes away,
  with the costs on both sides; families about to leave in the race, two seasons ahead, with the income and the works
  that avoid it; a vehicle to spare where a gateway or collection point is little used (it replaces the unmeasured
  advice on idle collection points).
- Buying or selling a vehicle, and upgrading a building, show the change in the families' income a year.

### Changed

- Each upgrade the colony pays for opens one more job (the prototype opened one at the second level only), so
  workshops and services are another way to the workers a level asks for besides another hundred fields.
- In the race, the seasons leading two markets count toward victory only from level 12.
- The asset returns say when a kind of building has too many (the last one already takes income away), instead of
  calling one more worth it.

### Fixed

- A steamboat bought at the pier never showed on the river; it now steams down to Iguape like the canoes.
- Trains stopped at the end of the rails, on the map's edge, and vanished there; they now run on past the edge and
  fade out, like the convoys on the road, and come back the same way.

## [1.0.0-beta.8] - 2026-11-11

Trains for the race, a milonga, and texts that read right.

### Added

- A sixth piece of music, "Milonga do Tropeiro": a milonga in D minor led by a three-reed accordion, which sings
  the tune (in thirds from the second time on) and plays the chords, over the guitar's 3-3-2 bass walking to each
  chord. It plays mostly in autumn and winter.

### Fixed

- A train station had no trains to buy: its sheet left out every rail vehicle, so rails to the edge opened no market.
  The light train can be bought from the start of the race, the medium and heavy ones when the rivals' advances open
  them, and Inácio asks for a train when a station stands empty. One rule now decides which vehicles can be bought,
  for the sheet, the advisor and the command.
- A new district's name showed as its id in the season report ("district.hamlet|2,5"); the same in the advice that
  names a district.
- Texts that put a building's name before a gendered word ("Embarcadouro lotada", "Casa vazio") now read right
  whatever the building; a collection point that fills up at harvest in several places is one line, not one each.
- The end of a long crisis reads "Acabou a Revolução Federalista." and its warning "há sinais de que vem aí ...".

## [1.0.0-beta.7] - 2026-11-11

Transport, reviewed as a whole: buildings that work from the day they are built, advice that is measured on the
whole chain, and screens that say why cargo is lost.

### Changed

- A new trading post, waystation or rail stop comes with a mule train (or railcar), and a new landing or pier with a
  canoe, at the same price: a collection point or gateway carries from its first season.
- Mule trains cost $ 200 (was $ 300) and carry 80 arrobas a season (was 60).
- The trading post, the landing, the waystation and mule trains open at level 3 (was 4), when fields start to lie
  far from the commerce.
- The advisor's transport advice is measured: an empty collection point, a full one, a gateway with no slot left, a
  land with no collection point and a commerce with no gateway each say what they would add a year, and are only
  given when they add something. A vehicle behind a full gateway adds nothing, so the gateway comes first.
- Packages for far fields start with the building and the vehicle it comes with, the cheapest step that pays; when
  it fills up, the advice for a full building adds the next vehicle.
- A producer's "O que resolve" also looks at adding a vehicle to the collection point that already reaches it, or
  to a full gateway, and at upgrading a gateway with no slot left.
- Producers walk a few lots more to a commerce that can send their surplus out rather than stop at one with no
  gateway in reach. Before, a new store far from the gateways could pull the fields' cargo away from the one that
  exports it and halve the colony's income.
- Near a deadline, while the title's level still lacks workers, the jobs it asks for come before new collection
  points and gateways, which pay the families over years.
- New advice when the next level lacks only workers: how many jobs are missing and the cheapest job that still
  pays. Robot colonies now reach the parish before the deadline in every test run.

### Fixed

- A producer's sheet says why its cargo walks: the collection point in reach has no vehicle, is full, there is
  none in reach, or the gateway is full.
- In the outlets layer, a collection point with no vehicle is drawn grey and labelled, and what still walks keeps
  its own line to the commerce; collection points show how full they are.
- The full-gateway workshop advice no longer says "1 famílias" or "0 arrobas a menos".

## [1.0.0-beta.6] - 2026-11-10

### Fixed

- The transport preview also shows collection points: a store shows the trading posts and landings that would
  unload there, and a gateway shows those behind each commerce, with their line to it.
- Moving a transport building counts what it already served as gained at the new place, not as already served.
- A rail stop whose rails do not lead to a station says that it would collect nothing yet.

## [1.0.0-beta.5] - 2026-11-10

### Added

- Placing a trading post, landing, rail stop, store, pier, port or waystation shows on the map what would send its
  cargo there: a line from each one, with the arrobas it sends a year, blue when it gains a way out and grey when
  it already had one. The sheet counts them and the arrobas they would bring; a gateway with no commerce in reach
  says so.

### Fixed

- The outlets layer's lines have a light outline, so crossing lines stay apart, and arrows the way the cargo
  goes; the share badges fit "100%".

- A text never shows an empty placeholder such as "{n}" again: a missing count or amount shows 0 and a
  missing name an ellipsis, and the game notes it in the console.
- Events in the season report keep their numbers and names ("Leva de 6 famílias"), including what each
  option chose.
- The far-fields advice names the collection point it suggests.
- Tests now check that every text fills all its placeholders: the interface's and the advisor's calls in the
  code, every event, and everything the robot player sees over a few colonies.

## [1.0.0-beta.4] - 2026-11-10

### Fixed

- The season report is back as in the prototype, with the interface review's changes: families out of work,
  satisfaction (and what it was) and income a year at the top; the purse card with the season's accounts, and
  the outlet capacity in use; the families' improvements; "Evolução" with the families chart and "Carga
  parada" by season, now labelled with dates; "Efeito das suas decisões" as one card per work, law, tax and
  event, with a verdict and its effects; "Rentabilidade do patrimônio" with a verdict for each kind of
  building, from most to least worth it; and the result per good with its breakdown and the four seasons.
- Works in the report are named properly ("4 ranchos", "9 trechos de rua").
- Placing a home shows again the satisfaction each home would have, over every home on the map, and the
  new home's own; the build sheet also shows the forest around, the homes that already had a service, and
  for transport buildings their reach and what they serve.
- Counts in texts ("{n} famílias", "{n} estações") are filled in again.
- The level path choices show their title and each option's effect.
- News that name a good ("Procura por {good} caiu em Iguape") name it again.
- The extra funds and more time requests are back in Direção, Província, under "Pedir à província".
- The satisfaction and purse arrows no longer wrap under the number.
- The build list shows each building's cost again.
- When far fields lose on foot and the advisor suggests a store alone, it no longer says it comes with a
  waystation and mule trains; before level 4 it adds that the trading post, which collects from far fields,
  opens then.

## [1.0.0-beta.3] - 2026-11-10

### Added

- The goods screen (Economia, Recursos) is back as in the prototype: raw materials and processed goods in
  separate chips, food and other goods apart, and a switch that shows, dimmed, what the colony does not
  make yet. Each card shows when the good is harvested or where it is made, whether it is exported, its
  price and trend, and a bar with where the year's arrobas went.
- Tapping a good opens its price over the last seasons and where its arrobas went; for a good not made yet,
  it shows how to start making it, with a button to build the workshop or the level it opens at.

## [1.0.0-beta.2] - 2026-11-10

### Fixed

- On phones, the season report no longer runs off the side of the screen: each decision's effects now sit under
  its name and wrap.

## [1.0.0-beta.1] - 2026-11-10

The first beta: the whole game, from the first ten families to the railway race.

### Added

- The colony: streets, homes, fields, harvests, trades, services and satisfaction, season by season, on the
  painted map of the Ribeira valley, with lands to annex.
- Getting goods out: gateways (pier, port, waystation), collection points, mule trains, carts and canoes,
  with tariffs set by the player.
- Government: taxes, laws and great works, and the colony's money season by season.
- Milestones from settlement to parish and village, with the province's deadlines.
- The advisor, named by the player, with advice that explains itself and can be acted on in one tap.
- Reports and charts: the season report, economy, colony, transport, level and districts screens.
- Map layers: satisfaction, services, soil, resources, outlets and districts.
- The late game: the railway race against rival colonies, stations, rails and trains.
- First steps guide for new players.
- Saves: one per colony, five yearly autosaves, export to a file and import back.
- Portuguese and English, switchable at any time.
- Music and sounds.
- River birds (egrets, ibises, cormorants, lapwings and parakeets) that fade in and out.
- A wider, fuller adult araucaria, closer to the real tree.
- Feedback button under the map layers: a short message sent through the player's email app.
- The version, shown in the start menu and in Settings.
- Saves record their format and the game version; older formats are migrated when loaded, and saves from a
  newer version are refused with a message.
- Links to the author (GitHub, email and website) in the start menu's lower right corner.
- The README, in Portuguese: the game, the history of the Assunguy colony, the mechanics and a gallery.
- Licensed under PolyForm Noncommercial 1.0.0.

[Unreleased]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.8...HEAD
[1.0.0-beta.8]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.7...v1.0.0-beta.8
[1.0.0-beta.7]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.6...v1.0.0-beta.7
[1.0.0-beta.6]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.5...v1.0.0-beta.6
[1.0.0-beta.5]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.4...v1.0.0-beta.5
[1.0.0-beta.4]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.3...v1.0.0-beta.4
[1.0.0-beta.3]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.2...v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.1...v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/phenricor/assunguy/releases/tag/v1.0.0-beta.1
