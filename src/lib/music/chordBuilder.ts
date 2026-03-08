import type { NoteName, ChordQuality, ChordDefinition, Pitch } from '../../types/music';
import { noteToSemitone, semitoneToNote, prefersFlats, pitch } from './noteUtils';

/** Interval definitions for each chord quality (semitones from root) */
export const CHORD_INTERVALS: Record<ChordQuality, number[]> = {
  'M7':    [0, 4, 7, 11],     // 1, 3, 5, 7
  '7':     [0, 4, 7, 10],     // 1, 3, 5, b7
  'm7':    [0, 3, 7, 10],     // 1, b3, 5, b7
  '7sus4': [0, 5, 7, 10],     // 1, 4, 5, b7
  'm7b5':  [0, 3, 6, 10],     // 1, b3, b5, b7
  'mM7':   [0, 3, 7, 11],     // 1, b3, 5, 7
  'dim7':  [0, 3, 6, 9],      // 1, b3, b5, bb7
  '6':     [0, 4, 7, 9],      // 1, 3, 5, 6
  'm6':    [0, 3, 7, 9],      // 1, b3, 5, 6
};

/** Tension availability per chord quality */
export const TENSION_RULES: Record<ChordQuality, { available: number[]; avoid: number[] }> = {
  'M7':    { available: [9, 13], avoid: [11] },     // #11 ok, natural 11 avoid
  'm7':    { available: [9, 11, 13], avoid: [] },
  '7':     { available: [9, 13], avoid: [] },
  '7sus4': { available: [9, 13], avoid: [] },
  'm7b5':  { available: [11], avoid: [] },
  'mM7':   { available: [9, 11], avoid: [] },
  'dim7':  { available: [], avoid: [] },
  '6':     { available: [9], avoid: [] },
  'm6':    { available: [9], avoid: [] },
};

/** Tension intervals in semitones from root */
export const TENSION_INTERVALS: Record<number, number> = {
  9: 2,     // 9 = 2 semitones above root (mod octave: +14 but typically +2)
  11: 5,    // 11 = 5 semitones
  13: 9,    // 13 = 9 semitones
};

/** Create a chord definition */
export function createChord(root: NoteName, quality: ChordQuality): ChordDefinition {
  const qualityDisplay = quality === 'mM7' ? '-(maj7)' : quality === 'dim7' ? '\u00B07' : quality;
  return {
    root,
    quality,
    symbol: `${root}${qualityDisplay}`,
  };
}

/** Build chord tones as Pitch array at a given octave */
export function buildChordPitches(root: NoteName, quality: ChordQuality, octave: number): Pitch[] {
  const intervals = CHORD_INTERVALS[quality];
  const rootSemitone = noteToSemitone(root);
  const useFlats = prefersFlats(root);

  return intervals.map(interval => {
    const semitone = (rootSemitone + interval) % 12;
    const name = semitoneToNote(semitone, useFlats);
    const noteOctave = octave + Math.floor((rootSemitone + interval) / 12);
    return pitch(name, noteOctave);
  });
}

/** Get the degree labels for each note in a chord (1, 3, 5, 7, etc.) */
export function getChordDegreeLabels(quality: ChordQuality): string[] {
  const labels: Record<ChordQuality, string[]> = {
    'M7':    ['1', '3', '5', '7'],
    '7':     ['1', '3', '5', '\u266D7'],
    'm7':    ['1', '\u266D3', '5', '\u266D7'],
    '7sus4': ['1', '4', '5', '\u266D7'],
    'm7b5':  ['1', '\u266D3', '\u266D5', '\u266D7'],
    'mM7':   ['1', '\u266D3', '5', '7'],
    'dim7':  ['1', '\u266D3', '\u266D5', '\u266D\u266D7'],
    '6':     ['1', '3', '5', '6'],
    'm6':    ['1', '\u266D3', '5', '6'],
  };
  return labels[quality];
}

/** Get II-V-I chord qualities for a given key */
export function getTwoFiveOneQualities(majorKey: boolean): [ChordQuality, ChordQuality, ChordQuality] {
  return majorKey ? ['m7', '7', 'M7'] : ['m7b5', '7', 'm7'];
}

/** Get II-V-I roots from a target key */
export function getTwoFiveOneRoots(targetRoot: NoteName): [NoteName, NoteName, NoteName] {
  const rootSemitone = noteToSemitone(targetRoot);
  const useFlats = prefersFlats(targetRoot);
  // II = 2 semitones above root, V = 7 semitones above root
  const ii = semitoneToNote((rootSemitone + 2) % 12, useFlats);
  const v = semitoneToNote((rootSemitone + 7) % 12, useFlats);
  return [ii, v, targetRoot];
}
