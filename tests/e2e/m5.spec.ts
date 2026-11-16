import { expect, test } from '@playwright/test';
import type { DebugHooks } from '../../src/debug/hooks.ts';
import { hooks, openGame, snap, watchErrors } from './game.ts';

const audio = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __game: DebugHooks }).__game.audio());

test.describe('M5: audio, credits, options, loading', () => {
  test('sound unlocks on the first click; shots, reloads, hits and warnings make their sounds', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=range&seed=42&test=1');
    expect((await audio(page)).unlocked).toBe(false);
    await page.getByText('CLICK TO START').click();
    expect((await audio(page)).unlocked).toBe(true);

    await g.stepFrames(60);
    const target = (await g.state()).actors.find((a) => a.role === 'enemy')!;
    const p = (await g.zoneScreen(target.id, 'head'))!;
    await g.fireAt(p.x, p.y);
    await g.stepFrames(10);
    await page.keyboard.press('r');
    await g.stepFrames(200); // long enough for a sight to turn red and an enemy to fire
    const played = (await audio(page)).played;
    expect(played.revolver).toBe(1);
    expect(played.head).toBe(1);
    expect(played.reload).toBe(1);
    expect(played.reloaded).toBe(1);
    expect(played.warn).toBeGreaterThan(0);
    expect(played.playerHit).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });

  test('credits name the third-party licence, and the licence file is served', async ({ page, request }) => {
    await openGame(page, 'stage=1&seed=42&test=1');
    await page.getByRole('button', { name: 'CREDITS' }).click();
    await expect(page.locator('#screen h2')).toHaveText('CREDITS');
    await expect(page.locator('.credits')).toContainText('three.js');
    const href = await page.getByRole('link', { name: 'read the licence' }).getAttribute('href');
    const res = await request.get(new URL(href!, page.url()).toString());
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('MIT License');
    await snap(page, 'credits');
    await page.locator('#screen').click({ position: { x: 20, y: 20 } });
    await expect(page.locator('#screen')).toContainText('CLICK TO START');
  });

  test('music and sound volumes cycle and are saved', async ({ page }) => {
    await openGame(page, 'stage=1&seed=42&test=1');
    await page.getByRole('button', { name: 'OPTIONS' }).click();
    await page.getByRole('button', { name: '60%' }).click();
    await expect(page.getByRole('button', { name: '80%' }).first()).toBeVisible();
    await page.reload();
    await page.getByRole('button', { name: 'OPTIONS' }).click();
    const music = page.locator('.option', { hasText: 'MUSIC' }).getByRole('button');
    await expect(music).toHaveText('80%');
  });

  test('the loading screen hands over to the title with the stage model loaded', async ({ page }) => {
    await page.goto('./?stage=1&test=1');
    await expect(page.locator('#screen')).toContainText('CLICK TO START');
    const g = hooks(page);
    expect((await g.state()).stop).toBe(0);
    const info = await page.evaluate(() => (window as unknown as { __game: DebugHooks }).__game.renderInfo());
    expect(info.triangles).toBeGreaterThan(1000);
  });
});
