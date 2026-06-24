# Maze TD

A browser tower-defence game with **true mazing**: you place towers anywhere on
open ground to sculpt the path enemies must walk. The game prevents you from
fully walling off the exit.

## Stack

- TypeScript
- [PixiJS v8](https://pixijs.com/) for WebGL rendering
- [Vite](https://vitejs.dev/) for dev server / bundling

## Run

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # typecheck + production build to dist/
npm run preview  # serve the production build
```

## How it plays

- Select a tower in the panel or press its number key (`1`, `2`); `Esc` deselects.
- **Click** the grid to build one tower, or **click-and-drag** to mass-build along
  the cursor path.
- **Right-click** a tower to sell it (70% refund).
- Tower types: **Gun** and **Cannon** attack; **Farm** generates money every
  second (only while a wave is active); **Mill** boosts the income of farms in the
  8 surrounding cells; **Bank** pays interest on your current money at the start of
  each wave.
- Towers reshape the enemy path. Placements that would trap enemies or seal the
  exit are rejected (the hover cell turns red).
- Click **Start Wave** to send the next wave. Starting early (within the build
  window) pays a cash bonus per second skipped. Enable **Auto-start waves** (off
  by default) to fire each wave automatically when the window elapses.
- Kills earn money; leaks cost lives. Survive all waves to win.
- **Threat scaling:** enemy HP rises with the money tied up in your economy
  towers (`+60%` HP per `$1000` invested by default). The **Threat** meter shows
  the multiplier; it locks in when a wave starts. Selling economy lowers it — but
  costs you the income, so dodging by spend-down is self-defeating.

## Architecture

Logic is decoupled from rendering — the core would run headless.

| File | Responsibility |
|------|----------------|
| `src/grid.ts` | Cell state + **distance field** (BFS from the exit) + placement validation |
| `src/enemy.ts` | Position, hp, follows the distance-field gradient downhill |
| `src/tower.ts` | Range, fire rate, targeting (first-in-range), fires projectiles |
| `src/projectile.ts` | Homes onto its target, applies damage |
| `src/waves.ts` | Timed spawning per wave |
| `src/game.ts` | Orchestrates state, economy, win/lose |
| `src/renderer.ts` | PixiJS drawing (board, enemies, projectiles, range preview) |
| `src/ui.ts` | HTML panel/overlay wiring |
| `src/main.ts` | Boot, game loop, pointer input |
| `src/config.ts` | All tunable constants (grid size, towers, waves) |

### Why a distance field instead of per-enemy A\*

BFS runs once from the exit across the whole grid; every open cell stores its
step-distance to the exit. Enemies just step toward the lowest-distance
neighbour, so they re-route for free when a tower changes the maze — no per-unit
pathfinding, no jitter. The field is recomputed only when a tower is placed.

### Block prevention

Before committing a placement, the candidate cell is tentatively blocked and the
field recomputed. The placement is rejected if it disconnects the spawn **or**
any cell currently occupied by a live enemy.

## Tuning

Everything balance-related lives in `src/config.ts`: grid dimensions, starting
money/lives, the `TOWER_DEFS` list, and the `WAVES` list.
