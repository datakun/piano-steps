import * as Tone from 'tone';

export type MetronomeTickCallback = (beat: number, time: number) => void;

/** Convert 0–100 percentage to dB for the accent (high) click. */
export function volumeToDb(percent: number): number {
  if (percent <= 0) return -Infinity;
  // 0% = -∞, 80% ≈ -6 dB (legacy default), 100% = 0 dB
  return -30 + (percent / 100) * 30;
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

  private ensureSynths() {
    const highDb = volumeToDb(this._volume);
    const lowDb = highDb - ACCENT_OFFSET;

    if (!this.clickHigh) {
      this.clickHigh = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
        volume: highDb,
      }).toDestination();
    }
    if (!this.clickLow) {
      this.clickLow = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
        volume: lowDb,
      }).toDestination();
    }
  }

  async start(
    bpm: number,
    beatsPerMeasure: number,
    accentBeat1: boolean,
    onTick: MetronomeTickCallback
  ) {
    await Tone.start();
    this.ensureSynths();

    this._beatsPerMeasure = beatsPerMeasure;
    this._beat = 0;
    Tone.getTransport().bpm.value = bpm;

    this.stop();

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
    }, '4n');

    this.loop.start(0);
    Tone.getTransport().start();
    this._isPlaying = true;
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
  }

  setBpm(bpm: number) {
    Tone.getTransport().bpm.value = bpm;
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
