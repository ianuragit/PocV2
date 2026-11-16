import { App } from './app.ts';
import { installDebugHooks } from './debug/hooks.ts';
import { SaveStore } from './save/saveStore.ts';
import type { Difficulty } from './sim/index.ts';
import { Screens } from './ui/screens.ts';
import { loadGameData } from './view/data.ts';

const STAGES: Record<string, string> = { '1': 'stage1', stage1: 'stage1', range: 'range' };
const DIFFICULTIES = new Set<string>(['easy', 'normal', 'hard']);

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

async function boot(): Promise<void> {
  document.querySelector('#version')!.textContent = `build ${__COMMIT__}`;
  const params = new URLSearchParams(location.search);
  const debug = params.get('debug') === '1';
  const stageId = STAGES[params.get('stage') ?? '1'] ?? 'stage1';
  const difficulty = params.get('difficulty');
  const stop = Math.max(0, Number(params.get('stop') ?? '1') - 1);

  try {
    const data = await loadGameData(stageId);
    const app = new App({
      data,
      stageId,
      stageName: (data.stage as { name?: string }).name ?? stageId,
      difficulty: difficulty && DIFFICULTIES.has(difficulty) ? (difficulty as Difficulty) : null,
      seed: Number(params.get('seed') ?? Date.now() % 1_000_000),
      startStop: Number.isInteger(stop) ? stop : 0,
      god: params.get('god') === '1',
      debug,
      save: new SaveStore(storage()),
    });
    // Test hooks: always in dev; in a built site only with debug=1 (draws hit zones) or test=1 (does not).
    if (import.meta.env.DEV || debug || params.get('test') === '1') installDebugHooks(app);
  } catch (err) {
    console.error(err);
    new Screens().show('error', { message: err instanceof Error ? err.message : String(err) });
  }
}

void boot();
