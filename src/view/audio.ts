import type { GameEvent, GameState, Tuning, WeaponKind } from '../sim/index.ts';
import { SONGS, STEPS_PER_LOOP, type Theme } from './music.ts';

/** Every sound the game makes, all synthesized at play time: no audio files. */
export type Sfx =
  | 'revolver'
  | 'shotgun'
  | 'machine_pistol'
  | 'magnum'
  | 'dry'
  | 'reload'
  | 'reloaded'
  | 'hit'
  | 'head'
  | 'disarm'
  | 'thrownHit'
  | 'block'
  | 'civilian'
  | 'playerHit'
  | 'enemyShot'
  | 'warn'
  | 'crate'
  | 'pickup'
  | 'throw'
  | 'boss'
  | 'bonus'
  | 'clear'
  | 'gameOver'
  | 'tick'
  | 'menu';

const LOOKAHEAD = 0.12; // seconds of music scheduled ahead of the clock
/** Per-stage key and tempo for the shared themes: stage 1 as written, then up a minor third, then down a tone. */
const VARIANTS = [
  { transpose: 0, tempo: 1 },
  { transpose: 3, tempo: 1.04 },
  { transpose: -2, tempo: 1.07 },
];
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/**
 * Sound effects and music on the Web Audio API. Reads simulation state and reacts to events;
 * never changes the game. Browsers only allow sound after a user gesture, so nothing is created
 * until unlock() runs from a click or key press.
 */
export class AudioDirector {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private volumes = { music: 0.6, sfx: 0.8 };
  private theme: Theme | null = null;
  private variant = 0;
  private step = 0;
  private nextStepAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private warned = new Set<number>();
  /** Sounds played, by name, for tests. */
  readonly played: Partial<Record<Sfx, number>> = {};

