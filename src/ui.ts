import {
  CELL,
  GAME_SPEEDS,
  LEVELS,
  SPLASH_DAMAGE_FRACTION,
  TOWER_DEFS,
  type LevelDef,
  type Point,
  type TowerDef,
} from './config.ts';
import type { Game } from './game.ts';
import type { Progress } from './progress.ts';

export interface UICallbacks {
  /** Load a chosen level and switch to the playing screen. */
  selectLevel: (level: LevelDef) => void;
  /** Reload the level currently being played. */
  restart: () => void;
  /** Load the level after the one just cleared (if any). */
  nextLevel: () => void;
  /** Return to the level-select screen. */
  menu: () => void;
}

/** "$0", "$7.5", "$20" — one decimal only when the rate isn't whole. */
function formatIncome(perSecond: number): string {
  const rounded = Math.round(perSecond * 10) / 10;
  return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
}

function describeTower(def: TowerDef): string {
  switch (def.kind) {
    case 'attack': {
      const dps = Math.round(def.damage * def.fireRate * 10) / 10;
      const range = Math.round((def.range / CELL) * 10) / 10;
      const base = `dmg ${def.damage} · rate ${def.fireRate}/s · ${dps} dps · range ${range}`;
      if (def.splashRadius <= 0) return base;
      const splash = Math.round((def.splashRadius / CELL) * 10) / 10;
      return `${base} · splash ${splash} @${Math.round(SPLASH_DAMAGE_FRACTION * 100)}%`;
    }
    case 'farm':
      return `+$${def.incomePerWave}/wave`;
    case 'bank':
      return `+${Math.round(def.interest * 100)}% money/wave`;
    case 'mill':
      return `+${Math.round(def.farmBoost * 100)}% to nearby farms`;
    case 'amp':
      return `+${Math.round(def.damageBoost * 100)}% dmg to nearby towers`;
  }
}

/** Wires the HTML panel, level-select menu and end-of-game overlay to the game. */
export class UI {
  private readonly money = document.getElementById('money')!;
  private readonly income = document.getElementById('income')!;
  private readonly lives = document.getElementById('lives')!;
  private readonly wave = document.getElementById('wave')!;
  private readonly threat = document.getElementById('threat')!;
  private readonly levelName = document.getElementById('level-name')!;
  private readonly message = document.getElementById('message')!;
  private readonly startBtn = document.getElementById('start') as HTMLButtonElement;
  private readonly towersEl = document.getElementById('towers')!;
  private readonly ecoTowersEl = document.getElementById('eco-towers')!;
  private readonly boostTowersEl = document.getElementById('boost-towers')!;
  private readonly overlay = document.getElementById('overlay')!;
  private readonly overlayTitle = document.getElementById('overlay-title')!;
  private readonly nextBtn = document.getElementById('next-level') as HTMLButtonElement;
  private readonly retryBtn = document.getElementById('retry') as HTMLButtonElement;
  private readonly menuBtn = document.getElementById('to-menu') as HTMLButtonElement;
  private readonly levelMenu = document.getElementById('levels')!;
  private readonly levelList = document.getElementById('level-list')!;
  private readonly contextMenu = document.getElementById('context-menu')!;
  private readonly sellOption = document.getElementById('sell-option') as HTMLButtonElement;
  private readonly autoToggle = document.getElementById('auto') as HTMLInputElement;
  private readonly speedEl = document.getElementById('speed')!;
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private readonly speedButtons = new Map<number, HTMLButtonElement>();
  /** Attack: 1‑N · Economy: Shift+1‑N · Boost: Alt+1‑N. */
  private readonly attackDefs = TOWER_DEFS.filter((d) => d.kind === 'attack');
  private readonly ecoDefs = TOWER_DEFS.filter((d) => d.kind === 'farm' || d.kind === 'bank' || d.kind === 'mill');
  private readonly boostDefs = TOWER_DEFS.filter((d) => d.kind === 'amp');
  /** Cell the open right-click menu acts on, or null when the menu is closed. */
  private contextCell: Point | null = null;

