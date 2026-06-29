export const CELL = 30;

/** Seconds of build time before the next wave auto-starts. */
export const AUTO_START_DELAY = 10;
/** Fraction of a tower's cost refunded when sold. */
export const SELL_REFUND = 0.7;
/** Bonus money per whole second skipped by starting a wave early. */
export const EARLY_BONUS_PER_SECOND = 5;
/** Gold awarded for clearing a wave, multiplied by the wave number. */
export const WAVE_CLEAR_BONUS = 50;
/**
 * Added enemy-HP (and spawn-count) multiplier per standing threat-driving
 * economy building (Farms and Mills; Banks are exempt).
 */
export const ECONOMY_THREAT_PER_BUILDING = 0.2;
/** Fraction of a splash projectile's damage dealt to non-primary targets. */
export const SPLASH_DAMAGE_FRACTION = 0.5;
/** Selectable simulation speeds (1× = real time); each runs N substeps/frame. */
export const GAME_SPEEDS = [1, 2, 3, 5, 7, 10] as const;

/**
 * Star rating for a cleared level, from the fraction of starting lives kept.
 * 3 = flawless (no leaks), 2 = at least this fraction left, 1 = cleared at all.
 */
export const STAR_TWO_LIVES_FRACTION = 0.5;

/** Stars (1–3) earned for clearing a level with `livesLeft` of `startLives`. */
export function starsForResult(livesLeft: number, startLives: number): number {
  if (livesLeft <= 0) return 0;
  if (livesLeft >= startLives) return 3;
  if (livesLeft >= startLives * STAR_TWO_LIVES_FRACTION) return 2;
  return 1;
}

export const COLORS = {
  bgEven: 0x14100c, // warm cave stone
  bgOdd: 0x191309,
  grid: 0x2a2018,
  wall: 0x3b2f24, // hewn rock
  spawn: 0x4f9d44, // the dungeon mouth raiders pour from
  exit: 0xff5630, // the glowing hoard at the heart
  towerBody: 0xff7b3a,
  enemy: 0xb8c4d0, // cold steel invaders against the warm lair
  enemyHpBg: 0x30363d,
  enemyHp: 0x3fb950,
  projectile: 0xffb648,
  rangeOk: 0xffb648,
  rangeBad: 0xff5630,
  boss: 0xd65ad6, // a named champion answering the Bounty
  bossHp: 0xd65ad6,
} as const;

export type TowerKind = 'attack' | 'farm' | 'bank' | 'mill' | 'amp';

/**
 * Which in-range enemy an attack tower shoots. `first`/`last` use the
 * distance-field progress (closest-to-exit / just-entered); `closest` uses
 * straight-line distance to the tower; `strongest`/`weakest` use current HP.
 */
export type TargetingMode = 'first' | 'last' | 'closest' | 'strongest' | 'weakest';

/** Selectable targeting modes with their menu labels (display order). */
export const TARGETING_MODES: ReadonlyArray<{ id: TargetingMode; label: string }> = [
  { id: 'first', label: 'First' },
  { id: 'last', label: 'Last' },
  { id: 'closest', label: 'Closest' },
  { id: 'strongest', label: 'Strongest' },
  { id: 'weakest', label: 'Weakest' },
];

export interface TowerDef {
  id: string;
  name: string;
  kind: TowerKind;
  cost: number;
  color: number;
  // Attack (0 for economy towers).
  range: number; // pixels
  fireRate: number; // shots per second
  damage: number;
  /**
   * Level id whose clear unlocks this tower. Absent = available from the start.
   * Unlocks are global: once earned, the tower is buildable on every level.
   */
  unlockLevel?: string;
  /** Default target priority for this attack tower (per-tower override in-game). */
  defaultTargeting?: TargetingMode;
  projectileSpeed: number; // px per second
  splashRadius: number; // attack: damage radius around the impact (0 = single-target)
  // Economy (0 for attack towers).
  incomePerWave: number; // farm: money paid at the start of each wave
  interest: number; // bank: fraction of current money paid each wave
  farmBoost: number; // mill: income bonus added to each farm in range
  damageBoost: number; // amp: damage bonus added to each attack tower in range
}

