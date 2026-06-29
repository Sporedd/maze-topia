import { LEVELS, type TowerDef } from './config.ts';

const STORAGE_KEY = 'maze-topia.cleared';
const SCORE_KEY = 'maze-topia.stars';

/**
 * Persisted player progress: which levels are cleared (gates level unlocks and
 * global tower unlocks) and the best star rating earned per level.
 */
export class Progress {
  private cleared: Set<string>;
  private stars: Map<string, number>;

  constructor() {
    this.cleared = new Set(Progress.loadStringArray(STORAGE_KEY));
    this.stars = Progress.loadStars();
  }

  private static loadStringArray(key: string): string[] {
    try {
      const raw = localStorage.getItem(key);
      const ids: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private static loadStars(): Map<string, number> {
    try {
      const raw = localStorage.getItem(SCORE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (typeof parsed !== 'object' || parsed === null) return new Map();
      return new Map(
        Object.entries(parsed as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'number')
          .map(([k, v]) => [k, v as number]),
      );
    } catch {
      return new Map();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.cleared]));
      localStorage.setItem(SCORE_KEY, JSON.stringify(Object.fromEntries(this.stars)));
    } catch {
      // Storage unavailable (private mode / quota) — progress stays in-memory.
    }
  }

  isCleared(id: string): boolean {
    return this.cleared.has(id);
  }

  /** Best star rating (0–3) earned on a level; 0 if never cleared. */
  bestStars(id: string): number {
    return this.stars.get(id) ?? 0;
  }

  /** Record a clear and keep the best star rating seen for the level. */
  recordClear(id: string, stars: number): void {
    this.cleared.add(id);
    this.stars.set(id, Math.max(this.stars.get(id) ?? 0, stars));
    this.persist();
  }

  /** A level is unlocked if it's the first one or the previous one is cleared. */
  isUnlocked(index: number): boolean {
    return index === 0 || this.cleared.has(LEVELS[index - 1].id);
  }

  /** A tower is available if it has no unlock gate or that level is cleared. */
  isTowerUnlocked(def: TowerDef): boolean {
    return !def.unlockLevel || this.cleared.has(def.unlockLevel);
  }
}
