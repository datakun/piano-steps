import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { useTwoFiveOneStore } from './twoFiveOneStore';
import { useMetronomeStore } from '../metronome/metronomeStore';
import { volumeToDb } from '../../lib/audio/metronomeEngine';

/**
 * Hook that integrates Tone.js Transport with II-V-I practice playback.
 * Advances through measures in sync with the metronome.
 */
export function usePracticePlayback() {
  const loopRef = useRef<Tone.Loop | null>(null);
  const beatRef = useRef(0);
  const isRepeatingRef = useRef(false);

  const { playback, play, pause, stop, resetSession, setCurrentMeasure, setCurrentBeat } =
    useTwoFiveOneStore();
  const bpm = useMetronomeStore(s => s.bpm);
  const volume = useMetronomeStore(s => s.volume);
  const timeSignature = useMetronomeStore(s => s.timeSignature);

  const compound = timeSignature === '6/8' || timeSignature === '7/8';
  const beatsPerMeasureMap: Record<string, number> = {
    '2/4': 2, '3/4': 3, '4/4': 4, '5/4': 5, '6/8': 6, '7/8': 7,
  };
  const beatsPerMeasure = beatsPerMeasureMap[timeSignature] ?? 4;

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
  }, []);

  const startPlayback = useCallback(async () => {
    await Tone.start();
    cleanup();

    const totalMeasures = playback.totalMeasures;
    let currentMeasure = playback.currentMeasure;
    beatRef.current = 0;

    // For compound meters (6/8, 7/8): BPM = dotted quarter, transport uses quarter-note BPM
    Tone.getTransport().bpm.value = compound ? bpm * 1.5 : bpm;

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
        const progStart = Math.floor(currentMeasure / 4) * 4;
        currentMeasure++;

        // Crossed a 4-measure progression boundary?
        if (currentMeasure % 4 === 0) {
          if (isRepeatingRef.current) {
            // Repeat current progression
            currentMeasure = progStart;
          } else if (currentMeasure >= totalMeasures) {
            // End of session
            Tone.getDraw().schedule(() => {
              stop();
            }, time);
            return;
          }
        }
      }
    }, compound ? '8n' : '4n');

    loopRef.current.start(0);
    Tone.getTransport().start();
    play();
  }, [bpm, volume, beatsPerMeasure, compound, playback.totalMeasures, playback.currentMeasure, cleanup, play, stop, setCurrentMeasure, setCurrentBeat]);

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
