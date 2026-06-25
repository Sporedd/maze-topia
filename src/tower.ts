import { CELL, type TowerDef } from './config.ts';
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
    return new Projectile(
      this.x,
      this.y,
      target,
      damage,
      this.def.projectileSpeed,
      shape,
      this.def.splashRadius,
    );
  }

  /** First-in-range = the in-range enemy closest to the exit (lowest field dist). */
  private pickTarget(enemies: Enemy[], grid: Grid): Enemy | null {
    let best: Enemy | null = null;
    let bestProgress = Infinity;
    const rangeSq = this.def.range * this.def.range;
    for (const e of enemies) {
      if (e.dead || e.escaped) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      if (dx * dx + dy * dy > rangeSq) continue;
      const c = e.cell;
      const progress = grid.dist[c.y]?.[c.x] ?? Infinity;
      if (progress < bestProgress) {
        bestProgress = progress;
        best = e;
      }
    }
    return best;
  }
}
