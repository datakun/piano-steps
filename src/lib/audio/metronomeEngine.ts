import * as Tone from 'tone';

export type MetronomeTickCallback = (beat: number, time: number) => void;

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
