import type { NoteName, ChordVoicing, Progression } from '../types/music';
import { pitch, noteToSemitone, semitoneToNote } from '../lib/music/noteUtils';
import { createChord } from '../lib/music/chordBuilder';
import { getTwoFiveOneRoots } from '../lib/music/chordBuilder';

/**
 * A form (Open / Drop 2) voicing for II-V-I in C key.
 * Transcribed from lesson handout (docs/2-5-1 voicing 1.jpeg).
 *
 * IIm7 (Dm7): LH: D3, C4 | RH: E4, F4, A4
 * V7  (G7):   LH: G2, B3 | RH: D4, F4, A4
 * IM7 (CM7):  LH: C3, B3 | RH: D4, E4, G4
 */
const A_FORM_C: ChordVoicing[] = [
  {
    chord: createChord('D', 'm7'),
    leftHand: [pitch('D', 3), pitch('C', 4)],
    rightHand: [pitch('E', 4), pitch('F', 4), pitch('A', 4)],
  },
  {
    chord: createChord('G', '7'),
    leftHand: [pitch('G', 2), pitch('B', 3)],
    rightHand: [pitch('D', 4), pitch('F', 4), pitch('A', 4)],
  },
  {
    chord: createChord('C', 'M7'),
    leftHand: [pitch('C', 3), pitch('B', 3)],
    rightHand: [pitch('D', 4), pitch('E', 4), pitch('G', 4)],
  },
];

/**
 * B form (Close) voicing for II-V-I in C key.
 * Transcribed from lesson handout (docs/2-5-1 voicing 2.jpeg).
 *
 * IIm7 (Dm7): LH: D3 | RH: C4, E4, F4, A4
 * V7  (G7):   LH: G2 | RH: B3, D4, F4, A4
 * IM7 (CM7):  LH: C3 | RH: B3, D4, E4, G4
 */
const B_FORM_C: ChordVoicing[] = [
  {
    chord: createChord('D', 'm7'),
    leftHand: [pitch('D', 3)],
    rightHand: [pitch('C', 4), pitch('E', 4), pitch('F', 4), pitch('A', 4)],
  },
  {
    chord: createChord('G', '7'),
    leftHand: [pitch('G', 2)],
    rightHand: [pitch('B', 3), pitch('D', 4), pitch('F', 4), pitch('A', 4)],
  },
  {
    chord: createChord('C', 'M7'),
    leftHand: [pitch('C', 3)],
    rightHand: [pitch('B', 3), pitch('D', 4), pitch('E', 4), pitch('G', 4)],
  },
];

/**
 * Transpose a set of voicings by a given number of semitones.
 */
function transposeVoicings(voicings: ChordVoicing[], semitones: number, targetKey: NoteName): ChordVoicing[] {
  const [iiRoot, vRoot, iRoot] = getTwoFiveOneRoots(targetKey);
  const roots = [iiRoot, vRoot, iRoot];
  const qualities: ('m7' | '7' | 'M7')[] = ['m7', '7', 'M7'];

  return voicings.map((v, idx) => {
    const transposePitch = (p: typeof v.leftHand[0]) => {
      const newMidi = p.midi + semitones;
      const octave = Math.floor(newMidi / 12) - 1;
      const sem = newMidi % 12;
      const name = semitoneToNote(sem, true);
      return pitch(name, octave);
    };

    return {
      chord: createChord(roots[idx], qualities[idx]),
      leftHand: v.leftHand.map(transposePitch),
      rightHand: v.rightHand.map(transposePitch),
    };
  });
}

/**
 * Get II-V-I voicings for any key.
 */
export function getProgressionVoicings(key: NoteName, form: 'A' | 'B'): ChordVoicing[] {
  const baseVoicings = form === 'A' ? A_FORM_C : B_FORM_C;
  const semitones = noteToSemitone(key) - noteToSemitone('C');
  if (semitones === 0) return baseVoicings;
  return transposeVoicings(baseVoicings, semitones, key);
}

/**
 * Build a Progression object for a key.
 */
export function buildProgression(key: NoteName, form: 'A' | 'B'): Progression {
  const voicings = getProgressionVoicings(key, form);
  return {
    key,
    chords: [voicings[0], voicings[1], voicings[2]] as [ChordVoicing, ChordVoicing, ChordVoicing],
    form,
  };
}

/**
 * Generate 8 progressions in chromatic descending order.
 * Start from startKey and go down by half steps.
 */
export function generateChromaticProgressions(
  startKey: NoteName,
  form: 'A' | 'B',
  count = 8
): Progression[] {
  const startSemitone = noteToSemitone(startKey);
  const progressions: Progression[] = [];
  for (let i = 0; i < count; i++) {
    const sem = ((startSemitone - i) % 12 + 12) % 12;
    const key = semitoneToNote(sem, true);
    progressions.push(buildProgression(key, form));
  }
  return progressions;
}

/**
 * Generate 8 progressions with random starting keys.
 */
export function generateRandomProgressions(form: 'A' | 'B', count = 8): Progression[] {
  const allKeys: NoteName[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const shuffled = [...allKeys].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(key => buildProgression(key, form));
}
