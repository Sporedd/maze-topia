import { LEVELS, type LevelDef, type Point } from './config.ts';
import { Renderer } from './renderer.ts';
import { Game } from './game.ts';
import { Progress } from './progress.ts';
import { UI } from './ui.ts';

async function boot(): Promise<void> {
  const renderer = new Renderer();
  await renderer.init(document.getElementById('game')!);

  const progress = new Progress();
  // Single mutable holder so screens can swap the game without rebinding listeners.
  const state: { game: Game | null } = { game: null };
  let hover: Point | null = null;
  // Whether the current game's win has already been recorded (so we mark once).
  let clearRecorded = false;

  const loadLevel = (level: LevelDef): void => {
    state.game = new Game(level);
    clearRecorded = false;
    hover = null;
    renderer.resize(level.cols, level.rows);
    ui.hideMenu();
  };

  const nextLevel = (): void => {
    const game = state.game;
    if (!game) return;
    const index = LEVELS.findIndex((l) => l.id === game.level.id);
    const next = LEVELS[index + 1];
    if (next) loadLevel(next);
  };

  const showMenu = (): void => {
    state.game = null;
    hover = null;
    ui.showMenu();
  };

  const ui = new UI(
    () => state.game,
    {
      selectLevel: loadLevel,
      restart: () => state.game && loadLevel(state.game.level),
      nextLevel,
      menu: showMenu,
    },
    progress,
  );

  const canvas = renderer.app.canvas;
  const cellAt = (ev: PointerEvent | MouseEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    return state.game!.cellFromPixel(ev.clientX - rect.left, ev.clientY - rect.top);
  };

  // Drag-to-build state.
  let painting = false;
  let lastPainted: Point | null = null;

  const paintCell = (cell: Point): void => {
    state.game?.tryPlace(cell.x, cell.y);
  };

  canvas.addEventListener('pointermove', (ev) => {
    if (!state.game) return;
    const cell = cellAt(ev);
    hover = cell;
    if (!painting) return;
    if (lastPainted) {
      // Fill every cell along the drag so fast moves don't skip tiles.
      for (const c of cellLine(lastPainted, cell)) paintCell(c);
    } else {
      paintCell(cell);
    }
    lastPainted = cell;
  });
  canvas.addEventListener('pointerleave', () => {
    hover = null;
    // Keep painting if the button is still held, but drop the anchor so
    // re-entering doesn't draw a line across the whole board.
    lastPainted = null;
  });
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || !state.game) return;
    painting = true;
    const cell = cellAt(ev);
    paintCell(cell);
    lastPainted = cell;
  });
  window.addEventListener('pointerup', () => {
    painting = false;
    lastPainted = null;
  });
  // Right-click opens a context menu with a Sell option over the tower.
  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (!state.game) return;
    ui.openContextMenu(ev.clientX, ev.clientY, cellAt(ev));
  });

  renderer.app.ticker.add((ticker) => {
    const game = state.game;
    if (!game) return; // On the level-select screen — nothing to simulate.

    const dt = Math.min(ticker.deltaMS / 1000, 0.05); // clamp big frame gaps
    // Speed-up runs extra fixed substeps rather than scaling dt, so pathing and
    // projectile homing stay stable at high multipliers.
    for (let step = 0; step < game.speed && game.status === 'playing'; step++) {
      game.update(dt);
    }

    if (game.status === 'won' && !clearRecorded) {
      progress.markCleared(game.level.id);
      clearRecorded = true;
    }

    if (game.boardDirty) {
      renderer.drawBoard(game.grid, game.towers);
      game.boardDirty = false;
    }
    renderer.drawDynamic(game.enemies, game.projectiles);

    if (hover && game.selected) {
      renderer.drawPreview(hover, game.selected, game.canPlaceSelected(hover.x, hover.y));
    } else if (hover && game.sellValueAt(hover.x, hover.y) !== null) {
      renderer.drawSellPreview(hover);
    } else {
      renderer.clearPreview();
    }

    ui.render(game);
  });

  showMenu();
}

/** Integer grid cells from `a` to `b` inclusive (Bresenham line). */
function cellLine(a: Point, b: Point): Point[] {
  const cells: Point[] = [];
  let x = a.x;
  let y = a.y;
  const dx = Math.abs(b.x - x);
  const dy = Math.abs(b.y - y);
  const sx = x < b.x ? 1 : -1;
  const sy = y < b.y ? 1 : -1;
  let err = dx - dy;
  // Skip the start cell — it was painted on the previous event.
  while (x !== b.x || y !== b.y) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    cells.push({ x, y });
  }
  return cells;
}

boot();
