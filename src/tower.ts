import { CELL, type TargetingMode, type TowerDef } from './config.ts';
import type { Enemy } from './enemy.ts';
import type { Grid } from './grid.ts';
import { Projectile } from './projectile.ts';

export class Tower {
  readonly cx: number;
  readonly cy: number;
  readonly x: number;
  readonly y: number;
  readonly def: TowerDef;
  /** Fractional damage bonus from amplifiers in range; recomputed on board change. */
  damageBoost = 0;
  /** Per-tower target priority; null falls back to the def's default. */
  targeting: TargetingMode | null = null;
  private cooldown = 0;

  constructor(cx: number, cy: number, def: TowerDef) {
    this.cx = cx;
    this.cy = cy;
    this.x = cx * CELL + CELL / 2;
    this.y = cy * CELL + CELL / 2;
    this.def = def;
  }

  /** Money a farm pays at the start of a wave (0 for other towers). */
  collectIncome(multiplier: number): number {
    if (this.def.incomePerWave <= 0) return 0;
    return Math.floor(this.def.incomePerWave * multiplier);
  }

  /** Bank payout for a wave start given current money (0 for other towers). */
  collectInterest(currentMoney: number): number {
    if (this.def.interest <= 0) return 0;
    return Math.floor(currentMoney * this.def.interest);
  }

  /** Returns a projectile when it fires this frame, otherwise null. */
  update(dt: number, enemies: Enemy[], grid: Grid): Projectile | null {
    if (this.def.kind !== 'attack') return null;
    this.cooldown -= dt;
    if (this.cooldown > 0) return null;

    const target = this.pickTarget(enemies, grid);
    if (!target) return null;

    this.cooldown = 1 / this.def.fireRate;
    const damage = this.def.damage * (1 + this.damageBoost);
    const shape = this.def.id === 'cannon' ? 'rect' : 'circle';
    // Splash shells are slow and arc onto a fixed spot, so aim where the target
    // will be at impact instead of homing onto it.
    const impact =
      this.def.splashRadius > 0 ? this.leadImpact(target, grid) : null;
    return new Projectile(
      this.x,
      this.y,
      target,
      damage,
      this.def.projectileSpeed,
      shape,
      this.def.splashRadius,
      impact,
    );
  }

  /**
   * Predicted impact point for a slow shell: estimate the flight time, ask the
   * target where it'll be by then, and refine a couple of times so the time and
   * the lead distance agree.
   */
  private leadImpact(target: Enemy, grid: Grid): { x: number; y: number } {
    let aim = { x: target.x, y: target.y };
    for (let i = 0; i < 3; i++) {
      const flight = Math.hypot(aim.x - this.x, aim.y - this.y) / this.def.projectileSpeed;
      aim = target.predictPosition(flight, grid);
    }
    return aim;
  }

  /** Active target priority: the per-tower override, else the def default, else first. */
  get effectiveTargeting(): TargetingMode {
    return this.targeting ?? this.def.defaultTargeting ?? 'first';
  }

  /** Pick the in-range enemy that best matches this tower's targeting mode. */
  private pickTarget(enemies: Enemy[], grid: Grid): Enemy | null {
    const rangeSq = this.def.range * this.def.range;
    const inRange = enemies.filter((e) => {
      if (e.dead || e.escaped) return false;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      return dx * dx + dy * dy <= rangeSq;
    });
    if (inRange.length === 0) return null;

    // Field distance to the exit: low = closest to exit (first), high = just entered (last).
    const progress = (e: Enemy): number => grid.dist[e.cell.y]?.[e.cell.x] ?? Infinity;
    const mode = this.effectiveTargeting;
    // Every mode is expressed as "lower score wins"; progress breaks ties so the
    // chosen target stays stable frame-to-frame instead of flickering.
    const score = (e: Enemy): number => this.targetScore(e, mode, progress);
    return inRange.reduce((best, e) => {
      const delta = score(e) - score(best);
      if (delta < 0) return e;
      if (delta === 0 && progress(e) < progress(best)) return e;
      return best;
    });
  }

  /** Lower-is-better ranking value for `e` under the given targeting mode. */
  private targetScore(e: Enemy, mode: TargetingMode, progress: (e: Enemy) => number): number {
    switch (mode) {
      case 'first':
        return progress(e);
      case 'last':
        return -progress(e);
      case 'closest': {
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        return dx * dx + dy * dy;
      }
      case 'strongest':
        return -e.hp;
      case 'weakest':
        return e.hp;
    }
  }
}
