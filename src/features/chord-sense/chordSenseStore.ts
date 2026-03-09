import { create } from 'zustand';
import type { Instrument, ChordSenseResult, HistoryEntry } from '../../lib/audio/pitchDetector';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

interface ChordSenseState {
  /** Selected instrument mode */
  instrument: Instrument;
  /** Whether the microphone is actively listening */
  isListening: boolean;
  /** Error message if mic access fails */
  micError: string | null;
  /** Currently detected chord (real-time) */
  currentChord: ChordSenseResult | null;
  /** Detected note names (e.g. ['C','E','G']) for note pills */
  detectedNotes: string[];
  /** RMS volume level 0–1 */
  volume: number;
  /** History of detected chords */
  history: HistoryEntry[];
  /** Reason for auto-stop (e.g. "no-input") */
  stopReason: string | null;

  // Actions
  setInstrument: (i: Instrument) => void;
  startListening: () => void;
  stopListening: (reason?: string) => void;
  setMicError: (err: string | null) => void;
  setCurrentChord: (chord: ChordSenseResult | null) => void;
  setDetectedNotes: (notes: string[]) => void;
  setVolume: (v: number) => void;
  addToHistory: (name: string) => void;
  clearHistory: () => void;
  removeFromHistory: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChordSenseStore = create<ChordSenseState>((set, get) => ({
  instrument: 'piano',
  isListening: false,
  micError: null,
  currentChord: null,
  detectedNotes: [],
  volume: 0,
  history: [],
  stopReason: null,

  setInstrument: (instrument) => set({ instrument }),

  startListening: () => set({
    isListening: true,
    micError: null,
    currentChord: null,
    detectedNotes: [],
    volume: 0,
    stopReason: null,
  }),

  stopListening: (reason) => set({
    isListening: false,
    currentChord: null,
    detectedNotes: [],
    volume: 0,
    stopReason: reason ?? null,
  }),

  setMicError: (err) => set({ micError: err, isListening: false }),

  setCurrentChord: (chord) => set({ currentChord: chord }),

  setDetectedNotes: (notes) => set({ detectedNotes: notes }),

  setVolume: (v) => set({ volume: v }),

  addToHistory: (name) => {
    const { history } = get();
    // Skip if same chord as the last entry (avoid consecutive duplicates)
    const last = history[history.length - 1];
    if (last && last.name === name) return;
    const entry: HistoryEntry = { name, time: new Date().toLocaleTimeString() };
    set({ history: [...history, entry] });
  },

  clearHistory: () => set({ history: [] }),

  removeFromHistory: (index) => set((s) => ({
    history: s.history.filter((_, i) => i !== index),
  })),
}));
