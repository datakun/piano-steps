import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { useTwoFiveOneStore } from './twoFiveOneStore';
import { useMetronomeStore } from '../metronome/metronomeStore';

/**
 * Hook that integrates Tone.js Transport with II-V-I practice playback.
 * Advances through measures in sync with the metronome.
 */
export function usePracticePlayback() {
  const loopRef = useRef<Tone.Loop | null>(null);
  const beatRef = useRef(0);

  const { playback, play, pause, stop, resetSession, setCurrentMeasure, setCurrentBeat } =
    useTwoFiveOneStore();
  const bpm = useMetronomeStore(s => s.bpm);
  const timeSignature = useMetronomeStore(s => s.timeSignature);

  const beatsPerMeasure = timeSignature === '3/4' ? 3 : timeSignature === '6/8' ? 6 : 4;

  const cleanup = useCallback(() => {
    if (loopRef.current) {
      loopRef.current.stop();
      loopRef.current.dispose();
      loopRef.current = null;
    }
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
  }, []);

  const startPlayback = useCallback(async () => {
    await Tone.start();
    cleanup();

    const totalMeasures = playback.totalMeasures;
    const isRepeating = playback.isRepeating;
    let currentMeasure = playback.currentMeasure;
    beatRef.current = 0;

    Tone.getTransport().bpm.value = bpm;

    // Create click synths
    const clickHigh = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      volume: -6,
    }).toDestination();

    const clickLow = new Tone.Synth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
      volume: -10,
    }).toDestination();

    loopRef.current = new Tone.Loop((time) => {
      // Play click
      const isAccent = beatRef.current === 0;
      const freq = isAccent ? 1200 : 800;
      (isAccent ? clickHigh : clickLow).triggerAttackRelease(freq, '32n', time);

      const beat = beatRef.current;
      const measure = currentMeasure;

      Tone.getDraw().schedule(() => {
        setCurrentBeat(beat);
        setCurrentMeasure(measure);
      }, time);

      beatRef.current++;
      if (beatRef.current >= beatsPerMeasure) {
        beatRef.current = 0;
        currentMeasure++;
        if (currentMeasure >= totalMeasures) {
          if (isRepeating) {
            currentMeasure = 0;
          } else {
            // Stop at end
            Tone.getDraw().schedule(() => {
              stop();
            }, time);
            return;
          }
        }
      }
    }, '4n');

    loopRef.current.start(0);
    Tone.getTransport().start();
    play();
  }, [bpm, beatsPerMeasure, playback.totalMeasures, playback.isRepeating, playback.currentMeasure, cleanup, play, stop, setCurrentMeasure, setCurrentBeat]);

  const pausePlayback = useCallback(() => {
    Tone.getTransport().pause();
    pause();
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
