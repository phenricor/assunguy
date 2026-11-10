# The new game (apps/game)

The playable game: the new simulation (`@assunguy/sim`) behind the prototype's look.

## Decision: the prototype's canvas and sprites, not new art

The user asked that the game look like the prototype, keeping the sprites refined there ("se não ficar, opte
pelo canvas como já é atualmente"). So the map is drawn by the prototype's own canvas renderer and sprite
generator, vendored unchanged; only the state they read comes from the new simulation.

- `src/legacy/` holds vendored prototype code, extracted by `tools/legacy-render/extract.py` from
  `legacy/prototype/index.html`. Frozen, in Portuguese, never edited by hand: re-run the script.
  - `spr3d.js`: the sprite generator (3D models to isometric sprites), run in Web Workers.
  - `render.js`: world generation (static map), camera, ground painting, sprites, people, mule trains,
    canoes, weather, effects, layers drawing, input, sound, music and the start-screen landscape.
  - The PNG atlases (`v0-v3`, `g0-g3`, `anim`) come from the prototype package and are inlined in the build.
- `src/view.ts` (English): builds the prototype-shaped view the renderer reads (`M`, `C`, ...) from the
  new `GameState`, translating ids with `legacy/id-map.json`, and receives the renderer's callbacks
  (tap on a lot, street drawn, preview) for the interface.
- `src/ui/` (English): the screens, rewritten against the new simulation, with the prototype's CSS and
  markup so they look the same, and the changes from `docs/ui-review.md` and the catalog.

## Status

- [x] extraction script and vendored renderer running with the adapter
- [x] interface: top bar, guide, build sheet, selection, lands, season report, events, toasts, confirms
- [x] screens: Colônia, Governo (Direção tabs), Economia, Transporte, Nível, Conselheiro
- [x] layers: Satisfação, services, soil, resources, Escoamento, Bairros
- [x] menu, new game with names, saves (IndexedDB, one per colony, 5 yearly autosaves, export, import)
- [x] pt-BR / en toggle (ui.* keys from tools/text/ui_text.py)

- [x] late-game race: `sim/race.ts` (rivals, competitiveness, rails, decline and victory), the Transport
      panel's race block, rail building, train animation, restart from the day the race began
- [x] review texts: building descriptions without family counts, the store without the land rule
      (`tools/text/review_text.py`, run after the legacy import)

Testing: `apps/game` builds with `npx vite build` into one HTML file; Playwright flows (served `dist/`)
click through the menu, a build, a season, every panel, the layers and the race, at 390 px and 1280 px.

## Texts

- `tools/text/ui_text.py`: every `ui.*` key, both languages; warns about keys the code uses but lacks.
- `tools/text/race_text.py`: the race's news, chronicle, events, advice and panel.
- Words the vendored renderer draws (the map's cartouche and sayings) go through `hooks.word` and
  `hooks.saying`, replaced at extraction (`render.json` "replace").

## Not carried over from the prototype

- Loans in the race (the prototype's credit screen), the network lines editor and the old Rede screens:
  the race runs on the reviewed transport model, with stations, rails and vehicles at gateways.
- Núcleos (satellite settlements) and the prototype's cloud save.
