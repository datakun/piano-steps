// ---------------------------------------------------------------------------
// Melody Extractor — Quantize + MIDI Generation
// ---------------------------------------------------------------------------
// Converts Basic Pitch transcription output into quantized melody notes
// and generates a downloadable MIDI file.
// ---------------------------------------------------------------------------

import type { NoteEventTime } from '@spotify/basic-pitch';
import { Midi } from '@tonejs/midi';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MelodyNote {
  /** MIDI note number (0–127) */
  pitchMidi: number;
  /** Start time in seconds */
  startTime: number;
  /** Duration in seconds */
  duration: number;
  /** Amplitude 0–1 */
  amplitude: number;
  /** Note name (e.g. 'C4', 'D#5') */
  name: string;
}

// ---------------------------------------------------------------------------
// Note name helper
// ---------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function midiToName(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
}

// ---------------------------------------------------------------------------
// Convert Basic Pitch output to MelodyNote[]
// ---------------------------------------------------------------------------

export function toMelodyNotes(notes: NoteEventTime[]): MelodyNote[] {
  return notes
    .filter((n) => n.durationSeconds > 0.01) // discard artifacts
    .map((n) => ({
      pitchMidi: n.pitchMidi,
      startTime: n.startTimeSeconds,
      duration: n.durationSeconds,
      amplitude: n.amplitude,
      name: midiToName(n.pitchMidi),
    }))
    .sort((a, b) => a.startTime - b.startTime);
}

// ---------------------------------------------------------------------------
// Quantize notes to a tempo grid
// ---------------------------------------------------------------------------

/**
 * Snap note timings to a BPM-based rhythmic grid.
 * @param notes    - Input melody notes
 * @param bpm      - Tempo in beats per minute
 * @param subdivision - Grid resolution: 4=quarter, 8=eighth, 16=sixteenth
 */
export function quantizeNotes(
  notes: MelodyNote[],
  bpm: number,
  subdivision: 4 | 8 | 16 = 8,
): MelodyNote[] {
  const secondsPerBeat = 60 / bpm;
  const gridUnit = secondsPerBeat / (subdivision / 4);
  const minDuration = gridUnit; // at least one grid unit

  return notes
    .map((n) => {
      const snappedStart = Math.round(n.startTime / gridUnit) * gridUnit;
      const snappedEnd = Math.round((n.startTime + n.duration) / gridUnit) * gridUnit;
      const snappedDuration = Math.max(snappedEnd - snappedStart, minDuration);

      return {
        ...n,
        startTime: snappedStart,
        duration: snappedDuration,
      };
    })
    .filter((n) => n.duration >= minDuration);
}

// ---------------------------------------------------------------------------
// Generate MIDI file as Uint8Array
// ---------------------------------------------------------------------------

/**
 * Create a MIDI file from melody notes.
 * Uses @tonejs/midi (already a dependency of @spotify/basic-pitch).
 */
export function createMidiData(notes: MelodyNote[], bpm: number): Uint8Array {
  const midi = new Midi();

  // Set tempo
  midi.header.tempos = [{ bpm, ticks: 0 }];
  midi.header.timeSignatures = [{ timeSignature: [4, 4], ticks: 0 }];

  const track = midi.addTrack();
  track.name = 'Humming Melody';

  for (const note of notes) {
    track.addNote({
      midi: note.pitchMidi,
      time: note.startTime,
      duration: note.duration,
      velocity: Math.max(0.1, Math.min(1, note.amplitude)),
    });
  }

  return midi.toArray();
}

// ---------------------------------------------------------------------------
// Download helper
// ---------------------------------------------------------------------------

/**
 * Trigger a MIDI file download in the browser.
 */
export function downloadMidi(
  notes: MelodyNote[],
  bpm: number,
  filename = 'humming-melody.mid',
): void {
  const data = createMidiData(notes, bpm);
  const blob = new Blob([data.buffer as ArrayBuffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
