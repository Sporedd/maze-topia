import { TOWER_DEFS, type TowerDef } from './config.ts';
import type { Game } from './game.ts';

function describeTower(def: TowerDef): string {
  switch (def.kind) {
    case 'attack':
      return `dmg ${def.damage} · rate ${def.fireRate}/s`;
    case 'farm':
      return `+$${def.incomePerSecond}/s`;
    case 'bank':
      return `+${Math.round(def.interest * 100)}% money/wave`;
    case 'mill':
      return `+${Math.round(def.farmBoost * 100)}% to nearby farms`;
  }
}

/** Wires the HTML panel/overlay to the game state. */
export class UI {
  private readonly money = document.getElementById('money')!;
  private readonly lives = document.getElementById('lives')!;
  private readonly wave = document.getElementById('wave')!;
  private readonly threat = document.getElementById('threat')!;
  private readonly message = document.getElementById('message')!;
  private readonly startBtn = document.getElementById('start') as HTMLButtonElement;
  private readonly towersEl = document.getElementById('towers')!;
  private readonly overlay = document.getElementById('overlay')!;
  private readonly overlayTitle = document.getElementById('overlay-title')!;
  private readonly restartBtn = document.getElementById('restart') as HTMLButtonElement;
  private readonly autoToggle = document.getElementById('auto') as HTMLInputElement;
  private readonly buttons = new Map<string, HTMLButtonElement>();

  constructor(
    private readonly getGame: () => Game,
    onRestart: () => void,
  ) {
    TOWER_DEFS.forEach((def, i) => {
      const key = String(i + 1);
      const btn = document.createElement('button');
      btn.className = 'tower-btn';
      btn.innerHTML = `<kbd>${key}</kbd> ${def.name} — $${def.cost}<small>${describeTower(def)}</small>`;
      btn.addEventListener('click', () => this.toggleSelect(def.id));
      this.towersEl.appendChild(btn);
      this.buttons.set(def.id, btn);
    });
    this.startBtn.addEventListener('click', () => this.getGame().startWave());
    this.restartBtn.addEventListener('click', onRestart);
    this.autoToggle.addEventListener('change', () => {
      this.getGame().autoStart = this.autoToggle.checked;
    });
    window.addEventListener('keydown', (ev) => this.handleKey(ev));
  }

  private toggleSelect(id: string): void {
    const game = this.getGame();
    game.selectTower(game.selected?.id === id ? null : id);
  }

  /** Number keys select a tower; Escape deselects. */
  private handleKey(ev: KeyboardEvent): void {
    const game = this.getGame();
    if (ev.key === 'Escape') {
      game.selectTower(null);
      return;
    }
    const idx = Number(ev.key) - 1;
    if (Number.isInteger(idx) && idx >= 0 && idx < TOWER_DEFS.length) {
      this.toggleSelect(TOWER_DEFS[idx].id);
    }
  }

  private activeMessage(g: Game): string {
    const parts = ['Wave in progress…'];
    if (g.lastEarlyBonus > 0) parts.push(`early +$${g.lastEarlyBonus}`);
    if (g.lastBankInterest > 0) parts.push(`bank +$${g.lastBankInterest}`);
    return parts.join(' · ');
  }

  private idleMessage(g: Game, countdown: number | null): string {
    const parts: string[] = [];
    if (g.pendingEarlyBonus > 0) parts.push(`Start now: +$${g.pendingEarlyBonus} bonus`);
    if (g.autoStart && countdown !== null) parts.push(`auto in ${countdown}s`);
    if (g.selected) parts.push(`placing ${g.selected.name}`);
    return parts.join(' · ');
  }

  render(g: Game): void {
    this.money.textContent = String(g.money);
    this.lives.textContent = String(g.lives);
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

    if (g.status === 'playing') {
      const countdown = g.nextWaveCountdown;
      this.message.textContent = g.waves.isActive
        ? this.activeMessage(g)
        : this.idleMessage(g, countdown);
      this.startBtn.textContent =
        g.autoStart && countdown !== null ? `Start Wave (auto ${countdown}s)` : 'Start Wave';
      this.overlay.style.display = 'none';
    } else {
      this.overlayTitle.textContent = g.status === 'won' ? 'You survived! 🎉' : 'Game over 💀';
      this.overlay.style.display = 'flex';
    }
  }
}
