import type { NoteName, NoteNameSharp, NoteNameFlat, Pitch } from '../../types/music';

const SHARP_NOTES: NoteNameSharp[] = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES: NoteNameFlat[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Keys that prefer flats in their spelling
const FLAT_KEYS: NoteName[] = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb'];

/** Convert any note name to a semitone index (0-11, C=0) */
export function noteToSemitone(name: NoteName): number {
  const sharpIdx = SHARP_NOTES.indexOf(name as NoteNameSharp);
  if (sharpIdx >= 0) return sharpIdx;
  const flatIdx = FLAT_NOTES.indexOf(name as NoteNameFlat);
  if (flatIdx >= 0) return flatIdx;
  return 0;
}

/** Convert semitone index to note name, choosing sharps or flats based on context */
export function semitoneToNote(semitone: number, preferFlats = false): NoteName {
  const idx = ((semitone % 12) + 12) % 12;
  return preferFlats ? FLAT_NOTES[idx] : SHARP_NOTES[idx];
}

/** Determine if a key context prefers flats */
export function prefersFlats(key: NoteName): boolean {
  return FLAT_KEYS.includes(key);
}

/** Create a Pitch object */
export function pitch(name: NoteName, octave: number): Pitch {
  return {
    name,
    octave,
    midi: noteToSemitone(name) + (octave + 1) * 12,
  };
}

/** Get MIDI number for a pitch */
export function pitchToMidi(p: Pitch): number {
  return p.midi;
}

/** Convert MIDI number to Pitch */
export function midiToPitch(midi: number, preferFlats = false): Pitch {
  const octave = Math.floor(midi / 12) - 1;
  const semitone = midi % 12;
  const name = semitoneToNote(semitone, preferFlats);
  return { name, octave, midi };
}

/** Transpose a pitch by semitones */
export function transposePitch(p: Pitch, semitones: number, preferFlats = false): Pitch {
  return midiToPitch(p.midi + semitones, preferFlats);
}

/** Convert pitch to VexFlow notation string, e.g. "C/4", "Eb/5" */
export function pitchToVexflow(p: Pitch): string {
  return `${p.name}/${p.octave}`;
}

/** Get all 12 root notes in chromatic order starting from C */
export function getAllRoots(): NoteName[] {
  return ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
}

/** Get note name for display (e.g., chord symbols) */
export function noteDisplay(name: NoteName): string {
  return name.replace('#', '\u266F').replace('b', '\u266D');
}

/** Transpose a note name by semitones */
export function transposeNoteName(name: NoteName, semitones: number, preferFlats = false): NoteName {
  const current = noteToSemitone(name);
  return semitoneToNote(current + semitones, preferFlats);
}

/**
 * Re-spell a pitch to match key signature conventions.
 * Sharp keys (G, D, A, E, B) need sharps instead of flats for notes in the key signature.
 * e.g., in key of G, Gb → F#; in key of D, Gb → F# and Db → C#.
 */
const SHARP_KEY_SEMITONES: Record<string, number[]> = {
  'G':  [6],
  'D':  [6, 1],
  'A':  [6, 1, 8],
  'E':  [6, 1, 8, 3],
  'B':  [6, 1, 8, 3, 10],
};

const FLAT_TO_SHARP: Record<string, NoteName> = {
  'Gb': 'F#', 'Db': 'C#', 'Ab': 'G#', 'Eb': 'D#', 'Bb': 'A#',
};

/**
 * 음들의 스팬이 12반음(옥타브)을 초과하면
 * 최저음을 옥타브 위로 올려서 close voicing으로 만듦.
 */
export function compactVoicing(notes: Pitch[]): Pitch[] {
  if (notes.length <= 1) return notes;
  const sorted = [...notes].sort((a, b) => a.midi - b.midi);
  while (sorted.length > 1 && sorted[sorted.length - 1].midi - sorted[0].midi > 12) {
    const lowest = sorted.shift()!;
    sorted.push(pitch(lowest.name, lowest.octave + 1));
    sorted.sort((a, b) => a.midi - b.midi);
  }
  return sorted;
}

export function respellForKey(p: Pitch, key: NoteName): Pitch {
  const semitones = SHARP_KEY_SEMITONES[key];
  if (!semitones) return p;

  const sem = noteToSemitone(p.name);
  if (semitones.includes(sem) && FLAT_TO_SHARP[p.name]) {
    return { ...p, name: FLAT_TO_SHARP[p.name] as NoteName };
  }
  return p;
}
