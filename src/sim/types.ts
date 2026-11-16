import type { Vec3 } from './vec.ts';

// ---------- Data files ----------

export type Difficulty = 'easy' | 'normal' | 'hard';
export type HitZone = 'gun_hand' | 'head' | 'body';

export interface Tuning {
  version: number;
  step_hz: number;
  player: { invulnerable_time: number; ring_pause_on_hit: number; bonus_lives_at: number[] };
  difficulty: Record<Difficulty, { lives: number; max_rings: number; aim_time_scale: number }>;
  rings: {
    start_scale: number;
    end_scale: number;
    reaim_jitter: number;
    /** View only: ring progress at which the colour turns amber, then red. */
    amber_at: number;
    red_at: number;
  };
  revolver: { capacity: number; max_shots_per_second: number; reload_time: number };
  scoring: {
    gun_hand: number;
    head: number;
    body: number;
    thrown: number;
    combo_step: number;
    combo_cap: number;
  };
  director: { wave_gap: number };
  entries: Record<string, number>;
  civilian: { stay_time: number };
  body: {
    height: number;
    body_bottom: number;
    body_top: number;
    body_radius: number;
    head_height: number;
    head_radius: number;
    /** Right, up, forward offset from the actor's feet. */
    hand_offset: [number, number, number];
    hand_radius: number;
  };
  enemies: Record<string, { aim_time: number; hits: number }>;
}

export interface SpawnDef {
  type: string;
  marker: string;
  entry: string;
  delay: number;
  aim_time?: number;
}
export interface WaveDef {
  spawns: SpawnDef[];
}
export interface StopDef {
  path_offset: number;
  travel_speed: number;
  look_at: string;
  waves: WaveDef[];
}
export interface SceneDef {
  id: string;
  stops: StopDef[];
}
export interface StageDef {
  id: string;
  name: string;
  environment: string;
  music: string;
  rank_thresholds: { S: number; A: number; B: number };
  scenes: SceneDef[];
}

export interface MarkerDef {
  position: [number, number, number];
  rotation: [number, number, number];
  /** Half extents for Cover_ boxes (a Blender default cube has size 2, so scale = half extent). */
  scale?: [number, number, number];
}
export type Markers = Record<string, MarkerDef>;

// ---------- Inputs and events ----------

export type Input = { type: 'fire'; origin: Vec3; direction: Vec3 } | { type: 'reload' } | { type: 'pause' };

export type GameEvent =
  | { type: 'Paused' }
  | { type: 'Resumed' }
  | { type: 'StopReached'; stop: number }
  | { type: 'WaveStarted'; stop: number; wave: number }
  | { type: 'WaveCleared'; stop: number; wave: number }
  | { type: 'EnemySpawned'; id: number; actor: string }
  | { type: 'RingStarted'; id: number }
  | { type: 'RingClosed'; id: number; hit: boolean }
  | { type: 'ShotFired'; ammo: number }
  | { type: 'DryFire' }
  | { type: 'ReloadStarted' }
  | { type: 'Reloaded' }
  | { type: 'EnemyHit'; id: number; zone: HitZone; points: number; killed: boolean; disarmed: boolean }
  | { type: 'CivilianHit'; id: number }
  | { type: 'CoverHit'; name: string }
  | { type: 'Miss' }
  | { type: 'CivilianLeft'; id: number }
  | { type: 'PlayerHit'; lives: number; cause: 'shot' | 'civilian' }
  | { type: 'BonusLife'; lives: number }
  | { type: 'StageCleared'; score: number }
  | { type: 'GameOver'; score: number };

// ---------- State ----------

export type ActorPhase = 'entering' | 'waiting' | 'aiming' | 'standing' | 'dead' | 'disarmed' | 'fled';

export interface Actor {
  id: number;
  /** Enemy type name from tuning.enemies, or 'civilian'. */
  type: string;
  civilian: boolean;
  position: Vec3;
  yaw: number;
  phase: ActorPhase;
  /** Frames left in the current timed phase (entering, standing). */
  timer: number;
  hitsLeft: number;
  /** Base aim time in frames, after difficulty scaling. */
  aimFrames: number;
  /** Aim time for the current ring, in frames (base plus jitter). */
  ringFrames: number;
  ringElapsed: number;
  /** Frame the actor joined the ring queue; earlier goes first. */
  queuedAt: number;
  /** Rings this actor has closed so far. */
  shots: number;
}

export interface Ring {
  id: number;
  /** 0 when the ring appears, 1 when it closes. */
  progress: number;
  /** Multiple of the actor's height: start_scale down to end_scale. */
  scale: number;
}

export interface WeaponState {
  ammo: number;
  capacity: number;
  cooldown: number;
  reloading: number;
}

export interface ScoreState {
  score: number;
  streak: number;
  multiplier: number;
  shots: number;
  hits: number;
}

export type GamePhase = 'travel' | 'combat' | 'stageClear' | 'gameOver';

export interface GameState {
  frame: number;
  phase: GamePhase;
  paused: boolean;
  difficulty: Difficulty;
  camera: { position: Vec3; lookAt: Vec3; pathOffset: number };
  stop: number;
  wave: number;
  actors: readonly Actor[];
  rings: readonly Ring[];
  weapon: WeaponState;
  score: ScoreState;
  lives: number;
  invulnerable: number;
  ringPause: number;
}
