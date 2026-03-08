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

interface ExercisePattern {
  id: number;
  name: string;
  description: string;
  /** Notes for each chord degree (I-VII), each is an array of 8th note pitches */
  patterns: Pitch[][];
}

// C major diatonic chord tones (root, 3rd, 5th, 7th)
const DIATONIC_TONES = [
  // I: CM7 - C E G B
  { root: 'C', tones: ['C', 'E', 'G', 'B'], label: 'CM7' },
  // II: Dm7 - D F A C
  { root: 'D', tones: ['D', 'F', 'A', 'C'], label: 'Dm7' },
  // III: Em7 - E G B D
  { root: 'E', tones: ['E', 'G', 'B', 'D'], label: 'Em7' },
  // IV: FM7 - F A C E
  { root: 'F', tones: ['F', 'A', 'C', 'E'], label: 'FM7' },
  // V: G7 - G B D F
  { root: 'G', tones: ['G', 'B', 'D', 'F'], label: 'G7' },
  // VI: Am7 - A C E G
  { root: 'A', tones: ['A', 'C', 'E', 'G'], label: 'Am7' },
  // VII: Bm7b5 - B D F A
  { root: 'B', tones: ['B', 'D', 'F', 'A'], label: 'Bm7b5' },
] as const;

function p(name: string, octave: number): Pitch {
  return pitch(name as any, octave);
}

/**
 * Pattern 1: Ascending arpeggios (1-3-5-7-8-7-5-3)
 * Each chord: up through chord tones, then back down
 */
function pattern1(): Pitch[][] {
  return DIATONIC_TONES.map((chord, idx) => {
    const baseOct = 4;
    const [r, t3, t5, t7] = chord.tones;
    // Up: 1 3 5 7, then down: 8(next octave root) 7 5 3
    return [
      p(r, baseOct), p(t3, baseOct), p(t5, baseOct), p(t7, baseOct),
      p(r, baseOct + 1), p(t7, baseOct), p(t5, baseOct), p(t3, baseOct),
    ];
  });
}

/**
 * Pattern 2: Descending arpeggios (8-7-5-3-1-3-5-7)
 * Start from top, descend, then ascend back
 */
function pattern2(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const baseOct = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, baseOct + 1), p(t7, baseOct), p(t5, baseOct), p(t3, baseOct),
      p(r, baseOct), p(t3, baseOct), p(t5, baseOct), p(t7, baseOct),
    ];
  });
}

/**
 * Pattern 3: Zigzag ascending (1-3-3-5-5-7-7-8)
 * Step up in pairs
 */
function pattern3(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const baseOct = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, baseOct), p(t3, baseOct), p(t3, baseOct), p(t5, baseOct),
      p(t5, baseOct), p(t7, baseOct), p(t7, baseOct), p(r, baseOct + 1),
    ];
  });
}

/**
 * Pattern 4: Skip pattern (1-5-3-7-5-8-7-3)
 * Wider intervals for coordination
 */
function pattern4(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const baseOct = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, baseOct), p(t5, baseOct), p(t3, baseOct), p(t7, baseOct),
      p(t5, baseOct), p(r, baseOct + 1), p(t7, baseOct), p(t3, baseOct),
    ];
  });
}

/**
 * Pattern 5: Continuous ascending through 2 octaves (1-3-5-7-1-3-5-7)
 */
function pattern5(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const baseOct = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(r, baseOct), p(t3, baseOct), p(t5, baseOct), p(t7, baseOct),
      p(r, baseOct + 1), p(t3, baseOct + 1), p(t5, baseOct + 1), p(t7, baseOct + 1),
    ];
  });
}

/**
 * Pattern 6: Continuous descending from 2 octaves (7-5-3-1-7-5-3-1)
 */
function pattern6(): Pitch[][] {
  return DIATONIC_TONES.map((chord) => {
    const baseOct = 4;
    const [r, t3, t5, t7] = chord.tones;
    return [
      p(t7, baseOct + 1), p(t5, baseOct + 1), p(t3, baseOct + 1), p(r, baseOct + 1),
      p(t7, baseOct), p(t5, baseOct), p(t3, baseOct), p(r, baseOct),
    ];
  });
}

export const EXERCISES: ExercisePattern[] = [
  { id: 1, name: 'Pattern 1', description: 'Ascending & descending (1-3-5-7-8-7-5-3)', patterns: pattern1() },
  { id: 2, name: 'Pattern 2', description: 'Descending & ascending (8-7-5-3-1-3-5-7)', patterns: pattern2() },
  { id: 3, name: 'Pattern 3', description: 'Zigzag ascending (1-3-3-5-5-7-7-8)', patterns: pattern3() },
  { id: 4, name: 'Pattern 4', description: 'Skip intervals (1-5-3-7-5-8-7-3)', patterns: pattern4() },
  { id: 5, name: 'Pattern 5', description: 'Two octave ascending (1-3-5-7-1-3-5-7)', patterns: pattern5() },
  { id: 6, name: 'Pattern 6', description: 'Two octave descending (7-5-3-1-7-5-3-1)', patterns: pattern6() },
];

export const DIATONIC_CHORD_LABELS = DIATONIC_TONES.map(c => c.label);

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
