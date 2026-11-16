import type { GameEvent, GameState } from '../sim/index.ts';
import type { ScreenPoint } from '../view/overlay.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const WEAPON_LABELS: Record<string, string> = {
  shotgun: 'SHOTGUN',
  machine_pistol: 'M.PISTOL',
  magnum: 'MAGNUM',
};
/** Above this many rounds the ammo shows as a number instead of one pip per round. */
const MAX_PIPS = 8;

/** Score, combo, lives, weapon and ammo, and short feedback. DOM only; reads state and reacts to events. */
export class Hud {
  private readonly root = $('hud');
  private readonly score = $('score');
  private readonly combo = $('combo');
  private readonly lives = $('lives');
  private readonly ammo = $('ammo');
  private readonly weapon = $('weapon');
  private readonly reload = $('reload');
  private readonly bannerEl = $('banner');
  private readonly flash = $('flash');
  private readonly popups = $('popups');
  private last = { score: -1, mult: -1, lives: -1, ammo: -1, capacity: -1, kind: '', reloadShown: false };
  private bannerTimer = 0;

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  /** Softer, shorter damage flash for players sensitive to flashing. */
  setReducedFlash(on: boolean): void {
    this.flash.classList.toggle('reduced', on);
  }

  update(state: GameState, dt: number): void {
    const s = state.score;
    if (s.score !== this.last.score) this.score.textContent = String(s.score).padStart(7, '0');
    if (s.multiplier !== this.last.mult)
      this.combo.textContent = s.multiplier > 1 ? `COMBO x${s.multiplier}` : '';
    if (state.lives !== this.last.lives) {
      this.lives.replaceChildren(...Array.from({ length: state.lives }, () => el('div', 'life')));
    }
    const w = state.weapon;
    if (w.ammo !== this.last.ammo || w.capacity !== this.last.capacity || w.kind !== this.last.kind) {
      if (w.capacity > MAX_PIPS) {
        const count = el('div', 'ammo-count');
        count.textContent = String(w.ammo).padStart(2, '0');
        this.ammo.replaceChildren(el('div', `round ${w.kind}`), count);
      } else {
        this.ammo.replaceChildren(
          ...Array.from({ length: w.capacity }, (_, i) =>
            el('div', i < w.ammo ? `round ${w.kind}` : 'round spent'),
          ),
        );
      }
      this.weapon.textContent = WEAPON_LABELS[w.kind] ?? '';
      this.weapon.classList.toggle('hidden', w.kind === 'revolver');
    }
    // Specials are dropped when empty, so only the revolver ever asks for a reload.
    const reloadShown = w.kind === 'revolver' && w.ammo === 0 && w.reloading === 0;
    if (reloadShown !== this.last.reloadShown) this.reload.classList.toggle('hidden', !reloadShown);
    this.last = {
      score: s.score,
      mult: s.multiplier,
      lives: state.lives,
      ammo: w.ammo,
      capacity: w.capacity,
      kind: w.kind,
      reloadShown,
    };

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerEl.classList.remove('show');
    }
  }

  onEvents(events: readonly GameEvent[], pointer: ScreenPoint | null): void {
    for (const e of events) {
      if (e.type === 'EnemyHit') this.popup(pointer, `+${e.points}`);
      else if (e.type === 'CivilianHit') this.popup(pointer, 'CIVILIAN!', true);
      else if (e.type === 'ShieldBlock') this.popup(pointer, 'BLOCKED', true);
      else if (e.type === 'PlayerHit') this.hitFlash();
      else if (e.type === 'BonusLife') this.banner('EXTRA LIFE', 1.2);
      else if (e.type === 'WaveCleared') this.banner('CLEAR', 0.8);
    }
  }

  reset(): void {
    this.bannerEl.classList.remove('show');
    this.bannerTimer = 0;
    this.popups.replaceChildren();
    this.last = { score: -1, mult: -1, lives: -1, ammo: -1, capacity: -1, kind: '', reloadShown: true };
  }

  banner(text: string, seconds: number): void {
    this.bannerEl.textContent = text;
    this.bannerEl.classList.add('show');
    this.bannerTimer = seconds;
  }

  private hitFlash(): void {
    this.flash.classList.remove('hit');
    void this.flash.offsetWidth; // restart the animation
    this.flash.classList.add('hit');
  }

  private popup(at: ScreenPoint | null, text: string, bad = false): void {
    if (!at) return;
    const p = el('div', bad ? 'popup bad' : 'popup');
    p.textContent = text;
    p.style.left = `${at.x}px`;
    p.style.top = `${at.y}px`;
    p.addEventListener('animationend', () => p.remove());
    this.popups.append(p);
  }
}

function el(tag: string, className: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = className;
  return e;
}
