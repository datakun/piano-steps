import type { NoteName, ChordQuality } from '../types/music';

/** All root notes in chromatic order (using flats for display) */
export const ALL_ROOTS: NoteName[] = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
];

/** All chord qualities available in the cheat sheet */
export const ALL_QUALITIES: ChordQuality[] = [
  'M7', '7', 'm7', '7sus4', 'm7b5', 'mM7', 'dim7', '6', 'm6',
];

/** Display names for chord qualities */
export const QUALITY_DISPLAY: Record<ChordQuality, string> = {
  'M7': 'M7',
  '7': '7',
  'm7': 'm7',
  '7sus4': '7sus4',
  'm7b5': 'm7\u266D5',
  'mM7': '-(maj7)',
  'dim7': '\u00B07',
  '6': '6',
  'm6': 'm6',
};

/** Full display symbol for a chord */
export function chordSymbol(root: NoteName, quality: ChordQuality): string {
  return `${root}${QUALITY_DISPLAY[quality]}`;
}
