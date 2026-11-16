import { describe, expect, it } from 'vitest';
import {
  cleanInitials,
  parseSave,
  SAVE_KEY,
  SaveStore,
  type KeyValueStorage,
} from '../../src/save/saveStore.ts';

const memory = (init: Record<string, string> = {}): KeyValueStorage & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
};
const entry = (initials: string, score: number) => ({
  initials,
  score,
  rank: 'B' as const,
  date: '2026-11-16',
});

describe('SaveStore', () => {
  it('starts from defaults and survives a reload through storage', () => {
    const storage = memory();
    const a = new SaveStore(storage);
    expect(a.data.options).toEqual({ difficulty: 'normal', reducedFlash: false });
    a.setOptions({ difficulty: 'hard' });
    a.addScore('stage1', 'hard', entry('ann', 1200));
    a.markCleared('stage1');
    a.markCleared('stage1');
    const b = new SaveStore(storage);
    expect(b.data.options.difficulty).toBe('hard');
    expect(b.table('stage1', 'hard')).toEqual([entry('ANN', 1200)]);
    expect(b.data.cleared).toEqual(['stage1']);
    expect(JSON.parse(storage.data[SAVE_KEY]!).version).toBe(1);
  });

  it('keeps the top ten, best first, with ties below earlier scores', () => {
    const s = new SaveStore(memory());
    for (let i = 1; i <= 10; i++) expect(s.addScore('stage1', 'normal', entry('aaa', i * 100))).toBe(0);
    expect(s.qualifies('stage1', 'normal', 100)).toBe(false);
    expect(s.qualifies('stage1', 'normal', 150)).toBe(true);
    expect(s.qualifies('stage1', 'easy', 0)).toBe(false);
    expect(s.addScore('stage1', 'normal', entry('bbb', 500))).toBe(6);
    expect(s.addScore('stage1', 'normal', entry('ccc', 50))).toBe(-1);
    const t = s.table('stage1', 'normal');
    expect(t).toHaveLength(10);
    expect(t.map((e) => e.score)).toEqual([1000, 900, 800, 700, 600, 500, 500, 400, 300, 200]);
    expect(t[6]!.initials).toBe('BBB');
  });

  it('exports and imports, rejecting anything invalid without changing the save', () => {
    const s = new SaveStore(memory());
    s.addScore('stage1', 'easy', entry('zed', 900));
    const text = s.exportText();
    const other = new SaveStore(memory());
    expect(other.importText(text)).toBe(true);
    expect(other.table('stage1', 'easy')[0]!.score).toBe(900);
    expect(other.importText('not json')).toBe(false);
    expect(other.importText('{"version": 99}')).toBe(false);
    expect(other.table('stage1', 'easy')).toHaveLength(1);
  });

  it('cleans untrusted saves: bad keys, bad entries and bad options are dropped', () => {
    const parsed = parseSave(
      JSON.stringify({
        version: 1,
        options: { difficulty: 'nightmare', reducedFlash: 'yes' },
        cleared: ['stage1', 7],
        scores: {
          'stage1:normal': [
            entry('<b>', 10),
            { initials: 'x', score: -5, rank: 'B', date: '' },
            { score: 1.5 },
          ],
          'bad key': [entry('abc', 1)],
          'stage1:hard': 'nope',
        },
      }),
    )!;
    expect(parsed.options).toEqual({ difficulty: 'normal', reducedFlash: false });
    expect(parsed.cleared).toEqual(['stage1']);
    expect(Object.keys(parsed.scores)).toEqual(['stage1:normal']);
    expect(parsed.scores['stage1:normal']).toEqual([{ ...entry('B..', 10) }]);
    expect(parseSave('null')).toBeNull();
  });

  it('works when storage is missing or throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const s = new SaveStore(broken);
    s.setOptions({ reducedFlash: true });
    expect(s.data.options.reducedFlash).toBe(true);
    expect(new SaveStore(null).data.scores).toEqual({});
  });

  it('cleans initials to three letters or digits', () => {
    expect(cleanInitials('ab')).toBe('AB.');
    expect(cleanInitials('a-b c!d')).toBe('ABC');
    expect(cleanInitials('')).toBe('...');
  });
});