  constructor(private readonly tuning: Tuning) {}

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /** Creates or resumes the audio context. Call from a user gesture. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        const master = this.ctx.createDynamicsCompressor();
        master.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.musicBus = this.ctx.createGain();
        this.sfxBus.connect(master);
        this.musicBus.connect(master);
        this.noise = this.makeNoise();
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null; // no audio on this device; the game plays silently
    }
  }

  setVolumes(music: number, sfx: number): void {
    this.volumes = { music, sfx };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    this.sfxBus!.gain.setValueAtTime(this.volumes.sfx * 0.9, this.ctx.currentTime);
    this.musicBus!.gain.setValueAtTime(this.volumes.music * 0.35, this.ctx.currentTime);
  }

  // ---------- Music ----------

  /**
   * Plays a theme. `variant` (the stage index) shifts the key and tempo, so each stage's music is
   * its own while sharing the tunes.
   */
  playMusic(theme: Theme | null, variant = 0): void {
    if (theme === this.theme && variant === this.variant) return;
    this.theme = theme;
    this.variant = variant;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!theme || !this.ctx) return;
    this.step = 0;
    this.nextStepAt = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  /** Quiets the music (pause, continue screen) without losing its place. */
  duck(on: boolean): void {
    if (!this.ctx) return;
    const target = this.volumes.music * 0.35 * (on ? 0.25 : 1);
    this.musicBus!.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.theme) return;
    const song = SONGS[this.theme];
    const v = VARIANTS[this.variant % VARIANTS.length]!;
    const stepLen = 60 / (song.bpm * v.tempo) / 4;
    const note = (n: number) => midi(n + v.transpose);
    while (this.nextStepAt < ctx.currentTime + LOOKAHEAD) {
      const i = this.step % STEPS_PER_LOOP;
      const t = this.nextStepAt;
      const bass = song.bass[i]!;
      if (bass) this.voice(t, note(bass), stepLen * 1.8, 'square', 0.22, this.musicBus!, 700);
      const lead = song.lead[i]!;
      if (lead) this.voice(t, note(lead), stepLen * 1.6, song.leadWave, 0.12, this.musicBus!, 3200);
      const d = song.drums[i];
      if (d === 'k') this.kick(t, this.musicBus!, 0.9);
      else if (d === 's') this.burst(t, 0.12, 1800, 'bandpass', 0.45, this.musicBus!);
      else if (d === 'h') this.burst(t, 0.03, 8000, 'highpass', 0.18, this.musicBus!);
      this.step += 1;
      this.nextStepAt += stepLen;
    }
  }

  // ---------- Effects ----------

  play(name: Sfx): void {
    this.played[name] = (this.played[name] ?? 0) + 1;
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + 0.005;
    const out = this.sfxBus!;
    switch (name) {
      case 'revolver':
        this.burst(t, 0.14, 3200, 'lowpass', 0.9, out, 400);
        this.sweep(t, 140, 45, 0.12, 'sine', 0.9, out);
        break;
      case 'shotgun':
        this.burst(t, 0.3, 2000, 'lowpass', 1, out, 250);
        this.sweep(t, 110, 35, 0.2, 'sine', 1, out);
        break;
      case 'machine_pistol':
        this.burst(t, 0.06, 4200, 'bandpass', 0.7, out);
        this.sweep(t, 220, 90, 0.05, 'square', 0.25, out);
        break;
      case 'magnum':
        this.burst(t, 0.4, 1400, 'lowpass', 1, out, 200);
        this.sweep(t, 90, 28, 0.3, 'sine', 1, out);
        break;
      case 'dry':
        this.voice(t, 1900, 0.02, 'square', 0.25, out);
        break;
      case 'reload':
        this.voice(t, 900, 0.03, 'square', 0.3, out);
        this.burst(t + 0.02, 0.04, 5000, 'highpass', 0.3, out);
        break;
      case 'reloaded':
        this.voice(t, 1400, 0.03, 'square', 0.3, out);
        this.voice(t + 0.05, 1800, 0.03, 'square', 0.25, out);
        break;
      case 'hit':
        this.sweep(t, 700, 1100, 0.07, 'square', 0.3, out);
        break;
      case 'head':
        this.sweep(t, 1100, 1700, 0.08, 'square', 0.3, out);
        this.voice(t + 0.06, 2200, 0.05, 'triangle', 0.25, out);
        break;
      case 'disarm':
        this.voice(t, 620, 0.18, 'square', 0.22, out);
        this.voice(t, 930, 0.18, 'square', 0.18, out);
        break;
      case 'thrownHit':
        this.burst(t, 0.1, 3500, 'bandpass', 0.6, out);
        this.voice(t, 1500, 0.05, 'triangle', 0.25, out);
        break;
      case 'block':
        this.voice(t, 300, 0.08, 'square', 0.3, out);
        this.burst(t, 0.06, 2500, 'bandpass', 0.4, out);
        break;
      case 'civilian':
        this.sweep(t, 520, 180, 0.35, 'sawtooth', 0.35, out);
        break;
      case 'playerHit':
        this.sweep(t, 160, 60, 0.3, 'sawtooth', 0.5, out);
        this.burst(t, 0.25, 700, 'lowpass', 0.8, out);
        break;
      case 'enemyShot':
        this.burst(t, 0.1, 2400, 'lowpass', 0.45, out);
        break;
      case 'warn':
        this.voice(t, 1240, 0.05, 'square', 0.18, out);
        break;
      case 'crate':
        this.burst(t, 0.12, 1200, 'bandpass', 0.6, out);
        break;
      case 'pickup':
        [72, 76, 79, 84].forEach((n, i) => this.voice(t + i * 0.05, midi(n), 0.08, 'square', 0.22, out));
        break;
      case 'throw':
        this.burst(t, 0.35, 900, 'bandpass', 0.35, out, 3000);
        break;
      case 'boss':
        [0, 0.24, 0.48].forEach((d) => {
          this.voice(t + d, 880, 0.1, 'square', 0.25, out);
          this.voice(t + d + 0.12, 660, 0.1, 'square', 0.25, out);
        });
        break;
      case 'bonus':
        [76, 81, 84, 88].forEach((n, i) => this.voice(t + i * 0.07, midi(n), 0.1, 'triangle', 0.3, out));
        break;
      case 'clear':
        [69, 73, 76, 81, 85, 88].forEach((n, i) =>
          this.voice(t + i * 0.1, midi(n), 0.22, 'square', 0.25, out),
        );
        break;
      case 'gameOver':
        [69, 65, 62, 57].forEach((n, i) => this.voice(t + i * 0.22, midi(n), 0.3, 'triangle', 0.35, out));
        break;
      case 'tick':
        this.voice(t, 1000, 0.04, 'sine', 0.3, out);
        break;
      case 'menu':
        this.voice(t, 1320, 0.035, 'square', 0.15, out);
        break;
    }
  }

  /**
   * Maps simulation events to sounds. `weaponBefore` is the weapon held before the step, so the last
   * shell of a special (dropped in the same step) still sounds like that special.
   */
  onEvents(events: readonly GameEvent[], weaponBefore: WeaponKind): void {
    for (const e of events) {
      switch (e.type) {
        case 'ShotFired':
          this.play(weaponBefore);
          break;
        case 'DryFire':
          this.play('dry');
          break;
        case 'ReloadStarted':
          this.play('reload');
          break;
        case 'Reloaded':
          this.play('reloaded');
          break;
        case 'EnemyHit':
          this.play(
            e.disarmed ? 'disarm' : e.zone === 'head' ? 'head' : e.zone === 'thrown' ? 'thrownHit' : 'hit',
          );
          break;
        case 'ShieldBlock':
          this.play('block');
          break;
        case 'CivilianHit':
          this.play('civilian');
          break;
        case 'PlayerHit':
          this.play('playerHit');
          break;
        case 'RingClosed':
          if (!e.hit) this.play('enemyShot');
          break;
        case 'CrateOpened':
          this.play('crate');
          break;
        case 'WeaponPickedUp':
          this.play('pickup');
          break;
        case 'ProjectileThrown':
          this.play('throw');
          break;
        case 'BossPhase':
          this.play('boss');
          break;
        case 'EnemySpawned':
          if (e.actor === 'boss') this.play('boss');
          break;
        case 'BonusLife':
          this.play('bonus');
          break;
        case 'StageCleared':
          this.playMusic(null);
          this.play('clear');
          break;
        case 'GameOver':
          this.playMusic(null);
          this.play('gameOver');
          break;
      }
    }
  }

  /** Per-frame checks: a beep the moment a sight turns red, and the music for the moment. */
  update(state: GameState): void {
    const red = this.tuning.rings.red_at;
    const live = new Set<number>();
    for (const r of state.rings) {
      live.add(r.id);
      if (r.progress >= red && !this.warned.has(r.id)) {
        this.warned.add(r.id);
        this.play('warn');
      } else if (r.progress < red) {
        this.warned.delete(r.id);
      }
    }
    for (const id of this.warned) if (!live.has(id)) this.warned.delete(id);
  }

  /** Music for a game in progress: the boss theme while a boss is on stage. */
  themeFor(state: GameState): Theme | null {
    if (state.phase === 'stageClear' || state.phase === 'gameOver') return null;
    return state.actors.some((a) => a.role === 'boss' && a.phase !== 'dead') ? 'boss' : 'stage';
  }

  // ---------- Synth voices ----------

  private makeNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // A fixed-seed generator so the noise is the same every run (and Math.random stays out of the game).
    let s = 0x1234567;
    for (let i = 0; i < data.length; i++) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      data[i] = s / 0x3fffffff - 1;
    }
    return buf;
  }

  private envelope(g: GainNode, t: number, peak: number, dur: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  private voice(
    t: number,
    freq: number,
    dur: number,
    wave: OscillatorType,
    peak: number,
    out: AudioNode,
    cutoff = 6000,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(freq, t);
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    this.envelope(g, t, peak, dur);
    o.connect(f).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private sweep(
    t: number,
    from: number,
    to: number,
    dur: number,
    wave: OscillatorType,
    peak: number,
    out: AudioNode,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    this.envelope(g, t, peak, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private burst(
    t: number,
    dur: number,
    freq: number,
    type: BiquadFilterType,
    peak: number,
    out: AudioNode,
    sweepTo?: number,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    this.envelope(g, t, peak, dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, (t * 7919) % 0.8);
    src.stop(t + dur + 0.02);
  }

  private kick(t: number, out: AudioNode, peak: number): void {
    this.sweep(t, 150, 40, 0.16, 'sine', peak, out);
  }
}
