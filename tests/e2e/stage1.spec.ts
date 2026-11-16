import { expect, test } from '@playwright/test';
import type { DebugHooks } from '../../src/debug/hooks.ts';
import { openGame, snap, watchErrors } from './game.ts';

test.describe('stage 1 (M3 acceptance)', () => {
  test('plays start to finish from JSON and one .glb, through real screen-space shots', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    await openGame(page, 'stage=1&seed=42&test=1');
    // An in-page bot: every shot goes through projection to the screen and back to a ray,
    // exactly as a click would. Runs inside the page so 4,000 steps take seconds, not minutes.
    const result = await page.evaluate(() => {
      const g = (window as unknown as { __game: DebugHooks }).__game;
      g.start();
      const seenAt = new Map<number, number>();
      for (let i = 0; i < 20_000; i++) {
        const s = g.state();
        if (s.phase === 'stageClear' || s.phase === 'gameOver') {
          return { phase: s.phase, stop: s.stop, score: s.score.score, lives: s.lives, steps: i };
        }
        for (const a of s.actors) if (!seenAt.has(a.id)) seenAt.set(a.id, s.frame);
        const target = s.actors
          .filter((a) => !a.civilian && ['entering', 'waiting', 'aiming'].includes(a.phase))
          .filter((a) => s.frame - seenAt.get(a.id)! >= 30)
          .sort((a, b) => a.id - b.id)[0];
        if (s.weapon.ammo === 0) {
          if (s.weapon.reloading === 0) g.reload();
        } else if (target && s.weapon.cooldown === 0) {
          const p = g.zoneScreen(target.id, 'body');
          if (p) g.fireAt(p.x, p.y);
        }
        g.stepFrames(1);
      }
      return { phase: 'timeout', stop: -1, score: 0, lives: 0, steps: 0 };
    });
    expect(result.phase).toBe('stageClear');
    expect(result.stop).toBe(8);
    expect(result.lives).toBe(5);
    // Same 43 straight body hits as the simulation bot, now through the browser's camera.
    expect(result.score).toBe(37_000);
    await page.evaluate(() => (window as unknown as { __game: DebugHooks }).__game.stepFrames(80));
    await expect(page.locator('#screen h2')).toHaveText('STAGE CLEAR');
    await snap(page, 'stage1-clear');
    expect(errors).toEqual([]);
  });

  test('screenshot tour: every stop with its first wave in', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=1&seed=42&test=1&god=1');
    await g.start();
    for (let stop = 1; stop <= 9; stop++) {
      await g.skipToStop(stop);
      // Travel from the previous stop, then 2.5 s for the wave to come in.
      for (let i = 0; i < 40; i++) {
        const events = await g.stepFrames(30);
        if (events.some((e) => e.type === 'StopReached')) break;
      }
      await g.stepFrames(150);
      const state = await g.state();
      expect(state.stop, `stop ${stop}`).toBe(stop - 1);
      expect(state.actors.length, `stop ${stop} has actors`).toBeGreaterThan(0);
      await snap(page, `stage1-stop-${stop}`);
    }
    expect(errors).toEqual([]);
  });
});
