# Assunguy

A colony-building game set in 19th-century Paraná. Mobile first, two languages (Portuguese and English).

## Layout

```
packages/
  data/     content and balance tables (goods, buildings, vehicles, levels, laws, biomes)
  i18n/     pt-BR and en catalogs and the translator; code never holds display text
  sim/      the rules: pure TypeScript, deterministic, no DOM
  sprites/  (planned) the procedural sprite generator
  render/   (planned) the isometric map in PixiJS
  ui/       (planned) the React component kit and screens
  audio/    (planned) music, ambience and effects
apps/
  game/     (planned) the Vite app, PWA first, Capacitor later
tools/
  legacy-import/  one-way import of the prototype's content tables
  legacy-oracle/  runs the frozen prototype and records fixtures for golden tests
  bot/            (planned) the robot player and balance reports
legacy/
  prototype/      the original single-file prototype, frozen as the reference
```

## Rules of the codebase

- Code, identifiers and comments are in English. Player-facing text lives only in `packages/i18n/locales`.
- The advisor is a role (`advisor`); the player names them. No character names in code.
- The simulation never calls `Math.random`; every draw comes from a seed kept in the state.
- Porting from the prototype is checked by golden tests: `tools/legacy-oracle` records what the prototype
  computes and the TypeScript port must match it.

## Commands

```
pnpm install
pnpm test          # unit and golden tests
pnpm typecheck
pnpm import:legacy # regenerate content.generated.ts and fill missing locale keys
node tools/legacy-oracle/oracle.cjs market   # re-record a golden fixture (needs Playwright)
```
