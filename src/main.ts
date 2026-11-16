import { Renderer } from './view/renderer';

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const title = document.querySelector<HTMLDivElement>('#title')!;
const version = document.querySelector<HTMLDivElement>('#version')!;

version.textContent = `build ${__COMMIT__}`;

const view = new Renderer(canvas);
let frames = 0;
let started = false;
let last = performance.now();

function tick(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  view.frame(dt);
  frames++;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

title.addEventListener('click', () => {
  started = true;
  title.classList.add('hidden');
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

if (
  import.meta.env.DEV ||
  import.meta.env.MODE === 'test' ||
  new URLSearchParams(location.search).has('debug')
) {
  (window as unknown as { __game: unknown }).__game = {
    state: () => ({ frames, started, commit: __COMMIT__ }),
  };
}
