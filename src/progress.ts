import { LEVELS } from './config.ts';

const STORAGE_KEY = 'maze-topia.cleared';

/** Ids of levels the player has cleared, persisted across reloads. */
export class Progress {
  private cleared: Set<string>;

  constructor() {
    this.cleared = Progress.load();
  }

  private static load(): Set<string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const ids: unknown = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.cleared]));
    } catch {
      // Storage unavailable (private mode / quota) — progress stays in-memory.
    }
  }

  isCleared(id: string): boolean {
    return this.cleared.has(id);
  }

  markCleared(id: string): void {
    this.cleared.add(id);
    this.persist();
  }

  /** A level is unlocked if it's the first one or the previous one is cleared. */
  isUnlocked(index: number): boolean {
    return index === 0 || this.cleared.has(LEVELS[index - 1].id);
  }
}
