import type { Difficulty, Rank } from '../sim/index.ts';
import type { ScoreEntry } from '../save/saveStore.ts';

export type ScreenName =
  | 'loading'
  | 'title'
  | 'playing'
  | 'paused'
  | 'continue'
  | 'results'
  | 'scores'
  | 'options'
  | 'credits'
  | 'error';

export interface ScreenData {
  difficulty?: Difficulty;
  best?: number;
  score?: number;
  cleared?: boolean;
  rank?: Rank;
  accuracy?: number;
  continuesUsed?: number;
  continuesLeft?: number;
  seconds?: number;
  askInitials?: boolean;
  stageName?: string;
  table?: ScoreEntry[];
  highlight?: number;
  reducedFlash?: boolean;
  musicVolume?: number;
  sfxVolume?: number;
  status?: string;
  message?: string;
  stageLabel?: string;
  stagesUnlocked?: number;
  stagesTotal?: number;
  /** Results: the name of a stage this clear just unlocked. */
  unlocked?: string;
}

const CONTROLS =
  'Click to shoot · Right click, R, Space or the screen edge to reload · F fullscreen · P pause';
const DIFFS: Difficulty[] = ['easy', 'normal', 'hard'];

/** What a click on a screen's background does (buttons carry their own data-action). */
export const DEFAULT_ACTION: Partial<Record<ScreenName, string>> = {
  title: 'start',
  paused: 'resume',
  continue: 'continue',
  results: 'done',
  scores: 'title',
  credits: 'title',
};

const pad = (n: number) => String(n).padStart(7, '0');
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const btn = (action: string, label: string, extra = '') =>
  `<button type="button" class="btn ${extra}" data-action="${action}">${label}</button>`;

/** Title, pause, continue, results, high scores, options and error screens: one element, rewritten per screen. */
export class Screens {
  readonly root = document.getElementById('screen')!;
  current: ScreenName = 'loading';
  /** False while the results screen waits for initials: background clicks must not skip the entry. */
  backgroundClicks = true;

  show(name: ScreenName, d: ScreenData = {}): void {
    this.current = name;
    this.backgroundClicks = true;
    document.getElementById('stage')!.classList.toggle('playing', name === 'playing');
    this.root.classList.toggle('hidden', name === 'playing');
    this.root.dataset.screen = name;
    this.root.innerHTML = this.render(name, d);
    if (name === 'results' && d.askInitials) {
      this.backgroundClicks = false;
      const input = this.root.querySelector<HTMLInputElement>('#initials');
      input?.focus();
    }
  }

  /** Fills the loading bar, 0..1. */
  setProgress(fraction: number): void {
    const bar = this.root.querySelector<HTMLElement>('#load-bar');
    const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
    if (bar) bar.style.width = `${pct}%`;
    const label = this.root.querySelector('#load-pct');
    if (label) label.textContent = `${pct}%`;
  }

  /** Updates the continue countdown without rebuilding the screen. */
  setCountdown(seconds: number): void {
    const el = this.root.querySelector('#continue-count');
    if (el && el.textContent !== String(seconds)) el.textContent = String(seconds);
  }

