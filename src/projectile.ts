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
  /** Fixed ground point a splash shell flies to; null for homing shots. */
  private readonly impactX: number | null;
  private readonly impactY: number | null;
  dead = false;

  constructor(
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    speed: number,
    shape: ProjectileShape = 'circle',
    splashRadius = 0,
    impact: { x: number; y: number } | null = null,
  ) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.shape = shape;
    this.splashRadius = splashRadius;
    this.impactX = impact?.x ?? null;
    this.impactY = impact?.y ?? null;
  }

  update(dt: number, enemies: Enemy[]): void {
    // Splash shells commit to a fixed ground point (their lead aim) and land
    // there even if the target dies mid-flight; single-target shots home and
    // fizzle when their target is gone.
    if (this.impactX === null || this.impactY === null) {
      if (this.target.dead || this.target.escaped) {
        this.dead = true;
        return;
      }
    }
    const aimX = this.impactX ?? this.target.x;
    const aimY = this.impactY ?? this.target.y;
    const dx = aimX - this.x;
    const dy = aimY - this.y;
    const len = Math.hypot(dx, dy);
    const move = this.speed * dt;
    if (len <= move) {
      this.explode(enemies, aimX, aimY);
      this.dead = true;
      return;
    }
    this.x += (dx / len) * move;
    this.y += (dy / len) * move;
  }

  /**
   * Deal damage on impact. Single-target shots hit only their target. Splash
   * shells detonate at the impact point: the intended target (if it's still in
   * range) takes the full hit and everything else nearby takes a reduced share.
   */
  private explode(enemies: Enemy[], impactX: number, impactY: number): void {
    if (this.splashRadius <= 0) {
      this.target.damage(this.damage);
      return;
    }
    const radiusSq = this.splashRadius * this.splashRadius;
    const splashDamage = this.damage * SPLASH_DAMAGE_FRACTION;
    enemies
      .filter((e) => !e.dead && !e.escaped)
      .filter((e) => {
        const dx = e.x - impactX;
        const dy = e.y - impactY;
        return dx * dx + dy * dy <= radiusSq;
      })
      .forEach((e) => e.damage(e === this.target ? this.damage : splashDamage));
  }
}
