import { describe, expect, it } from 'vitest';
import { SONGS, STEPS_PER_LOOP } from '../../src/view/music.ts';

describe('music data', () => {
  it('every part of every song fills exactly one loop', () => {
    for (const [name, song] of Object.entries(SONGS)) {
      expect(song.bass, `${name} bass`).toHaveLength(STEPS_PER_LOOP);
      expect(song.lead, `${name} lead`).toHaveLength(STEPS_PER_LOOP);
      expect(song.drums, `${name} drums`).toHaveLength(STEPS_PER_LOOP);
      expect(/^[ksh.]+$/.test(song.drums), `${name} drum symbols`).toBe(true);
      for (const n of [...song.bass, ...song.lead]) expect(n === 0 || (n >= 24 && n <= 108)).toBe(true);
    }
  });
});