export const TOWER_DEFS: TowerDef[] = [
  {
    id: 'gun',
    name: 'Imp',
    kind: 'attack',
    cost: 50,
    color: 0xff6b4a, // ember firebolts
    range: 2.5 * CELL,
    fireRate: 3,
    damage: 6,
    projectileSpeed: 12 * CELL,
    splashRadius: 0,
    defaultTargeting: 'first',
    incomePerWave: 0,
    interest: 0,
    farmBoost: 0,
    damageBoost: 0,
  },
  {
    id: 'cannon',
    name: 'Ogre',
    kind: 'attack',
    cost: 120,
    color: 0x9a8470, // hurled boulders
    range: 3.2 * CELL,
    fireRate: 0.8,
    damage: 40,
    projectileSpeed: 10 * CELL,
    splashRadius: 0,
    defaultTargeting: 'strongest', // a heavy single hit is wasted on chaff
    incomePerWave: 0,
    interest: 0,
    farmBoost: 0,
    damageBoost: 0,
  },
  {
    id: 'mortar',
    name: 'Gargoyle',
    kind: 'attack',
    cost: 160,
    color: 0xf0a83e, // arcing fire-spit that bursts
    range: 3.5 * CELL,
    fireRate: 0.6,
    damage: 22,
    projectileSpeed: 5 * CELL,
    splashRadius: 1.4 * CELL, // hits everything bunched on the path
    unlockLevel: 'the-funnel', // splash is the reward for taming the chokepoint
    defaultTargeting: 'first', // aim at the front so the blast lands on the pack
    incomePerWave: 0,
    interest: 0,
    farmBoost: 0,
    damageBoost: 0,
  },
  {
    id: 'sniper',
    name: 'Basilisk',
    kind: 'attack',
    cost: 200,
    color: 0x8be04a, // petrifying gaze-bolt
    range: 8 * CELL, // picks off enemies from across the board
    fireRate: 0.5,
    damage: 80, // long reach traded for a softer hit
    projectileSpeed: 24 * CELL, // near-hitscan
    splashRadius: 0,
    unlockLevel: 'the-core', // the final clear hands you the longest reach on the board
    defaultTargeting: 'strongest', // pick off the tankiest enemy from range
    incomePerWave: 0,
    interest: 0,
    farmBoost: 0,
    damageBoost: 0,
  },
  {
    id: 'farm',
    name: 'Gold Vein',
    kind: 'farm',
    cost: 100,
    color: 0xffd24a, // raw ore glittering in the open
    range: 0,
    fireRate: 0,
    damage: 0,
    projectileSpeed: 0,
    splashRadius: 0,
    incomePerWave: 30,
    interest: 0,
    farmBoost: 0,
    damageBoost: 0,
  },
  {
    id: 'bank',
    name: 'Deep Vault',
    kind: 'bank',
    cost: 250,
    color: 0xc89b2e, // hidden gold, no Bounty
    range: 0,
    fireRate: 0,
    damage: 0,
    projectileSpeed: 0,
    splashRadius: 0,
    incomePerWave: 0,
    interest: 0.12,
    farmBoost: 0,
    damageBoost: 0,
  },
  {
    id: 'mill',
    name: 'Taskmaster',
    kind: 'mill',
    cost: 150,
    color: 0xc56a3a, // whips nearby veins to dig faster
    range: 1.8 * CELL, // reaches the 8 surrounding cells
    fireRate: 0,
    damage: 0,
    projectileSpeed: 0,
    splashRadius: 0,
    unlockLevel: 'open-field', // first clear opens up farm-stacking economies
    incomePerWave: 0,
    interest: 0,
    farmBoost: 0.5, // +50% income to each farm in range
    damageBoost: 0,
  },
  {
    id: 'amp',
    name: 'War Drum',
    kind: 'amp',
    cost: 175,
    color: 0xe5484d, // rallies nearby guardians
    range: 2.5 * CELL,
    fireRate: 0,
    damage: 0,
    projectileSpeed: 0,
    splashRadius: 0,
    unlockLevel: 'the-pillars', // earned once you've mazed around fixed walls
    incomePerWave: 0,
    interest: 0,
    farmBoost: 0,
    damageBoost: 0.25, // +25% damage to each attack tower in range
  },
];

