import { COLS, ROWS, SPAWN, EXIT } from './config.ts';

export enum Cell {
  Empty,
  Tower,
  Spawn,
  Exit,
}

const NEIGHBORS = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

/**
 * Logical grid. Holds cell state and a distance field (BFS from the exit) so
 * enemies can follow the gradient downhill without per-unit pathfinding.
 */
export class Grid {
  readonly cols = COLS;
  readonly rows = ROWS;
  readonly cells: Cell[][];
  /** Step distance from each cell to the exit; Infinity if unreachable. */
  dist: number[][];

  constructor() {
    this.cells = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => Cell.Empty),
    );
    this.cells[SPAWN.y][SPAWN.x] = Cell.Spawn;
    this.cells[EXIT.y][EXIT.x] = Cell.Exit;
    this.dist = this.computeField();
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  isWalkable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.cells[y][x] !== Cell.Tower;
  }

  /** BFS outward from the exit across walkable cells. */
  private computeField(): number[][] {
    const dist: number[][] = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => Infinity),
    );
    const queue: Array<{ x: number; y: number }> = [{ x: EXIT.x, y: EXIT.y }];
    dist[EXIT.y][EXIT.x] = 0;
    let head = 0;
    while (head < queue.length) {
      const { x, y } = queue[head++];
      const d = dist[y][x];
      for (const { dx, dy } of NEIGHBORS) {
        const nx = x + dx;
        const ny = y + dy;
        if (!this.isWalkable(nx, ny)) continue;
        if (dist[ny][nx] !== Infinity) continue;
        dist[ny][nx] = d + 1;
        queue.push({ x: nx, y: ny });
      }
    }
    return dist;
  }

  /**
   * Can a tower be placed here without trapping the spawn or any live enemy?
   * `enemyCells` are the grid cells currently occupied by enemies.
   */
  canPlace(x: number, y: number, enemyCells: Array<{ x: number; y: number }>): boolean {
    if (!this.inBounds(x, y)) return false;
    if (this.cells[y][x] !== Cell.Empty) return false;
    // Can't build on a cell an enemy is standing in.
    if (enemyCells.some((c) => c.x === x && c.y === y)) return false;

    this.cells[y][x] = Cell.Tower;
    const dist = this.computeField();
    this.cells[y][x] = Cell.Empty;

    if (dist[SPAWN.y][SPAWN.x] === Infinity) return false;
    for (const c of enemyCells) {
      if (dist[c.y][c.x] === Infinity) return false;
    }
    return true;
  }

  place(x: number, y: number): void {
    this.cells[y][x] = Cell.Tower;
    this.dist = this.computeField();
  }

  /** Remove a tower, reopening the cell. Always safe (only adds connectivity). */
  remove(x: number, y: number): void {
    if (!this.inBounds(x, y) || this.cells[y][x] !== Cell.Tower) return;
    this.cells[y][x] = Cell.Empty;
    this.dist = this.computeField();
  }

  /** Center pixel of the next cell to step toward from (cx, cy). Null at exit. */
  nextStep(cx: number, cy: number): { x: number; y: number } | null {
    if (cx === EXIT.x && cy === EXIT.y) return null;
    let best: { x: number; y: number } | null = null;
    let bestDist = this.dist[cy][cx];
    for (const { dx, dy } of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!this.isWalkable(nx, ny)) continue;
      if (this.dist[ny][nx] < bestDist) {
        bestDist = this.dist[ny][nx];
        best = { x: nx, y: ny };
      }
    }
    return best;
  }
}
