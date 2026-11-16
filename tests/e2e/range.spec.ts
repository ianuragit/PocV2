import { expect, test } from '@playwright/test';
import { openGame, snap, watchErrors } from './game';

test.describe('firing range (M2 acceptance)', () => {
  test('points are right per hit zone through real clicks', async ({ page }) => {
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=range&seed=42&test=1');
    await g.start();
    // Travel (30 steps) plus the first two grunts' entries.
    await g.stepFrames(30 + 24 + 30);
    const ids = (await g.state()).actors.filter((a) => !a.civilian).map((a) => a.id);
    expect(ids.length).toBeGreaterThanOrEqual(2);

    const shoot = async (id: number, zone: 'head' | 'body' | 'gun_hand') => {
      const p = (await g.zoneScreen(id, zone))!;
      await g.fireAt(p.x, p.y);
      const events = await g.stepFrames(8);
      return events.find((e) => e.type === 'EnemyHit');
    };
    expect(await shoot(ids[0]!, 'head')).toMatchObject({ zone: 'head', points: 300 });
    expect(await shoot(ids[1]!, 'gun_hand')).toMatchObject({ zone: 'gun_hand', points: 500, disarmed: true });
    await g.stepFrames(60);
    const third = (await g.state()).actors.find(
      (a) => !a.civilian && a.phase !== 'dead' && a.phase !== 'disarmed',
    )!;
    expect(await shoot(third.id, 'body')).toMatchObject({ zone: 'body', points: 200 });
    expect(errors).toEqual([]);
  });

  test('rings are centred on their enemies, and screenshot mid-wave', async ({ page }) => {
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=range&seed=42&debug=1&god=1');
    await g.start();
    await g.stepFrames(200);
    const rings = await g.rings();
    expect(rings.length).toBe(3);
    await snap(page, 'range-mid-wave-debug');

    // A shot at the centre of each drawn ring must hit the enemy that ring belongs to.
    for (const ring of rings) {
      await g.fireAt(ring.x, ring.y);
      const hit = (await g.stepFrames(8)).find((e) => e.type === 'EnemyHit');
      expect(hit, `ring #${ring.id}`).toMatchObject({ id: ring.id, zone: 'body' });
    }
    expect(errors).toEqual([]);
  });

  test('clean gameplay screenshot mid-wave, with a hit spark', async ({ page }) => {
    const g = await openGame(page, 'stage=range&seed=42&test=1&god=1');
    await g.start();
    await g.stepFrames(200);
    const target = (await g.state()).actors.find((a) => a.phase === 'aiming')!;
    const p = (await g.zoneScreen(target.id, 'head'))!;
    await g.fireAt(p.x, p.y);
    await g.stepFrames(1);
    await snap(page, 'range-mid-wave');
  });

  test('a wave of 5 beats a slow player, then results and replay', async ({ page }) => {
    const errors = watchErrors(page);
    const g = await openGame(page, 'stage=range&seed=42&test=1');
    await g.start();
    await g.stepFrames(3000);
    const state = await g.state();
    expect(state.phase).toBe('gameOver');
    expect(state.lives).toBe(0);
    await expect(page.locator('#screen h2')).toHaveText('GAME OVER');
    expect(await g.rings()).toEqual([]);
    await expect(page.locator('#hud')).toBeHidden();
    await snap(page, 'results');
    await page.locator('#screen').click();
    await expect(page.locator('#screen')).toBeHidden();
    expect((await g.state()).lives).toBe(5);
    expect(errors).toEqual([]);
  });

  test('border-zone click and right click reload; P pauses', async ({ page }) => {
    const g = await openGame(page, 'stage=range&seed=42&test=1');
    await g.start();
    await g.stepFrames(40);
    await g.fireAt(640, 360);
    await g.stepFrames(10);
    expect((await g.state()).weapon.ammo).toBe(5);
    await g.fireAt(5, 360); // inside the 4% border
    expect((await g.stepFrames(30)).map((e) => e.type)).toContain('ReloadStarted');
    expect((await g.state()).weapon.ammo).toBe(6);

    await g.fireAt(640, 360);
    await g.stepFrames(10);
    await page.mouse.click(640, 360, { button: 'right' });
    expect((await g.stepFrames(30)).map((e) => e.type)).toContain('ReloadStarted');

    await page.keyboard.press('p');
    await g.stepFrames(1);
    await expect(page.locator('#screen h2')).toHaveText('PAUSED');
    await page.locator('#screen').click();
    await g.stepFrames(1);
    await expect(page.locator('#screen')).toBeHidden();
  });

  test('title screenshot; no debug hooks in a production build without debug=1', async ({ page }) => {
    await page.goto('./?stage=1&seed=42');
    await expect(page.locator('#screen')).toContainText('CLICK TO START');
    expect(await page.evaluate(() => '__game' in window)).toBe(false);
    await snap(page, 'title');
  });
});
