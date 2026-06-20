const STORAGE_KEY = 'eek-a-volve.sound';
/** Master mix level — deliberately quiet and unobtrusive. */
const MASTER_GAIN = 0.22;
/** Cap on simultaneously sounding voices, so a busy frame cannot blast. */
const MAX_VOICES = 8;

type SoundKind = 'eat' | 'birth' | 'death' | 'catastrophe';

/** Minimum gap (ms) between repeats of each sound, so frequent events do not spam. */
const THROTTLE_MS: Record<SoundKind, number> = {
  eat: 70,
  birth: 110,
  death: 110,
  catastrophe: 700,
};

/**
 * A tiny synthesised sound kit (specification: relatability — cheap fun). Every
 * sound is generated with the Web Audio API — no audio files ship. The context is
 * created lazily on a user gesture (autoplay policy), voices are capped, and each
 * kind is rate-limited. Off by default; the choice is remembered in localStorage.
 * Sounds are driven by the same real events as the visual cues, so picture and
 * sound agree.
 */
export class SoundKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private enabled: boolean;
  private voices = 0;
  private readonly last: Record<string, number> = {};

  constructor() {
    let stored = false;
    try {
      stored = localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      /* storage unavailable — stay off */
    }
    this.enabled = stored;

    // A one-shot gesture unlock, so a remembered "on" choice can resume audio.
    const unlock = (): void => {
      if (this.enabled) this.ensureContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    try {
      localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (on) this.ensureContext();
  }

  eat(): void {
    this.tone('eat', 720, 0.05, 'square', 0.5, 1.18);
  }

  birth(): void {
    this.tone('birth', 440, 0.16, 'sine', 0.55, 1.9);
  }

  death(): void {
    this.noise('death', 0.18, 900, 0.45);
  }

  catastrophe(): void {
    this.noise('catastrophe', 0.7, 320, 1.0);
  }

  private ensureContext(): void {
    if (this.ctx !== null) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctor === undefined) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = MASTER_GAIN;
    this.master.connect(this.ctx.destination);

    // A short reusable white-noise buffer for the percussive sounds.
    const len = Math.floor(this.ctx.sampleRate * 0.7);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  /** Whether a sound of `kind` may play now (enabled, unlocked, within limits). */
  private ready(kind: SoundKind): boolean {
    if (!this.enabled) return false;
    this.ensureContext();
    if (this.ctx === null || this.master === null || this.ctx.state !== 'running') return false;
    if (this.voices >= MAX_VOICES) return false;
    const now = performance.now();
    if (now - (this.last[kind] ?? -1e9) < THROTTLE_MS[kind]) return false;
    this.last[kind] = now;
    return true;
  }

  private tone(
    kind: SoundKind,
    freq: number,
    dur: number,
    type: OscillatorType,
    peak: number,
    sweep: number,
  ): void {
    if (!this.ready(kind)) return;
    const ctx = this.ctx as AudioContext;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master as GainNode);
    this.voices++;
    osc.onended = (): void => {
      this.voices--;
    };
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(kind: SoundKind, dur: number, cutoff: number, peak: number): void {
    if (!this.ready(kind) || this.noiseBuffer === null) return;
    const ctx = this.ctx as AudioContext;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.3), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.master as GainNode);
    this.voices++;
    src.onended = (): void => {
      this.voices--;
    };
    src.start(t);
    src.stop(t + dur);
  }
}
