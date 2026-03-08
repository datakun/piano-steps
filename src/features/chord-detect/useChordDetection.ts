import { useRef, useCallback, useEffect } from 'react';
import { useChordDetectStore } from './chordDetectStore';
import { buildChromaVector, matchChord, computeRMS } from '../../lib/audio/chordAnalyser';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FFT_SIZE = 8192;
const ANALYSIS_INTERVAL_MS = 120;  // analyse every ~120ms
const SILENCE_THRESHOLD = 0.005;   // RMS below this = "no input"
const SILENCE_TIMEOUT_MS = 30_000; // auto-stop after 30s of silence
const STABLE_FRAMES = 1;           // update immediately each frame (~120ms)

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useChordDetection() {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceStartRef = useRef<number | null>(null);

  // Stabilization: require N consecutive frames of the same chord
  const candidateRef = useRef<string | null>(null);   // symbol of current candidate
  const candidateCountRef = useRef(0);                 // consecutive frame count
  const confirmedRef = useRef<string | null>(null);    // currently confirmed & displayed chord

  const store = useChordDetectStore;

  // Buffers (allocated once, reused)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const freqBufRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeBufRef = useRef<any>(null);

  /** Run one analysis frame */
  const analyse = useCallback(() => {
    const analyser = analyserRef.current;
    const audioCtx = audioCtxRef.current;
    if (!analyser || !audioCtx) return;

    const freqBuf = freqBufRef.current!;
    const timeBuf = timeBufRef.current!;

    analyser.getFloatFrequencyData(freqBuf);
    analyser.getFloatTimeDomainData(timeBuf);

    // --- Silence detection ---
    const rms = computeRMS(timeBuf);
    // Debug: log every ~1s (every 8th frame at 120ms interval)
    if (Math.random() < 0.12) {
      console.log('[ChordDetect] rms:', rms.toFixed(4), 'freq[100]:', freqBuf[100]?.toFixed(1));
    }
    if (rms < SILENCE_THRESHOLD) {
      if (silenceStartRef.current === null) {
        silenceStartRef.current = Date.now();
      } else if (Date.now() - silenceStartRef.current >= SILENCE_TIMEOUT_MS) {
        // Auto-stop after 30s silence
        store.getState().stopListening('no-input');
        cleanup();
        return;
      }
      // Still silent — keep last detected chord visible
      return;
    }
    // Sound detected — reset silence timer
    silenceStartRef.current = null;

    // --- Chord detection with stabilization ---
    const chroma = buildChromaVector(freqBuf, audioCtx.sampleRate, FFT_SIZE);
    const result = matchChord(chroma);

    const newSymbol = result?.symbol ?? null;

    if (newSymbol === candidateRef.current) {
      // Same chord as last frame — increment count
      candidateCountRef.current++;
    } else {
      // Different chord — reset candidate
      candidateRef.current = newSymbol;
      candidateCountRef.current = 1;
    }

    // Only update UI when chord is stable (N consecutive frames)
    if (candidateCountRef.current >= STABLE_FRAMES && newSymbol !== confirmedRef.current) {
      confirmedRef.current = newSymbol;
      if (result) {
        const detected = {
          root: result.root,
          quality: result.quality,
          symbol: result.symbol,
          confidence: result.confidence,
          timestamp: Date.now(),
        };
        store.getState().setCurrentChord(detected);
        store.getState().addToHistory(detected);
      } else {
        store.getState().setCurrentChord(null);
      }
    }
  }, []);

  /** Clean up all audio resources */
  const cleanup = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    silenceStartRef.current = null;
    candidateRef.current = null;
    candidateCountRef.current = 0;
    confirmedRef.current = null;
  }, []);

  /** Start listening */
  const start = useCallback(async () => {
    // Already listening? skip
    if (audioCtxRef.current) return;

    try {
      // navigator.mediaDevices requires a secure context (HTTPS or localhost)
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? 'Microphone API is not available in this browser'
            : 'Microphone requires HTTPS. Please access via HTTPS or localhost.'
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

      // Create a separate AudioContext (not Tone.js's)
      const ctx = new AudioContext();
      // iOS requires explicit resume() — context starts as "suspended"
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      audioCtxRef.current = ctx;

      console.log('[ChordDetect] AudioContext state:', ctx.state, 'sampleRate:', ctx.sampleRate);

      const source = ctx.createMediaStreamSource(stream);

      // iOS Safari returns very low mic levels (~100x lower than desktop).
      // Amplify the signal before analysis so thresholds work consistently.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const gain = ctx.createGain();
      gain.gain.value = isIOS ? 80 : 1;
      source.connect(gain);

      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.82;
      gain.connect(analyser);
      analyserRef.current = analyser;

      // Allocate buffers
      freqBufRef.current = new Float32Array(analyser.frequencyBinCount);
      timeBufRef.current = new Float32Array(analyser.fftSize);

      silenceStartRef.current = null;
      store.getState().startListening();

      // Start analysis loop
      intervalRef.current = setInterval(analyse, ANALYSIS_INTERVAL_MS);
    } catch (err) {
      cleanup();
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      store.getState().setMicError(message);
    }
  }, [analyse, cleanup]);

  /** Stop listening */
  const stop = useCallback(() => {
    store.getState().stopListening();
    cleanup();
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { start, stop };
}
