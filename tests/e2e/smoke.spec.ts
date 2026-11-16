import { expect, test } from '@playwright/test';
import { openGame, watchErrors } from './game';

test('boots to the title, starts on click, and clears stop 1 of stage 1', async ({ page }) => {
  const errors = watchErrors(page);
  const g = await openGame(page, 'stage=1&seed=42&debug=1');
  await expect(page.locator('#version')).toContainText('build ');

  await page.locator('#screen').click();
  await expect(page.locator('#screen')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();

  // Play stop 1 through the real click path: shoot each enemy in the body as soon as it is visible.
  for (let i = 0; i < 600; i++) {
    const state = await g.state();
    if (state.stop > 0) break;
    const target = state.actors.find(
      (a) => !a.civilian && ['entering', 'waiting', 'aiming'].includes(a.phase),
    );
    if (target && state.weapon.cooldown === 0) {
      if (state.weapon.ammo === 0) await page.keyboard.press('r');
      else {
        const p = (await g.zoneScreen(target.id, 'body'))!;
        await g.fireAt(p.x, p.y);
      }
    }
    await g.stepFrames(1);
  }
  const state = await g.state();
  expect(state.stop).toBe(1);
  expect(state.lives).toBe(5);
  expect(state.score.score).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