export interface WaveDef {
  count: number;
  hp: number;
  speed: number; // px per second
  interval: number; // seconds between spawns
  reward: number; // money per kill
  /**
   * A climactic boss wave: spawn count is NOT multiplied by threat (a boss is
   * a single unit), but its HP still scales with the locked-in threat.
   */
  boss?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export interface LevelDef {
  id: string;
  name: string;
  /** One-line flavour shown in the level-select menu. */
  blurb: string;
  cols: number;
  rows: number;
  spawn: Point;
  exit: Point;
  /** Cells permanently blocked: unbuildable and not walkable. */
  walls: Point[];
  startMoney: number;
  startLives: number;
  waves: WaveDef[];
}

/** Inclusive rectangle of cells, handy for sketching walls. */
function rect(x0: number, y0: number, x1: number, y1: number): Point[] {
  const cells: Point[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) cells.push({ x, y });
  }
  return cells;
}

/** The progression. Index order is the unlock order. */
export const LEVELS: LevelDef[] = [
  {
    id: 'open-field',
    name: 'The Antechamber',
    blurb: 'Bare rock to the hoard — your guardians are the only walls.',
    cols: 40,
    rows: 28,
    spawn: { x: 0, y: 14 },
    exit: { x: 39, y: 14 },
    walls: [],
    startMoney: 1000,
    startLives: 30,
    waves: [
      { count: 14, hp: 24, speed: 1.5 * CELL, interval: 0.8, reward: 10 },
      { count: 18, hp: 36, speed: 1.6 * CELL, interval: 0.7, reward: 10 },
      { count: 22, hp: 55, speed: 1.7 * CELL, interval: 0.65, reward: 11 },
      { count: 26, hp: 85, speed: 1.8 * CELL, interval: 0.6, reward: 12 },
      { count: 30, hp: 130, speed: 1.9 * CELL, interval: 0.55, reward: 13 },
      { count: 34, hp: 200, speed: 2.0 * CELL, interval: 0.5, reward: 15 },
      { count: 38, hp: 300, speed: 2.2 * CELL, interval: 0.45, reward: 16 },
      { count: 42, hp: 450, speed: 2.3 * CELL, interval: 0.4, reward: 18 },
      { count: 48, hp: 680, speed: 2.4 * CELL, interval: 0.4, reward: 20 },
      { count: 1, hp: 5000, speed: 1.1 * CELL, interval: 1, reward: 400, boss: true },
    ],
  },
  {
    id: 'the-pillars',
    name: 'Stalagmite Hall',
    blurb: 'Stone teeth the raiders must weave around. Less gold to start.',
    cols: 34,
    rows: 24,
    spawn: { x: 0, y: 2 },
    exit: { x: 33, y: 21 },
    walls: [
      ...rect(8, 6, 9, 17),
      ...rect(16, 6, 17, 17),
      ...rect(24, 6, 25, 17),
    ],
    startMoney: 750,
    startLives: 20,
    waves: [
      { count: 18, hp: 40, speed: 1.7 * CELL, interval: 0.65, reward: 10 },
      { count: 24, hp: 70, speed: 1.8 * CELL, interval: 0.6, reward: 11 },
      { count: 28, hp: 120, speed: 1.9 * CELL, interval: 0.55, reward: 12 },
      { count: 32, hp: 190, speed: 2.0 * CELL, interval: 0.5, reward: 13 },
      { count: 36, hp: 300, speed: 2.2 * CELL, interval: 0.45, reward: 15 },
      { count: 40, hp: 460, speed: 2.4 * CELL, interval: 0.4, reward: 17 },
      { count: 46, hp: 700, speed: 2.5 * CELL, interval: 0.4, reward: 19 },
      { count: 54, hp: 1050, speed: 2.7 * CELL, interval: 0.35, reward: 22 },
      { count: 1, hp: 8000, speed: 1.2 * CELL, interval: 1, reward: 500, boss: true },
    ],
  },
  {
    id: 'the-funnel',
    name: "The Dragon's Throat",
    blurb: 'A narrow gap halfway in forces every raider through one chokepoint.',
    cols: 44,
    rows: 30,
    spawn: { x: 0, y: 15 },
    exit: { x: 43, y: 15 },
    walls: [
      // A wall straight down the middle with a single 4-cell gap.
      ...rect(22, 0, 22, 12),
      ...rect(22, 17, 22, 29),
    ],
    startMoney: 900,
    startLives: 22,
    waves: [
      { count: 20, hp: 50, speed: 1.8 * CELL, interval: 0.6, reward: 10 },
      { count: 26, hp: 90, speed: 1.9 * CELL, interval: 0.55, reward: 11 },
      { count: 30, hp: 150, speed: 2.0 * CELL, interval: 0.5, reward: 13 },
      { count: 34, hp: 240, speed: 2.2 * CELL, interval: 0.45, reward: 14 },
      { count: 38, hp: 380, speed: 2.4 * CELL, interval: 0.4, reward: 16 },
      { count: 44, hp: 580, speed: 2.5 * CELL, interval: 0.4, reward: 18 },
      { count: 50, hp: 880, speed: 2.7 * CELL, interval: 0.35, reward: 21 },
      { count: 58, hp: 1300, speed: 2.8 * CELL, interval: 0.3, reward: 24 },
      { count: 66, hp: 1900, speed: 3.0 * CELL, interval: 0.3, reward: 28 },
      { count: 1, hp: 12000, speed: 1.2 * CELL, interval: 1, reward: 600, boss: true },
    ],
  },
  {
    id: 'the-core',
    name: 'The Inner Sanctum',
    blurb: 'The hoard sits dead centre — raiders spiral inward through two rings.',
    cols: 41,
    rows: 29,
    spawn: { x: 0, y: 0 },
    exit: { x: 20, y: 14 },
    walls: [
      // Outer ring (box 12..28 × 6..22) with a gap at the top.
      ...rect(12, 6, 18, 6),
      ...rect(22, 6, 28, 6),
      ...rect(12, 22, 28, 22),
      ...rect(12, 7, 12, 21),
      ...rect(28, 7, 28, 21),
      // Inner ring (box 16..24 × 10..18) with a gap at the bottom (offset 180°).
      ...rect(16, 10, 24, 10),
      ...rect(16, 11, 16, 17),
      ...rect(24, 11, 24, 17),
      ...rect(16, 18, 18, 18),
      ...rect(22, 18, 24, 18),
    ],
    startMoney: 850,
    startLives: 22,
    waves: [
      { count: 20, hp: 50, speed: 1.8 * CELL, interval: 0.6, reward: 10 },
      { count: 26, hp: 90, speed: 1.9 * CELL, interval: 0.55, reward: 11 },
      { count: 30, hp: 150, speed: 2.0 * CELL, interval: 0.5, reward: 13 },
      { count: 34, hp: 240, speed: 2.2 * CELL, interval: 0.45, reward: 14 },
      { count: 38, hp: 380, speed: 2.4 * CELL, interval: 0.4, reward: 16 },
      { count: 44, hp: 580, speed: 2.5 * CELL, interval: 0.4, reward: 18 },
      { count: 50, hp: 880, speed: 2.7 * CELL, interval: 0.35, reward: 21 },
      { count: 58, hp: 1300, speed: 2.8 * CELL, interval: 0.3, reward: 24 },
      { count: 66, hp: 1900, speed: 3.0 * CELL, interval: 0.3, reward: 28 },
      { count: 1, hp: 12000, speed: 1.0 * CELL, interval: 1, reward: 700, boss: true },
    ],
  },
];
