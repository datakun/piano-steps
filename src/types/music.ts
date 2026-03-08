export type NoteName =
  | 'C' | 'C#' | 'Db'
  | 'D' | 'D#' | 'Eb'
  | 'E'
  | 'F' | 'F#' | 'Gb'
  | 'G' | 'G#' | 'Ab'
  | 'A' | 'A#' | 'Bb'
  | 'B';

export type NoteNameSharp = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';
export type NoteNameFlat = 'C' | 'Db' | 'D' | 'Eb' | 'E' | 'F' | 'Gb' | 'G' | 'Ab' | 'A' | 'Bb' | 'B';

export interface Pitch {
  name: NoteName;
  octave: number;
  midi: number;
}

export type ChordQuality =
  | 'M7'      // Major 7
  | '7'       // Dominant 7
  | 'm7'      // Minor 7
  | '7sus4'   // Dominant 7 sus4
  | 'm7b5'    // Half-diminished (Minor 7 flat 5)
  | 'mM7'     // Minor Major 7
  | 'dim7'    // Diminished 7
  | '6'       // Major 6
  | 'm6';     // Minor 6

export interface ChordDefinition {
  root: NoteName;
  quality: ChordQuality;
  symbol: string;       // Display name, e.g. "CM7", "Dm7"
}

export interface ChordVoicing {
  chord: ChordDefinition;
  leftHand: Pitch[];
  rightHand: Pitch[];
}

export interface Progression {
  key: NoteName;
  chords: [ChordVoicing, ChordVoicing, ChordVoicing]; // IIm7, V7, IM7
  form: 'A' | 'B';
}

export type VoicingMode = 'basic' | 'drop2';
