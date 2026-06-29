# The Hoard

A browser tower-defence game with **true mazing**: you place guardians anywhere
on open ground to sculpt the path raiders must walk. The game prevents you from
fully walling off the exit.

**Theme.** You are the dragon. The map is your lair; the exit is your hoard.
Adventurers raid in from the entrance to reach the gold — each one that gets
through steals a life. You shape the labyrinth with stationed monsters, but an
ancient geas means the way to the hoard can never be fully sealed (that *is* the
true-mazing rule, made diegetic). Flaunted wealth raises the **Bounty** and
draws braver, beefier raiders; gold sunk into a sealed vault is just rumour, so
it never raises the Bounty — which is why vaults are threat-exempt.

> Names are flavour over the same mechanics. In the code (`src/config.ts`) the
> building ids are unchanged: `gun`/`cannon`/`mortar`/`sniper` are the attack
> guardians **Imp / Ogre / Gargoyle / Basilisk**; `farm`/`mill`/`bank`/`amp` are
> **Gold Vein / Taskmaster / Deep Vault / War Drum**.

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
gold/lives, and raid curve. Clear a level to unlock the next; cleared levels are
remembered across reloads (`localStorage`). On a win you can jump straight to the
next level, replay, or return to the menu.

Each clear also earns a **star rating** (★ to ★★★) based on the lives you keep —
3 for a flawless run, 2 for keeping at least half your lives, 1 for surviving.
The best rating per level is saved and shown on its card, giving a reason to
replay cleared levels for a higher score.

## How it plays

- Guardians are split into three panels: **Attack** (selected with `1`–`4`),
  **Economy** (gold-coded, `Shift`+`1`–`Shift`+`3`) and **Boost** (coral-coded,
  `Alt`+`1`). Click a button or press its key; `Esc` deselects.
- **Click** the grid to build one guardian, or **click-and-drag** to mass-build
  along the cursor path.
- **Right-click** a guardian for its context menu: tear it down (70% refund),
  and — for attack guardians — pick a **target priority** (First, Last, Closest,
  Strongest, Weakest). Each attack type ships with a sensible default (e.g. Ogre
  and Basilisk open on *Strongest*); the menu setting overrides it per guardian.
- Guardian types — **attack:** **Imp** (rapid firebolts), **Ogre** (slow, heavy
  lobbed boulders), **Gargoyle** (arcing fire-spit that bursts for splash damage
  on a bunched-up party) and **Basilisk** (fires slowly but petrifies a single
  target very hard from long range). **Economy:** **Gold Vein** pays out a fixed
  sum at the start of each raid; **Taskmaster** drives the Veins in the 8
  surrounding cells harder; **Deep Vault** pays interest on your current gold at
  the start of each raid. **Boost:** **War Drum** rallies attack guardians in
  range for bonus damage (bonuses stack).
- Guardians reshape the raiders' path. Placements that would trap raiders or seal
  the exit are rejected (the hover cell turns red).
- Hit the **🔥 Breath** button (or press `N`) to scorch every raider currently on
  the board — a one-shot panic button refreshed once per level. It recovers no
  loot (a bailout, not a payout) and in-flight spawns still arrive.
  **Champions are immune** — the finale has to be fought down.
- Click **Send Raid** to summon the next wave. Sending early (within the build
  window) pays a gold bonus per second skipped. Enable **Auto-send raids** (off
  by default) to fire each raid automatically when the window elapses.
- Use the **speed** buttons (`1×`–`10×`) to fast-forward the simulation; higher
  speeds run extra fixed substeps per frame rather than scaling the timestep, so
  pathing and projectile homing stay stable.
- Kills earn gold; leaks cost lives. Survive all raids to win.
- **Unlockable guardians:** you start with the **Imp**, **Ogre**, **Gold Vein**
  and **Deep Vault**. Clearing lairs permanently unlocks the rest —
  **Taskmaster** (The Antechamber), **War Drum** (Stalagmite Hall), **Gargoyle**
  (The Dragon's Throat) and **Basilisk** (The Inner Sanctum). Unlocks are global:
  once earned, a guardian is buildable on every lair (locked ones show a 🔒 and
  the lair that unlocks them). This is the carrot for finishing — the full
  toolkit makes earlier lairs a different puzzle on replay.
- **Champion finale:** every lair's last raid is a single **champion** — a huge,
  slow, distinctly-coloured hero answering the Bounty. Its HP scales with your
  locked-in **Threat**, so a greedy economy makes the climax tougher (its spawn
  *count* never scales — a champion is always one unit).
- Clearing a raid pays a **gold bonus** that scales with the raid number.
- **Threat scaling (the Bounty):** raider HP **and spawn count** rise with the
  number of threat-driving economy buildings you have standing — **Gold Veins**
  and **Taskmasters** (`+20%` each by default). **Deep Vaults are exempt** and
  never raise the Bounty (sheltered gold draws no raiders). The **Threat** meter
  shows the multiplier; it locks in when a raid starts. Tearing down economy
  lowers it — but costs you the income, so dodging by demolition is
  self-defeating.

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
