import * as Tone from 'tone';

/**
 * Shared piano Sampler singleton using Salamander Grand Piano samples.
 * Loads ~15 notes from CDN; Tone.Sampler pitch-shifts to cover all 88 keys.
 */

const BASE_URL = 'https://tonejs.github.io/audio/salamander/';

/** Sparse sample map — every minor-3rd across the full range */
const SAMPLE_MAP: Record<string, string> = {
  A0: 'A0.mp3',
  C1: 'C1.mp3',
  A1: 'A1.mp3',
  C2: 'C2.mp3',
  A2: 'A2.mp3',
  C3: 'C3.mp3',
  A3: 'A3.mp3',
  C4: 'C4.mp3',
  A4: 'A4.mp3',
  C5: 'C5.mp3',
  A5: 'A5.mp3',
  C6: 'C6.mp3',
  A6: 'A6.mp3',
  C7: 'C7.mp3',
  C8: 'C8.mp3',
};

type SamplerStatus = 'idle' | 'loading' | 'ready' | 'error';

let sampler: Tone.Sampler | null = null;
let status: SamplerStatus = 'idle';
let loadPromise: Promise<Tone.Sampler> | null = null;

/**
 * Lazily initialise and return the shared piano Sampler.
 * Subsequent calls return the same Promise / instance.
 */
export function getPianoSampler(): Promise<Tone.Sampler> {
  if (sampler && status === 'ready') return Promise.resolve(sampler);
  if (loadPromise) return loadPromise;

  status = 'loading';

  loadPromise = new Promise<Tone.Sampler>((resolve, reject) => {
    const s = new Tone.Sampler({
      urls: SAMPLE_MAP,
      baseUrl: BASE_URL,
      release: 1,
      onload: () => {
        sampler = s;
        status = 'ready';
        resolve(s);
      },
      onerror: (err) => {
        status = 'error';
        loadPromise = null;
        reject(err);
      },
    }).toDestination();
  });

  return loadPromise;
}

/** Check whether the sampler is loaded and playable. */
export function isPianoReady(): boolean {
  return status === 'ready';
}

/** Tear down the sampler (e.g. on app unload). */
export function disposePiano(): void {
  if (sampler) {
    sampler.releaseAll();
    sampler.dispose();
    sampler = null;
  }
  status = 'idle';
  loadPromise = null;
}

/** Convert a MIDI number to a Tone.js note string (e.g. 60 → "C4"). */
export function midiToNoteName(midi: number): string {
  return Tone.Frequency(midi, 'midi').toNote();
}
