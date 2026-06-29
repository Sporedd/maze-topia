import type { Point, WaveDef } from './config.ts';
import { Enemy } from './enemy.ts';

/** Drives spawning for one wave at a time, for a single level's wave list. */
export class WaveManager {
  /** Index of the wave currently spawning/active, -1 before the first. */
  current = -1;
  private toSpawn = 0;
  private timer = 0;
  private active = false;
  /** Threat multiplier locked in for the active wave (HP + count scaling). */
  private threat = 1;

  constructor(
    private readonly waves: WaveDef[],
    private readonly spawn: Point,
  ) {}

  get totalWaves(): number {
    return this.waves.length;
  }

  /** Human-facing wave number (1-based, clamped). */
  get displayWave(): number {
    return Math.min(this.current + 1, this.waves.length);
  }

  get isActive(): boolean {
    return this.active;
  }

  get hasMoreWaves(): boolean {
    return this.current < this.waves.length - 1;
  }

  /** Whether the wave currently running is a boss wave. */
  get currentIsBoss(): boolean {
    return this.active && Boolean(this.waves[this.current]?.boss);
  }

  /** Whether the next wave to start (while idle) is a boss wave. */
  get nextIsBoss(): boolean {
    return !this.active && this.hasMoreWaves && Boolean(this.waves[this.current + 1]?.boss);
  }

  /**
   * Begin the next wave at the given threat multiplier (scales both enemy HP
   * and spawn count). Returns false if a wave is running or none remain.
   */
  startNext(threat: number): boolean {
    if (this.active || !this.hasMoreWaves) return false;
    this.current += 1;
    this.threat = threat;
    // A boss is a single unit: threat scales its HP (below) but never its count.
    const wave = this.waves[this.current];
    this.toSpawn = wave.boss ? wave.count : Math.round(wave.count * threat);
    this.timer = 0;
    this.active = true;
    return true;
  }

  /** Returns enemies to spawn this frame (usually 0 or 1). */
  update(dt: number): Enemy[] {
    if (!this.active) return [];
    const spawned: Enemy[] = [];
    const wave = this.waves[this.current];
    this.timer -= dt;
    while (this.toSpawn > 0 && this.timer <= 0) {
      spawned.push(
        new Enemy(
          this.spawn,
          Math.round(wave.hp * this.threat),
          wave.speed,
          wave.reward,
          wave.boss,
        ),
      );
      this.toSpawn -= 1;
      this.timer += wave.interval;
    }
    if (this.toSpawn <= 0) this.active = false;
    return spawned;
  }
}
