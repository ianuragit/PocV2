import type { Markers, Tuning } from '../sim';

export interface GameData {
  tuning: Tuning;
  stage: unknown;
  markers: Markers;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

export async function loadGameData(stageId: string): Promise<GameData> {
  const [tuning, stage, markers] = await Promise.all([
    getJson<Tuning>('data/tuning.json'),
    getJson<unknown>(`data/stages/${stageId}.json`),
    getJson<Markers>(`data/stages/${stageId}.markers.json`),
  ]);
  return { tuning, stage, markers };
}
