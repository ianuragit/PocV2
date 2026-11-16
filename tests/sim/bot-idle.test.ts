import { describe, expect, it } from 'vitest';
import { newGame, readJson } from '../helpers.ts';
import { runIdleBot } from './bots.ts';

describe('idle bot on stage 1', () => {
  it('reaches game over at a known step on Normal', () => {
    const game = newGame({ seed: 42 });
    const { events } = runIdleBot(game);
    const hits = events.filter((e) => e.event.type === 'PlayerHit');

    expect(game.state.phase).toBe('gameOver');
    expect(game.state.lives).toBe(0);
    expect(hits).toHaveLength(5);
    expect(game.state.stop).toBe(0);
    expect(game.state.frame).toBe(IDLE_GAME_OVER_FRAME);
    // Once over, the game ignores further steps instead of hanging or advancing.
    game.step();
    expect(game.state.frame).toBe(IDLE_GAME_OVER_FRAME);
  });

  it('loses faster on Hard than on Easy', () => {
    const easy = newGame({ difficulty: 'easy' });
    const hard = newGame({ difficulty: 'hard' });
    runIdleBot(easy);
    runIdleBot(hard);
    expect(hard.state.frame).toBeLessThan(easy.state.frame);
  });
});

/**
 * Hand-checked timeline (Normal, seed 42): 10 m of rail at 4 m/s arrives at stop 0 on step 150.
 * The newsstand grunt leans out for 0.3 s (ring starts 167) and its 2.0 s ring hits on 286. The
 * runner spawns at 0.6 s (186), runs in for 0.8 s (ring starts 233), and its 1.5 s ring, held 30
 * steps by the ring pause, hits on 352. Re-aims (+-10% jitter) hit on 468, 594 and 656; one
 * closing at 501 falls inside invulnerability and misses.
 */
const IDLE_GAME_OVER_FRAME = 656;

describe('idle bot on the firing range', () => {
  it('a wave of 5 beats a player who never shoots', () => {
    const game = newGame({
      stage: readJson('public/data/stages/range.json'),
      markers: readJson('public/data/stages/range.markers.json'),
    });
    runIdleBot(game);
    expect(game.state.phase).toBe('gameOver');
  });
});
