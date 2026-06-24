import {
  CELL,
  START_MONEY,
  START_LIVES,
  AUTO_START_DELAY,
  SELL_REFUND,
  EARLY_BONUS_PER_SECOND,
  ECONOMY_THREAT_PER_1000,
  TOWER_DEFS,
  type TowerDef,
} from './config.ts';
import { Grid } from './grid.ts';
import { Enemy } from './enemy.ts';
import { Tower } from './tower.ts';
import { Projectile } from './projectile.ts';
import { WaveManager } from './waves.ts';

export type GameStatus = 'playing' | 'won' | 'lost';

export class Game {
  readonly grid = new Grid();
  readonly waves = new WaveManager();
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];

  money = START_MONEY;
  lives = START_LIVES;
  status: GameStatus = 'playing';
  selected: TowerDef | null = null;
  /** Bumped whenever the static board changes, so the renderer can redraw. */
  boardDirty = true;
  /** Seconds left in the build window (counts while idle; drives early bonus). */
  private nextWaveTimer = AUTO_START_DELAY;
  /** When true, the wave fires automatically once the window elapses. */
  autoStart = false;
  /** Early-start bonus awarded for the wave currently running (0 if none). */
  lastEarlyBonus = 0;
  /** Bank interest paid at the start of the current wave (0 if none). */
  lastBankInterest = 0;
  /** Enemy-HP multiplier locked in for the wave currently running. */
  currentThreat = 1;

  selectTower(id: string | null): void {
    this.selected = id ? (TOWER_DEFS.find((t) => t.id === id) ?? null) : null;
  }

  canAfford(def: TowerDef): boolean {
    return this.money >= def.cost;
  }

  enemyCells(): Array<{ x: number; y: number }> {
    return this.enemies
      .filter((e) => !e.dead && !e.escaped)
      .map((e) => e.cell);
  }

  /** Validity of placing the currently selected tower at this cell. */
  canPlaceSelected(x: number, y: number): boolean {
    if (!this.selected || !this.canAfford(this.selected)) return false;
    return this.grid.canPlace(x, y, this.enemyCells());
  }

  tryPlace(x: number, y: number): boolean {
    if (this.status !== 'playing' || !this.selected) return false;
    if (!this.canAfford(this.selected)) return false;
    if (!this.grid.canPlace(x, y, this.enemyCells())) return false;
    this.grid.place(x, y);
    this.towers.push(new Tower(x, y, this.selected));
    this.money -= this.selected.cost;
    this.boardDirty = true;
    return true;
  }

  /** Refund value of a tower at this cell, or null if none is there. */
  sellValueAt(x: number, y: number): number | null {
    const t = this.towers.find((tw) => tw.cx === x && tw.cy === y);
    return t ? Math.floor(t.def.cost * SELL_REFUND) : null;
  }

  sellAt(x: number, y: number): boolean {
    if (this.status !== 'playing') return false;
    const i = this.towers.findIndex((t) => t.cx === x && t.cy === y);
    if (i === -1) return false;
    const tower = this.towers[i];
    this.towers.splice(i, 1);
    this.grid.remove(x, y);
    this.money += Math.floor(tower.def.cost * SELL_REFUND);
    this.boardDirty = true;
    return true;
  }

  startWave(): boolean {
    if (this.status !== 'playing') return false;
    const earlyBonus = (this.nextWaveCountdown ?? 0) * EARLY_BONUS_PER_SECOND;
    const started = this.waves.startNext();
    if (!started) return false;

    this.money += earlyBonus;
    this.lastEarlyBonus = earlyBonus;

    // Banks pay interest on the money on hand at wave start.
    const base = this.money;
    let interest = 0;
    for (const t of this.towers) interest += t.collectInterest(base);
    this.money += interest;
    this.lastBankInterest = interest;

    // Lock the wealth-scaled threat for this wave.
    this.currentThreat = this.threatMultiplier;

    this.nextWaveTimer = AUTO_START_DELAY;
    return true;
  }

  /** Whether the Start Wave button should be enabled. */
  get canStartWave(): boolean {
    return (
      this.status === 'playing' &&
      !this.waves.isActive &&
      this.enemies.length === 0 &&
      this.waves.hasMoreWaves
    );
  }

  /** Whole seconds left in the build window, or null when not idle. */
  get nextWaveCountdown(): number | null {
    if (!this.canStartWave) return null;
    return Math.max(0, Math.ceil(this.nextWaveTimer));
  }

  /** Money you'd earn by starting the next wave right now. */
  get pendingEarlyBonus(): number {
    return (this.nextWaveCountdown ?? 0) * EARLY_BONUS_PER_SECOND;
  }

  /** Money currently tied up in standing economy towers. */
  get economyInvestment(): number {
    return this.towers
      .filter((t) => t.def.kind !== 'attack')
      .reduce((sum, t) => sum + t.def.cost, 0);
  }

  /** Enemy-HP multiplier the next wave would use given current investment. */
  get threatMultiplier(): number {
    return 1 + (this.economyInvestment / 1000) * ECONOMY_THREAT_PER_1000;
  }

  update(dt: number): void {
    if (this.status !== 'playing') return;

    this.updateAutoStart(dt);

    for (const e of this.waves.update(dt, this.currentThreat)) this.enemies.push(e);

    for (const e of this.enemies) {
      e.update(dt, this.grid);
      if (e.escaped) {
        this.lives -= 1;
      }
    }

    const inCombat = this.waves.isActive || this.enemies.length > 0;
    for (const t of this.towers) {
      const p = t.update(dt, this.enemies, this.grid);
      if (p) this.projectiles.push(p);
      if (inCombat) this.money += t.collectIncome(dt, this.farmMultiplier(t));
    }

    for (const p of this.projectiles) p.update(dt);

    for (const e of this.enemies) {
      if (e.dead) this.money += e.reward;
    }

    this.enemies = this.enemies.filter((e) => !e.dead && !e.escaped);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    this.resolveEndState();
  }

  /** Income multiplier for a farm from all mills within range. */
  private farmMultiplier(farm: Tower): number {
    if (farm.def.kind !== 'farm') return 1;
    let boost = 0;
    for (const t of this.towers) {
      if (t.def.kind !== 'mill') continue;
      const dx = t.x - farm.x;
      const dy = t.y - farm.y;
      if (dx * dx + dy * dy <= t.def.range * t.def.range) boost += t.def.farmBoost;
    }
    return 1 + boost;
  }

  private updateAutoStart(dt: number): void {
    if (!this.canStartWave) {
      this.nextWaveTimer = AUTO_START_DELAY;
      return;
    }
    if (this.nextWaveTimer > 0) {
      this.nextWaveTimer = Math.max(0, this.nextWaveTimer - dt);
    }
    if (this.autoStart && this.nextWaveTimer <= 0) this.startWave();
  }

  private resolveEndState(): void {
    if (this.lives <= 0) {
      this.lives = 0;
      this.status = 'lost';
      return;
    }
    const cleared = this.enemies.length === 0 && !this.waves.isActive;
    if (cleared && !this.waves.hasMoreWaves && this.waves.current >= 0) {
      this.status = 'won';
    }
  }

  cellFromPixel(px: number, py: number): { x: number; y: number } {
    return { x: Math.floor(px / CELL), y: Math.floor(py / CELL) };
  }
}
