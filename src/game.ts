import {
  CELL,
  AUTO_START_DELAY,
  SELL_REFUND,
  EARLY_BONUS_PER_SECOND,
  WAVE_CLEAR_BONUS,
  ECONOMY_THREAT_PER_BUILDING,
  TOWER_DEFS,
  type LevelDef,
  type TowerDef,
  type TowerKind,
} from './config.ts';
import { Grid } from './grid.ts';
import { Enemy } from './enemy.ts';
import { Tower } from './tower.ts';
import { Projectile } from './projectile.ts';
import { WaveManager } from './waves.ts';

export type GameStatus = 'playing' | 'won' | 'lost';

export class Game {
  readonly grid: Grid;
  readonly waves: WaveManager;
  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];

  money: number;
  lives: number;
  status: GameStatus = 'playing';
  selected: TowerDef | null = null;
  /** Bumped whenever the static board changes, so the renderer can redraw. */
  boardDirty = true;
  /** Seconds left in the build window (counts while idle; drives early bonus). */
  private nextWaveTimer = AUTO_START_DELAY;
  /** When true, the wave fires automatically once the window elapses. */
  autoStart = false;
  /** Simulation speed multiplier; the loop runs this many fixed substeps/frame. */
  speed = 1;
  /** Early-start bonus awarded for the wave currently running (0 if none). */
  lastEarlyBonus = 0;
  /** Bank interest paid at the start of the current wave (0 if none). */
  lastBankInterest = 0;
  /** Farm income paid at the start of the current wave (0 if none). */
  lastFarmIncome = 0;
  /** Gold paid for the most recently cleared wave (0 before any clear). */
  lastWaveBonus = 0;
  /** Highest wave index already paid a clear bonus, so we award it once. */
  private bonusPaidForWave = -1;
  /** Enemy-HP multiplier locked in for the wave currently running. */
  currentThreat = 1;

  constructor(readonly level: LevelDef) {
    this.grid = new Grid(level);
    this.waves = new WaveManager(level.waves, level.spawn);
    this.money = level.startMoney;
    this.lives = level.startLives;
  }

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
    this.recomputeDamageBoosts();
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
    this.recomputeDamageBoosts();
    this.boardDirty = true;
    return true;
  }

  startWave(): boolean {
    if (this.status !== 'playing') return false;
    const earlyBonus = (this.nextWaveCountdown ?? 0) * EARLY_BONUS_PER_SECOND;
    // Lock the wealth-scaled threat in before spawning; it scales HP and count.
    const threat = this.threatMultiplier;
    const started = this.waves.startNext(threat);
    if (!started) return false;
    this.currentThreat = threat;

    this.money += earlyBonus;
    this.lastEarlyBonus = earlyBonus;

    // Banks pay interest on the money on hand; farms pay their wave income.
    // Both are computed against the pre-wave total, so they don't compound.
    const base = this.money;
    const interest = this.towers.reduce((sum, t) => sum + t.collectInterest(base), 0);
    const farmIncome = this.towers.reduce(
      (sum, t) => sum + t.collectIncome(this.farmMultiplier(t)),
      0,
    );
    this.money += interest + farmIncome;
    this.lastBankInterest = interest;
    this.lastFarmIncome = farmIncome;

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

  /** Total money all farms pay at the start of a wave (incl. mill boosts). */
  get farmIncomePerWave(): number {
    return this.towers
      .filter((t) => t.def.kind === 'farm')
      .reduce((sum, t) => sum + t.def.incomePerWave * this.farmMultiplier(t), 0);
  }

  /** Number of standing economy buildings (income towers, not combat). */
  get economyBuildingCount(): number {
    const economyKinds: TowerKind[] = ['farm', 'bank', 'mill'];
    return this.towers.filter((t) => economyKinds.includes(t.def.kind)).length;
  }

  /** Enemy-HP multiplier the next wave would use given current economy count. */
  get threatMultiplier(): number {
    return 1 + this.economyBuildingCount * ECONOMY_THREAT_PER_BUILDING;
  }

  update(dt: number): void {
    if (this.status !== 'playing') return;

    this.updateAutoStart(dt);

    for (const e of this.waves.update(dt)) this.enemies.push(e);

    for (const e of this.enemies) {
      e.update(dt, this.grid);
      if (e.escaped) {
        this.lives -= 1;
      }
    }

    for (const t of this.towers) {
      const p = t.update(dt, this.enemies, this.grid);
      if (p) this.projectiles.push(p);
    }

    for (const p of this.projectiles) p.update(dt, this.enemies);

    for (const e of this.enemies) {
      if (e.dead) this.money += e.reward;
    }

    this.enemies = this.enemies.filter((e) => !e.dead && !e.escaped);
    this.projectiles = this.projectiles.filter((p) => !p.dead);

    this.awardWaveClearBonus();
    this.resolveEndState();
  }

  /** Pay a one-time gold bonus the moment a wave is fully cleared. */
  private awardWaveClearBonus(): void {
    const wave = this.waves.current;
    if (wave < 0 || wave <= this.bonusPaidForWave) return;
    if (this.waves.isActive || this.enemies.length > 0) return;
    this.bonusPaidForWave = wave;
    this.lastWaveBonus = WAVE_CLEAR_BONUS * this.waves.displayWave;
    this.money += this.lastWaveBonus;
  }

  /**
   * Refresh every attack tower's damage bonus from the amplifiers around it.
   * Bonuses stack additively; recomputed only when the board changes.
   */
  private recomputeDamageBoosts(): void {
    const amps = this.towers.filter((t) => t.def.kind === 'amp');
    this.towers
      .filter((t) => t.def.kind === 'attack')
      .forEach((tower) => {
        tower.damageBoost = amps.reduce((boost, amp) => {
          const dx = amp.x - tower.x;
          const dy = amp.y - tower.y;
          const inRange = dx * dx + dy * dy <= amp.def.range * amp.def.range;
          return inRange ? boost + amp.def.damageBoost : boost;
        }, 0);
      });
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