  constructor(
    private readonly getGame: () => Game | null,
    private readonly callbacks: UICallbacks,
    private readonly progress: Progress,
  ) {
    const groups: Array<{ defs: TowerDef[]; container: HTMLElement; modifier: string; cls: string }> = [
      { defs: this.attackDefs, container: this.towersEl, modifier: '', cls: 'tower-btn' },
      { defs: this.ecoDefs, container: this.ecoTowersEl, modifier: '⇧', cls: 'tower-btn eco' },
      { defs: this.boostDefs, container: this.boostTowersEl, modifier: '⌥', cls: 'tower-btn boost' },
    ];
    for (const { defs, container, modifier, cls } of groups) {
      defs.forEach((def, i) => {
        const key = `${modifier}${i + 1}`;
        const btn = document.createElement('button');
        btn.className = cls;
        btn.innerHTML = `<kbd>${key}</kbd> ${def.name} — $${def.cost}<small>${describeTower(def)}</small>`;
        btn.addEventListener('click', () => this.toggleSelect(def.id));
        container.appendChild(btn);
        this.buttons.set(def.id, btn);
      });
    }
    GAME_SPEEDS.forEach((speed) => {
      const btn = document.createElement('button');
      btn.className = 'speed-btn';
      btn.textContent = `${speed}×`;
      btn.addEventListener('click', () => {
        const game = this.getGame();
        if (game) game.speed = speed;
      });
      this.speedEl.appendChild(btn);
      this.speedButtons.set(speed, btn);
    });
    this.startBtn.addEventListener('click', () => this.getGame()?.startWave());
    this.nextBtn.addEventListener('click', () => this.callbacks.nextLevel());
    this.retryBtn.addEventListener('click', () => this.callbacks.restart());
    this.menuBtn.addEventListener('click', () => this.callbacks.menu());
    this.autoToggle.addEventListener('change', () => {
      const game = this.getGame();
      if (game) game.autoStart = this.autoToggle.checked;
    });
    this.sellOption.addEventListener('click', () => this.sellFromContextMenu());
    // Any click outside the menu dismisses it (also fires before a right-click reopens it).
    document.addEventListener('pointerdown', (ev) => {
      if (!this.contextMenu.contains(ev.target as Node)) this.closeContextMenu();
    });
    window.addEventListener('keydown', (ev) => this.handleKey(ev));
  }

  /** Show the right-click menu at the cursor for the tower in `cell` (if any). */
  openContextMenu(clientX: number, clientY: number, cell: Point): void {
    const value = this.getGame()?.sellValueAt(cell.x, cell.y) ?? null;
    if (value === null) {
      this.closeContextMenu();
      return;
    }
    this.contextCell = cell;
    this.sellOption.textContent = `Sell tower (+$${value})`;
    this.contextMenu.style.left = `${clientX}px`;
    this.contextMenu.style.top = `${clientY}px`;
    this.contextMenu.style.display = 'block';
  }

  closeContextMenu(): void {
    this.contextCell = null;
    this.contextMenu.style.display = 'none';
  }

  private sellFromContextMenu(): void {
    const game = this.getGame();
    if (game && this.contextCell) game.sellAt(this.contextCell.x, this.contextCell.y);
    this.closeContextMenu();
  }

  /** Render and show the level-select screen; hide the end-of-game overlay. */
  showMenu(): void {
    this.closeContextMenu();
    this.overlay.style.display = 'none';
    this.levelList.replaceChildren(
      ...LEVELS.map((level, i) => this.buildLevelCard(level, i)),
    );
    this.levelMenu.style.display = 'flex';
  }

  /** Hide the level-select screen so a loaded level becomes visible. */
  hideMenu(): void {
    this.levelMenu.style.display = 'none';
  }

  private buildLevelCard(level: LevelDef, index: number): HTMLButtonElement {
    const unlocked = this.progress.isUnlocked(index);
    const cleared = this.progress.isCleared(level.id);
    const badge = cleared ? '✓ cleared' : unlocked ? `${level.waves.length} waves` : '🔒 locked';
    const btn = document.createElement('button');
    btn.className = 'level-card';
    btn.disabled = !unlocked;
    btn.innerHTML =
      `<b>${index + 1}. ${level.name}</b>` +
      `<span class="badge">${badge}</span>` +
      `<small>${level.blurb}</small>`;
    btn.addEventListener('click', () => this.callbacks.selectLevel(level));
    return btn;
  }

