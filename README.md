# Assunguy

A colony-building game set in 19th-century Paraná. Mobile first, two languages (Portuguese and English).

## Layout

```
packages/
  data/     content and balance tables (goods, buildings, vehicles, levels, laws, biomes)
  i18n/     pt-BR and en catalogs and the translator; code never holds display text
  sim/      the rules: pure TypeScript, deterministic, no DOM
apps/
  game/     the playable game: Vite, one self-contained HTML file
    src/render/  the canvas map renderer and sprite generator
    src/ui/      menus, panels and screens
tools/
  bot/      the robot player and balance reports
  text/     scripts that write the texts into both catalogs
docs/
  GAME.md       how the game app is put together
  balance.md    robot results and the balance decisions
  ui-review.md  rules from the interface review
```

## Rules of the codebase

- Code, identifiers and comments are in English. Player-facing text lives only in `packages/i18n/locales`.
  The exception is `apps/game/src/render/`, which came from the prototype in Portuguese.
- The advisor is a role (`advisor`); the player names them. No character names in code.
- The simulation never calls `Math.random`; every draw comes from a seed kept in the state.
- Art is drawn by code, through the sprite generator.

## Versions and releases

Semantic versioning, one version for the whole repository (the root `package.json`). What counts as a major,
minor or patch change is set out at the top of `CHANGELOG.md`; saves carry their own format number
(`apps/game/src/saveFormat.ts`), with a migration for each change.

To release: set the version in every `package.json`, turn `Unreleased` in `CHANGELOG.md` into the version's
section and commit. Then either run the Release workflow from the Actions tab (it tags the commit with the
version) or push the tag yourself (`git tag -a v1.0.0-beta.2 -m "1.0.0-beta.2" && git push --follow-tags`).
The workflow checks, builds and publishes a GitHub Release with the game's HTML file.

## Commands

```
pnpm install
pnpm test          # unit and golden tests
pnpm typecheck
pnpm balance       # robot games and balance report
cd apps/game && npx vite build   # the game, in dist/index.html
```
