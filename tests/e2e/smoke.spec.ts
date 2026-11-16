import { expect, test } from '@playwright/test';

type GameState = { frames: number; started: boolean; commit: string };

test('title boots, renders, and click-to-start works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await page.goto('./?debug=1');
  await expect(page.locator('#title h1')).toHaveText('REAL COP 2');
  await expect(page.locator('#version')).toContainText('build ');

  const state = () =>
    page.evaluate(() => (window as unknown as { __game: { state(): GameState } }).__game.state());
  await expect.poll(async () => (await state()).frames).toBeGreaterThan(10);
  await page.screenshot({ path: 'test-results/screenshots/title.png' });

  await page.locator('#title').click();
  await expect(page.locator('#title')).toBeHidden();
  expect((await state()).started).toBe(true);
  await page.screenshot({ path: 'test-results/screenshots/cube.png' });

  expect(errors).toEqual([]);
});
