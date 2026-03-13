import type { Pitch } from '../types/music';
import { pitch, noteToSemitone, semitoneToNote } from '../lib/music/noteUtils';

/**
 * Jazz Hanon exercise data - "Triads and Seventh Chords"
 * Based on docs/jazz trill.jpeg
 *
 * Each exercise uses C major diatonic 7th chords:
 * I=CM7, II=Dm7, III=Em7, IV=FM7, V=G7, VI=Am7, VII=Bm7b5
 *
 * Each pattern is a sequence of 8th notes arpeggiating chord tones.
 */

export interface ExercisePattern {
  id: number | string;
  name: string;
  description: string;
  /** Notes for each chord degree (I-VII), each is an array of 8th note pitches */
  patterns: Pitch[][];
  /** Right-hand fingering for each note position (same for all 7 chords) */
  fingerings: string[];
  /** Whether this is a user-created custom pattern */
  isCustom?: boolean;
  /** Original degree sequence (only for custom patterns, enables re-editing) */
  degrees?: ChordDegree[];
}

/** Chord tone degree: 1=R, 3=3rd, 5=5th, 7=7th at base octave; 8,10,12,14 = same +1 octave; 9,11,13 = tensions +1 octave */
export type ChordDegree = 1 | 3 | 5 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export const DEGREE_LABELS: Record<ChordDegree, string> = {
  1: 'I', 3: 'III', 5: 'V', 7: 'VII',
  9: 'IX', 11: 'XI', 13: 'XIII',
  8: "I'", 10: "III'", 12: "V'", 14: "VII'",
};

const DEGREE_MAP: Record<ChordDegree, { toneIndex: number; octaveOffset: number }> = {
  1:  { toneIndex: 0, octaveOffset: 0 },
  3:  { toneIndex: 1, octaveOffset: 0 },
  5:  { toneIndex: 2, octaveOffset: 0 },
  7:  { toneIndex: 3, octaveOffset: 0 },
  8:  { toneIndex: 0, octaveOffset: 1 },
  9:  { toneIndex: 4, octaveOffset: 1 },
  10: { toneIndex: 1, octaveOffset: 1 },
  11: { toneIndex: 5, octaveOffset: 1 },
  12: { toneIndex: 2, octaveOffset: 1 },
  13: { toneIndex: 6, octaveOffset: 1 },
  14: { toneIndex: 3, octaveOffset: 1 },
};

/** Convert a degree sequence to Pitch[][] for all 7 diatonic chords */
export function degreesToPatterns(degrees: ChordDegree[]): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const baseOct = 4;
    const root = chord.tones[0];
    return degrees.map((deg) => {
      const { toneIndex, octaveOffset } = DEGREE_MAP[deg];
      const tone = chord.tones[toneIndex];
      return p(tone, o(tone, root, baseOct + octaveOffset));
    });
  });
}

// C major diatonic chord tones (root, 3rd, 5th, 7th, 9th, 11th, 13th)
const DIATONIC_TONES = [
  // I: CM7 - C E G B + tensions D F A
  { root: 'C', tones: ['C', 'E', 'G', 'B', 'D', 'F', 'A'], label: 'CM7' },
  // II: Dm7 - D F A C + tensions E G B
  { root: 'D', tones: ['D', 'F', 'A', 'C', 'E', 'G', 'B'], label: 'Dm7' },
  // III: Em7 - E G B D + tensions F A C
  { root: 'E', tones: ['E', 'G', 'B', 'D', 'F', 'A', 'C'], label: 'Em7' },
  // IV: FM7 - F A C E + tensions G B D
  { root: 'F', tones: ['F', 'A', 'C', 'E', 'G', 'B', 'D'], label: 'FM7' },
  // V: G7 - G B D F + tensions A C E
  { root: 'G', tones: ['G', 'B', 'D', 'F', 'A', 'C', 'E'], label: 'G7' },
  // VI: Am7 - A C E G + tensions B D F
  { root: 'A', tones: ['A', 'C', 'E', 'G', 'B', 'D', 'F'], label: 'Am7' },
  // VII: Bm7b5 - B D F A + tensions C E G
  { root: 'B', tones: ['B', 'D', 'F', 'A', 'C', 'E', 'G'], label: 'Bm7b5' },
] as const;

