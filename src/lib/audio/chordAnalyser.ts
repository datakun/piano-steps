import { CHORD_INTERVALS } from '../music/chordBuilder';
import { semitoneToNote } from '../music/noteUtils';
import type { NoteName } from '../../types/music';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChordResult {
  root: NoteName;
  quality: string;     // triad: '', 'm', 'dim', 'aug' | 7th: 'M7', '7', 'm7', etc.
  symbol: string;
  confidence: number;  // 0–1
}

// ---------------------------------------------------------------------------
// Pre-computed chord templates (generated once at module load)
// 4 triads + 9 seventh chords = 13 qualities × 12 roots = 156 templates
// ---------------------------------------------------------------------------

/** Triad intervals (defined here — not in chordBuilder) */
const TRIAD_INTERVALS: Record<string, number[]> = {
  '':    [0, 4, 7],    // Major
  'm':   [0, 3, 7],    // minor
  'dim': [0, 3, 6],    // diminished
  'aug': [0, 4, 8],    // augmented
};

interface ChordTemplate {
  root: number;        // semitone 0–11
  rootName: NoteName;
  quality: string;
  symbol: string;
  chroma: number[];    // 12-element binary vector
}

function buildTemplates(): ChordTemplate[] {
  const templates: ChordTemplate[] = [];

  for (let rootSem = 0; rootSem < 12; rootSem++) {
    const rootName = semitoneToNote(rootSem, true); // prefer flats (jazz convention)

    // --- Triads ---
    for (const [q, intervals] of Object.entries(TRIAD_INTERVALS)) {
      const chroma = new Array(12).fill(0);
      for (const iv of intervals) {
        chroma[(rootSem + iv) % 12] = 1;
      }
      const qualityDisplay = q === 'dim' ? '°' : q === 'aug' ? '+' : q;
      const symbol = `${rootName}${qualityDisplay}`;
      templates.push({ root: rootSem, rootName, quality: q, symbol, chroma });
    }

    // --- 7th chords (from chordBuilder) ---
    for (const [q, intervals] of Object.entries(CHORD_INTERVALS)) {
      const chroma = new Array(12).fill(0);
      for (const iv of intervals) {
        chroma[(rootSem + iv) % 12] = 1;
      }
      const qualityDisplay = q === 'mM7' ? '-(maj7)' : q === 'dim7' ? '°7' : q;
      const symbol = `${rootName}${qualityDisplay}`;
      templates.push({ root: rootSem, rootName, quality: q, symbol, chroma });
    }
  }
  return templates;
}

const TEMPLATES = buildTemplates();

// ---------------------------------------------------------------------------
// Chroma vector construction
// ---------------------------------------------------------------------------

/** Reference frequency for C0 (MIDI 12) ≈ 16.35 Hz */
const C0_FREQ = 16.3516;

/** Minimum / maximum frequency range for analysis (C2–B6) */
const MIN_FREQ = 65;   // ~C2
const MAX_FREQ = 2100;  // ~C7

/**
 * Build a 12-dimensional chroma vector from FFT frequency data.
 * Each element represents the total energy for one pitch class (C=0, C#=1, ..., B=11).
 */
export function buildChromaVector(
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
): number[] {
  const chroma = new Array(12).fill(0);
  const binCount = frequencyData.length; // fftSize / 2

  for (let bin = 0; bin < binCount; bin++) {
    const freq = (bin * sampleRate) / fftSize;
    if (freq < MIN_FREQ || freq > MAX_FREQ) continue;

    // Convert dB to linear magnitude (frequencyData is in dB)
    const dB = frequencyData[bin];
    if (dB < -90) continue; // skip very quiet bins
    const magnitude = Math.pow(10, dB / 20);

    // Map frequency to pitch class
    const pitchClass = Math.round(12 * Math.log2(freq / C0_FREQ)) % 12;
    const pc = ((pitchClass % 12) + 12) % 12;
    chroma[pc] += magnitude;
  }

  // Normalize to 0–1 range
  const max = Math.max(...chroma);
  if (max > 0) {
    for (let i = 0; i < 12; i++) chroma[i] /= max;
  }

  return chroma;
}

// ---------------------------------------------------------------------------
// Chord matching via cosine similarity
// ---------------------------------------------------------------------------

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < 12; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dotProduct / denom : 0;
}

/**
 * Match a chroma vector against all chord templates.
 * Returns the best-matching chord above the confidence threshold, or null.
 */
export function matchChord(
  chroma: number[],
  threshold = 0.72,
): ChordResult | null {
  let bestResult: ChordResult | null = null;
  let bestScore = 0;

  for (const tpl of TEMPLATES) {
    const score = cosineSimilarity(chroma, tpl.chroma);
    if (score < threshold) continue;

    if (score > bestScore) {
      bestScore = score;
      bestResult = {
        root: tpl.rootName,
        quality: tpl.quality,
        symbol: tpl.symbol,
        confidence: score,
      };
    }
  }

  return bestResult;
}

// ---------------------------------------------------------------------------
// RMS energy (silence detection)
// ---------------------------------------------------------------------------

/**
 * Compute RMS energy from time-domain audio data.
 * Values range from 0 (silence) to ~1 (max amplitude).
 * Used to detect 30-second silence for auto-stop.
 */
export function computeRMS(timeDomainData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    const sample = timeDomainData[i];
    sum += sample * sample;
  }
  return Math.sqrt(sum / timeDomainData.length);
}
