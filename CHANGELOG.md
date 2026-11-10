# Changelog

All notable changes to the game. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the game uses [Semantic Versioning](https://semver.org/), read in terms of the saves:

- **Major**: older saves no longer load, or the rules change enough to change how the game is played.
- **Minor**: new content or features, or balance changes; older saves still load (migrated if needed).
- **Patch**: fixes to bugs, texts or visuals, with no rule changes.

Pre-releases carry a suffix (`-beta.N`, `-rc.N`) and count up until the stable version.

## [Unreleased]

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

[Unreleased]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.5...HEAD
[1.0.0-beta.5]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.4...v1.0.0-beta.5
[1.0.0-beta.4]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.3...v1.0.0-beta.4
[1.0.0-beta.3]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.2...v1.0.0-beta.3
[1.0.0-beta.2]: https://github.com/phenricor/assunguy/compare/v1.0.0-beta.1...v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/phenricor/assunguy/releases/tag/v1.0.0-beta.1
