import type { Vec3 } from './vec.ts';

// ---------- Data files ----------

export type Difficulty = 'easy' | 'normal' | 'hard';
export type HitZone = 'gun_hand' | 'head' | 'body' | 'thrown';
export type WeaponKind = 'revolver' | 'shotgun' | 'machine_pistol' | 'magnum';
export type SpecialWeapon = Exclude<WeaponKind, 'revolver'>;
export type Rank = 'S' | 'A' | 'B' | 'C';

export interface WeaponDef {
  capacity: number;
  max_shots_per_second: number;
  /** Revolver only: specials are dropped when empty, never reloaded. */
  reload_time?: number;
  /** Shotgun: pellets per shot, in a fixed pattern (centre plus a ring) of this half-angle. */
  pellets?: number;
  spread_deg?: number;
  /** Fires repeatedly while the trigger is held (the view sends Fire every step). */
  auto?: boolean;
  /** Passes through cover, shields and enemies, hitting everything on the line. */
  pierce?: boolean;
}

export interface EnemyDef {
  aim_time: number;
  hits: number;
  /** 'throw' launches a shootable projectile instead of an instant shot. */
  attack?: 'shoot' | 'throw';
  /** Throwers: seconds the projectile takes to reach the player. */
  flight_time?: number;
  /** Carries a shield that blocks body shots from the front (the magnum pierces it). */
  shield?: boolean;
}

export interface Tuning {
  version: number;
  step_hz: number;
  player: {
    invulnerable_time: number;
    ring_pause_on_hit: number;
    bonus_lives_at: number[];
    continues: number;
    /** Seconds the continue offer waits before the game ends. */
    continue_time: number;
  };
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
  specials: Record<SpecialWeapon, WeaponDef>;
  /** Shootable weapon crates: half extents of the box, centred above the marker. */
  crate: { half_extents: [number, number, number] };
  projectile: { radius: number };
  boss: {
    phases: { hits: number; aim_time: number }[];
    /** Seconds the boss is out of reach while it moves to the next phase marker. */
    move_time: number;
    bonus: number;
  };
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
  enemies: Record<string, EnemyDef>;
}

export interface SpawnDef {
  type: string;
  marker: string;
  entry: string;
  delay: number;
  aim_time?: number;
  /** Crates: the weapon inside. */
  weapon?: SpecialWeapon;
  /** Boss: one Spawn_ marker per phase; the boss moves between them. */
  phase_markers?: string[];
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

export type Input =
  | { type: 'fire'; origin: Vec3; direction: Vec3 }
  | { type: 'reload' }
  | { type: 'pause' }
  /** Accept the continue offer: lives refill, score resets. */
  | { type: 'continue' }
  /** Decline the continue offer. */
  | { type: 'giveUp' };

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
  | { type: 'ShieldBlock'; id: number }
  | { type: 'CrateOpened'; id: number; weapon: SpecialWeapon }
  | { type: 'WeaponPickedUp'; weapon: SpecialWeapon }
  | { type: 'WeaponLost'; weapon: SpecialWeapon; reason: 'empty' | 'hit' }
  | { type: 'ProjectileThrown'; id: number; from: number }
  | { type: 'ProjectileLanded'; id: number; hit: boolean }
  | { type: 'BossPhase'; id: number; phase: number }
  | { type: 'BossDefeated'; id: number; bonus: number }
  | { type: 'ContinueOffered'; continuesLeft: number; seconds: number }
  | { type: 'Continued'; continuesLeft: number }
  | { type: 'Miss' }
  | { type: 'CivilianLeft'; id: number }
  | { type: 'PlayerHit'; lives: number; cause: 'shot' | 'civilian' }
  | { type: 'BonusLife'; lives: number }
  | { type: 'StageCleared'; score: number; rank: Rank }
  | { type: 'GameOver'; score: number };

// ---------- State ----------

export type ActorPhase =
  | 'entering'
  | 'waiting'
  | 'aiming'
  /** Civilians and crates: present, not attacking. */
  | 'standing'
  /** Projectiles: in the air. */
  | 'flying'
  /** Boss: out of reach between phases. */
  | 'moving'
  | 'dead'
  | 'disarmed'
  | 'opened'
  | 'fled';

export type ActorRole = 'enemy' | 'civilian' | 'crate' | 'projectile' | 'boss';

export interface Actor {
  id: number;
  /** Enemy type name from tuning.enemies, or 'civilian', 'crate', 'projectile', 'boss'. */
  type: string;
  role: ActorRole;
  /** Same as role === 'civilian'; kept because most code only asks this. */
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
  /** Crates: the weapon inside. */
  weapon?: SpecialWeapon;
  /** Projectiles: where they fly from and to, and the total flight in frames. */
  flight?: { from: Vec3; to: Vec3; frames: number };
  /** Boss: current phase (0-based) and the marker positions per phase. */
  boss?: { phase: number; positions: Vec3[]; yaws: number[] };
}

export interface Ring {
  id: number;
  /** 0 when the ring appears, 1 when it closes. */
  progress: number;
  /** Multiple of the actor's height: start_scale down to end_scale. */
  scale: number;
}

export interface WeaponState {
  kind: WeaponKind;
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
  /** Targets hit (a shotgun or magnum shot can hit several). */
  hits: number;
  /** Shots that hit at least one target, for accuracy. */
  shotsOnTarget: number;
}

export type GamePhase = 'travel' | 'combat' | 'continue' | 'stageClear' | 'gameOver';

export interface StageResult {
  score: number;
  rank: Rank;
  /** Percent of shots that hit, 0..100. */
  accuracy: number;
  continuesUsed: number;
}

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
  continuesLeft: number;
  continuesUsed: number;
  /** Frames left on the continue offer, while phase is 'continue'. */
  continueTimer: number;
  /** Set when the stage is cleared. */
  result: StageResult | null;
}
