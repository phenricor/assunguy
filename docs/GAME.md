# The new game (apps/game)

The playable game: the new simulation (`@assunguy/sim`) behind the prototype's look.

## Decision: the prototype's canvas and sprites, not new art

The user asked that the game look like the prototype, keeping the sprites refined there ("se não ficar, opte
pelo canvas como já é atualmente"). So the map is drawn by the prototype's own canvas renderer and sprite
generator; only the state they read comes from the new simulation.

- `src/render/` holds the prototype's renderer, now kept here, in Portuguese as it was written.
  - `spr3d.js`: the sprite generator (3D models to isometric sprites), run in Web Workers. The build adds
    the game's own models to it: `src/birdModels.js` (river birds) and `src/araucaria.js` (the adult
    araucaria, which replaces the prototype's).
  - `render.js`: world generation (static map), camera, ground painting, sprites, people, mule trains,
    canoes, weather, effects, layers drawing, input, sound, music and the start-screen landscape.
  - `ids.json`: the Portuguese ids the renderer uses, mapped to the simulation's English ones.
  - The PNG atlases (`v0`, `g0`, `anim`) are in `assets/` and inlined in the build.
- `src/view.ts` (English): builds the prototype-shaped view the renderer reads (`M`, `C`, ...) from the
  new `GameState`, translating ids with `src/render/ids.json`, and receives the renderer's callbacks
  (tap on a lot, street drawn, preview) for the interface.
- `src/ui/` (English): the screens, rewritten against the new simulation, with the prototype's CSS and
  markup so they look the same, and the changes from `docs/ui-review.md` and the catalog.

## Status

- [x] prototype renderer running with the adapter
- [x] interface: top bar, guide, build sheet, selection, lands, season report, events, toasts, confirms
- [x] screens: Colônia, Governo (Direção tabs), Economia, Transporte, Nível, Conselheiro
- [x] layers: Satisfação, services, soil, resources, Escoamento, Bairros
- [x] menu, new game with names, saves (IndexedDB, one per colony, 5 yearly autosaves, export, import)
- [x] pt-BR / en toggle (ui.* keys from tools/text/ui_text.py)

- [x] late-game race: `sim/race.ts` (rivals, competitiveness, rails, decline and victory), the Transport
      panel's race block, rail building, train animation, restart from the day the race began
- [x] review texts: building descriptions without family counts, the store without the land rule
      (`tools/text/review_text.py`)

Testing: `apps/game` builds with `npx vite build` into one HTML file; Playwright flows (served `dist/`)
click through the menu, a build, a season, every panel, the layers and the race, at 390 px and 1280 px.

## Texts

- `tools/text/ui_text.py`: every `ui.*` key, both languages; warns about keys the code uses but lacks.
- `tools/text/race_text.py`: the race's news, chronicle, events, advice and panel.
- Words the renderer draws (the map's cartouche and sayings) go through `hooks.word` and
  `hooks.saying`.

## Not carried over from the prototype

- Loans in the race (the prototype's credit screen), the network lines editor and the old Rede screens:
  the race runs on the reviewed transport model, with stations, rails and vehicles at gateways.
- Núcleos (satellite settlements) and the prototype's cloud save.
