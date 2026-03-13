import * as Tone from 'tone';

export type MetronomeTickCallback = (beat: number, time: number) => void;

/**
 * Suspend the Tone.js AudioContext to release the media session.
 * Dismisses the lock screen media widget on mobile devices.
 * Safe to call when nothing is playing — resume happens via Tone.start().
 */
export function suspendAudioContext() {
  const ctx = Tone.getContext().rawContext as AudioContext | undefined;
  if (ctx && ctx.state === 'running' && typeof ctx.suspend === 'function') {
    ctx.suspend();
  }
}

// ── Media Session API helpers ──────────────────────────────────
// Controls the mobile lock screen media widget state.

/** Set media widget to "playing" state. */
export function setMediaSessionPlaying() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'playing';
  }
}

/** Set media widget to "paused" state (widget stays visible). */
export function setMediaSessionPaused() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'paused';
  }
}

/**
 * Dismiss the media widget entirely.
 * Sets playbackState to "none" and suspends AudioContext.
 */
export function setMediaSessionStopped() {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = 'none';
  }
  suspendAudioContext();
}

/** Convert 0–100 percentage to dB for the accent (high) click. */
export function volumeToDb(percent: number): number {
  if (percent <= 0) return -Infinity;
  // 0% = -∞, 80% ≈ 0 dB, 100% = +6 dB
  return -30 + (percent / 100) * 36;
}

/** Accent click is 4 dB louder than the regular click. */
const ACCENT_OFFSET = 4; // dB

class MetronomeEngine {
  private clickHigh: Tone.Synth | null = null;
  private clickLow: Tone.Synth | null = null;
  private loop: Tone.Loop | null = null;
  private _isPlaying = false;
  private _beat = 0;
  private _beatsPerMeasure = 4;
  private _volume = 80; // 0–100
  private _compound = false; // true for x/8 time signatures

  private ensureSynths() {
    const highDb = volumeToDb(this._volume);
    const lowDb = highDb - ACCENT_OFFSET;

    if (!this.clickHigh) {
      this.clickHigh = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
        volume: highDb,
      }).toDestination();
    }
    if (!this.clickLow) {
      this.clickLow = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
        volume: lowDb,
      }).toDestination();
    }
  }

  async start(
    bpm: number,
    beatsPerMeasure: number,
    accentBeat1: boolean,
    onTick: MetronomeTickCallback,
    compound = false,
  ) {
    await Tone.start();
    this.ensureSynths();

    this._beatsPerMeasure = beatsPerMeasure;
    this._beat = 0;
    this._compound = compound;

    // For compound meters (6/8, 7/8): BPM = dotted quarter note
    // Transport uses quarter-note BPM, so multiply by 1.5
    // Loop fires on 8th notes instead of quarter notes
    Tone.getTransport().bpm.value = compound ? bpm * 1.5 : bpm;

    this.stop();

    const subdivision = compound ? '8n' : '4n';

    this.loop = new Tone.Loop((time) => {
      const isAccent = accentBeat1 && this._beat === 0;
      const freq = isAccent ? 1200 : 800;
      const synth = isAccent ? this.clickHigh! : this.clickLow!;
      synth.triggerAttackRelease(freq, '32n', time);

      const currentBeat = this._beat;
      Tone.getDraw().schedule(() => {
        onTick(currentBeat, time);
      }, time);

      this._beat = (this._beat + 1) % this._beatsPerMeasure;
    }, subdivision);

    this.loop.start(0);
    Tone.getTransport().start();
    this._isPlaying = true;
    setMediaSessionPlaying();
  }

  stop() {
    if (this.loop) {
      this.loop.stop();
      this.loop.dispose();
      this.loop = null;
    }
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    this._isPlaying = false;
    this._beat = 0;

    // Dismiss mobile lock screen media widget
    setMediaSessionStopped();
  }

  setBpm(bpm: number) {
    Tone.getTransport().bpm.value = this._compound ? bpm * 1.5 : bpm;
  }

  /** Update volume (0–100). Takes effect immediately if synths exist. */
  setVolume(percent: number) {
    this._volume = Math.max(0, Math.min(100, percent));
    const highDb = volumeToDb(this._volume);
    const lowDb = highDb - ACCENT_OFFSET;
    if (this.clickHigh) this.clickHigh.volume.value = highDb;
    if (this.clickLow) this.clickLow.volume.value = lowDb;
  }

  get volume() {
    return this._volume;
  }

  get isPlaying() {
    return this._isPlaying;
  }

  dispose() {
    this.stop();
    this.clickHigh?.dispose();
    this.clickLow?.dispose();
    this.clickHigh = null;
    this.clickLow = null;
  }
}

// Singleton
export const metronomeEngine = new MetronomeEngine();
