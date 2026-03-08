import * as Tone from 'tone';

export type MetronomeTickCallback = (beat: number, time: number) => void;

class MetronomeEngine {
  private synth: Tone.MembraneSynth | null = null;
  private clickHigh: Tone.Synth | null = null;
  private clickLow: Tone.Synth | null = null;
  private loop: Tone.Loop | null = null;
  private _isPlaying = false;
  private _beat = 0;
  private _beatsPerMeasure = 4;

  private ensureSynths() {
    if (!this.clickHigh) {
      this.clickHigh = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
        volume: -6,
      }).toDestination();
    }
    if (!this.clickLow) {
      this.clickLow = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
        volume: -10,
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
