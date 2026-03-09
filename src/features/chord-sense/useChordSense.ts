import { useRef, useCallback, useEffect } from 'react';
import { useChordSenseStore } from './chordSenseStore';
import {
  detectPitchesFFT,
  detectPitchesHPS,
  NoteAccumulator,
  recognizeChord,
  computeRMSFromBytes,
  NOTE_NAMES,
} from '../../lib/audio/pitchDetector';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FFT_SIZE = 16384;
const SILENCE_TIMEOUT_MS = 30_000; // auto-stop after 30s of silence
const SILENCE_RMS_THRESHOLD = 0.008; // RMS below this = "no input" (silence timer)
const NOISE_GATE_RMS = 0.04;         // RMS below this = ambient noise (skip detection)
const STABLE_CHORD_FRAMES = 3; // require N consecutive frames of same chord before switching

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChordSense() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const accRef = useRef<NoteAccumulator>(new NoteAccumulator());
  const silenceStartRef = useRef<number | null>(null);

  // Chord stabilization: require N consecutive frames of the same chord
  const candidateChordRef = useRef<string | null>(null);
  const candidateCountRef = useRef(0);
  const confirmedChordRef = useRef<string | null>(null);

  // Expose analyserRef for SpectrumCanvas
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  const store = useChordSenseStore;

  /** Clean up all audio resources */
  const cleanup = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    analyserNodeRef.current = null;
    silenceStartRef.current = null;
    candidateChordRef.current = null;
    candidateCountRef.current = 0;
    confirmedChordRef.current = null;
    accRef.current.reset();
  }, []);

  /** Stop listening */
  const stop = useCallback(() => {
    store.getState().stopListening();
    cleanup();
  }, [cleanup]);

  /** Start listening */
  const start = useCallback(async () => {
    // Already listening? skip
    if (audioCtxRef.current) return;

    const instrument = store.getState().instrument;

    try {
      // navigator.mediaDevices requires a secure context (HTTPS or localhost)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1'
            ? 'Microphone API is not available in this browser'
            : 'Microphone requires HTTPS. Please access via HTTPS or localhost.',
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext({ sampleRate: 44100 });
      // iOS requires explicit resume() — context starts as "suspended"
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);

      // Amplify mic signal before analysis.
      // iOS Safari returns very low levels (~100x lower), desktop can also be quiet.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const gain = ctx.createGain();
      gain.gain.value = isIOS ? 80 : 4;
      source.connect(gain);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      // Piano benefits from more smoothing to reduce transient spikes
      analyser.smoothingTimeConstant = instrument === 'piano' ? 0.7 : 0.6;
      gain.connect(analyser);
      analyserRef.current = analyser;
      analyserNodeRef.current = analyser;

      // Allocate buffers
      const freqBuf = new Float32Array(analyser.frequencyBinCount);
      const timeBuf = new Uint8Array(analyser.frequencyBinCount);

      silenceStartRef.current = null;
      candidateChordRef.current = null;
      candidateCountRef.current = 0;
      confirmedChordRef.current = null;
      accRef.current = new NoteAccumulator();
      store.getState().startListening();

      // Analysis loop — uses requestAnimationFrame for smooth visualization sync
      const process = (): void => {
        rafRef.current = requestAnimationFrame(process);

        const currentAnalyser = analyserRef.current;
        const currentCtx = audioCtxRef.current;
        if (!currentAnalyser || !currentCtx) return;

        // --- Volume meter (RMS from byte time domain) ---
        currentAnalyser.getByteTimeDomainData(timeBuf);
        const rms = computeRMSFromBytes(timeBuf);
        store.getState().setVolume(Math.min(1, rms * 8));

        // --- Silence detection ---
        if (rms < SILENCE_RMS_THRESHOLD) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current >= SILENCE_TIMEOUT_MS) {
            store.getState().stopListening('no-input');
            cleanup();
            return;
          }
          // Still silent — keep last detected chord visible
          return;
        }
        silenceStartRef.current = null;

        // --- Noise gate: ambient noise zone → skip detection ---
        // Between SILENCE_RMS_THRESHOLD and NOISE_GATE_RMS is "background noise".
        // Push empty frames to dilute any lingering notes in the accumulator.
        if (rms < NOISE_GATE_RMS) {
          accRef.current.push([]);
          return;
        }

        // --- Pitch detection ---
        currentAnalyser.getFloatFrequencyData(freqBuf);

        const currentInstrument = store.getState().instrument;
        const rawNotes =
          currentInstrument === 'piano'
            ? detectPitchesHPS(freqBuf, currentCtx.sampleRate, FFT_SIZE)
            : detectPitchesFFT(freqBuf, currentCtx.sampleRate, FFT_SIZE);

        // --- Temporal smoothing ---
        accRef.current.push(rawNotes);
        const stableClasses = accRef.current.getStable();
        store.getState().setDetectedNotes(stableClasses.map((nc) => NOTE_NAMES[nc]));

        // --- Chord recognition with stabilization ---
        const result = recognizeChord(new Set(stableClasses));
        const newChordName = result
          ? result.root + result.pattern.display
          : null;

        // Track consecutive frames of the same chord
        if (newChordName === candidateChordRef.current) {
          candidateCountRef.current++;
        } else {
          candidateChordRef.current = newChordName;
          candidateCountRef.current = 1;
        }

        // Only switch chord display after N consecutive frames of same chord
        if (
          candidateCountRef.current >= STABLE_CHORD_FRAMES &&
          newChordName !== confirmedChordRef.current
        ) {
          confirmedChordRef.current = newChordName;
          if (result) {
            store.getState().setCurrentChord(result);
            store.getState().addToHistory(newChordName!);
          }
        }
      };

      process();
    } catch (err) {
      cleanup();
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      store.getState().setMicError(message);
    }
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { start, stop, analyserNodeRef };
}
