import { create } from 'zustand';
import type { NoteName } from '../../types/music';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DetectedChord {
  root: NoteName;
  quality: string;     // triad: '', 'm', 'dim', 'aug' | 7th: 'M7', '7', 'm7', etc.
  symbol: string;
  confidence: number;
  timestamp: number;
}

interface ChordDetectState {
  /** Whether the microphone is actively listening */
  isListening: boolean;
  /** Error message if mic access fails */
  micError: string | null;
  /** Currently detected chord (real-time) */
  currentChord: DetectedChord | null;
  /** History of detected chords */
  history: DetectedChord[];
  /** Reason for auto-stop (e.g. "no-input") */
  stopReason: string | null;

  // Actions
  startListening: () => void;
  stopListening: (reason?: string) => void;
  setMicError: (err: string | null) => void;
  setCurrentChord: (chord: DetectedChord | null) => void;
  addToHistory: (chord: DetectedChord) => void;
  clearHistory: () => void;
  removeFromHistory: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useChordDetectStore = create<ChordDetectState>((set, get) => ({
  isListening: false,
  micError: null,
  currentChord: null,
  history: [],
  stopReason: null,

  startListening: () => set({
    isListening: true,
    micError: null,
    currentChord: null,
    stopReason: null,
  }),

  stopListening: (reason) => set({
    isListening: false,
    currentChord: null,
    stopReason: reason ?? null,
  }),

  setMicError: (err) => set({ micError: err, isListening: false }),

  setCurrentChord: (chord) => set({ currentChord: chord }),

  addToHistory: (chord) => {
    const { history } = get();
    // Skip if same chord as the last entry (avoid consecutive duplicates)
    const last = history[history.length - 1];
    if (last && last.symbol === chord.symbol) return;
    set({ history: [...history, chord] });
  },

  clearHistory: () => set({ history: [] }),

  removeFromHistory: (index) => set(s => ({
    history: s.history.filter((_, i) => i !== index),
  })),
}));
