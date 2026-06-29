# AGENTS.md

Orientation for AI agents working on **Maze Topia**, a browser tower-defence
game. Read [`README.md`](README.md) first — it covers gameplay, the per-file
responsibility table, and the design rationale. This file is the layer the
README doesn't: how to work in the repo without breaking it.

## Commands

```bash
npm install
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # tsc (typecheck) THEN vite build → dist/
npm run preview  # serve the production build
```

- **There are no tests and no linter.** `tsc` (run via `npm run build`) is the
  only automated gate. Run it before you call a change done.
- Runtime is **Node 24, npm** (matches CI). Stack: TypeScript + PixiJS v8 +
  Vite. Only runtime dep is `pixi.js`.
- CI is [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): every
  push to `main` builds and deploys to GitHub Pages. A red build = a broken
  deploy, so don't push type errors.

## The one architectural rule

**Game logic is decoupled from rendering, and it must stay that way.** Only
[`src/renderer.ts`](src/renderer.ts) imports `pixi.js`; the simulation
(`game`, `grid`, `enemy`, `tower`, `projectile`, `waves`, `config`) has zero
DOM or Pixi references and could run headless. Do not import Pixi, reach for
`document`/`window`, or otherwise pull rendering/DOM concerns into a core file.
Rendering reads game state; it never owns it.

## Invariants you can break by accident

- **Pathing is a distance field, not per-enemy pathfinding.** `grid.ts` runs
  one BFS from the exit; every open cell stores its step-distance, and enemies
  walk downhill to the lowest neighbour. The field is recomputed only when the
  board changes (`Grid.place` → `computeField`). Don't add A\* or per-unit
  routing — re-routing is already free.
- **Placement validation must keep the maze solvable.** A candidate cell is
  tentatively blocked and the field recomputed; the placement is rejected if it
  strands the spawn *or* any cell holding a live enemy (`grid.ts` validate /
  `dist === Infinity`). Preserve this check when touching placement.
- **Fast-forward = extra fixed substeps, not a bigger `dt`.** `main.ts` clamps
  `dt` per frame and loops `game.speed` substeps. Never scale the timestep to
  speed things up — it destabilises homing and pathing.
- **Targeting is "lower score wins" with a progress tiebreak** (`tower.ts`
  `targetScore`). Per-tower override → `def.defaultTargeting` → `'first'`. Add
  a mode by extending `TargetingMode` + `TARGETING_MODES` in `config.ts` and
  the `switch` in `targetScore` (the switch is exhaustive — a new mode without a
  case is a type error, which is the point).
- **HMR is disabled** (`vite.config.ts` `hmr: false`). After editing during
  `npm run dev`, **reload the browser manually** — changes will not hot-apply.
- **`base: '/maze-topia/'`** is set for GitHub Pages. Don't hardcode absolute
  asset paths that assume serving from `/`.
- **Level progress lives in `localStorage`** (`progress.ts`). Clearing it
  resets unlocks; tests/manual runs may need it cleared.

## Where to change what

- **Balance and content** (grid size, tower stats, wave curves, levels) live
  entirely in [`src/config.ts`](src/config.ts): the `TOWER_DEFS` list and the
  `LEVELS` array. Add a level by appending to `LEVELS` — its array index is its
  unlock order. Use the `rect(...)` helper for wall blocks. You rarely need to
  touch logic to tune the game.
- **New tower behaviour**: add a `TowerDef` (kind `attack`/`farm`/`bank`/`mill`/
  `amp`), then implement any non-generic behaviour in `tower.ts` / `game.ts`.
  Economy hooks already exist: `collectIncome`, `collectInterest`, farm/damage
  boosts.
- **Threat scaling**: enemy HP and spawn count scale with standing
  threat-driving economy buildings (Farms, Mills). **Banks are exempt.** If you
  add an economy tower, decide deliberately whether it drives threat.

## Conventions

- **Strict TypeScript, `noUnusedLocals`/`noUnusedParameters`/exhaustive
  switches on. Never use `any`.** Imports use explicit `.ts` extensions
  (`allowImportingTsExtensions`).
- Comments explain **why**, not what — match the existing density (see
  `tower.ts` leading/targeting comments for the house style).
- Config constants are derived from `CELL` (e.g. `range: 2.5 * CELL`) so the
  whole board scales together. Keep new tunables in those units.