function p(name: string, octave: number): Pitch {
  return pitch(name as any, octave);
}

/** Correct octave for a chord tone: if its semitone < root's semitone, bump up one octave */
function o(tone: string, root: string, baseOct: number): number {
  return baseOct + (noteToSemitone(tone as any) < noteToSemitone(root as any) ? 1 : 0);
}

/** Generate bass chords (R-3-5-7) for all 7 diatonic chords. G and above start at octave 2. */
export function getDiatonicBassChords(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const tones = [chord.tones[0], chord.tones[1], chord.tones[2], chord.tones[3]];
    const rootSem = noteToSemitone(tones[0] as any);
    let oct = rootSem >= 7 ? 2 : 3; // G(7), A(9), B(11) → octave 2
    let prevSem = -1;
    return tones.map((tone) => {
      const sem = noteToSemitone(tone as any);
      if (prevSem >= 0 && sem <= prevSem) {
        oct++;
      }
      prevSem = sem;
      return p(tone, oct);
    });
  });
}

/**
 * Pattern 1: Ascending arpeggios (1-3-5-7-8-7-5-3)
 * Each chord: up through chord tones, then back down
 */
function pattern1(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const b = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, o(r,r,b)), p(t3, o(t3,r,b)), p(t5, o(t5,r,b)), p(t7, o(t7,r,b)),
      p(r, o(r,r,b+1)), p(t7, o(t7,r,b)), p(t5, o(t5,r,b)), p(t3, o(t3,r,b)),
    ];
  });
}

/**
 * Pattern 2: Descending arpeggios (8-7-5-3-1-3-5-7)
 * Start from top, descend, then ascend back
 */
function pattern2(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const b = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, o(r,r,b+1)), p(t7, o(t7,r,b)), p(t5, o(t5,r,b)), p(t3, o(t3,r,b)),
      p(r, o(r,r,b)), p(t3, o(t3,r,b)), p(t5, o(t5,r,b)), p(t7, o(t7,r,b)),
    ];
  });
}

/**
 * Pattern 3: Zigzag ascending (1-3-3-5-5-7-7-8)
 * Step up in pairs
 */
function pattern3(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const b = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, o(r,r,b)), p(t3, o(t3,r,b)), p(t3, o(t3,r,b)), p(t5, o(t5,r,b)),
      p(t5, o(t5,r,b)), p(t7, o(t7,r,b)), p(t7, o(t7,r,b)), p(r, o(r,r,b+1)),
    ];
  });
}

/**
 * Pattern 4: Skip pattern (1-5-3-7-5-8-7-3)
 * Wider intervals for coordination
 */
function pattern4(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const b = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, o(r,r,b)), p(t5, o(t5,r,b)), p(t3, o(t3,r,b)), p(t7, o(t7,r,b)),
      p(t5, o(t5,r,b)), p(r, o(r,r,b+1)), p(t7, o(t7,r,b)), p(t3, o(t3,r,b)),
    ];
  });
}

/**
 * Pattern 5: Continuous ascending through 2 octaves (1-3-5-7-1-3-5-7)
 */
function pattern5(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const b = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, o(r,r,b)), p(t3, o(t3,r,b)), p(t5, o(t5,r,b)), p(t7, o(t7,r,b)),
      p(r, o(r,r,b+1)), p(t3, o(t3,r,b+1)), p(t5, o(t5,r,b+1)), p(t7, o(t7,r,b+1)),
    ];
  });
}

/**
 * Pattern 6: Continuous descending from 2 octaves (7-5-3-1-7-5-3-1)
 */
function pattern6(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const b = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(t7, o(t7,r,b+1)), p(t5, o(t5,r,b+1)), p(t3, o(t3,r,b+1)), p(r, o(r,r,b+1)),
      p(t7, o(t7,r,b)), p(t5, o(t5,r,b)), p(t3, o(t3,r,b)), p(r, o(r,r,b)),
    ];
  });
}

