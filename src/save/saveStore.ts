import type { Difficulty, Rank } from '../sim/index.ts';

export const SAVE_KEY = 'realcop2.save';
export const SAVE_VERSION = 1;
export const TABLE_SIZE = 10;

export interface ScoreEntry {
  initials: string;
  score: number;
  rank: Rank;
  /** ISO date, for display only. */
  date: string;
}

export interface Options {
  difficulty: Difficulty;
  /** Softer, shorter screen flashes when hit. */
  reducedFlash: boolean;
  /** 0 to 1. */
  musicVolume: number;
  sfxVolume: number;
}

export interface SaveData {
  version: typeof SAVE_VERSION;
  options: Options;
  /** Stages cleared at least once. */
  cleared: string[];
  /** Top scores per "stageId:difficulty", best first. */
  scores: Record<string, ScoreEntry[]>;
}

/** The parts of the Web Storage API the store needs, so tests can pass a plain object. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const defaults = (): SaveData => ({
  version: SAVE_VERSION,
  options: { difficulty: 'normal', reducedFlash: false, musicVolume: 0.6, sfxVolume: 0.8 },
  cleared: [],
  scores: {},
});

const DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const RANKS = new Set(['S', 'A', 'B', 'C']);

/** Normalises initials: up to three letters or digits, upper case, padded with dots. */
export function cleanInitials(raw: string): string {
  const s = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
  return s.padEnd(3, '.');
}

/** Checks untrusted JSON (from storage or an imported file) and returns valid save data, or null. */
export function parseSave(text: string): SaveData | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== SAVE_VERSION) return null;
  const out = defaults();
  const o = r.options as Record<string, unknown> | undefined;
  if (o && typeof o === 'object') {
    if (typeof o.difficulty === 'string' && DIFFICULTIES.has(o.difficulty))
      out.options.difficulty = o.difficulty as Difficulty;
    if (typeof o.reducedFlash === 'boolean') out.options.reducedFlash = o.reducedFlash;
    for (const k of ['musicVolume', 'sfxVolume'] as const) {
      const v = o[k];
      if (typeof v === 'number' && Number.isFinite(v)) out.options[k] = Math.min(1, Math.max(0, v));
    }
  }
  if (Array.isArray(r.cleared))
    out.cleared = r.cleared.filter((s): s is string => typeof s === 'string').slice(0, 50);
  if (r.scores && typeof r.scores === 'object') {
    for (const [key, list] of Object.entries(r.scores as Record<string, unknown>)) {
      if (!/^[a-z0-9_-]+:(easy|normal|hard)$/.test(key) || !Array.isArray(list)) continue;
      const entries = list
        .filter(
          (e): e is ScoreEntry =>
            typeof e === 'object' &&
            e !== null &&
            typeof e.initials === 'string' &&
            Number.isSafeInteger(e.score) &&
            e.score >= 0 &&
            RANKS.has(e.rank) &&
            typeof e.date === 'string',
        )
        .map((e) => ({
          initials: cleanInitials(e.initials),
          score: e.score,
          rank: e.rank,
          date: e.date.slice(0, 32),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TABLE_SIZE);
      out.scores[key] = entries;
    }
  }
  return out;
}

/**
 * Options, cleared stages and high scores, in one versioned localStorage key. Clearing browser data
 * clears it; export and import move it between browsers. Storage failures (private windows, blocked
 * site data) never break the game: the store keeps working in memory.
 */
export class SaveStore {
  data: SaveData;

  constructor(private readonly storage: KeyValueStorage | null) {
    let text: string | null;
    try {
      text = storage?.getItem(SAVE_KEY) ?? null;
    } catch {
      text = null;
    }
    this.data = (text && parseSave(text)) || defaults();
  }

  private persist(): void {
    try {
      this.storage?.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      // Quota or privacy settings: keep going in memory.
    }
  }

  setOptions(patch: Partial<Options>): void {
    this.data.options = { ...this.data.options, ...patch };
    this.persist();
  }

  markCleared(stageId: string): void {
    if (!this.data.cleared.includes(stageId)) {
      this.data.cleared.push(stageId);
      this.persist();
    }
  }

  table(stageId: string, difficulty: Difficulty): ScoreEntry[] {
    return this.data.scores[`${stageId}:${difficulty}`] ?? [];
  }

  /** True if a score would enter the top ten. */
  qualifies(stageId: string, difficulty: Difficulty, score: number): boolean {
    if (score <= 0) return false;
    const t = this.table(stageId, difficulty);
    return t.length < TABLE_SIZE || score > t[t.length - 1]!.score;
  }

  /** Adds an entry and returns its place (0 = top), or -1 if it did not make the table. */
  addScore(stageId: string, difficulty: Difficulty, entry: ScoreEntry): number {
    const key = `${stageId}:${difficulty}`;
    const clean = { ...entry, initials: cleanInitials(entry.initials) };
    const list = [...this.table(stageId, difficulty)];
    // Ties go below existing entries: the earlier score keeps its place.
    let at = list.findIndex((e) => clean.score > e.score);
    if (at === -1) at = list.length;
    if (at >= TABLE_SIZE) return -1;
    list.splice(at, 0, clean);
    this.data.scores[key] = list.slice(0, TABLE_SIZE);
    this.persist();
    return at;
  }

  exportText(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /** Replaces the save with an exported file's contents. Returns false (and changes nothing) if invalid. */
  importText(text: string): boolean {
    const parsed = parseSave(text);
    if (!parsed) return false;
    this.data = parsed;
    this.persist();
    return true;
  }
}
