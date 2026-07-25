/**
 * Synthesised sound direction — no audio files, no licensing, no download.
 * Everything here is oscillators, one procedurally generated noise buffer and
 * a handful of filters, which is why the whole layer costs a few hundred
 * bytes of transfer instead of a few hundred kilobytes.
 *
 * Direction, not decoration. There is one quiet room tone whose level follows
 * the machine's energy, and a small set of cues that mark real events:
 * material tension before the surface opens, a seam igniting, mass releasing,
 * an order entering and leaving a station, strain accumulating, a constraint
 * locking, the analysis measuring and landing, a route activating, the system
 * stabilising, and the surface closing again.
 *
 * Rules: silent by default, only started from an explicit user gesture,
 * duckable, suspendable when the tab is hidden, fully releasable, and every
 * single call is failure-safe — a missing tone must never break the page.
 */

type NoiseOpts = {
  type?: BiquadFilterType;
  freq?: number;
  sweepTo?: number;
  q?: number;
  gain?: number;
  delay?: number;
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientBus: GainNode | null = null;
  private fxBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private ambientNodes: { osc: OscillatorNode; lfo: OscillatorNode }[] = [];
  private tension: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null =
    null;
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
        this.master.gain.value = 0.26;
        this.master.connect(this.ctx.destination);
        this.ambientBus = this.ctx.createGain();
        this.ambientBus.gain.value = 0.5;
        this.ambientBus.connect(this.master);
        this.fxBus = this.ctx.createGain();
        this.fxBus.gain.value = 1;
        this.fxBus.connect(this.master);
        this.noiseBuffer = this.makeNoise();
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
    this.stopTension();
    this.stopAmbient();
    try {
      if (this.ctx?.state === "running") void this.ctx.suspend();
    } catch {
      /* already closed */
    }
  }

  /** Release the audio context entirely — used when the experience unmounts. */
  destroy(): void {
    this.disable();
    try {
      void this.ctx?.close();
    } catch {
      /* already closed */
    }
    this.ctx = null;
    this.master = null;
    this.ambientBus = null;
    this.fxBus = null;
    this.noiseBuffer = null;
  }

  /** Tab hidden: hold everything silent without tearing the graph down. */
  suspend(): void {
    try {
      if (this.ctx?.state === "running") void this.ctx.suspend();
    } catch {
      /* nothing to hold */
    }
  }

  resume(): void {
    try {
      if (this.enabled && this.ctx?.state === "suspended") void this.ctx.resume();
    } catch {
      /* nothing to resume */
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /* ---------------------------------------------------------------- */
  /* Building blocks                                                    */
  /* ---------------------------------------------------------------- */

  /** Two seconds of white noise, generated once and reused by every cue. */
  private makeNoise(): AudioBuffer | null {
    if (!this.ctx) return null;
    try {
      const len = Math.floor(this.ctx.sampleRate * 2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      // Deterministic generator — the room tone sounds the same every visit.
      let seed = 22222;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (seed / 0x3fffffff - 1) * 0.5;
      }
      return buf;
    } catch {
      return null;
    }
  }

  /** One short enveloped tone. The building block for every event sound. */
  private tone(
    freq: number,
    duration: number,
    opts: { type?: OscillatorType; gain?: number; glideTo?: number; delay?: number } = {},
  ): void {
    if (!this.enabled || !this.ctx || !this.fxBus) return;
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
      osc.connect(gain).connect(this.fxBus);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    } catch {
      /* a missed blip is fine */
    }
  }

  /** A filtered burst of the shared noise buffer — air, friction, mass. */
  private noise(duration: number, opts: NoiseOpts = {}): void {
    if (!this.enabled || !this.ctx || !this.fxBus || !this.noiseBuffer) return;
    try {
      const t0 = this.ctx.currentTime + (opts.delay ?? 0);
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = opts.type ?? "bandpass";
      filter.frequency.setValueAtTime(opts.freq ?? 800, t0);
      if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(opts.sweepTo, t0 + duration);
      filter.Q.value = opts.q ?? 1;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(opts.gain ?? 0.06, t0 + Math.min(0.08, duration * 0.3));
      gain.gain.exponentialRampToValueAtTime(0.0004, t0 + duration);
      src.connect(filter).connect(gain).connect(this.fxBus);
      src.start(t0);
      src.stop(t0 + duration + 0.05);
    } catch {
      /* optional texture */
    }
  }

  /** Rate-limit an event channel. */
  private gate(channel: string, minIntervalMs: number): boolean {
    const now = typeof performance !== "undefined" ? performance.now() : 0;
    if ((this.lastEvent[channel] ?? 0) + minIntervalMs > now) return false;
    this.lastEvent[channel] = now;
    return true;
  }

  /* ---------------------------------------------------------------- */
  /* Ambient layer                                                      */
  /* ---------------------------------------------------------------- */

  /** Low machine-room hum: two detuned triangles under a slow LFO. */
  private startAmbient(): void {
    if (!this.ctx || !this.ambientBus || this.ambientNodes.length > 0) return;
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
        osc.connect(gain).connect(filter).connect(this.ambientBus);
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

  /** The room's presence follows the machine's energy. 0..1. */
  setAmbient(level: number): void {
    if (!this.enabled || !this.ctx || !this.ambientBus) return;
    try {
      const target = 0.16 + Math.max(0, Math.min(1, level)) * 0.62;
      this.ambientBus.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
    } catch {
      /* level is advisory */
    }
  }

  /** Pull the room down so a precise moment can be heard. */
  duck(amount = 0.25, seconds = 1.2): void {
    if (!this.enabled || !this.ctx || !this.ambientBus) return;
    try {
      const now = this.ctx.currentTime;
      const g = this.ambientBus.gain;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(amount, now, 0.12);
      g.setTargetAtTime(0.5, now + seconds, 0.5);
    } catch {
      /* ducking is advisory */
    }
  }

  /* ---------------------------------------------------------------- */
  /* Scene 1 — the surface                                              */
  /* ---------------------------------------------------------------- */

  /** Continuous material tension under the closed surface. 0 stops it. */
  setTension(level: number): void {
    if (!this.enabled || !this.ctx || !this.fxBus || !this.noiseBuffer) return;
    const value = Math.max(0, Math.min(1, level));
    try {
      if (value <= 0.001) {
        this.stopTension();
        return;
      }
      if (!this.tension) {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        const filter = this.ctx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 180;
        filter.Q.value = 8;
        const gain = this.ctx.createGain();
        gain.gain.value = 0;
        src.connect(filter).connect(gain).connect(this.fxBus);
        src.start();
        this.tension = { src, gain, filter };
      }
      const now = this.ctx.currentTime;
      this.tension.gain.gain.setTargetAtTime(value * 0.05, now, 0.2);
      this.tension.filter.frequency.setTargetAtTime(150 + value * 420, now, 0.3);
    } catch {
      /* tension is optional */
    }
  }

  private stopTension(): void {
    if (!this.tension) return;
    try {
      this.tension.gain.gain.value = 0;
      this.tension.src.stop();
    } catch {
      /* already stopped */
    }
    this.tension = null;
  }

  /** Fine ignition running the length of the seam. */
  seamIgnite(): void {
    if (!this.gate("ignite", 2500)) return;
    this.noise(1.1, { type: "bandpass", freq: 420, sweepTo: 2600, q: 3, gain: 0.045 });
    this.tone(180, 1.2, { type: "triangle", gain: 0.035, glideTo: 320 });
  }

  /** The halves breaking free: low mass moving. */
  mechanicalRelease(): void {
    if (!this.gate("release", 2500)) return;
    this.tone(72, 1.5, { type: "sine", gain: 0.11, glideTo: 38 });
    this.noise(0.9, { type: "lowpass", freq: 900, sweepTo: 180, gain: 0.05 });
    this.tone(140, 0.35, { type: "triangle", gain: 0.04, delay: 0.06 });
  }

  /** Structure taking up its stops. */
  settle(): void {
    if (!this.gate("settle", 2200)) return;
    this.tone(96, 0.32, { type: "sine", gain: 0.07 });
    this.tone(88, 0.26, { type: "sine", gain: 0.045, delay: 0.13 });
  }

  /* ---------------------------------------------------------------- */
  /* Scene 2 — the hero order                                           */
  /* ---------------------------------------------------------------- */

  /** The order arriving at a station. */
  stationEnter(): void {
    if (!this.gate("station", 260)) return;
    this.tone(620, 0.12, { gain: 0.045 });
    this.noise(0.09, { type: "highpass", freq: 2400, gain: 0.02 });
  }

  /** Work completed on it. */
  processConfirm(): void {
    if (!this.gate("process", 260)) return;
    this.tone(520, 0.16, { gain: 0.04 });
    this.tone(780, 0.2, { gain: 0.035, delay: 0.08 });
  }

  /** Released onward. */
  dispatch(): void {
    if (!this.gate("dispatch", 260)) return;
    this.tone(880, 0.22, { gain: 0.04, glideTo: 500 });
  }

  /* ---------------------------------------------------------------- */
  /* Scene 3 — pressure and the constraint lock                         */
  /* ---------------------------------------------------------------- */

  /** Rhythmic mechanical strain; density follows the pressure. 0..1. */
  strain(level: number): void {
    const gapMs = 1400 - level * 900;
    if (!this.gate("strain", Math.max(320, gapMs))) return;
    this.tone(110 - level * 24, 0.3, { type: "sawtooth", gain: 0.018 + level * 0.02 });
    if (level > 0.6) this.noise(0.22, { type: "bandpass", freq: 320, q: 6, gain: 0.02, delay: 0.1 });
  }

  /** Congestion warning — a low descending minor second. */
  warn(): void {
    if (!this.gate("warn", 4000)) return;
    this.tone(220, 0.5, { type: "sawtooth", gain: 0.045, glideTo: 174 });
    this.tone(110, 0.6, { type: "triangle", gain: 0.05, delay: 0.05 });
  }

  /** The constraint locking: motion compresses, everything else steps back. */
  constraintLock(): void {
    if (!this.gate("lock", 4000)) return;
    this.duck(0.18, 1.6);
    this.tone(150, 1.1, { type: "sine", gain: 0.085, glideTo: 46 });
    this.tone(300, 0.5, { type: "triangle", gain: 0.03, delay: 0.04 });
    this.noise(0.5, { type: "lowpass", freq: 1600, sweepTo: 220, gain: 0.035, delay: 0.02 });
  }

  /* ---------------------------------------------------------------- */
  /* Scene 4 — intelligence                                             */
  /* ---------------------------------------------------------------- */

  /** The analysis beginning: the room steps back, a measurement rises. */
  scan(): void {
    if (!this.gate("scan", 1500)) return;
    this.duck(0.14, 2.6);
    this.tone(320, 1.6, { gain: 0.05, glideTo: 1280 });
    this.tone(640, 1.2, { gain: 0.025, glideTo: 2560, delay: 0.25 });
  }

  /** Each station measured as the ring passes it. */
  measure(): void {
    if (!this.gate("measure", 150)) return;
    this.tone(2400, 0.05, { type: "sine", gain: 0.012 });
  }

  /** The constraint identified — precise, three descending steps. */
  constraintFound(): void {
    if (!this.gate("found", 1500)) return;
    [880, 740, 590].forEach((f, i) => this.tone(f, 0.28, { gain: 0.035, delay: i * 0.1 }));
  }

  /** Optimisation applied — a settled major arpeggio. */
  resolve(): void {
    if (!this.gate("resolve", 1200)) return;
    const base = 440;
    [1, 1.25, 1.5, 2].forEach((ratio, i) => {
      this.tone(base * ratio, 0.5, { gain: 0.045, delay: i * 0.09 });
    });
  }

  /** A new route coming into service. */
  routeActivate(): void {
    if (!this.gate("route", 1200)) return;
    this.noise(0.7, { type: "bandpass", freq: 300, sweepTo: 1800, q: 2, gain: 0.035 });
    this.tone(220, 0.6, { type: "triangle", gain: 0.03, glideTo: 660 });
  }

  /** Queues draining, rhythm coordinating: a slow harmonic settle. */
  stabilise(): void {
    if (!this.gate("stabilise", 4000)) return;
    [196, 294, 392].forEach((f, i) => this.tone(f, 1.6, { gain: 0.03, delay: i * 0.22 }));
  }

  /* ---------------------------------------------------------------- */
  /* Scene 5 — the closure                                              */
  /* ---------------------------------------------------------------- */

  /** The machine going back under: the opening motif, reversed in feel. */
  closing(): void {
    if (!this.gate("closing", 5000)) return;
    this.noise(1.6, { type: "bandpass", freq: 2200, sweepTo: 260, q: 2.5, gain: 0.04 });
    this.tone(300, 1.4, { type: "triangle", gain: 0.035, glideTo: 120 });
  }

  /** Contact, and one long resonance left behind. */
  finalResonance(): void {
    if (!this.gate("final", 8000)) return;
    this.tone(84, 0.5, { type: "sine", gain: 0.1, glideTo: 60 });
    this.tone(110, 3.2, { type: "sine", gain: 0.05, delay: 0.1 });
    this.tone(165, 3.0, { type: "sine", gain: 0.03, delay: 0.16 });
  }

  /* ---------------------------------------------------------------- */
  /* Interface                                                          */
  /* ---------------------------------------------------------------- */

  /** Soft data pulse — orders completing their journey. */
  pulse(): void {
    if (!this.gate("pulse", 700)) return;
    this.tone(880, 0.14, { gain: 0.04 });
  }

  /** UI press. */
  click(): void {
    if (!this.gate("click", 60)) return;
    this.tone(1400, 0.05, { type: "square", gain: 0.02 });
  }
}

/** Singleton — one audio context for the whole experience. */
export const soundEngine = new SoundEngine();
