import { Renderer } from './renderer.ts';
import { Game } from './game.ts';
import { UI } from './ui.ts';

async function boot(): Promise<void> {
  const renderer = new Renderer();
  await renderer.init(document.getElementById('game')!);

  // Single mutable holder so restart can swap the game without rebinding listeners.
  const state = { game: new Game() };
  let hover: { x: number; y: number } | null = null;

  const ui = new UI(
    () => state.game,
    () => {
      state.game = new Game();
    },
  );

  const canvas = renderer.app.canvas;
  const cellAt = (ev: PointerEvent | MouseEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    return state.game.cellFromPixel(ev.clientX - rect.left, ev.clientY - rect.top);
  };

  // Drag-to-build state.
  let painting = false;
  let lastPainted: { x: number; y: number } | null = null;

  const paintCell = (cell: { x: number; y: number }): void => {
    state.game.tryPlace(cell.x, cell.y);
  };

  canvas.addEventListener('pointermove', (ev) => {
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
    if (ev.button !== 0) return;
    painting = true;
    const cell = cellAt(ev);
    paintCell(cell);
    lastPainted = cell;
  });
  window.addEventListener('pointerup', () => {
    painting = false;
    lastPainted = null;
  });
  // Right-click sells the tower under the cursor.
  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const cell = cellAt(ev);
    state.game.sellAt(cell.x, cell.y);
  });

  renderer.app.ticker.add((ticker) => {
    const game = state.game;
    const dt = Math.min(ticker.deltaMS / 1000, 0.05); // clamp big frame gaps
    game.update(dt);

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
}

/** Integer grid cells from `a` to `b` inclusive (Bresenham line). */
function cellLine(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = [];
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
