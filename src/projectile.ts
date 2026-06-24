import type { Enemy } from './enemy.ts';

export class Projectile {
  x: number;
  y: number;
  readonly target: Enemy;
  readonly damage: number;
  readonly speed: number;
  dead = false;

  constructor(x: number, y: number, target: Enemy, damage: number, speed: number) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
  }

  update(dt: number): void {
    // Target gone before impact: fizzle.
    if (this.target.dead || this.target.escaped) {
      this.dead = true;
      return;
    }
    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const len = Math.hypot(dx, dy);
    const move = this.speed * dt;
    if (len <= move) {
      this.target.damage(this.damage);
      this.dead = true;
      return;
    }
    this.x += (dx / len) * move;
    this.y += (dy / len) * move;
  }
}
