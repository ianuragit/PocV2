import { Mesh, MeshLambertMaterial, type Group, type Material } from 'three';
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
 * Loads a stage .glb and gives it the arcade look: vertex colours under flat Lambert shading.
 * Marker empties carry no mesh, so nothing needs hiding; the simulation reads them from markers.json.
 */
export async function loadEnvironment(path: string): Promise<Group> {
  const gltf = await new GLTFLoader().loadAsync(url(`assets/${path}`));
  const shared = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  gltf.scene.traverse((o) => {
    if (o instanceof Mesh) {
      (o.material as Material).dispose();
      o.material = shared;
      o.matrixAutoUpdate = false;
      o.updateMatrix();
    }
  });
  gltf.scene.name = 'environment';
  return gltf.scene;
}

export async function loadGameData(stageId: string): Promise<GameData> {
  const [tuning, stage, markers] = await Promise.all([
    getJson<Tuning>('data/tuning.json'),
    getJson<{ environment?: string }>(`data/stages/${stageId}.json`),
    getJson<Markers>(`data/stages/${stageId}.markers.json`),
  ]);
  const env = stage.environment;
  const environment = env && env !== 'procedural' ? await loadEnvironment(env) : null;
  return { tuning, stage, markers, environment };
}
