import type { Place } from "@/lib/places/schema";

type AmbientKind = Place["ambient"];

/**
 * Procedural ambience with the Web Audio API: no audio files at all.
 * Each place is a bed of filtered noise plus sparse one-shot events (birds,
 * cups, passing cars). Everything is quiet by design and starts only after a
 * user gesture, as browsers require.
 */
class AmbientEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private bed: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private timer: number | null = null;
  private kind: AmbientKind | null = null;
  private muted = false;
  private night = 0;

  /** Call from a click or key press. Safe to call repeatedly. */
  unlock() {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const Context =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return;
    this.context = new Context();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    this.master.connect(this.context.destination);

    // Two seconds of white noise, looped, feeds every noise-based layer.
    const length = this.context.sampleRate * 2;
    this.noise = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let index = 0; index < length; index++) data[index] = Math.random() * 2 - 1;

    if (this.kind) this.start(this.kind);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.context.currentTime, 0.2);
    }
  }

  /** 0 by day, 1 at night: fewer birds, quieter streets. */
  setNight(night: number) {
    this.night = night;
  }

  setPlace(kind: AmbientKind | null) {
    if (kind === this.kind) return;
    this.kind = kind;
    this.stop();
    if (kind && this.context) this.start(kind);
  }

  /** A short plucked melody for the musician's song. */
  playSong() {
    const context = this.context;
    if (!context || !this.master) return;
    // A minor pentatonic phrase, two bars.
    const notes = [
      220, 261.6, 329.6, 392, 329.6, 261.6, 293.7, 220, 261.6, 329.6, 440, 392, 329.6, 293.7, 261.6,
      220,
    ];
    notes.forEach((frequency, index) => {
      const at = context.currentTime + 0.3 + index * 0.42;
      this.pluck(frequency, at, 0.5);
      if (index % 4 === 0) this.pluck(frequency / 2, at, 0.35);
    });
  }

  private pluck(frequency: number, at: number, volume: number) {
    const context = this.context!;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2600, at);
    filter.frequency.exponentialRampToValueAtTime(500, at + 0.9);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 1.1);
    oscillator.connect(filter).connect(gain).connect(this.master!);
    oscillator.start(at);
    oscillator.stop(at + 1.2);
  }

  private noiseLayer(
    type: BiquadFilterType,
    frequency: number,
    q: number,
    volume: number,
    wobble = 0,
  ) {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.bed!);
    if (wobble > 0) {
      // Slow swell, like wind or a murmuring crowd.
      const lfo = context.createOscillator();
      const depth = context.createGain();
      lfo.frequency.value = 0.07 + Math.random() * 0.08;
      depth.gain.value = volume * wobble;
      lfo.connect(depth).connect(gain.gain);
      lfo.start();
    }
    source.start();
  }

  private start(kind: AmbientKind) {
    const context = this.context!;
    this.bed = context.createGain();
    this.bed.gain.value = 0;
    this.bed.gain.setTargetAtTime(1, context.currentTime, 1.2);
    this.bed.connect(this.master!);

    if (kind === "park") {
      this.noiseLayer("lowpass", 520, 0.4, 0.16, 0.6); // wind
      this.noiseLayer("bandpass", 3200, 0.8, 0.035, 0.8); // leaves
    } else if (kind === "cafe") {
      this.noiseLayer("bandpass", 480, 0.9, 0.11, 0.5); // murmur
      this.noiseLayer("lowpass", 180, 0.5, 0.1, 0.3); // city
    } else {
      this.noiseLayer("lowpass", 260, 0.5, 0.2, 0.35); // traffic hum
      this.noiseLayer("bandpass", 900, 0.6, 0.04, 0.6);
    }

    const tick = () => {
      this.event(kind);
      this.timer = window.setTimeout(tick, 1400 + Math.random() * 4200);
    };
    this.timer = window.setTimeout(tick, 1500);
  }

  private stop() {
    if (this.timer !== null) window.clearTimeout(this.timer);
    this.timer = null;
    const bed = this.bed;
    this.bed = null;
    if (bed && this.context) {
      bed.gain.setTargetAtTime(0, this.context.currentTime, 0.3);
      window.setTimeout(() => bed.disconnect(), 1500);
    }
  }

  private event(kind: AmbientKind) {
    const context = this.context;
    if (!context || !this.bed || context.state !== "running") return;
    const now = context.currentTime;
    if (kind === "park") {
      if (Math.random() > this.night * 0.95) this.bird(now);
    } else if (kind === "cafe") {
      if (Math.random() < 0.6) this.clink(now);
      else this.swoosh(now, 140, 0.16, 5); // S-Bahn rumbling overhead
    } else {
      this.swoosh(now, 500 + Math.random() * 500, 0.1 * (1 - this.night * 0.5), 2.6); // passing car
    }
  }

  private bird(at: number) {
    const context = this.context!;
    const base = 2400 + Math.random() * 1800;
    const chirps = 2 + Math.floor(Math.random() * 4);
    for (let index = 0; index < chirps; index++) {
      const start = at + index * (0.11 + Math.random() * 0.05);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.setValueAtTime(base, start);
      oscillator.frequency.exponentialRampToValueAtTime(
        base * (1.15 + Math.random() * 0.4),
        start + 0.06,
      );
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.05, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.09);
      oscillator.connect(gain).connect(this.bed!);
      oscillator.start(start);
      oscillator.stop(start + 0.1);
    }
  }

  private clink(at: number) {
    const context = this.context!;
    for (const frequency of [2100 + Math.random() * 500, 3350 + Math.random() * 600]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.045, at);
      gain.gain.exponentialRampToValueAtTime(0.0005, at + 0.35);
      oscillator.connect(gain).connect(this.bed!);
      oscillator.start(at);
      oscillator.stop(at + 0.4);
    }
  }

  private swoosh(at: number, frequency: number, volume: number, duration: number) {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(frequency * 0.7, at);
    filter.frequency.linearRampToValueAtTime(frequency * 1.3, at + duration / 2);
    filter.frequency.linearRampToValueAtTime(frequency * 0.6, at + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + duration / 2);
    gain.gain.linearRampToValueAtTime(0, at + duration);
    source.connect(filter).connect(gain).connect(this.bed!);
    source.start(at);
    source.stop(at + duration + 0.1);
  }
}

/** Overall loudness. Deliberately low: ambience should sit in the background. */
const MASTER_VOLUME = 0.32;

export const ambient = new AmbientEngine();
