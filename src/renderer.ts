import { Application, Container, Graphics } from 'pixi.js';
import { CELL, COLORS } from './config.ts';
import { Cell, type Grid } from './grid.ts';
import type { Enemy } from './enemy.ts';
import type { Tower } from './tower.ts';
import type { Projectile } from './projectile.ts';
import type { TowerDef } from './config.ts';

export class Renderer {
  readonly app = new Application();
  private readonly board = new Graphics(); // grid + towers, redrawn on change
  private readonly dynamic = new Graphics(); // enemies + projectiles, every frame
  private readonly preview = new Graphics(); // hover range + placement validity

  async init(mount: HTMLElement): Promise<void> {
    await this.app.init({
      width: CELL,
      height: CELL,
      background: COLORS.bgEven,
      antialias: true,
    });
    mount.appendChild(this.app.canvas);
    const root = new Container();
    root.addChild(this.board, this.dynamic, this.preview);
    this.app.stage.addChild(root);
  }

  /** Match the canvas to a level's grid dimensions. */
  resize(cols: number, rows: number): void {
    this.app.renderer.resize(cols * CELL, rows * CELL);
  }

  /** Redraw static board: checkerboard, spawn, exit, walls, towers. */
  drawBoard(grid: Grid, towers: Tower[]): void {
    const g = this.board;
    g.clear();
    for (let y = 0; y < grid.rows; y++) {
      for (let x = 0; x < grid.cols; x++) {
        const color = (x + y) % 2 === 0 ? COLORS.bgEven : COLORS.bgOdd;
        g.rect(x * CELL, y * CELL, CELL, CELL).fill(color);
        const cell = grid.cells[y][x];
        if (cell === Cell.Spawn) {
          g.rect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4).fill(COLORS.spawn);
        } else if (cell === Cell.Exit) {
          g.rect(x * CELL + 2, y * CELL + 2, CELL - 4, CELL - 4).fill(COLORS.exit);
        } else if (cell === Cell.Wall) {
          g.rect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2).fill(COLORS.wall);
        }
      }
    }
    for (const t of towers) {
      g.rect(t.cx * CELL + 4, t.cy * CELL + 4, CELL - 8, CELL - 8)
        .fill(t.def.color)
        .stroke({ width: 2, color: 0x0d1117 });
    }
  }

  drawDynamic(enemies: Enemy[], projectiles: Projectile[]): void {
    const g = this.dynamic;
    g.clear();
    const r = CELL * 0.3;
    for (const e of enemies) {
      g.circle(e.x, e.y, r).fill(COLORS.enemy);
      // HP bar
      const w = CELL * 0.6;
      const frac = Math.max(0, e.hp / e.maxHp);
      const bx = e.x - w / 2;
      const by = e.y - r - 6;
      g.rect(bx, by, w, 3).fill(COLORS.enemyHpBg);
      g.rect(bx, by, w * frac, 3).fill(COLORS.enemyHp);
    }
    for (const p of projectiles) {
      if (p.shape === 'rect') {
        const s = 4;
        g.rect(p.x - s / 2, p.y - s / 2, s, s).fill(COLORS.projectile);
      } else {
        // Splash shells are drawn fatter so the heavier round reads at a glance.
        g.circle(p.x, p.y, p.splashRadius > 0 ? 5 : 3).fill(COLORS.projectile);
      }
    }
  }

  /** Draw hover cell + range circle; color reflects whether placement is legal. */
  drawPreview(cell: { x: number; y: number } | null, def: TowerDef | null, ok: boolean): void {
    const g = this.preview;
    g.clear();
    if (!cell || !def) return;
    const color = ok ? COLORS.rangeOk : COLORS.rangeBad;
    const cx = cell.x * CELL + CELL / 2;
    const cy = cell.y * CELL + CELL / 2;
    g.circle(cx, cy, def.range).fill({ color, alpha: 0.1 });
    g.circle(cx, cy, def.range).stroke({ width: 1, color, alpha: 0.5 });
    g.rect(cell.x * CELL + 2, cell.y * CELL + 2, CELL - 4, CELL - 4)
      .fill({ color, alpha: 0.25 })
      .stroke({ width: 2, color });
  }

  /** Red outline over a tower the cursor can sell (right-click). */
  drawSellPreview(cell: { x: number; y: number }): void {
    const g = this.preview;
    g.clear();
    g.rect(cell.x * CELL + 2, cell.y * CELL + 2, CELL - 4, CELL - 4)
      .fill({ color: COLORS.rangeBad, alpha: 0.25 })
      .stroke({ width: 2, color: COLORS.rangeBad });
  }

  clearPreview(): void {
    this.preview.clear();
  }
}
