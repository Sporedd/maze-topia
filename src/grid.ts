import type { LevelDef, Point } from './config.ts';

export enum Cell {
  Empty,
  Tower,
  Spawn,
  Exit,
  Wall,
}

const ORTHO = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
];

const DIAG = [
  { dx: 1, dy: 1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: -1, dy: -1 },
];

const DIAG_COST = Math.SQRT2;

interface Move {
  x: number;
  y: number;
  cost: number;
}

/** Binary min-heap keyed by a number, used as the Dijkstra frontier. */
class MinHeap<T> {
  private items: { key: number; value: T }[] = [];

  push(key: number, value: T): void {
    const items = this.items;
    items.push({ key, value });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].key <= items[i].key) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const items = this.items;
    const top = items[0];
    if (top === undefined) return undefined;
    const last = items.pop() as { key: number; value: T };
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < items.length && items[l].key < items[smallest].key) smallest = l;
        if (r < items.length && items[r].key < items[smallest].key) smallest = r;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top.value;
  }
}

/**
 * Logical grid for one level. Holds cell state and a distance field (BFS from
 * the exit) so enemies can follow the gradient downhill without per-unit
 * pathfinding. Dimensions, spawn/exit and pre-blocked walls come from the level.
 */
export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly spawn: Point;
  readonly exit: Point;
  readonly cells: Cell[][];
  /** Step distance from each cell to the exit; Infinity if unreachable. */
  dist: number[][];

  constructor(level: LevelDef) {
    this.cols = level.cols;
    this.rows = level.rows;
    this.spawn = level.spawn;
    this.exit = level.exit;
    this.cells = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => Cell.Empty),
    );
    level.walls.forEach(({ x, y }) => {
      if (this.inBounds(x, y)) this.cells[y][x] = Cell.Wall;
    });
    this.cells[this.spawn.y][this.spawn.x] = Cell.Spawn;
    this.cells[this.exit.y][this.exit.x] = Cell.Exit;
    this.dist = this.computeField();
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  isWalkable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    const cell = this.cells[y][x];
    return cell !== Cell.Tower && cell !== Cell.Wall;
  }

  atExit(x: number, y: number): boolean {
    return x === this.exit.x && y === this.exit.y;
  }

  /**
   * Walkable moves out of (x, y): orthogonal steps cost 1, diagonal steps cost
   * √2. A diagonal is only allowed when both shared orthogonal cells are also
   * walkable, so enemies never cut the corner of a tower or wall.
   */
  private moves(x: number, y: number): Move[] {
    const ortho = ORTHO.map(({ dx, dy }) => ({
      x: x + dx,
      y: y + dy,
      cost: 1,
    })).filter(({ x, y }) => this.isWalkable(x, y));

    const diag = DIAG.filter(
      ({ dx, dy }) =>
        this.isWalkable(x + dx, y + dy) &&
        this.isWalkable(x + dx, y) &&
        this.isWalkable(x, y + dy),
    ).map(({ dx, dy }) => ({ x: x + dx, y: y + dy, cost: DIAG_COST }));

    return [...ortho, ...diag];
  }

  /** Dijkstra outward from the exit across walkable cells (diagonals allowed). */
  private computeField(): number[][] {
    const dist: number[][] = Array.from({ length: this.rows }, () =>
      Array.from({ length: this.cols }, () => Infinity),
    );
    const heap = new MinHeap<Point>();
    dist[this.exit.y][this.exit.x] = 0;
    heap.push(0, { x: this.exit.x, y: this.exit.y });

    for (let node = heap.pop(); node !== undefined; node = heap.pop()) {
      const { x, y } = node;
      const d = dist[y][x];
      for (const { x: nx, y: ny, cost } of this.moves(x, y)) {
        const nd = d + cost;
        if (nd < dist[ny][nx]) {
          dist[ny][nx] = nd;
          heap.push(nd, { x: nx, y: ny });
        }
      }
    }
    return dist;
  }

  /**
   * Can a tower be placed here without trapping the spawn or any live enemy?
   * `enemyCells` are the grid cells currently occupied by enemies.
   */
  canPlace(x: number, y: number, enemyCells: Point[]): boolean {
    if (!this.inBounds(x, y)) return false;
    if (this.cells[y][x] !== Cell.Empty) return false;
    // Can't build on a cell an enemy is standing in.
    if (enemyCells.some((c) => c.x === x && c.y === y)) return false;

    this.cells[y][x] = Cell.Tower;
    const dist = this.computeField();
    this.cells[y][x] = Cell.Empty;

    if (dist[this.spawn.y][this.spawn.x] === Infinity) return false;
    return enemyCells.every((c) => dist[c.y][c.x] !== Infinity);
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
  nextStep(cx: number, cy: number): Point | null {
    if (this.atExit(cx, cy)) return null;
    return this.moves(cx, cy)
      .filter(({ x, y }) => Number.isFinite(this.dist[y][x]))
      .reduce<{ step: Point; total: number } | null>((best, { x, y, cost }) => {
        const total = cost + this.dist[y][x];
        if (best !== null && total >= best.total) return best;
        return { step: { x, y }, total };
      }, null)?.step ?? null;
  }
}
