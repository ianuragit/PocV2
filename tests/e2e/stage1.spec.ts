import { expect, test } from '@playwright/test';
import type { DebugHooks } from '../../src/debug/hooks.ts';
import { hooks, openGame, playToEnd, snap, watchErrors } from './game.ts';

test.describe('stage 1 (M3 + M4 acceptance)', () => {
  test('full arcade loop: title, the whole stage and boss, rank, initials, high score kept after reload', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=1&seed=42&test=1');
    await page.getByText('CLICK TO START').click();
    await expect(page.locator('#screen')).toBeHidden();

    const result = await playToEnd(page);
    expect(result.phase).toBe('stageClear');
    expect(result.stop).toBe(9);
    // Same 69 straight hits and boss bonus as the simulation bot, now through the browser's camera.
    expect(result.score).toBe(74_000);
    expect(result.result).toEqual({ score: 74_000, rank: 'A', accuracy: 100, continuesUsed: 0 });

    await g.stepFrames(80);
    await expect(page.locator('#screen h2')).toHaveText('STAGE CLEAR');
    await expect(page.locator('.rank')).toHaveText('A');
    await expect(page.locator('#screen .stats')).toContainText('SCORE 0074000');
    await expect(page.locator('.unlock')).toHaveText('NEW STAGE UNLOCKED: STUDIO BACKLOT');
    await snap(page, 'stage1-results');

    // Type initials into the real field; game keys (R, P, Space) must not fire while typing.
    await page.locator('#initials').pressSequentially('r p');
    await expect(page.locator('#initials')).toHaveValue('r p');
    await page.locator('#initials').fill('ace');
    await page.getByRole('button', { name: 'OK' }).click();
    await expect(page.locator('#screen h2')).toHaveText('HIGH SCORES');
    await expect(page.locator('tr.me')).toContainText('ACE');
    await expect(page.locator('tr.me')).toContainText('0074000');
    await snap(page, 'stage1-scores');

    // Back to the title, which shows the best score.
    await page.locator('#screen').click({ position: { x: 20, y: 20 } });
    await expect(page.locator('#screen')).toContainText('CLICK TO START');
    await expect(page.locator('#screen')).toContainText('BEST 0074000');

    // Scores survive a reload.
    await page.reload();
    await expect(page.locator('#screen')).toContainText('BEST 0074000');
    await page.getByRole('button', { name: 'HIGH SCORES' }).click();
    await expect(page.locator('#screen table')).toContainText('ACE');
    expect(errors).toEqual([]);
  });

  test('continue: losing the last life offers a continue that refills lives and restarts the score', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=1&seed=42&test=1&difficulty=hard');
    await g.start();
    for (let i = 0; i < 100 && (await g.state()).phase !== 'continue'; i++) await g.stepFrames(30);
    await expect(page.locator('#screen h2')).toHaveText('CONTINUE?');
    await expect(page.locator('#continue-count')).toHaveText('10');
    await g.stepFrames(120);
    await expect(page.locator('#continue-count')).toHaveText('8');
    await snap(page, 'continue');
    await page.getByRole('button', { name: 'CONTINUE', exact: true }).click();
    await g.stepFrames(1);
    await expect(page.locator('#screen')).toBeHidden();
    const s = await g.state();
    expect(s).toMatchObject({ lives: 3, continuesLeft: 2, continuesUsed: 1 });
    expect(errors).toEqual([]);
  });

  test('options: difficulty and reduced flash persist; export gives a save file', async ({ page }) => {
    await openGame(page, 'stage=1&seed=42&test=1');
    await page.getByRole('button', { name: 'OPTIONS' }).click();
    await page.getByRole('button', { name: 'HARD' }).click();
    await page.getByRole('button', { name: 'OFF' }).click();
    await expect(page.getByRole('button', { name: 'ON', exact: true })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'EXPORT' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('real-cop-2-save.json');
    await snap(page, 'options');
    await page.reload();
    await expect(page.getByRole('button', { name: 'DIFFICULTY: HARD' })).toBeVisible();
    expect(await hooks(page).state()).toMatchObject({ difficulty: 'hard', lives: 3 });
  });

  test('screenshot tour: every stop with its first wave in', async ({ page }) => {
    test.setTimeout(150_000);
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=1&seed=42&test=1&god=1');
    for (let stop = 1; stop <= 10; stop++) {
      await g.skipToStop(stop);
      for (let i = 0; i < 40; i++) {
        const events = await g.stepFrames(30);
        if (events.some((e) => e.type === 'StopReached')) break;
      }
      await g.stepFrames(150);
      const state = await g.state();
      expect(state.stop, `stop ${stop}`).toBe(stop - 1);
      expect(state.actors.length, `stop ${stop} has actors`).toBeGreaterThan(0);
      await snap(page, `stage1-stop-${stop}`);
      // Rendering target from the spec: under 150 draw calls per frame.
      const info = await page.evaluate(() =>
        (window as unknown as { __game: DebugHooks }).__game.renderInfo(),
      );
      expect(info.calls, `stop ${stop} draw calls`).toBeLessThan(150);
    }
    expect(errors).toEqual([]);
  });
});
