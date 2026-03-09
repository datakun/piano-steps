import { create } from 'zustand';
import type { NoteName, Progression } from '../../types/music';
import type { PlaybackState } from '../../types/playback';
import { generateChromaticProgressions, generateRandomProgressions } from '../../data/progressions';

type PracticeMode = 'chromatic' | 'random';

interface TwoFiveOneState {
  mode: PracticeMode;
  form: 'A' | 'B';
  startKey: NoteName;
  guideMode: boolean;
  progressions: Progression[];
  playback: PlaybackState;
  isSessionStarted: boolean;

  // Actions
  setMode: (mode: PracticeMode) => void;
  setForm: (form: 'A' | 'B') => void;
  setStartKey: (key: NoteName) => void;
  setGuideMode: (enabled: boolean) => void;
  startSession: () => void;
  resetSession: () => void;

  // Playback
  play: () => void;
  pause: () => void;
  stop: () => void;
  toggleRepeat: () => void;
  nextMeasure: () => void;
  prevMeasure: () => void;
  setCurrentMeasure: (m: number) => void;
  setCurrentBeat: (b: number) => void;
}

export const useTwoFiveOneStore = create<TwoFiveOneState>((set, get) => ({
  mode: 'chromatic',
  form: 'A',
  startKey: 'C',
  guideMode: false,
  progressions: [],
  isSessionStarted: false,
  playback: {
    status: 'stopped',
    currentMeasure: 0,
    currentBeat: 0,
    totalMeasures: 0,
    isRepeating: false,
  },

  setMode: (mode) => set({ mode }),
  setForm: (form) => {
    set({ form });
    const state = get();
    if (state.isSessionStarted) {
      // Regenerate with new form
      const progs = state.mode === 'chromatic'
        ? generateChromaticProgressions(state.startKey, form)
        : generateRandomProgressions(form);
      set({
        progressions: progs,
        playback: { ...state.playback, totalMeasures: progs.length * 4, currentMeasure: 0 },
      });
    }
  },
  setStartKey: (key) => set({ startKey: key }),
  setGuideMode: (enabled) => set({ guideMode: enabled }),

  startSession: () => {
    const { mode, form, startKey } = get();
    const progs = mode === 'chromatic'
      ? generateChromaticProgressions(startKey, form)
      : generateRandomProgressions(form);
    set({
      progressions: progs,
      isSessionStarted: true,
      playback: {
        status: 'stopped',
        currentMeasure: 0,
        currentBeat: 0,
        totalMeasures: progs.length * 4, // Each progression plays 2 bars, repeated = 4 bars
        isRepeating: false,
      },
    });
  },

  resetSession: () => set({
    progressions: [],
    isSessionStarted: false,
    playback: { status: 'stopped', currentMeasure: 0, currentBeat: 0, totalMeasures: 0, isRepeating: false },
  }),

  play: () => set(s => ({
    playback: { ...s.playback, status: 'playing' },
  })),

  pause: () => set(s => ({
    playback: { ...s.playback, status: 'paused' },
  })),

  stop: () => set(s => ({
    playback: { ...s.playback, status: 'stopped', currentMeasure: 0, currentBeat: 0 },
  })),

  toggleRepeat: () => set(s => ({
    playback: { ...s.playback, isRepeating: !s.playback.isRepeating },
  })),

  nextMeasure: () => set(s => {
    const next = Math.min(s.playback.currentMeasure + 1, s.playback.totalMeasures - 1);
    return { playback: { ...s.playback, currentMeasure: next, currentBeat: 0 } };
  }),

  prevMeasure: () => set(s => {
    const prev = Math.max(s.playback.currentMeasure - 1, 0);
    return { playback: { ...s.playback, currentMeasure: prev, currentBeat: 0 } };
  }),

  setCurrentMeasure: (m) => set(s => ({
    playback: { ...s.playback, currentMeasure: m },
  })),

  setCurrentBeat: (b) => set(s => ({
    playback: { ...s.playback, currentBeat: b },
  })),
}));
