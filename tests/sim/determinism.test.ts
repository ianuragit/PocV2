import { describe, expect, it } from 'vitest';
import { newGame, tuning } from '../helpers';
import { runClearingBot, runIdleBot } from './bots';

describe('determinism', () => {
  it('the same seed and inputs give identical event logs', () => {
    expect(runIdleBot(newGame({ seed: 7 })).events).toEqual(runIdleBot(newGame({ seed: 7 })).events);
    expect(runClearingBot(newGame({ seed: 7 }), tuning()).events).toEqual(
      runClearingBot(newGame({ seed: 7 }), tuning()).events,
    );
  });

  it('a different seed changes re-aim timing', () => {
    const a = runIdleBot(newGame({ seed: 1 })).events;
    const b = runIdleBot(newGame({ seed: 2 })).events;
    expect(a).not.toEqual(b);
  });
});
