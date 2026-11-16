export type ScreenName = 'loading' | 'title' | 'playing' | 'paused' | 'results' | 'error';

const CONTROLS =
  'Click to shoot · Right click, R, Space or the screen edge to reload · F fullscreen · P pause';

/** Title, pause, results and error screens: one element, rewritten per screen. */
export class Screens {
  private readonly root = document.getElementById('screen')!;
  current: ScreenName = 'loading';

  show(
    name: ScreenName,
    data: { score?: number; cleared?: boolean; accuracy?: number; message?: string } = {},
  ): void {
    this.current = name;
    document.getElementById('stage')!.classList.toggle('playing', name === 'playing');
    this.root.classList.toggle('hidden', name === 'playing');
    switch (name) {
      case 'loading':
        this.root.innerHTML = `<h1 class="logo">REAL COP 2</h1><p class="blink">Loading…</p>`;
        break;
      case 'title':
        this.root.innerHTML = `<h1 class="logo">REAL COP 2</h1><p class="blink">CLICK TO START</p><p class="controls">${CONTROLS}</p>`;
        break;
      case 'paused':
        this.root.innerHTML = `<h2>PAUSED</h2><p class="blink">CLICK TO RESUME</p><p class="controls">${CONTROLS}</p>`;
        break;
      case 'results':
        this.root.innerHTML = `<h2>${data.cleared ? 'STAGE CLEAR' : 'GAME OVER'}</h2>
          <div class="stats">SCORE ${String(data.score ?? 0).padStart(7, '0')}<br>HIT RATE ${data.accuracy ?? 0}%</div>
          <p class="blink">CLICK TO PLAY AGAIN</p>`;
        break;
      case 'error':
        this.root.innerHTML = `<h2>Something went wrong</h2><p>${escapeHtml(data.message ?? '')}</p>`;
        break;
      case 'playing':
        break;
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
