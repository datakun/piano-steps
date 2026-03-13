import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { useJazzHanonStore } from './jazzHanonStore';
import { useMetronomeStore } from '../metronome/metronomeStore';
import { volumeToDb, suspendAudioContext } from '../../lib/audio/metronomeEngine';
import { getPianoSampler, midiToNoteName } from '../../lib/audio/pianoSampler';
import type { Pitch } from '../../types/music';

/**
 * Hook that integrates Tone.js Transport with Jazz Hanon playback.
 * Fires on eighth notes (8 per measure), clicks on quarter-note positions.
 * Plays pattern notes via piano sampler on every eighth note.
 * currentBeat = eighth-note index (0-7) for staff activeNoteIndex.
 */
export function useHanonPlayback(patterns?: Pitch[][], bassChords?: Pitch[][]) {
  const loopRef = useRef<Tone.Loop | null>(null);
  const eighthRef = useRef(0);
  const isRepeatingRef = useRef(false);

  // Capture patterns in refs so the Tone.js loop callback reads latest values
  const patternsRef = useRef<Pitch[][] | undefined>(patterns);
  patternsRef.current = patterns;

  const { playback, play, pause, stop, resetSession, setCurrentMeasure, setCurrentBeat } =
    useJazzHanonStore();
  const bpm = useMetronomeStore(s => s.bpm);
  const volume = useMetronomeStore(s => s.volume);

  const EIGHTHS_PER_MEASURE = 8;

  // Keep ref in sync with store so the Tone.js loop reads the latest value
  isRepeatingRef.current = playback.isRepeating;

  const cleanup = useCallback(() => {
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current.dispose();
      loopRef.current = null;
    }
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    suspendAudioContext();
  }, []);

  const startPlayback = useCallback(async () => {
    await Tone.start();
    cleanup();

    // Load piano sampler (may already be cached)
    let pianoSampler: Tone.Sampler | null = null;
    try {
      pianoSampler = await getPianoSampler();
    } catch {
      // Piano failed to load — continue with clicks only
    }

    const totalMeasures = playback.totalMeasures;
    let currentMeasure = playback.currentMeasure;
    eighthRef.current = 0;

    Tone.getTransport().bpm.value = bpm;

    // Create click synths with shared volume
    const highDb = volumeToDb(volume);
    const lowDb = highDb - 4;

    const clickHigh = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      volume: highDb,
    }).toDestination();

    const clickLow = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      volume: lowDb,
    }).toDestination();

    let stopped = false;

    loopRef.current = new Tone.Loop((time) => {
      // Guard: don't fire after end-of-exercise was triggered
      if (stopped) return;

      const eighth = eighthRef.current;

      // Play click on quarter-note positions only (0, 2, 4, 6)
      if (eighth % 2 === 0) {
        const isAccent = eighth === 0;
        const freq = isAccent ? 1200 : 800;
        (isAccent ? clickHigh : clickLow).triggerAttackRelease(freq, '32n', time);
      }

      // Play pattern note via piano sampler
      if (pianoSampler) {
        const curPatterns = patternsRef.current;

        if (curPatterns && currentMeasure < curPatterns.length) {
          const pattern = curPatterns[currentMeasure];
          if (pattern && eighth < pattern.length) {
            const note = pattern[eighth];
            pianoSampler.triggerAttackRelease(
              midiToNoteName(note.midi), '8n', time, 0.7,
            );
          }
        }

      }

      const measure = currentMeasure;

      Tone.getDraw().schedule(() => {
        setCurrentBeat(eighth);
        setCurrentMeasure(measure);
      }, time);

      eighthRef.current++;
      if (eighthRef.current >= EIGHTHS_PER_MEASURE) {
        eighthRef.current = 0;

        if (isRepeatingRef.current) {
          // Repeat current measure — don't advance
        } else {
          currentMeasure++;
          if (currentMeasure >= totalMeasures) {
            // End of exercise
            stopped = true;
            Tone.getDraw().schedule(() => {
              stop();
            }, time);
            return;
          }
        }
      }
    }, '8n');

    loopRef.current.start(0);
    Tone.getTransport().start();
    play();
  }, [bpm, volume, playback.totalMeasures, playback.currentMeasure, cleanup, play, stop, setCurrentMeasure, setCurrentBeat]);

  const pausePlayback = useCallback(() => {
    Tone.getTransport().pause();
    pause();
    suspendAudioContext();
  }, [pause]);

  const stopPlayback = useCallback(() => {
    cleanup();
    stop();
  }, [cleanup, stop]);

  // Cleanup on unmount — stop Tone.js and fully reset session
  useEffect(() => {
    return () => {
      cleanup();
      resetSession();
    };
  }, [cleanup, resetSession]);

  return {
    startPlayback,
    pausePlayback,
    stopPlayback,
  };
}
