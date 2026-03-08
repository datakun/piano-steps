import { create } from 'zustand';
import type { NoteName } from '../../types/music';
import type { PlaybackState } from '../../types/playback';

interface JazzHanonState {
  selectedExercise: number | string; // number for built-in, string for custom
  selectedKey: NoteName;
  playback: PlaybackState;
  isSessionStarted: boolean;

  setExercise: (id: number | string) => void;
  setKey: (key: NoteName) => void;
  startSession: () => void;
  resetSession: () => void;

  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleRepeat: () => void;
  nextMeasure: () => void;
  prevMeasure: () => void;
  setCurrentMeasure: (m: number) => void;
  setCurrentBeat: (b: number) => void;
}

export const useJazzHanonStore = create<JazzHanonState>((set, _get) => ({
  selectedExercise: 1,
  selectedKey: 'C',
  playback: {
    status: 'stopped',
    currentMeasure: 0,
    currentBeat: 0,
    totalMeasures: 7, // 7 diatonic chords
    isRepeating: false,
  },
  isSessionStarted: false,

  setExercise: (id) => set({ selectedExercise: id }),
  setKey: (key) => set({ selectedKey: key }),

  startSession: () => set({
    isSessionStarted: true,
    playback: {
      status: 'stopped',
      currentMeasure: 0,
      currentBeat: 0,
      totalMeasures: 7,
      isRepeating: false,
    },
  }),

  resetSession: () => set({
    isSessionStarted: false,
    playback: { status: 'stopped', currentMeasure: 0, currentBeat: 0, totalMeasures: 7, isRepeating: false },
  }),

  play: () => set(s => ({ playback: { ...s.playback, status: 'playing' } })),
  pause: () => set(s => ({ playback: { ...s.playback, status: 'paused' } })),
  stop: () => set(s => ({ playback: { ...s.playback, status: 'stopped', currentMeasure: 0, currentBeat: 0 } })),
  toggleRepeat: () => set(s => ({ playback: { ...s.playback, isRepeating: !s.playback.isRepeating } })),

  nextMeasure: () => set(s => ({
    playback: { ...s.playback, currentMeasure: Math.min(s.playback.currentMeasure + 1, 6), currentBeat: 0 },
  })),

  prevMeasure: () => set(s => ({
    playback: { ...s.playback, currentMeasure: Math.max(s.playback.currentMeasure - 1, 0), currentBeat: 0 },
  })),

  setCurrentMeasure: (m) => set(s => ({ playback: { ...s.playback, currentMeasure: m } })),
  setCurrentBeat: (b) => set(s => ({ playback: { ...s.playback, currentBeat: b } })),
}));