  private render(name: ScreenName, d: ScreenData): string {
    switch (name) {
      case 'loading':
        return `<h1 class="logo">REAL COP 2</h1>
          <div class="loadbar"><div id="load-bar"></div></div>
          <p class="small">LOADING <span id="load-pct">0%</span></p>`;
      case 'title':
        return `<h1 class="logo">REAL COP 2</h1>
          <p class="blink">CLICK TO START</p>
          <div class="menu">${btn('stage', d.stageLabel ?? 'STAGE 1', 'primary')}</div>
          ${
            (d.stagesTotal ?? 0) > (d.stagesUnlocked ?? 0)
              ? `<p class="small">CLEAR A STAGE TO UNLOCK THE NEXT (${d.stagesUnlocked}/${d.stagesTotal} OPEN)</p>`
              : ''
          }
          <div class="menu">
            ${btn('difficulty', `DIFFICULTY: ${(d.difficulty ?? 'normal').toUpperCase()}`)}
            ${btn('scores', 'HIGH SCORES')}
            ${btn('options', 'OPTIONS')}
            ${btn('fullscreen', 'FULLSCREEN')}
            ${btn('credits', 'CREDITS')}
          </div>
          ${d.best ? `<p class="small">BEST ${pad(d.best)}</p>` : ''}
          <p class="controls">${CONTROLS}</p>`;
      case 'paused':
        return `<h2>PAUSED</h2><p class="blink">CLICK TO RESUME</p><p class="controls">${CONTROLS}</p>`;
      case 'continue':
        return `<h2>CONTINUE?</h2>
          <div class="countdown" id="continue-count">${d.seconds ?? 10}</div>
          <p class="small">CONTINUES LEFT ${d.continuesLeft ?? 0} · YOUR SCORE STARTS AGAIN FROM ZERO</p>
          <div class="menu">${btn('continue', 'CONTINUE', 'primary')}${btn('giveup', 'GIVE UP')}</div>`;
      case 'results': {
        const rank = d.cleared && d.rank ? `<div class="rank rank-${d.rank}">${d.rank}</div>` : '';
        const entry = d.askInitials
          ? `<form class="initials" data-form="initials">
              <label for="initials">NEW HIGH SCORE! ENTER YOUR INITIALS</label>
              <input id="initials" maxlength="3" autocomplete="off" spellcheck="false" />
              ${btn('submit-initials', 'OK', 'primary')}
            </form>`
          : `<p class="blink">CLICK TO CONTINUE</p>`;
        return `<h2>${d.cleared ? 'STAGE CLEAR' : 'GAME OVER'}</h2>
          ${rank}
          <div class="stats">SCORE ${pad(d.score ?? 0)}<br>HIT RATE ${d.accuracy ?? 0}%${
            d.continuesUsed ? `<br>CONTINUES ${d.continuesUsed}` : ''
          }</div>
          ${d.unlocked ? `<p class="unlock">NEW STAGE UNLOCKED: ${esc(d.unlocked.toUpperCase())}</p>` : ''}
          ${entry}`;
      }
      case 'scores': {
        const rows = (d.table ?? [])
          .map(
            (e, i) =>
              `<tr class="${i === d.highlight ? 'me' : ''}"><td>${i + 1}</td><td>${esc(e.initials)}</td><td>${pad(e.score)}</td><td>${e.rank}</td></tr>`,
          )
          .join('');
        const tabs = DIFFS.map((x) =>
          btn(`scores-${x}`, x.toUpperCase(), x === d.difficulty ? 'on' : ''),
        ).join('');
        return `<h2>HIGH SCORES</h2>
          <p class="small">${esc(d.stageName ?? '')}</p>
          <div class="menu tabs">${tabs}</div>
          <table class="table">${rows || '<tr><td colspan="4">NO SCORES YET</td></tr>'}</table>
          <p class="blink">CLICK TO CONTINUE</p>`;
      }
      case 'options': {
        const diffs = DIFFS.map((x) => btn(`set-${x}`, x.toUpperCase(), x === d.difficulty ? 'on' : '')).join(
          '',
        );
        return `<h2>OPTIONS</h2>
          <div class="option"><span>DIFFICULTY</span><div class="menu">${diffs}</div></div>
          <div class="option"><span>MUSIC</span>${btn('music', `${Math.round((d.musicVolume ?? 0) * 100)}%`)}</div>
          <div class="option"><span>SOUND EFFECTS</span>${btn('sfx', `${Math.round((d.sfxVolume ?? 0) * 100)}%`)}</div>
          <div class="option"><span>REDUCED FLASH</span>${btn('flash', d.reducedFlash ? 'ON' : 'OFF', d.reducedFlash ? 'on' : '')}</div>
          <div class="option"><span>SAVE DATA</span><div class="menu">${btn('export', 'EXPORT')}${btn('import', 'IMPORT')}</div></div>
          <input type="file" id="import-file" accept="application/json,.json" hidden />
          <p class="small" id="options-status">${esc(d.status ?? '')}</p>
          ${btn('title', 'BACK', 'primary')}`;
      }
      case 'credits':
        return `<h2>CREDITS</h2>
          <div class="credits">
            <p><b>REAL COP 2</b> · an original on-rails shooter</p>
            <p>Built by: <b>Anurag</b></p>
            <p>Code, stage, characters, music and sound effects made for this game.<br>
              Music and effects are synthesized live in your browser; there are no audio files.</p>
            <p>3D rendering: <b>three.js</b> · MIT licence ·
              <a href="${import.meta.env.BASE_URL}licenses/three.txt" target="_blank" rel="noopener">read the licence</a></p>
            <p>Built with Vite and TypeScript.</p>
          </div>
          <p class="blink">CLICK TO CONTINUE</p>`;
      case 'error':
        return `<h2>Something went wrong</h2><p>${esc(d.message ?? '')}</p>`;
      case 'playing':
        return '';
    }
  }
}
