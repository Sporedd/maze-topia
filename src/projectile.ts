import { SPLASH_DAMAGE_FRACTION } from './config.ts';
import type { Enemy } from './enemy.ts';

export type ProjectileShape = 'circle' | 'rect';

export class Projectile {
  x: number;
  y: number;
  readonly target: Enemy;
  readonly damage: number;
  readonly speed: number;
  readonly shape: ProjectileShape;
  /** Damage radius around the impact; 0 means single-target. */
  readonly splashRadius: number;
  dead = false;

  constructor(
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    speed: number,
    shape: ProjectileShape = 'circle',
    splashRadius = 0,
  ) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.shape = shape;
    this.splashRadius = splashRadius;
  }

  update(dt: number, enemies: Enemy[]): void {
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
      this.explode(enemies);
      this.dead = true;
      return;
    }
    this.x += (dx / len) * move;
    this.y += (dy / len) * move;
  }

  /**
   * Deal damage on impact: the target takes the full hit; everything else in
   * the splash radius takes a reduced share.
   */
  private explode(enemies: Enemy[]): void {
    this.target.damage(this.damage);
    if (this.splashRadius <= 0) return;
    const radiusSq = this.splashRadius * this.splashRadius;
    const splashDamage = this.damage * SPLASH_DAMAGE_FRACTION;
    enemies
      .filter((e) => e !== this.target && !e.dead && !e.escaped)
      .filter((e) => {
        const dx = e.x - this.target.x;
        const dy = e.y - this.target.y;
        return dx * dx + dy * dy <= radiusSq;
      })
      .forEach((e) => e.damage(splashDamage));
  }
}
