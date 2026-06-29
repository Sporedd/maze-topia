# Maze Topia

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

## Levels

The game opens on a **level-select** screen. Each level is its own map — grid
size, spawn/exit positions, pre-blocked **walls** to maze around, starting
money/lives, and wave curve. Clear a level to unlock the next; cleared levels are
remembered across reloads (`localStorage`). On a win you can jump straight to the
next level, replay, or return to the menu.

Each clear also earns a **star rating** (★ to ★★★) based on the lives you keep —
3 for a flawless run, 2 for keeping at least half your lives, 1 for surviving.
The best rating per level is saved and shown on its card, giving a reason to
replay cleared levels for a higher score.

## How it plays

- Towers are split into three panels: **Attack** (selected with `1`–`4`),
  **Economy** (gold-coded, `Shift`+`1`–`Shift`+`3`) and **Boost** (coral-coded,
  `Alt`+`1`). Click a tower button or press its key; `Esc` deselects.
- **Click** the grid to build one tower, or **click-and-drag** to mass-build along
  the cursor path.
- **Right-click** a tower for its context menu: sell it (70% refund), and — for
  attack towers — pick a **target priority** (First, Last, Closest, Strongest,
  Weakest). Each attack tower type ships with a sensible default (e.g. Cannon and
  Sniper open on *Strongest*); the menu setting overrides it per tower.
- Tower types: **Gun**, **Cannon**, **Sniper** and **Mortar** attack (the Sniper
  fires slowly but hits a single target very hard from long range; the Mortar
  deals splash damage to every enemy near its impact); **Farm** pays out a fixed sum at the
  start of each wave; **Mill** boosts the income of farms in the 8 surrounding
  cells; **Bank** pays interest on your current money at the start of each wave;
  **Amplifier** boosts the damage of attack towers in range (bonuses stack).
- Towers reshape the enemy path. Placements that would trap enemies or seal the
  exit are rejected (the hover cell turns red).
- Hit the **☢ Nuke** button (or press `N`) to wipe every enemy currently on the
  board — a one-shot panic button refreshed once per level. It pays no kill
  reward (a bailout, not a payout) and in-flight wave spawns still arrive.
  **Bosses are immune** — the finale has to be fought down.
- Click **Start Wave** to send the next wave. Starting early (within the build
  window) pays a cash bonus per second skipped. Enable **Auto-start waves** (off
  by default) to fire each wave automatically when the window elapses.
- Use the **speed** buttons (`1×`–`10×`) to fast-forward the simulation; higher
  speeds run extra fixed substeps per frame rather than scaling the timestep, so
  pathing and projectile homing stay stable.
- Kills earn money; leaks cost lives. Survive all waves to win.
- **Unlockable towers:** you start with **Gun**, **Cannon**, **Farm** and
  **Bank**. Clearing levels permanently unlocks the rest — **Mill** (Open Field),
  **Amplifier** (The Pillars), **Mortar** (The Funnel) and **Sniper** (The Core).
  Unlocks are global: once earned, a tower is buildable on every level (locked
  towers show a 🔒 and the level that unlocks them). This is the carrot for
  finishing — the full toolkit makes earlier levels a different puzzle on replay.
- **Boss finale:** every level's last wave is a single **boss** — a huge, slow,
  distinctly-coloured unit. Its HP scales with your locked-in **Threat**, so a
  greedy economy makes the climax tougher (its spawn *count* never scales — a
  boss is always one unit).
- Clearing a wave pays a **gold bonus** that scales with the wave number.
- **Threat scaling:** enemy HP **and spawn count** rise with the number of
  threat-driving economy buildings you have standing — **Farms** and **Mills**
  (`+20%` each by default). **Banks are exempt** and never raise threat. The
  **Threat** meter shows the multiplier; it locks in when a wave starts.
  Selling economy lowers it — but costs you the income, so dodging by
  tearing-down is self-defeating.

## Architecture

Logic is decoupled from rendering — the core would run headless.

| File | Responsibility |
|------|----------------|
| `src/grid.ts` | Cell state (incl. pre-blocked walls) + **distance field** (BFS from the exit) + placement validation |
| `src/enemy.ts` | Position, hp, follows the distance-field gradient downhill |
| `src/tower.ts` | Range, fire rate, targeting (selectable priority), fires projectiles |
| `src/projectile.ts` | Homes onto its target, applies damage |
| `src/waves.ts` | Timed spawning per wave |
| `src/game.ts` | Orchestrates state, economy, win/lose (built from a `LevelDef`) |
| `src/progress.ts` | Cleared-level tracking, per-level star scores + tower-unlock rules, persisted to `localStorage` |
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

Everything balance-related lives in `src/config.ts`: the shared `TOWER_DEFS`
list and the `LEVELS` array. Each `LevelDef` carries its own grid dimensions,
spawn/exit, `walls`, starting money/lives, and per-level `waves`. Add a level by
appending to `LEVELS` (its index is its unlock order).

- Gate a tower behind progress with `TowerDef.unlockLevel` (the level id whose
  clear unlocks it; omit for a starter tower).
- Mark a wave as a boss with `WaveDef.boss: true` — its HP scales with Threat but
  its count does not. Levels typically end with a 1-count boss wave.
- Star thresholds are computed by `starsForResult` from the fraction of starting
  lives kept (`STAR_TWO_LIVES_FRACTION`).
