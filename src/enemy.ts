import { CELL, SPAWN, EXIT } from './config.ts';
import type { Grid } from './grid.ts';

export class Enemy {
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  readonly speed: number;
  readonly reward: number;
  /** Set when the enemy walks into the exit. */
  escaped = false;
  /** Set when hp drops to zero. */
  dead = false;

  constructor(hp: number, speed: number, reward: number) {
    this.x = SPAWN.x * CELL + CELL / 2;
    this.y = SPAWN.y * CELL + CELL / 2;
    this.hp = hp;
    this.maxHp = hp;
    this.speed = speed;
    this.reward = reward;
  }

  get cell(): { x: number; y: number } {
    return { x: Math.floor(this.x / CELL), y: Math.floor(this.y / CELL) };
  }

  damage(amount: number): void {
    this.hp -= amount;
    if (this.hp <= 0) this.dead = true;
  }

  update(dt: number, grid: Grid): void {
    const cx = Math.floor(this.x / CELL);
    const cy = Math.floor(this.y / CELL);

    if (cx === EXIT.x && cy === EXIT.y) {
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
