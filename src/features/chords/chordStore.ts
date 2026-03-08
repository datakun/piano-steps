import { create } from 'zustand';
import type { NoteName, ChordQuality, VoicingMode } from '../../types/music';

interface ChordState {
  selectedRoot: NoteName | null;
  selectedQuality: ChordQuality | null;
  searchQuery: string;
  voicingMode: VoicingMode;
  setRoot: (root: NoteName | null) => void;
  setQuality: (q: ChordQuality | null) => void;
  setSearchQuery: (q: string) => void;
  toggleVoicingMode: () => void;
}

export const useChordStore = create<ChordState>((set) => ({
  selectedRoot: null,
  selectedQuality: null,
  searchQuery: '',
  voicingMode: 'basic',
  setRoot: (root) => set({ selectedRoot: root }),
  setQuality: (q) => set({ selectedQuality: q }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  toggleVoicingMode: () =>
    set((s) => ({ voicingMode: s.voicingMode === 'basic' ? 'drop2' : 'basic' })),
}));
