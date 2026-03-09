import { create } from 'zustand';
import type { MelodyNote } from '../../lib/audio/melodyExtractor';
import type { ModelStatus } from '../../lib/audio/basicPitchTranscriber';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export type RecordingStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error';

interface HummingState {
  /** Tempo for quantization */
  bpm: number;
  /** Quantization grid: 4=quarter, 8=eighth, 16=sixteenth */
  subdivision: 4 | 8 | 16;

  /** ML model lifecycle */
  modelStatus: ModelStatus;
  modelError: string | null;

  /** Recording state */
  recordingStatus: RecordingStatus;
  /** Elapsed recording time in seconds */
  recordingDuration: number;
  /** Transcription progress 0–1 */
  transcriptionProgress: number;
  /** Processing phase label shown to user */
  processingPhase: string;
  /** Transcription error message */
  transcriptionError: string | null;

  /** Quantized melody result */
  melodyNotes: MelodyNote[];
  /** Raw (un-quantized) notes */
  rawNotes: MelodyNote[];
  /** Processing time in ms */
  processingTimeMs: number | null;
  /** Recorded audio blob for playback */
  audioBlob: Blob | null;

  // Actions
  setBpm: (bpm: number) => void;
  setSubdivision: (sub: 4 | 8 | 16) => void;
  setModelStatus: (status: ModelStatus, error?: string) => void;
  setRecordingStatus: (status: RecordingStatus) => void;
  setRecordingDuration: (sec: number) => void;
  setTranscriptionProgress: (pct: number) => void;
  setProcessingPhase: (phase: string) => void;
  setTranscriptionError: (error: string) => void;
  setAudioBlob: (blob: Blob | null) => void;
  setResult: (raw: MelodyNote[], quantized: MelodyNote[], timeMs: number) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHummingStore = create<HummingState>((set) => ({
  bpm: 120,
  subdivision: 8,

  modelStatus: 'idle',
  modelError: null,

  recordingStatus: 'idle',
  recordingDuration: 0,
  transcriptionProgress: 0,
  processingPhase: '',
  transcriptionError: null,

  melodyNotes: [],
  rawNotes: [],
  processingTimeMs: null,
  audioBlob: null,

  setBpm: (bpm) => set({ bpm: Math.max(40, Math.min(200, bpm)) }),
  setSubdivision: (subdivision) => set({ subdivision }),

  setModelStatus: (status, error) =>
    set({ modelStatus: status, modelError: error ?? null }),

  setRecordingStatus: (recordingStatus) => set({ recordingStatus, transcriptionError: null }),
  setRecordingDuration: (recordingDuration) => set({ recordingDuration }),
  setTranscriptionProgress: (transcriptionProgress) =>
    set({ transcriptionProgress }),
  setProcessingPhase: (processingPhase) => set({ processingPhase }),
  setTranscriptionError: (transcriptionError) =>
    set({ transcriptionError, recordingStatus: 'error' }),

  setAudioBlob: (audioBlob) => set({ audioBlob }),

  setResult: (rawNotes, melodyNotes, processingTimeMs) =>
    set({ rawNotes, melodyNotes, processingTimeMs, recordingStatus: 'done' }),

  reset: () =>
    set({
      recordingStatus: 'idle',
      recordingDuration: 0,
      transcriptionProgress: 0,
      processingPhase: '',
      transcriptionError: null,
      melodyNotes: [],
      rawNotes: [],
      processingTimeMs: null,
      audioBlob: null,
    }),
}));
