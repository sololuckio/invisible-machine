/**
 * Synthesised sound layer — no audio files, no licensing, a few hundred
 * bytes of oscillator code. Everything is generated with the Web Audio API.
 *
 * Rules: silent by default, only initialised after an explicit user gesture
 * (the sound toggle), and every call is failure-safe.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientNodes: { osc: OscillatorNode; lfo: OscillatorNode }[] = [];
  private enabled = false;
  private lastEvent: Record<string, number> = {};

  /** Create the context. Must be called from a user gesture. */
  enable(): boolean {
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return false;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.28;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      this.enabled = true;
      this.startAmbient();
      return true;
    } catch {
      return false;
    }
  }

  disable(): void {
    this.enabled = false;
    this.stopAmbient();
    try {
      if (this.ctx?.state === "running") void this.ctx.suspend();
    } catch {
      /* already closed */
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Low machine-room hum: two detuned triangles under a slow LFO. */
  private startAmbient(): void {
    if (!this.ctx || !this.master || this.ambientNodes.length > 0) return;
    try {
      for (const [freq, det] of [
        [55, 0],
        [55.7, 3],
      ] as const) {
        const osc = this.ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.value = freq;
        osc.detune.value = det;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.05;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.11;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.02;
        lfo.connect(lfoGain).connect(gain.gain);
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 220;
        osc.connect(gain).connect(filter).connect(this.master);
        osc.start();
        lfo.start();
        this.ambientNodes.push({ osc, lfo });
      }
    } catch {
      /* ambience is optional */
    }
  }

  private stopAmbient(): void {
    for (const { osc, lfo } of this.ambientNodes) {
      try {
        osc.stop();
        lfo.stop();
      } catch {
        /* already stopped */
      }
    }
    this.ambientNodes = [];
  }

  /** One short enveloped tone. The building block for every event sound. */
  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; glideTo?: number; delay?: number } = {},
  ): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    try {
      const t0 = this.ctx.currentTime + (opts.delay ?? 0);
      const osc = this.ctx.createOscillator();
      osc.type = opts.type ?? "sine";
      osc.frequency.setValueAtTime(freq, t0);
      if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(opts.glideTo, t0 + duration);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(opts.gain ?? 0.12, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0004, t0 + duration);
      osc.connect(gain).connect(this.master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch {
      /* a missed blip is fine */
    }
  }

  /** Rate-limit an event channel. */
  private gate(channel: string, minIntervalMs: number): boolean {
    const now = performance.now();
    if ((this.lastEvent[channel] ?? 0) + minIntervalMs > now) return false;
    this.lastEvent[channel] = now;
    return true;
  }

  /** Soft data pulse — an order completed its journey. */
  pulse(): void {
    if (!this.gate("pulse", 700)) return;
    this.tone(880, 0.14, { gain: 0.05 });
  }

  /** UI click. */
  click(): void {
    if (!this.gate("click", 60)) return;
    this.tone(1400, 0.05, { type: "square", gain: 0.025 });
  }

  /** Congestion warning — a low descending minor second. */
  warn(): void {
    if (!this.gate("warn", 4000)) return;
    this.tone(220, 0.5, { type: "sawtooth", gain: 0.05, glideTo: 174 });
    this.tone(110, 0.6, { type: "triangle", gain: 0.06, delay: 0.05 });
  }

  /** AI activation — rising sweep with shimmer. */
  scan(): void {
    if (!this.gate("scan", 1500)) return;
    this.tone(320, 1.6, { gain: 0.06, glideTo: 1280 });
    this.tone(640, 1.2, { gain: 0.03, glideTo: 2560, delay: 0.25 });
  }

  /** Optimisation applied — a settled major arpeggio. */
  resolve(): void {
    if (!this.gate("resolve", 1200)) return;
    const base = 440;
    [1, 1.25, 1.5, 2].forEach((ratio, i) => {
      this.tone(base * ratio, 0.5, { gain: 0.05, delay: i * 0.09 });
    });
  }
}

/** Singleton — one audio context for the whole experience. */
export const soundEngine = new SoundEngine();