export const EXERCISES: ExercisePattern[] = [
  { id: 1, name: 'Pattern 1', description: 'Ascending & descending (1-3-5-7-8-7-5-3)', patterns: pattern1(), fingerings: ['1','2','3','4','5','4','3','2'], degrees: [1, 3, 5, 7, 8, 7, 5, 3] },
  { id: 2, name: 'Pattern 2', description: 'Descending & ascending (8-7-5-3-1-3-5-7)', patterns: pattern2(), fingerings: ['5','4','3','2','1','2','3','5'], degrees: [8, 7, 5, 3, 1, 3, 5, 7] },
  { id: 3, name: 'Pattern 3', description: 'Zigzag ascending (1-3-3-5-5-7-7-8)', patterns: pattern3(), fingerings: ['1','2','2','3','3','4','4','5'], degrees: [1, 3, 3, 5, 5, 7, 7, 8] },
  { id: 4, name: 'Pattern 4', description: 'Skip intervals (1-5-3-7-5-8-7-3)', patterns: pattern4(), fingerings: ['1','3','2','4','3','5','4','2'], degrees: [1, 5, 3, 7, 5, 8, 7, 3] },
  { id: 5, name: 'Pattern 5', description: 'Two octave ascending (1-3-5-7-1-3-5-7)', patterns: pattern5(), fingerings: ['1','2','3','4','1','2','3','5'], degrees: [1, 3, 5, 7, 8, 10, 12, 14] },
  { id: 6, name: 'Pattern 6', description: 'Two octave descending (7-5-3-1-7-5-3-1)', patterns: pattern6(), fingerings: ['5','3','2','1','5','3','2','1'], degrees: [14, 12, 10, 8, 7, 5, 3, 1] },
];

export const DIATONIC_CHORD_LABELS = DIATONIC_TONES.map(c => c.label);

/**
 * Auto-generate natural right-hand fingerings (1-5) from note pitches.
 * Uses pitch rank within the pattern to assign fingers.
 * For ≤5 unique pitches: direct rank→finger mapping.
 * For >5 unique pitches: split into two 4-note groups with thumb-under.
 */
export function autoFingering(notes: Pitch[]): string[] {
  const n = notes.length;
  if (n === 0) return [];

  const midis = notes.map(p => p.midi);
  const uniqueSorted = [...new Set(midis)].sort((a, b) => a - b);

  if (uniqueSorted.length <= 5) {
    const rankMap = new Map<number, number>();
    uniqueSorted.forEach((m, i) => rankMap.set(m, i + 1));
    return midis.map(m => String(rankMap.get(m)!));
  }

  // >5 unique pitches: split into two halves with thumb-under
  const half = Math.floor(n / 2);
  const result: string[] = [];

  for (let g = 0; g < 2; g++) {
    const start = g * half;
    const end = g === 0 ? half : n;
    const group = midis.slice(start, end);
    const gUnique = [...new Set(group)].sort((a, b) => a - b);
    const gRank = new Map<number, number>();
    gUnique.forEach((m, i) => gRank.set(m, i + 1));

    const maxRank = gUnique.length;
    const topMidi = gUnique[gUnique.length - 1];
    // Use pinky (5) for highest note if it's at a phrase boundary
    const usePinky = group[0] === topMidi || (g === 1 && group[group.length - 1] === topMidi);

    result.push(...group.map(m => {
      let r = gRank.get(m)!;
      if (usePinky && r === maxRank) r = 5;
      return String(Math.min(r, 5));
    }));
  }

  // Post-process: consecutive different notes must not share the same finger
  for (let i = 1; i < n; i++) {
    const prevF = parseInt(result[i - 1]);
    const currF = parseInt(result[i]);
    if (midis[i] !== midis[i - 1] && currF === prevF) {
      // Shift finger in the direction of pitch movement
      if (midis[i] > midis[i - 1]) {
        result[i] = String(Math.min(currF + 1, 5));
      } else {
        result[i] = String(Math.max(currF - 1, 1));
      }
    }
  }

  return result;
}

/**
 * Transpose an exercise to a different key.
 * @param exercise The original exercise (in C)
 * @param targetKey Target key name
 */
export function transposeExercise(exercise: ExercisePattern, targetKey: string): ExercisePattern {
  const semitones = noteToSemitone(targetKey as any) - noteToSemitone('C');
  if (semitones === 0) return exercise;

  return {
    ...exercise,
    patterns: exercise.patterns.map(pattern =>
      pattern.map(note => {
        const newMidi = note.midi + semitones;
        const oct = Math.floor(newMidi / 12) - 1;
        const sem = newMidi % 12;
        const name = semitoneToNote(sem, true);
        return pitch(name, oct);
      })
    ),
  };
}
