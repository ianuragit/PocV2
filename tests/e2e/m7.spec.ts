import { expect, test } from '@playwright/test';
import type { DebugHooks } from '../../src/debug/hooks.ts';
import { openGame, playToEnd, snap, watchErrors } from './game.ts';

const renderInfo = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __game: DebugHooks }).__game.renderInfo());

test.describe('M7: robustness and accessibility', () => {
  test('losing the WebGL context pauses the game; it resumes and draws again when restored', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=1&seed=42&test=1');
    await g.start();
    await g.stepFrames(60);
    const before = await renderInfo(page);
    await page.evaluate(() => {
      const gl = document.querySelector<HTMLCanvasElement>('#game')!.getContext('webgl2')!;
      (window as unknown as { __lose: WEBGL_lose_context }).__lose = gl.getExtension('WEBGL_lose_context')!;
      (window as unknown as { __lose: WEBGL_lose_context }).__lose.loseContext();
    });
    await expect(page.locator('#screen h2')).toHaveText('PAUSED');
    await expect(page.locator('#screen')).toContainText('GRAPHICS RESET');
    expect((await g.state()).paused).toBe(true);

    await page.evaluate(() => (window as unknown as { __lose: WEBGL_lose_context }).__lose.restoreContext());
    await expect(page.locator('#screen')).toContainText('GRAPHICS RESTORED');
    await page.locator('#screen').click({ position: { x: 20, y: 20 } });
    await g.stepFrames(30);
    await expect(page.locator('#screen')).toBeHidden();
    // The same scene draws again: same draw calls and triangles as before the loss.
    await g.skipToStop(1);
    await g.hold(true);
    const after = await renderInfo(page);
    expect(after.triangles).toBeGreaterThan(1000);
    expect(after.calls).toBe(before.calls);
    await snap(page, 'after-context-restore');
    expect(errors).toEqual([]);
  });

  test('reduced flash softens the damage flash', async ({ page }) => {
    await openGame(page, 'stage=range&seed=42&test=1');
    await page.getByRole('button', { name: 'OPTIONS' }).click();
    await page.getByRole('button', { name: 'OFF' }).click();
    await page.getByRole('button', { name: 'BACK' }).click();
    const g = (await import('./game.ts')).hooks(page);
    await g.start();
    for (let i = 0; i < 40 && (await g.state()).lives === 5; i++) await g.stepFrames(10);
    expect((await g.state()).lives).toBe(4);
    await expect(page.locator('#flash')).toHaveClass(/reduced/);
    const anim = await page.locator('#flash').evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('flash-reduced');
  });

  test.describe('on a touch screen', () => {
    test.use({ hasTouch: true });

    test('an on-screen button reloads without firing', async ({ page }) => {
      const errors = watchErrors(page);
      const g = await openGame(page, 'stage=range&seed=42&test=1');
      await expect(page.locator('#touch-reload')).toBeHidden();
      await g.start();
      await expect(page.locator('#touch-reload')).toBeVisible();
      await g.stepFrames(40);
      await page.locator('#stage').tap({ position: { x: 640, y: 300 } });
      await g.stepFrames(10);
      expect((await g.state()).weapon.ammo).toBe(5);
      const shots = (await g.state()).score.shots;
      await page.locator('#touch-reload').tap();
      const events = await g.stepFrames(30);
      expect(events.map((e) => e.type)).toContain('ReloadStarted');
      expect((await g.state()).score.shots).toBe(shots);
      expect((await g.state()).weapon.ammo).toBe(6);
      await snap(page, 'touch-reload');
      expect(errors).toEqual([]);
    });
  });
});

test.describe('M7: clean runs', () => {
  for (const { stage, score } of [
    { stage: 2, score: 67_700 },
    { stage: 3, score: 65_300 },
  ]) {
    test(`stage ${stage} plays start to finish in the browser with no console errors`, async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      await openGame(page, `stage=${stage}&seed=42&test=1`);
      await page.getByText('CLICK TO START').click();
      const result = await playToEnd(page);
      expect(result.phase).toBe('stageClear');
      expect(result.score).toBe(score);
      expect(result.result?.continuesUsed).toBe(0);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('M7: every enemy can be shot from the screen', () => {
  for (const { stage, stops } of [
    { stage: 1, stops: 10 },
    { stage: 2, stops: 9 },
    { stage: 3, stops: 9 },
  ]) {
    test(`stage ${stage}: every enemy appears on screen, away from the reload border`, async ({ page }) => {
      test.setTimeout(120_000);
      await openGame(page, `stage=${stage}&seed=42&test=1&god=1`);
      const offscreen = await page.evaluate((stops) => {
        const g = (window as unknown as { __game: DebugHooks }).__game;
        const stageEl = document.querySelector('#stage')!;
        const w = stageEl.clientWidth;
        const h = stageEl.clientHeight;
        const bad: string[] = [];
        for (let stop = 1; stop <= stops; stop++) {
          g.skipToStop(stop);
          for (let i = 0; i < 1500; i++) {
            g.stepFrames(1);
            const s = g.state();
            if (s.stop !== stop - 1) break;
            for (const a of s.actors) {
              if (!['enemy', 'boss'].includes(a.role) || !['waiting', 'aiming'].includes(a.phase)) continue;
              const p = g.aimScreen(a.id);
              // The reload border is 4% from each edge; keep targets a little further in than that.
              const ok = p && p.x > w * 0.06 && p.x < w * 0.94 && p.y > h * 0.06 && p.y < h * 0.94;
              const key = `stop ${stop}: ${a.type} #${a.id}`;
              if (!ok && !bad.includes(key)) bad.push(key);
            }
          }
        }
        return bad;
      }, stops);
      expect(offscreen).toEqual([]);
    });
  }
});
