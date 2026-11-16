import { expect, test, type Page } from '@playwright/test';
import type { DebugHooks } from '../../src/debug/hooks.ts';
import { openGame, snap, watchErrors } from './game.ts';

/** Seeds a save before the page loads: these stages already cleared. */
async function withCleared(page: Page, cleared: string[]) {
  await page.addInitScript((list) => {
    localStorage.setItem(
      'realcop2.save',
      JSON.stringify({ version: 1, options: { difficulty: 'normal' }, cleared: list, scores: {} }),
    );
  }, cleared);
}

const stageFiles = (urls: string[], id: string) => urls.filter((u) => u.includes(`/${id}.`));

test.describe('M6: stage select and lazy loading', () => {
  test('the title downloads only stage 1; stage 2 downloads when chosen', async ({ page }) => {
    const errors = watchErrors(page);
    const urls: string[] = [];
    page.on('request', (r) => urls.push(r.url()));
    await withCleared(page, ['stage1']);
    await openGame(page, 'test=1');
    await expect(page.getByRole('button', { name: 'STAGE 1: METRO STATION' })).toBeVisible();
    expect(stageFiles(urls, 'stage1').length).toBeGreaterThan(0);
    expect(stageFiles(urls, 'stage2')).toEqual([]);
    expect(stageFiles(urls, 'stage3')).toEqual([]);

    await page.getByRole('button', { name: 'STAGE 1: METRO STATION' }).click();
    await expect(page.getByRole('button', { name: 'STAGE 2: STUDIO BACKLOT' })).toBeVisible();
    expect(stageFiles(urls, 'stage2').some((u) => u.endsWith('stage2.glb'))).toBe(true);
    expect(stageFiles(urls, 'stage3')).toEqual([]);
    await snap(page, 'title-stage2');

    // Stage 3 is still locked, so the button wraps back to stage 1.
    await page.getByRole('button', { name: 'STAGE 2: STUDIO BACKLOT' }).click();
    await expect(page.getByRole('button', { name: 'STAGE 1: METRO STATION' })).toBeVisible();
    expect(stageFiles(urls, 'stage3')).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('with nothing cleared, only stage 1 is open', async ({ page }) => {
    await openGame(page, 'test=1');
    await expect(page.locator('#screen')).toContainText('CLEAR A STAGE TO UNLOCK THE NEXT (1/3 OPEN)');
    await page.getByRole('button', { name: 'STAGE 1: METRO STATION' }).click();
    await expect(page.getByRole('button', { name: 'STAGE 1: METRO STATION' })).toBeVisible();
  });

  for (const { stage, name, stops } of [
    { stage: 2, name: 'STUDIO BACKLOT', stops: 9 },
    { stage: 3, name: 'HILLSIDE DAM', stops: 9 },
  ]) {
    test(`stage ${stage} screenshot tour: every stop with its first wave in`, async ({ page }) => {
      test.setTimeout(150_000);
      const errors = watchErrors(page);
      const g = await openGame(page, `stage=${stage}&seed=42&test=1&god=1`);
      await expect(page.getByRole('button', { name: `STAGE ${stage}: ${name}` })).toBeVisible();
      for (let stop = 1; stop <= stops; stop++) {
        await g.skipToStop(stop);
        for (let i = 0; i < 40; i++) {
          const events = await g.stepFrames(30);
          if (events.some((e) => e.type === 'StopReached')) break;
        }
        await g.stepFrames(150);
        const state = await g.state();
        expect(state.stop, `stop ${stop}`).toBe(stop - 1);
        expect(state.actors.length, `stop ${stop} has actors`).toBeGreaterThan(0);
        await snap(page, `stage${stage}-stop-${stop}`);
        const info = await page.evaluate(() =>
          (window as unknown as { __game: DebugHooks }).__game.renderInfo(),
        );
        expect(info.calls, `stop ${stop} draw calls`).toBeLessThan(150);
      }
      expect(errors).toEqual([]);
    });
  }
});
