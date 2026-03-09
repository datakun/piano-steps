import { useRef, useCallback, useEffect } from 'react';
import { useHummingStore } from './hummingStore';
import { basicPitchTranscriber } from '../../lib/audio/basicPitchTranscriber';
import { toMelodyNotes, quantizeNotes } from '../../lib/audio/melodyExtractor';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_RECORDING_SECONDS = 60;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useHummingRecording() {
  const store = useHummingStore;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);

  // Audio level visualization
  const liveAudioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // -----------------------------------------------------------------------
  // Model loading
  // -----------------------------------------------------------------------

  const loadModel = useCallback(async () => {
    if (basicPitchTranscriber.status === 'ready') {
      store.getState().setModelStatus('ready');
      return;
    }

    store.getState().setModelStatus('loading');
    try {
      await basicPitchTranscriber.loadModel();
      store.getState().setModelStatus('ready');
    } catch {
      store.getState().setModelStatus(
        'error',
        basicPitchTranscriber.error ?? 'Failed to load model',
      );
    }
  }, []);

  // Load model on mount
  useEffect(() => {
    loadModel();
    return () => {
      cleanup();
      basicPitchTranscriber.dispose();
    };
  }, [loadModel]);

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];

    // Close live audio context used for level metering
    analyserRef.current = null;
    if (liveAudioCtxRef.current) {
      liveAudioCtxRef.current.close().catch(() => {});
      liveAudioCtxRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // -----------------------------------------------------------------------
  // Start recording
  // -----------------------------------------------------------------------

  const startRecording = useCallback(async () => {
    // Already recording? skip
    if (mediaRecorderRef.current) return;

    // Reset previous result
    store.getState().reset();

    try {
      // iOS audioSession
      try {
        if (navigator.audioSession) {
          navigator.audioSession.type = 'play-and-record';
        }
      } catch { /* not supported */ }

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

      // Set up AnalyserNode for real-time audio level metering
      try {
        const liveCtx = new AudioContext();
        const source = liveCtx.createMediaStreamSource(stream);
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const gain = liveCtx.createGain();
        gain.gain.value = isIOS ? 80 : 4;
        source.connect(gain);
        const analyser = liveCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        gain.connect(analyser);
        liveAudioCtxRef.current = liveCtx;
        analyserRef.current = analyser;
      } catch {
        // Level metering is optional; recording still works
      }

      // Choose supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop the mic stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }

        // Restore iOS audioSession
        try {
          if (navigator.audioSession) {
            navigator.audioSession.type = 'playback';
          }
        } catch { /* not supported */ }

        const blob = new Blob(chunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        chunksRef.current = [];

        // Store blob for piano roll playback
        store.getState().setAudioBlob(blob);

        if (blob.size === 0) {
          store.getState().setTranscriptionError('No audio data recorded');
          return;
        }

        // Transcribe
        await transcribe(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250); // collect chunks every 250ms

      startTimeRef.current = Date.now();
      store.getState().setRecordingStatus('recording');
      store.getState().setRecordingDuration(0);

      // Timer to update duration display
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current) / 1000;
        store.getState().setRecordingDuration(Math.min(elapsed, MAX_RECORDING_SECONDS));

        // Auto-stop after max duration
        if (elapsed >= MAX_RECORDING_SECONDS) {
          stopRecording();
        }
      }, 200);
    } catch (err) {
      cleanup();
      const message = err instanceof Error ? err.message : 'Microphone access denied';
      store.getState().setModelStatus('error', message);
    }
  }, [cleanup]);

  // -----------------------------------------------------------------------
  // Stop recording
  // -----------------------------------------------------------------------

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Immediately show processing state so user gets feedback
    store.getState().setRecordingStatus('processing');
    store.getState().setProcessingPhase('Preparing audio…');
    store.getState().setTranscriptionProgress(0);

    // Close live audio context (no longer needed)
    analyserRef.current = null;
    if (liveAudioCtxRef.current) {
      liveAudioCtxRef.current.close().catch(() => {});
      liveAudioCtxRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // triggers onstop → transcribe
    }
  }, []);

  // -----------------------------------------------------------------------
  // Transcribe recorded audio
  // -----------------------------------------------------------------------

  const transcribe = useCallback(async (blob: Blob) => {
    // Status already set to 'processing' in stopRecording
    try {
      // Phase 1: Decode audio
      store.getState().setProcessingPhase('Decoding audio…');
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 22050 });

      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      } finally {
        await audioCtx.close();
      }

      // Convert stereo → mono (Basic Pitch requires mono input)
      if (audioBuffer.numberOfChannels > 1) {
        const length = audioBuffer.length;
        const sampleRate = audioBuffer.sampleRate;
        const mono = new AudioBuffer({ length, sampleRate, numberOfChannels: 1 });
        const monoData = mono.getChannelData(0);
        const numCh = audioBuffer.numberOfChannels;
        for (let ch = 0; ch < numCh; ch++) {
          const chData = audioBuffer.getChannelData(ch);
          for (let i = 0; i < length; i++) {
            monoData[i] += chData[i] / numCh;
          }
        }
        audioBuffer = mono;
      }

      // Phase 2: ML transcription
      store.getState().setProcessingPhase('Transcribing melody…');
      const result = await basicPitchTranscriber.transcribe(
        audioBuffer,
        (pct) => store.getState().setTranscriptionProgress(pct),
      );

      if (!result || result.notes.length === 0) {
        store.getState().setResult([], [], 0);
        return;
      }

      // Phase 3: Quantize
      store.getState().setProcessingPhase('Quantizing notes…');
      const rawNotes = toMelodyNotes(result.notes);

      const { bpm, subdivision } = store.getState();
      const quantized = quantizeNotes(rawNotes, bpm, subdivision);

      store.getState().setResult(rawNotes, quantized, result.processingTimeMs);
    } catch (err) {
      console.warn('Transcription failed:', err);
      const message = err instanceof Error ? err.message : 'Transcription failed';
      store.getState().setTranscriptionError(message);
    }
  }, []);

  return { startRecording, stopRecording, loadModel, analyserRef };
}
