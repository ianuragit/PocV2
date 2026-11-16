import type { GameEvent, GameState } from '../sim';
import type { ScreenPoint } from '../view/overlay';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Score, combo, lives, ammo and short feedback. DOM only; reads state and reacts to events. */
export class Hud {
  private readonly root = $('hud');
  private readonly score = $('score');
  private readonly combo = $('combo');
  private readonly lives = $('lives');
  private readonly ammo = $('ammo');
  private readonly reload = $('reload');
  private readonly banner = $('banner');
  private readonly flash = $('flash');
  private readonly popups = $('popups');
  private last = { score: -1, mult: -1, lives: -1, ammo: -1, capacity: -1, reloadShown: false };
  private bannerTimer = 0;

  show(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  update(state: GameState, dt: number): void {
    const s = state.score;
    if (s.score !== this.last.score) this.score.textContent = s.score.toLocaleString('en-US');
    if (s.multiplier !== this.last.mult) this.combo.textContent = s.multiplier > 1 ? `x${s.multiplier}` : '';
    if (state.lives !== this.last.lives) {
      this.lives.replaceChildren(...Array.from({ length: state.lives }, () => el('div', 'life')));
    }
    const w = state.weapon;
    if (w.ammo !== this.last.ammo || w.capacity !== this.last.capacity) {
      this.ammo.replaceChildren(
        ...Array.from({ length: w.capacity }, (_, i) => el('div', i < w.ammo ? 'round' : 'round spent')),
      );
    }
    const reloadShown = w.ammo === 0 && w.reloading === 0;
    if (reloadShown !== this.last.reloadShown) this.reload.classList.toggle('hidden', !reloadShown);
    this.last = {
      score: s.score,
      mult: s.multiplier,
      lives: state.lives,
      ammo: w.ammo,
      capacity: w.capacity,
      reloadShown,
    };

    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.classList.remove('show');
    }
  }

  onEvents(events: readonly GameEvent[], pointer: ScreenPoint | null): void {
    for (const e of events) {
      if (e.type === 'EnemyHit') this.popup(pointer, `+${e.points}`);
      else if (e.type === 'CivilianHit') this.popup(pointer, 'CIVILIAN!', true);
      else if (e.type === 'PlayerHit') this.hitFlash();
      else if (e.type === 'BonusLife') this.showBanner('EXTRA LIFE', 1.2);
      else if (e.type === 'WaveCleared') this.showBanner('CLEAR', 0.8);
    }
  }

  reset(): void {
    this.banner.classList.remove('show');
    this.popups.replaceChildren();
    this.last = { score: -1, mult: -1, lives: -1, ammo: -1, capacity: -1, reloadShown: true };
  }

  private showBanner(text: string, seconds: number): void {
    this.banner.textContent = text;
    this.banner.classList.add('show');
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
