import { describe, expect, it } from 'vitest';
import { newGame } from '../helpers';
import { runIdleBot } from './bots';

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
 * Hand-checked timeline (Normal, seed 42): arrive at stop 0 on step 30; grunt 1's 2.0 s ring
 * runs 47..166 and hits; grunt 2's 1.8 s ring is held 30 steps by the ring pause and hits at 250;
 * re-aims (+-10% jitter) hit at 348, 417 and 536.
 */
const IDLE_GAME_OVER_FRAME = 536;
