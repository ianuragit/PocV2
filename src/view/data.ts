import { Mesh, MeshBasicMaterial, MeshLambertMaterial, type Group, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Markers, Tuning } from '../sim/index.ts';

export interface GameData {
  tuning: Tuning;
  stage: unknown;
  markers: Markers;
  /** The stage's environment model, or null for a procedural stage. */
  environment: Group | null;
}

const url = (path: string) => `${import.meta.env.BASE_URL}${path}`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path));
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Loads a stage .glb and gives it the arcade look: vertex colours under flat Lambert shading, with
 * light fittings (meshes named Lights*) unlit.
 * Marker empties carry no mesh, so nothing needs hiding; the simulation reads them from markers.json.
 */
export async function loadEnvironment(path: string, onProgress?: (fraction: number) => void): Promise<Group> {
  const gltf = await new GLTFLoader().loadAsync(url(`assets/${path}`), (e) => {
    if (onProgress && e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
  });
  const shared = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  // Meshes named Lights* are light fittings: drawn unlit so they glow.
  const glow = new MeshBasicMaterial({ vertexColors: true });
  gltf.scene.traverse((o) => {
    if (o instanceof Mesh) {
      (o.material as Material).dispose();
      o.material = o.name.startsWith('Lights') ? glow : shared;
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    }
  });
  gltf.scene.name = 'environment';
  return gltf.scene;
}

/**
 * Loads everything a stage needs. Progress runs 0..1: the small JSON files count for the first 10%,
 * the stage model (by bytes received) for the rest.
 */
export async function loadGameData(
  stageId: string,
  onProgress: (fraction: number) => void = () => {},
): Promise<GameData> {
  onProgress(0);
  const [tuning, stage, markers] = await Promise.all([
    getJson<Tuning>('data/tuning.json'),
    getJson<{ environment?: string }>(`data/stages/${stageId}.json`),
    getJson<Markers>(`data/stages/${stageId}.markers.json`),
  ]);
  onProgress(0.1);
  const env = stage.environment;
  const environment =
    env && env !== 'procedural' ? await loadEnvironment(env, (f) => onProgress(0.1 + 0.9 * f)) : null;
  onProgress(1);
  return { tuning, stage, markers, environment };
}

/** The stage list for the title screen: ids and names only, so no stage is downloaded to show it. */
export async function loadCatalog(): Promise<{ id: string; name: string }[]> {
  const index = await getJson<{ stages: { id: string; name: string }[] }>('data/stages/index.json');
  return index.stages;
}
