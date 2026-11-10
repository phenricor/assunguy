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

- [ ] extraction script and vendored renderer running with the adapter
- [ ] interface: top bar, guide, build sheet, selection, lands, season report, events, toasts, confirms
- [ ] screens: Colônia, Governo, Economia, Transporte, Nível, Conselheiro
- [ ] layers: Satisfação, services, soil, resources, Escoamento, Bairros
- [ ] menu, new game with names, saves (one per colony, yearly autosave, export, import)
- [ ] pt-BR / en toggle (ui.* keys from tools/text/ui_text.py)
- [ ] late-game race in the sim and its screens
- [ ] bot re-balance, single-file build, Playwright check at 390 px and desktop, publish
