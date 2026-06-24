export const COLS = 40;
export const ROWS = 28;
export const CELL = 30;
export const WIDTH = COLS * CELL;
export const HEIGHT = ROWS * CELL;

export const SPAWN = { x: 0, y: Math.floor(ROWS / 2) };
export const EXIT = { x: COLS - 1, y: Math.floor(ROWS / 2) };

export const START_MONEY = 1000;
export const START_LIVES = 25;
/** Seconds of build time before the next wave auto-starts. */
export const AUTO_START_DELAY = 10;
/** Fraction of a tower's cost refunded when sold. */
export const SELL_REFUND = 0.7;
/** Bonus money per whole second skipped by starting a wave early. */
export const EARLY_BONUS_PER_SECOND = 5;
/** Added enemy-HP multiplier per 1000 money tied up in economy towers. */
export const ECONOMY_THREAT_PER_1000 = 0.6;

export const COLORS = {
  bgEven: 0x121821,
  bgOdd: 0x161d28,
  grid: 0x1f2630,
  spawn: 0x3fb950,
  exit: 0xf85149,
  towerBody: 0x58a6ff,
  enemy: 0xffa657,
  enemyHpBg: 0x30363d,
  enemyHp: 0x3fb950,
  projectile: 0xffd33d,
  rangeOk: 0x58a6ff,
  rangeBad: 0xf85149,
} as const;

export type TowerKind = 'attack' | 'farm' | 'bank' | 'mill';

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
  projectileSpeed: number; // px per second
  // Economy (0 for attack towers).
  incomePerSecond: number; // farm: money generated each second
  interest: number; // bank: fraction of current money paid each wave
  farmBoost: number; // mill: income bonus added to each farm in range
}

export const TOWER_DEFS: TowerDef[] = [
  {
    id: 'gun',
    name: 'Gun',
    kind: 'attack',
    cost: 50,
    color: 0x58a6ff,
    range: 2.5 * CELL,
    fireRate: 3,
    damage: 6,
    projectileSpeed: 8 * CELL,
    incomePerSecond: 0,
    interest: 0,
    farmBoost: 0,
  },
  {
    id: 'cannon',
    name: 'Cannon',
    kind: 'attack',
    cost: 120,
    color: 0xbc8cff,
    range: 3.2 * CELL,
    fireRate: 0.8,
    damage: 40,
    projectileSpeed: 6 * CELL,
    incomePerSecond: 0,
    interest: 0,
    farmBoost: 0,
  },
  {
    id: 'farm',
    name: 'Farm',
    kind: 'farm',
    cost: 100,
    color: 0x3fb950,
    range: 0,
    fireRate: 0,
    damage: 0,
    projectileSpeed: 0,
    incomePerSecond: 5,
    interest: 0,
    farmBoost: 0,
  },
  {
    id: 'bank',
    name: 'Bank',
    kind: 'bank',
    cost: 250,
    color: 0xffd33d,
    range: 0,
    fireRate: 0,
    damage: 0,
    projectileSpeed: 0,
    incomePerSecond: 0,
    interest: 0.12,
    farmBoost: 0,
  },
  {
    id: 'mill',
    name: 'Mill',
    kind: 'mill',
    cost: 150,
    color: 0x39c5cf,
    range: 1.8 * CELL, // reaches the 8 surrounding cells
    fireRate: 0,
    damage: 0,
    projectileSpeed: 0,
    incomePerSecond: 0,
    interest: 0,
    farmBoost: 0.5, // +50% income to each farm in range
  },
];

export interface WaveDef {
  count: number;
  hp: number;
  speed: number; // px per second
  interval: number; // seconds between spawns
  reward: number; // money per kill
}

export const WAVES: WaveDef[] = [
  { count: 16, hp: 30, speed: 1.6 * CELL, interval: 0.7, reward: 10 },
  { count: 22, hp: 45, speed: 1.7 * CELL, interval: 0.65, reward: 10 },
  { count: 26, hp: 70, speed: 1.8 * CELL, interval: 0.6, reward: 11 },
  { count: 30, hp: 110, speed: 1.9 * CELL, interval: 0.55, reward: 12 },
  { count: 34, hp: 170, speed: 2.0 * CELL, interval: 0.5, reward: 13 },
  { count: 38, hp: 260, speed: 2.2 * CELL, interval: 0.45, reward: 15 },
  { count: 42, hp: 400, speed: 2.4 * CELL, interval: 0.4, reward: 16 },
  { count: 48, hp: 600, speed: 2.5 * CELL, interval: 0.4, reward: 18 },
  { count: 56, hp: 900, speed: 2.6 * CELL, interval: 0.35, reward: 20 },
];
