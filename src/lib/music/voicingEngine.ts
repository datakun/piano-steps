import type { NoteName, ChordQuality, Pitch, ChordVoicing } from '../../types/music';
import { pitch, noteToSemitone, semitoneToNote } from './noteUtils';
import { CHORD_INTERVALS, TENSION_RULES, createChord } from './chordBuilder';

/**
 * Resolve an interval from a root to a properly spelled note name.
 * Jazz convention: always prefer flats (Bb not A#, Eb not D#).
 */
function resolveInterval(rootSemitone: number, interval: number, octave: number): Pitch {
  const sem = (rootSemitone + interval) % 12;
  // Jazz always uses flats for chord spelling
  const name = semitoneToNote(sem, true);
  const oct = octave + Math.floor((rootSemitone + interval) / 12);
  return pitch(name, oct);
}

/**
 * Build a basic (stacked) voicing: left hand = root (octave 3), right hand = 1-3-5-7
 */
export function buildBasicVoicing(root: NoteName, quality: ChordQuality): ChordVoicing {
  const intervals = CHORD_INTERVALS[quality];
  const rootSemitone = noteToSemitone(root);

  // Left hand: root at octave 3 (standard bass clef range)
  const bassRoot = pitch(root, 3);

  // Right hand: chord tones starting at octave 4
  const rightHand = intervals.map(interval =>
    resolveInterval(rootSemitone, interval, 4)
  );

  return {
    chord: createChord(root, quality),
    leftHand: [bassRoot],
    rightHand,
  };
}

/**
 * Build a Drop 2 voicing with tensions.
 *
 * Process (from lesson notes):
 * 1. Start with guide tones (3rd, 7th)
 * 2. Add available tensions (9, 11, 13)
 * 3. Can omit root and 5th from right hand
 * 4. Drop 2nd from top note to left hand
 */
export function buildDrop2Voicing(root: NoteName, quality: ChordQuality): ChordVoicing {
  const intervals = CHORD_INTERVALS[quality];
  const tensions = TENSION_RULES[quality];
  const rootSemitone = noteToSemitone(root);

  // Build voicing notes: guide tones + tensions
  const voicingIntervals: number[] = [];

  // Add 3rd (intervals[1])
  if (intervals[1] !== undefined) voicingIntervals.push(intervals[1]);
  // Add 7th/6th (intervals[3])
  if (intervals[3] !== undefined) voicingIntervals.push(intervals[3]);

  // Add available tensions
  const tensionSemitones: Record<number, number> = { 9: 2, 11: 5, 13: 9 };
  for (const t of tensions.available) {
    if (t in tensionSemitones) {
      voicingIntervals.push(tensionSemitones[t]);
    }
  }

  // Sort by interval size
  voicingIntervals.sort((a, b) => a - b);

  // Create right hand notes at octave 4
  let rightNotes = voicingIntervals.map(i => resolveInterval(rootSemitone, i, 4));

  // Ensure at least 3 notes in right hand
  if (rightNotes.length < 3 && intervals[2] !== undefined) {
    rightNotes.push(resolveInterval(rootSemitone, intervals[2], 4));
    rightNotes.sort((a, b) => a.midi - b.midi);
  }

  // Left hand: root at octave 3
  const bassRoot = pitch(root, 3);

  // Drop 2: take 2nd note from top, move to left hand
  if (rightNotes.length >= 3) {
    const sorted = [...rightNotes].sort((a, b) => a.midi - b.midi);
    const dropIdx = sorted.length - 2;
    const droppedNote = sorted[dropIdx];

    // Move dropped note down an octave to left hand
    const droppedLow = pitch(droppedNote.name, droppedNote.octave - 1);
    const remaining = sorted.filter((_, i) => i !== dropIdx);

    return {
      chord: createChord(root, quality),
      leftHand: [bassRoot, droppedLow],
      rightHand: remaining,
    };
  }

  return {
    chord: createChord(root, quality),
    leftHand: [bassRoot],
    rightHand: rightNotes,
  };
}
