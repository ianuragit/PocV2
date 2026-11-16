import { expect, type Page } from '@playwright/test';
import type { DebugHooks } from '../../src/debug/hooks';
import type { GameEvent, GameState, HitZone } from '../../src/sim';

/** Typed access to window.__game from Playwright. */
export function hooks(page: Page) {
  const call = <T>(fn: string, ...args: unknown[]) =>
    page.evaluate(
      ([fn, args]) => {
        const g = (window as unknown as { __game: Record<string, (...a: unknown[]) => unknown> }).__game;
        return g[fn as string]!(...(args as unknown[]));
      },
      [fn, args] as const,
    ) as Promise<T>;
  return {
    state: () => call<GameState>('state'),
    events: () => call<GameEvent[]>('events'),
    start: () => call<void>('start'),
    hold: (on: boolean) => call<void>('hold', on),
    stepFrames: (n: number) => call<GameEvent[]>('stepFrames', n),
    fireAt: (x: number, y: number) => call<void>('fireAt', x, y),
    zoneScreen: (id: number, zone: HitZone) => call<{ x: number; y: number } | null>('zoneScreen', id, zone),
    rings: () => call<ReturnType<DebugHooks['rings']>>('rings'),
  };
}

/** Collects console errors and page errors; assert it is empty at the end of a test. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}

export async function openGame(page: Page, query: string) {
  await page.goto(`./?${query}`);
  await expect(page.locator('#screen h1')).toHaveText('REAL COP 2');
  await expect(page.locator('#screen')).toContainText('Click to start');
  const g = hooks(page);
  await g.hold(true);
  return g;
}

/** Screenshot after two animation frames, so the compositor has committed what the page last drew. */
export async function snap(page: Page, name: string) {
  await page.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
  await page.screenshot({ path: `test-results/screenshots/${name}.png` });
}
