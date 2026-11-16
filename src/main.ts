import { App } from './app';
import { installDebugHooks } from './debug/hooks';
import type { Difficulty } from './sim';
import { Screens } from './ui/screens';
import { loadGameData } from './view/data';

const STAGES: Record<string, string> = { '1': 'stage1', stage1: 'stage1', range: 'range' };
const DIFFICULTIES = new Set<Difficulty>(['easy', 'normal', 'hard']);

async function boot(): Promise<void> {
  document.querySelector('#version')!.textContent = `build ${__COMMIT__}`;
  const params = new URLSearchParams(location.search);
  const debug = params.get('debug') === '1';
  const stageId = STAGES[params.get('stage') ?? '1'] ?? 'stage1';
  const difficulty = (params.get('difficulty') ?? 'normal') as Difficulty;
  const stop = Math.max(0, Number(params.get('stop') ?? '1') - 1);

  try {
    const data = await loadGameData(stageId);
    const app = new App({
      data,
      difficulty: DIFFICULTIES.has(difficulty) ? difficulty : 'normal',
      seed: Number(params.get('seed') ?? Date.now() % 1_000_000),
      startStop: Number.isInteger(stop) ? stop : 0,
      god: params.get('god') === '1',
      debug,
    });
    if (import.meta.env.DEV || debug) installDebugHooks(app);
  } catch (err) {
    console.error(err);
    new Screens().show('error', { message: err instanceof Error ? err.message : String(err) });
  }
}

void boot();
