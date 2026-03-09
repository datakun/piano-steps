// ---------------------------------------------------------------------------
// Pitch Detection & Chord Recognition — Pure DSP Functions
// ---------------------------------------------------------------------------
// Guitar: FFT peak-picking + harmonic suppression
// Piano:  HPS (Harmonic Product Spectrum)
// Chord:  Set-based matching with scoring & penalty
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Instrument = 'guitar' | 'piano';

export interface ChordPattern {
  name: string;
  intervals: number[];
  display: string;
}

export interface DetectedNote {
  freq: number;
  db: number;
  bin: number;
  noteName: string;
  midi: number;
  noteClass: number; // 0–11, chromatic pitch class
  hps?: number;      // only populated in HPS mode
}

export interface ChordSenseResult {
  root: string;
  pattern: ChordPattern;
  confidence: number; // 0.0–1.0
}

export interface HistoryEntry {
  name: string;
  time: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NOTE_NAMES: readonly string[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
];

/**
 * Chord pattern library.
 * `intervals` are semitone offsets from the root (mod 12).
 * Values > 11 are octave-extended tones (e.g. 9th = 14).
 */
export const CHORD_PATTERNS: ChordPattern[] = [
  // Triads
  { name: 'maj',    intervals: [0, 4, 7],           display: '' },
  { name: 'min',    intervals: [0, 3, 7],           display: 'm' },
  { name: 'dim',    intervals: [0, 3, 6],           display: 'dim' },
  { name: 'aug',    intervals: [0, 4, 8],           display: 'aug' },
  // Suspended
  { name: 'sus2',   intervals: [0, 2, 7],           display: 'sus2' },
  { name: 'sus4',   intervals: [0, 5, 7],           display: 'sus4' },
  // Seventh
  { name: 'maj7',   intervals: [0, 4, 7, 11],       display: 'maj7' },
  { name: 'min7',   intervals: [0, 3, 7, 10],       display: 'm7' },
  { name: 'dom7',   intervals: [0, 4, 7, 10],       display: '7' },
  { name: 'dim7',   intervals: [0, 3, 6, 9],        display: 'dim7' },
  { name: 'min7b5', intervals: [0, 3, 6, 10],       display: 'm7b5' },
];

// ---------------------------------------------------------------------------
// Music Theory Utilities
// ---------------------------------------------------------------------------

/** Convert frequency (Hz) to MIDI note number (float). A4 = 440Hz = MIDI 69. */
export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

/** Convert MIDI note number to chromatic note name string (e.g. 60 -> "C"). */
export function midiToNoteName(midi: number): string {
  return NOTE_NAMES[((Math.round(midi) % 12) + 12) % 12];
}

// ---------------------------------------------------------------------------
// Chord Recognition — Set-based matching
// ---------------------------------------------------------------------------

/**
 * Match a set of pitch classes (0–11) against all chord patterns.
 * Uses a scoring system: reward matched intervals, penalise missing ones.
 * Requires at least 3 matched notes (or all required if pattern < 3).
 * When scores tie, prefer the more specific chord (more intervals).
 */
export function recognizeChord(noteSet: Set<number>): ChordSenseResult | null {
  if (noteSet.size < 2) return null;

  const notes = [...noteSet].sort((a, b) => a - b);
  let best: ChordSenseResult | null = null;
  let bestScore = -1;
  let bestMatched = 0;

  for (let root = 0; root < 12; root++) {
    for (const pattern of CHORD_PATTERNS) {
      const required = pattern.intervals.map((i) => (root + i) % 12);
      const matched = required.filter((n) => notes.includes(n)).length;
      const score =
        matched / pattern.intervals.length -
        (required.length - matched) * 0.3;

      // Require at least 3 matched notes (or all for smaller patterns)
      if (matched < Math.min(3, required.length)) continue;

      // Prefer higher score; on tie, prefer more matched notes (more specific chord)
      if (score > bestScore || (score === bestScore && matched > bestMatched)) {
        bestScore = score;
        bestMatched = matched;
        best = {
          root: NOTE_NAMES[root],
          pattern,
          confidence: matched / required.length,
        };
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Pitch Detection: Guitar (FFT peak picking + harmonic suppression)
// ---------------------------------------------------------------------------

/**
 * Guitar mode: detect multiple simultaneous pitches using FFT peak-picking.
 *
 * Algorithm:
 * 1. Find local magnitude peaks above a dB threshold in [60Hz, 1200Hz].
 * 2. Sort by amplitude, take top 12.
 * 3. Map each peak to a pitch class and keep the loudest per class.
 * 4. Walk descending by amplitude: for each accepted fundamental, suppress
 *    its 2nd–5th harmonics so they don't register as separate notes.
 */
export function detectPitchesFFT(
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
): DetectedNote[] {
  const bufLen = frequencyData.length;
  const freqPerBin = sampleRate / fftSize;
  const minBin = Math.floor(60 / freqPerBin);
  const maxBin = Math.min(Math.ceil(1200 / freqPerBin), bufLen - 1);
  const threshold = -55; // dBFS — GainNode already amplifies quiet signals

  // Step 1: local peak candidates
  const peaks: Array<{ freq: number; db: number; bin: number }> = [];
  for (let i = minBin + 1; i < maxBin - 1; i++) {
    const v = frequencyData[i];
    if (v > threshold && v > frequencyData[i - 1] && v > frequencyData[i + 1]) {
      peaks.push({ freq: (i * sampleRate) / fftSize, db: v, bin: i });
    }
  }

  // Step 2: keep loudest representative per pitch class
  peaks.sort((a, b) => b.db - a.db);
  const fundamentals = new Map<number, DetectedNote>();
  for (const peak of peaks.slice(0, 12)) {
    const midi = freqToMidi(peak.freq);
    const noteClass = ((Math.round(midi) % 12) + 12) % 12;
    const existing = fundamentals.get(noteClass);
    if (!existing || existing.db < peak.db) {
      fundamentals.set(noteClass, {
        ...peak,
        noteName: midiToNoteName(midi),
        midi: Math.round(midi),
        noteClass,
      });
    }
  }

  // Step 3: harmonic suppression walk
  const result: DetectedNote[] = [];
  const suppressed = new Set<number>();
  const sorted = [...fundamentals.values()].sort((a, b) => b.db - a.db);

  for (const f of sorted) {
    if (suppressed.has(f.noteClass)) continue;
    for (let h = 2; h <= 5; h++) {
      const harmMidi = f.midi + Math.round(12 * Math.log2(h));
      suppressed.add(((harmMidi % 12) + 12) % 12);
    }
    result.push(f);
  }

  return result.filter((n) => n.db > -55).slice(0, 6);
}

// ---------------------------------------------------------------------------
// Pitch Detection: Piano (HPS — Harmonic Product Spectrum)
// ---------------------------------------------------------------------------

/**
 * Piano mode: detect pitches using Harmonic Product Spectrum (HPS).
 *
 * Algorithm:
 * 1. Convert dB spectrum to linear amplitude.
 * 2. Compute HPS by multiplying downsampled copies (harmonics 2–4).
 * 3. Find local HPS peaks; deduplicate by pitch class.
 */
export function detectPitchesHPS(
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
): DetectedNote[] {
  const bufLen = frequencyData.length;
  const freqPerBin = sampleRate / fftSize;

  // dB -> linear amplitude
  const linear = new Float32Array(bufLen);
  for (let i = 0; i < bufLen; i++) {
    linear[i] = Math.pow(10, frequencyData[i] / 20);
  }

  // HPS product (4 harmonics)
  const hps = new Float32Array(bufLen);
  for (let i = 0; i < bufLen; i++) {
    hps[i] = linear[i];
    for (let h = 2; h <= 4; h++) {
      const j = Math.round(i * h);
      if (j < bufLen) hps[i] *= linear[j];
    }
  }

  const minBin = Math.floor(27.5 / freqPerBin);   // A0 (lowest piano key)
  const maxBin = Math.min(Math.ceil(4186 / freqPerBin), bufLen - 1); // C8
  const threshold = -50; // dBFS gate on raw spectrum — GainNode already amplifies quiet signals

  const peaks: Array<{ freq: number; db: number; bin: number; hps: number }> = [];
  for (let i = minBin + 1; i < maxBin - 1; i++) {
    if (
      hps[i] > hps[i - 1] &&
      hps[i] > hps[i + 1] &&
      frequencyData[i] > threshold
    ) {
      peaks.push({
        freq: (i * sampleRate) / fftSize,
        db: frequencyData[i],
        bin: i,
        hps: hps[i],
      });
    }
  }

  peaks.sort((a, b) => b.hps - a.hps);
  const notes = new Map<number, DetectedNote>();
  for (const p of peaks.slice(0, 16)) {
    const midi = freqToMidi(p.freq);
    const nc = ((Math.round(midi) % 12) + 12) % 12;
    if (!notes.has(nc)) {
      notes.set(nc, {
        ...p,
        noteName: midiToNoteName(midi),
        midi: Math.round(midi),
        noteClass: nc,
      });
    }
  }

  return [...notes.values()].sort((a, b) => (b.hps ?? 0) - (a.hps ?? 0)).slice(0, 8);
}

// ---------------------------------------------------------------------------
// Temporal Smoothing — NoteAccumulator
// ---------------------------------------------------------------------------

/**
 * Accumulates frame-level note detections over a rolling time window and
 * returns only pitch classes that appear in > 40% of frames.
 * This suppresses transient noise and pitch-detection jitter.
 */
export class NoteAccumulator {
  private readonly windowMs: number;
  private readonly stabilityThreshold: number;
  private history: Array<{ notes: DetectedNote[]; time: number }> = [];

  constructor(windowMs = 500, stabilityThreshold = 0.4) {
    this.windowMs = windowMs;
    this.stabilityThreshold = stabilityThreshold;
  }

  push(notes: DetectedNote[]): void {
    const now = Date.now();
    this.history.push({ notes, time: now });
    this.history = this.history.filter((h) => now - h.time < this.windowMs);
  }

  /** Returns pitch classes (0–11) stable across >= stabilityThreshold of recent frames. */
  getStable(): number[] {
    const counts = new Map<number, number>();
    for (const h of this.history) {
      for (const n of h.notes) {
        counts.set(n.noteClass, (counts.get(n.noteClass) ?? 0) + 1);
      }
    }
    const total = this.history.length;
    if (total === 0) return [];

    const stable: number[] = [];
    for (const [nc, cnt] of counts.entries()) {
      if (cnt / total > this.stabilityThreshold) stable.push(nc);
    }
    return stable;
  }

  reset(): void {
    this.history = [];
  }
}

// ---------------------------------------------------------------------------
// RMS energy (silence detection)
// ---------------------------------------------------------------------------

/**
 * Compute RMS energy from Uint8Array time-domain data.
 * Values: 0 (silence) → ~1 (max amplitude).
 * Input is Uint8Array from getByteTimeDomainData (0–255, center=128).
 */
export function computeRMSFromBytes(timeDomainData: Uint8Array): number {
  let rms = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    const v = timeDomainData[i] / 128 - 1;
    rms += v * v;
  }
  return Math.sqrt(rms / timeDomainData.length);
}