  private toggleSelect(id: string): void {
    const game = this.getGame();
    if (!game) return;
    game.selectTower(game.selected?.id === id ? null : id);
  }

  /** 1‑N attack, Shift+1‑N economy, Alt+1‑N boost; Escape deselects. */
  private handleKey(ev: KeyboardEvent): void {
    const game = this.getGame();
    if (!game) return;
    if (ev.key === 'Escape') {
      game.selectTower(null);
      this.closeContextMenu();
      return;
    }
    // Use the physical digit key so a modifier's shifted symbol (e.g. "!") doesn't matter.
    const digit = /^Digit([1-9])$/.exec(ev.code);
    if (!digit) return;
    const idx = Number(digit[1]) - 1;
    const group = ev.altKey ? this.boostDefs : ev.shiftKey ? this.ecoDefs : this.attackDefs;
    if (idx < group.length) {
      ev.preventDefault();
      this.toggleSelect(group[idx].id);
    }
  }

  private activeMessage(g: Game): string {
    const parts = ['Wave in progress…'];
    if (g.lastEarlyBonus > 0) parts.push(`early +$${g.lastEarlyBonus}`);
    if (g.lastFarmIncome > 0) parts.push(`farms +$${g.lastFarmIncome}`);
    if (g.lastBankInterest > 0) parts.push(`bank +$${g.lastBankInterest}`);
    return parts.join(' · ');
  }

  private idleMessage(g: Game, countdown: number | null): string {
    const parts: string[] = [];
    if (g.lastWaveBonus > 0) parts.push(`Wave cleared: +$${g.lastWaveBonus}`);
    if (g.pendingEarlyBonus > 0) parts.push(`Start now: +$${g.pendingEarlyBonus} bonus`);
    if (g.autoStart && countdown !== null) parts.push(`auto in ${countdown}s`);
    if (g.selected) parts.push(`placing ${g.selected.name}`);
    return parts.join(' · ');
  }

  render(g: Game): void {
    this.money.textContent = String(g.money);
    this.income.textContent = formatIncome(g.farmIncomePerWave);
    this.lives.textContent = String(g.lives);
    this.levelName.textContent = g.level.name;
    this.wave.textContent = `${g.waves.displayWave} / ${g.waves.totalWaves}`;
    const threat = g.waves.isActive ? g.currentThreat : g.threatMultiplier;
    this.threat.textContent = `×${threat.toFixed(2)}${g.waves.isActive ? '' : ' (next)'}`;
    this.startBtn.disabled = !g.canStartWave;

    for (const [id, btn] of this.buttons) {
      const def = TOWER_DEFS.find((t) => t.id === id)!;
      btn.classList.toggle('selected', g.selected?.id === id);
      btn.disabled = !g.canAfford(def);
    }

    this.autoToggle.checked = g.autoStart;

    for (const [speed, btn] of this.speedButtons) {
      btn.classList.toggle('selected', g.speed === speed);
    }

    if (g.status === 'playing') {
      const countdown = g.nextWaveCountdown;
      this.message.textContent = g.waves.isActive
        ? this.activeMessage(g)
        : this.idleMessage(g, countdown);
      this.startBtn.textContent =
        g.autoStart && countdown !== null ? `Start Wave (auto ${countdown}s)` : 'Start Wave';
      this.overlay.style.display = 'none';
    } else {
      const won = g.status === 'won';
      this.overlayTitle.textContent = won ? 'Level cleared! 🎉' : 'Game over 💀';
      const hasNext = won && this.hasNextLevel(g.level);
      this.nextBtn.style.display = hasNext ? 'inline-block' : 'none';
      this.retryBtn.textContent = won ? 'Replay' : 'Retry';
      this.overlay.style.display = 'flex';
    }
  }

  private hasNextLevel(level: LevelDef): boolean {
    const index = LEVELS.findIndex((l) => l.id === level.id);
    return index >= 0 && index < LEVELS.length - 1;
  }
}
