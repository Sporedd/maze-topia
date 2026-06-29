import { CELL, type Point } from './config.ts';
import type { Grid } from './grid.ts';

export class Enemy {
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly reward: number;
  /** A climactic single-unit boss — rendered larger and distinctly coloured. */
  readonly isBoss: boolean;
  /** Set when the enemy walks into the exit. */
  escaped = false;
  /** Set when hp drops to zero. */
  dead = false;

  constructor(spawn: Point, hp: number, speed: number, reward: number, isBoss = false) {
    this.x = spawn.x * CELL + CELL / 2;
    this.y = spawn.y * CELL + CELL / 2;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.reward = reward;
    this.isBoss = isBoss;
  }

  get cell(): { x: number; y: number } {
    return { x: Math.floor(this.x / CELL), y: Math.floor(this.y / CELL) };
  }

  damage(amount: number): void {
    this.hp -= amount;
    if (this.hp <= 0) this.dead = true;
  }

  /**
   * Where this enemy will be after `time` seconds if it keeps following the
   * path. Used by splash towers to lead their shots; mirrors the step-toward-
   * next-cell movement in `update` so the prediction tracks real motion.
   */
  predictPosition(time: number, grid: Grid): Point {
    let { x, y } = this;
    let cx = Math.floor(x / CELL);
    let cy = Math.floor(y / CELL);
    let remaining = time;

    while (remaining > 0 && !grid.atExit(cx, cy)) {
      const step = grid.nextStep(cx, cy);
      if (!step) break;
      const tx = step.x * CELL + CELL / 2;
      const ty = step.y * CELL + CELL / 2;
      const dx = tx - x;
      const dy = ty - y;
      const len = Math.hypot(dx, dy);
      if (len === 0) break;
      const reach = this.speed * remaining;
      if (reach < len) {
        x += (dx / len) * reach;
        y += (dy / len) * reach;
        remaining = 0;
      } else {
        x = tx;
        y = ty;
        cx = step.x;
        cy = step.y;
        remaining -= len / this.speed;
      }
    }
    return { x, y };
  }

  update(dt: number, grid: Grid): void {
    const cx = Math.floor(this.x / CELL);
    const cy = Math.floor(this.y / CELL);

    if (grid.atExit(cx, cy)) {
      this.escaped = true;
      return;
    }

    const step = grid.nextStep(cx, cy);
    const target = step
      ? { x: step.x * CELL + CELL / 2, y: step.y * CELL + CELL / 2 }
      : { x: cx * CELL + CELL / 2, y: cy * CELL + CELL / 2 };

    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const len = Math.hypot(dx, dy);
    const move = this.speed * dt;
    if (len <= move || len === 0) {
      this.x = target.x;
      this.y = target.y;
    } else {
      this.x += (dx / len) * move;
      this.y += (dy / len) * move;
    }
  }
}
