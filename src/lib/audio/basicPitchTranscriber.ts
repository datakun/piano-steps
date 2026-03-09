// ---------------------------------------------------------------------------
// Basic Pitch Model Wrapper — Singleton
// ---------------------------------------------------------------------------
// Wraps @spotify/basic-pitch for humming → MIDI transcription.
// Model files are served from /models/basic-pitch/model.json (public/).
// ---------------------------------------------------------------------------

import {
  BasicPitch,
  noteFramesToTime,
  addPitchBendsToNoteEvents,
  outputToNotesPoly,
  type NoteEventTime,
} from '@spotify/basic-pitch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface TranscriptionResult {
  notes: NoteEventTime[];
  processingTimeMs: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL_URL = '/models/basic-pitch/model.json';

// Thresholds for note detection (defaults from basic-pitch demo)
const ONSET_THRESHOLD = 0.5;
const FRAME_THRESHOLD = 0.3;
const MIN_NOTE_LENGTH = 11; // ~127ms at 86fps — filters out very short noise

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

class BasicPitchTranscriber {
  private model: BasicPitch | null = null;
  private _status: ModelStatus = 'idle';
  private _error: string | null = null;
  private _loadPromise: Promise<void> | null = null;

  get status(): ModelStatus {
    return this._status;
  }
  get error(): string | null {
    return this._error;
  }

  /**
   * Lazy-load the model. Safe to call multiple times —
   * returns the same promise if already loading/loaded.
   */
  async loadModel(): Promise<void> {
    if (this._status === 'ready') return;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = this._doLoad();
    return this._loadPromise;
  }

  private async _doLoad(): Promise<void> {
    this._status = 'loading';
    this._error = null;

    try {
      this.model = new BasicPitch(MODEL_URL);
      // Warm up: run a tiny silent buffer to ensure model weights are loaded
      const ctx = new OfflineAudioContext(1, 22050, 22050);
      const warmupBuf = ctx.createBuffer(1, 22050, 22050);
      await this.model.evaluateModel(
        warmupBuf,
        () => {},
        () => {},
      );
      this._status = 'ready';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load ML model';
      this._status = 'error';
      this._error = msg;
      this._loadPromise = null; // allow retry
      throw err;
    }
  }

  isReady(): boolean {
    return this._status === 'ready' && this.model !== null;
  }

  /**
   * Transcribe an AudioBuffer into discrete notes.
   * Returns null if model is not ready.
   */
  async transcribe(
    audioBuffer: AudioBuffer,
    onProgress?: (pct: number) => void,
  ): Promise<TranscriptionResult | null> {
    if (!this.isReady() || !this.model) return null;

    const t0 = performance.now();

    // Collect frames/onsets/contours from callback
    const frames: number[][] = [];
    const onsets: number[][] = [];
    const contours: number[][] = [];

    await this.model.evaluateModel(
      audioBuffer,
      (f, o, c) => {
        frames.push(...f);
        onsets.push(...o);
        contours.push(...c);
      },
      (pct) => onProgress?.(pct),
    );

    // Convert to note events
    const noteEvents = outputToNotesPoly(
      frames,
      onsets,
      ONSET_THRESHOLD,
      FRAME_THRESHOLD,
      MIN_NOTE_LENGTH,
    );
    const withBends = addPitchBendsToNoteEvents(contours, noteEvents);
    const notes = noteFramesToTime(withBends);

    const processingTimeMs = performance.now() - t0;
    return { notes, processingTimeMs };
  }

  /** Release resources */
  dispose(): void {
    this.model = null;
    this._status = 'idle';
    this._loadPromise = null;
    this._error = null;
  }
}

export const basicPitchTranscriber = new BasicPitchTranscriber();
