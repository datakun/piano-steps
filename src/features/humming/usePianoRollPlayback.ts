import { useState, useRef, useCallback, useEffect } from 'react';
import * as Tone from 'tone';
import type { MelodyNote } from '../../lib/audio/melodyExtractor';
import { getPianoSampler, midiToNoteName } from '../../lib/audio/pianoSampler';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PlayStatus = 'stopped' | 'playing' | 'paused';

export interface PianoRollPlaybackState {
  status: PlayStatus;
  currentTime: number;
  totalDuration: number;
  audioEnabled: boolean;
  midiEnabled: boolean;
  activeNotes: number[]; // MIDI numbers currently sounding
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePianoRollPlayback(
  notes: MelodyNote[],
  bpm: number,
  audioBlob: Blob | null,
) {
  const [state, setState] = useState<PianoRollPlaybackState>({
    status: 'stopped',
    currentTime: 0,
    totalDuration: 0,
    audioEnabled: true,
    midiEnabled: true,
    activeNotes: [],
  });

  // Refs for audio nodes
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const playerRef = useRef<Tone.Player | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Timing refs
  const playStartTimeRef = useRef(0);   // Tone.now() at play start
  const seekOffsetRef = useRef(0);      // offset from seek position
  const rafRef = useRef(0);
  const statusRef = useRef<PlayStatus>('stopped');

  // Compute total duration
  const totalDuration = notes.reduce(
    (max, n) => Math.max(max, n.startTime + n.duration),
    0,
  );

  // Keep totalDuration in state
  useEffect(() => {
    setState((s) => ({ ...s, totalDuration }));
  }, [totalDuration]);

  // Refs for toggles (so RAF loop reads latest values)
  const audioEnabledRef = useRef(true);
  const midiEnabledRef = useRef(true);

  // -----------------------------------------------------------------------
  // Initialize piano sampler (shared singleton)
  // -----------------------------------------------------------------------

  const getSampler = useCallback(async () => {
    if (samplerRef.current) return samplerRef.current;
    const s = await getPianoSampler();
    samplerRef.current = s;
    return s;
  }, []);

  // -----------------------------------------------------------------------
  // Load audio player from blob
  // -----------------------------------------------------------------------

  const getPlayer = useCallback(async (): Promise<Tone.Player | null> => {
    if (!audioBlob) return null;

    // Reuse if already loaded
    if (playerRef.current) return playerRef.current;

    // Create object URL
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(audioBlob);
    blobUrlRef.current = url;

    return new Promise<Tone.Player>((resolve, reject) => {
      const player = new Tone.Player({
        url,
        onload: () => {
          playerRef.current = player;
          resolve(player);
        },
        onerror: (err) => {
          console.warn('Failed to load audio player:', err);
          reject(err);
        },
      }).toDestination();
    });
  }, [audioBlob]);

  // -----------------------------------------------------------------------
  // Schedule MIDI notes
  // -----------------------------------------------------------------------

  const scheduleNotes = useCallback(
    (sampler: Tone.Sampler, startOffset: number, startTime: number) => {
      for (const note of notes) {
        if (note.startTime + note.duration <= startOffset) continue;

        const noteStart = Math.max(note.startTime, startOffset);
        const noteDur = note.duration - (noteStart - note.startTime);
        if (noteDur <= 0) continue;

        const noteName = midiToNoteName(note.pitchMidi);
        const when = startTime + (noteStart - startOffset);
        sampler.triggerAttackRelease(noteName, noteDur, when, note.amplitude * 0.7);
      }
    },
    [notes],
  );

  // -----------------------------------------------------------------------
  // RAF loop for time tracking
  // -----------------------------------------------------------------------

  const startTimeTracking = useCallback(() => {
    const tick = () => {
      if (statusRef.current !== 'playing') return;

      const elapsed = Tone.now() - playStartTimeRef.current + seekOffsetRef.current;
      const clampedTime = Math.min(elapsed, totalDuration);

      // Compute active notes
      const active: number[] = [];
      if (midiEnabledRef.current) {
        for (const note of notes) {
          if (
            clampedTime >= note.startTime &&
            clampedTime < note.startTime + note.duration
          ) {
            active.push(note.pitchMidi);
          }
        }
      }

      setState((s) => ({
        ...s,
        currentTime: clampedTime,
        activeNotes: active,
      }));

      // Auto-stop at end
      if (elapsed >= totalDuration) {
        stopPlayback();
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [totalDuration, notes]);

  // -----------------------------------------------------------------------
  // Play
  // -----------------------------------------------------------------------

  const play = useCallback(async () => {
    await Tone.start();

    const sampler = await getSampler();
    let player: Tone.Player | null = null;

    try {
      player = await getPlayer();
    } catch {
      // Audio player failed to load; continue with MIDI only
    }

    const offset = seekOffsetRef.current;
    const now = Tone.now() + 0.05; // small lookahead

    // Start audio player
    if (player && audioEnabledRef.current) {
      try {
        player.start(now, offset);
      } catch {
        // Player may not be loaded yet
      }
    }

    // Schedule MIDI notes
    if (midiEnabledRef.current) {
      scheduleNotes(sampler, offset, now);
    }

    playStartTimeRef.current = now;
    statusRef.current = 'playing';
    setState((s) => ({ ...s, status: 'playing' }));
    startTimeTracking();
  }, [getSampler, getPlayer, scheduleNotes, startTimeTracking]);

  // -----------------------------------------------------------------------
  // Pause
  // -----------------------------------------------------------------------

  const pause = useCallback(() => {
    cancelAnimationFrame(rafRef.current);

    // Save current position
    const elapsed = Tone.now() - playStartTimeRef.current + seekOffsetRef.current;
    seekOffsetRef.current = Math.min(elapsed, totalDuration);

    // Stop audio
    if (playerRef.current) {
      try {
        playerRef.current.stop();
      } catch { /* may not be playing */ }
    }

    // Release all sampler notes
    if (samplerRef.current) {
      samplerRef.current.releaseAll();
    }

    statusRef.current = 'paused';
    setState((s) => ({
      ...s,
      status: 'paused',
      currentTime: seekOffsetRef.current,
      activeNotes: [],
    }));
  }, [totalDuration]);

  // -----------------------------------------------------------------------
  // Stop
  // -----------------------------------------------------------------------

  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    seekOffsetRef.current = 0;

    if (playerRef.current) {
      try {
        playerRef.current.stop();
      } catch { /* may not be playing */ }
    }

    if (samplerRef.current) {
      samplerRef.current.releaseAll();
    }

    statusRef.current = 'stopped';
    setState((s) => ({
      ...s,
      status: 'stopped',
      currentTime: 0,
      activeNotes: [],
    }));
  }, []);

  // -----------------------------------------------------------------------
  // Seek
  // -----------------------------------------------------------------------

  const seekTo = useCallback(
    (time: number) => {
      const clampedTime = Math.max(0, Math.min(time, totalDuration));
      const wasPlaying = statusRef.current === 'playing';

      // Stop current playback
      cancelAnimationFrame(rafRef.current);
      if (playerRef.current) {
        try { playerRef.current.stop(); } catch { /* */ }
      }
      if (samplerRef.current) {
        samplerRef.current.releaseAll();
      }

      seekOffsetRef.current = clampedTime;
      setState((s) => ({ ...s, currentTime: clampedTime, activeNotes: [] }));

      // Resume if was playing
      if (wasPlaying) {
        statusRef.current = 'stopped'; // reset before play
        play();
      }
    },
    [totalDuration, play],
  );

  // -----------------------------------------------------------------------
  // Toggle audio/midi
  // -----------------------------------------------------------------------

  const setAudioEnabled = useCallback((enabled: boolean) => {
    audioEnabledRef.current = enabled;
    setState((s) => ({ ...s, audioEnabled: enabled }));

    // Mute/unmute player immediately
    if (playerRef.current) {
      playerRef.current.mute = !enabled;
    }
  }, []);

  const setMidiEnabled = useCallback((enabled: boolean) => {
    midiEnabledRef.current = enabled;
    setState((s) => ({ ...s, midiEnabled: enabled }));

    // If disabling, release all notes
    if (!enabled && samplerRef.current) {
      samplerRef.current.releaseAll();
    }
  }, []);

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);

      // Shared singleton — just release notes, don't dispose
      if (samplerRef.current) {
        samplerRef.current.releaseAll();
        samplerRef.current = null;
      }

      if (playerRef.current) {
        try { playerRef.current.stop(); } catch { /* */ }
        playerRef.current.dispose();
        playerRef.current = null;
      }

      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Reset player when audioBlob changes
  useEffect(() => {
    if (playerRef.current) {
      try { playerRef.current.stop(); } catch { /* */ }
      playerRef.current.dispose();
      playerRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [audioBlob]);

  return {
    playbackState: state,
    play,
    pause,
    stop: stopPlayback,
    seekTo,
    setAudioEnabled,
    setMidiEnabled,
  };
}
