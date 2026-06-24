import { WAVES } from './config.ts';
import { Enemy } from './enemy.ts';

/** Drives spawning for one wave at a time. */
export class WaveManager {
  /** Index of the wave currently spawning/active, -1 before the first. */
  current = -1;
  private toSpawn = 0;
  private timer = 0;
  private active = false;

  get totalWaves(): number {
    return WAVES.length;
  }

  /** Human-facing wave number (1-based, clamped). */
  get displayWave(): number {
    return Math.min(this.current + 1, WAVES.length);
  }

  get isActive(): boolean {
    return this.active;
  }

  get hasMoreWaves(): boolean {
    return this.current < WAVES.length - 1;
  }

  /** Begin the next wave. Returns false if a wave is running or none remain. */
  startNext(): boolean {
    if (this.active || !this.hasMoreWaves) return false;
    this.current += 1;
    this.toSpawn = WAVES[this.current].count;
    this.timer = 0;
    this.active = true;
    return true;
  }

  /** Returns enemies to spawn this frame (usually 0 or 1). */
  update(dt: number, hpMultiplier: number): Enemy[] {
    if (!this.active) return [];
    const spawned: Enemy[] = [];
    const wave = WAVES[this.current];
    this.timer -= dt;
    while (this.toSpawn > 0 && this.timer <= 0) {
      spawned.push(new Enemy(Math.round(wave.hp * hpMultiplier), wave.speed, wave.reward));
      this.toSpawn -= 1;
      this.timer += wave.interval;
    }
    if (this.toSpawn <= 0) this.active = false;
    return spawned;
  }
}
