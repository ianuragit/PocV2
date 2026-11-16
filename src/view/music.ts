/**
 * Original music, written as data for the synth sequencer in audio.ts: 16 steps per bar, four bars
 * per loop. Notes are MIDI numbers; 0 is a rest. Composed for this game; no existing tune is used.
 */
export type Theme = 'title' | 'stage' | 'boss';

export interface Song {
  bpm: number;
  /** One entry per step (sixteenth note) across the whole loop. */
  bass: number[];
  lead: number[];
  /** 'k' kick, 's' snare, 'h' hat, '.' rest; one character per step. */
  drums: string;
  leadWave: OscillatorType;
}

/** Spreads a list of [note, steps] pairs into one entry per step. */
function seq(...notes: [number, number][]): number[] {
  return notes.flatMap(([n, len]) => [n, ...Array<number>(len - 1).fill(0)]);
}

/** Repeats a one-bar pattern across a chord's root. */
const bassBar = (root: number) =>
  seq(
    [root, 2],
    [root, 2],
    [root + 12, 2],
    [root, 2],
    [root, 2],
    [root + 7, 2],
    [root + 12, 2],
    [root + 10, 2],
  );

export const SONGS: Record<Theme, Song> = {
  // Title: unhurried, minor, a rising hook.
  title: {
    bpm: 104,
    bass: [...seq([45, 16]), ...seq([41, 16]), ...seq([43, 16]), ...seq([40, 8], [44, 8])],
    lead: [
      ...seq([69, 4], [72, 4], [76, 6], [74, 2]),
      ...seq([72, 4], [69, 4], [65, 8]),
      ...seq([67, 4], [71, 4], [74, 6], [72, 2]),
      ...seq([71, 6], [68, 2], [64, 8]),
    ],
    drums: 'k.......s.......k.......s.......k.......s.......k...k...s...s.h.',
    leadWave: 'triangle',
  },
  // Stage: driving, 8th-note bass, arpeggiated lead over i–VI–III–VII in A minor.
  stage: {
    bpm: 138,
    bass: [...bassBar(45), ...bassBar(41), ...bassBar(48), ...bassBar(43)],
    lead: [
      ...seq([81, 2], [76, 2], [72, 2], [76, 2], [81, 2], [84, 2], [83, 2], [79, 2]),
      ...seq([77, 2], [72, 2], [69, 2], [72, 2], [77, 2], [81, 2], [79, 4]),
      ...seq([79, 2], [76, 2], [72, 2], [76, 2], [79, 2], [84, 2], [83, 2], [81, 2]),
      ...seq([79, 2], [74, 2], [71, 2], [74, 2], [79, 3], [81, 3], [83, 2]),
    ],
    drums: 'k.h.s.h.k.k.s.h.k.h.s.h.k.h.s.hhk.h.s.h.k.k.s.h.k.h.s.h.k.k.s.ss',
    leadWave: 'square',
  },
  // Boss: faster, chromatic pressure on a single low pedal.
  boss: {
    bpm: 152,
    bass: [...bassBar(40), ...bassBar(40), ...bassBar(41), ...bassBar(39)],
    lead: [
      ...seq([76, 1], [0, 1], [76, 1], [77, 1], [76, 2], [74, 2], [76, 4], [71, 4]),
      ...seq([76, 1], [0, 1], [76, 1], [77, 1], [79, 2], [77, 2], [76, 8]),
      ...seq([77, 1], [0, 1], [77, 1], [79, 1], [77, 2], [76, 2], [77, 4], [72, 4]),
      ...seq([75, 2], [76, 2], [79, 2], [83, 2], [82, 8]),
    ],
    drums: 'k.hkk.h.s.hkk.h.k.hkk.h.s.hks.s.k.hkk.h.s.hkk.h.k.hkk.h.s.s.ssss',
    leadWave: 'sawtooth',
  },
};

export const STEPS_PER_LOOP = 64;
