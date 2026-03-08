import { create } from 'zustand';
import type { MetronomeConfig, TimeSignature, ClickSound } from '../../types/metronome';
import { metronomeEngine } from '../../lib/audio/metronomeEngine';

interface MetronomeState extends MetronomeConfig {
  isPlaying: boolean;
  currentBeat: number;
  // Actions
  setBpm: (bpm: number) => void;
  setVolume: (volume: number) => void;
  setTimeSignature: (ts: TimeSignature) => void;
  toggleAccent: () => void;
  setSoundType: (type: ClickSound) => void;
  toggle: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => void;
}

function getBeatsPerMeasure(ts: TimeSignature): number {
  switch (ts) {
    case '2/4': return 2;
    case '3/4': return 3;
    case '4/4': return 4;
    case '5/4': return 5;
    case '6/8': return 6;
    case '7/8': return 7;
    default: return 4;
  }
}

export const useMetronomeStore = create<MetronomeState>((set, get) => ({
  // Initial state
  bpm: 120,
  timeSignature: '4/4' as TimeSignature,
  accentBeat1: true,
  soundType: 'click' as ClickSound,
  volume: 80,
  isPlaying: false,
  currentBeat: 0,

  setBpm: (bpm: number) => {
    const clamped = Math.max(40, Math.min(200, bpm));
    set({ bpm: clamped });
    if (get().isPlaying) {
      metronomeEngine.setBpm(clamped);
    }
  },

  setVolume: (volume: number) => {
    const clamped = Math.max(0, Math.min(100, volume));
    set({ volume: clamped });
    metronomeEngine.setVolume(clamped);
  },

  setTimeSignature: (ts: TimeSignature) => {
    set({ timeSignature: ts });
    const state = get();
    if (state.isPlaying) {
      state.stop();
      setTimeout(() => void state.start(), 50);
    }
  },

  toggleAccent: () => {
    set(s => ({ accentBeat1: !s.accentBeat1 }));
    const state = get();
    if (state.isPlaying) {
      state.stop();
      setTimeout(() => void state.start(), 50);
    }
  },

  setSoundType: (type: ClickSound) => set({ soundType: type }),

  toggle: async () => {
    const state = get();
    if (state.isPlaying) {
      state.stop();
    } else {
      await state.start();
    }
  },

  start: async () => {
    const state = get();
    const beats = getBeatsPerMeasure(state.timeSignature);
    await metronomeEngine.start(state.bpm, beats, state.accentBeat1, (beat) => {
      set({ currentBeat: beat });
    });
    set({ isPlaying: true, currentBeat: 0 });
  },

  stop: () => {
    metronomeEngine.stop();
    set({ isPlaying: false, currentBeat: 0 });
  },
}));
