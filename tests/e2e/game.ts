import { expect, type Page } from '@playwright/test';
import type { DebugHooks } from '../../src/debug/hooks.ts';
import type { GameEvent, GameState, HitZone } from '../../src/sim/index.ts';

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
    skipToStop: (n: number) => call<void>('skipToStop', n),
    menu: (action: string) => call<void>('menu', action),
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
  await expect(page.locator('#screen')).toContainText('CLICK TO START');
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

/**
 * An in-page bot: every shot goes through projection to the screen and back to a ray, exactly as
 * a click would. It runs inside the page so thousands of steps take seconds, not minutes.
 */
export async function playToEnd(page: Page) {
  return page.evaluate(() => {
    const g = (window as unknown as { __game: DebugHooks }).__game;
    const seenAt = new Map<number, number>();
    for (let i = 0; i < 20_000; i++) {
      const s = g.state();
      if (s.phase === 'stageClear' || s.phase === 'gameOver') {
        return { phase: s.phase, stop: s.stop, score: s.score.score, lives: s.lives, result: s.result };
      }
      for (const a of s.actors) if (!seenAt.has(a.id)) seenAt.set(a.id, s.frame);
      const target = s.actors
        .filter((a) => ['enemy', 'boss', 'projectile'].includes(a.role))
        .filter((a) => ['entering', 'waiting', 'aiming', 'flying'].includes(a.phase))
        .filter((a) => s.frame - seenAt.get(a.id)! >= 30)
        .sort((a, b) => Number(b.role === 'projectile') - Number(a.role === 'projectile') || a.id - b.id)[0];
      if (s.weapon.ammo === 0) {
        if (s.weapon.reloading === 0) g.reload();
      } else if (target && s.weapon.cooldown === 0) {
        const p = g.aimScreen(target.id);
        if (p) g.fireAt(p.x, p.y);
      }
      g.stepFrames(1);
    }
    return { phase: 'timeout', stop: -1, score: 0, lives: 0, result: null };
  });
}
