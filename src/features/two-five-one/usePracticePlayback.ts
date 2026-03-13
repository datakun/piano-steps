import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { useTwoFiveOneStore } from './twoFiveOneStore';
import { useMetronomeStore } from '../metronome/metronomeStore';
import { volumeToDb, suspendAudioContext } from '../../lib/audio/metronomeEngine';
import { getPianoSampler, midiToNoteName } from '../../lib/audio/pianoSampler';

/**
 * Hook that integrates Tone.js Transport with II-V-I practice playback.
 * Advances through measures in sync with the metronome.
 * Plays chord voicings via piano sampler at progression boundaries.
 */
export function usePracticePlayback() {
  const loopRef = useRef<Tone.Loop | null>(null);
  const beatRef = useRef(0);
  const isRepeatingRef = useRef(false);

  const { playback, progressions, play, pause, stop, resetSession, setCurrentMeasure, setCurrentBeat } =
    useTwoFiveOneStore();
  const bpm = useMetronomeStore(s => s.bpm);
  const volume = useMetronomeStore(s => s.volume);
  const timeSignature = useMetronomeStore(s => s.timeSignature);

  const compound = timeSignature === '6/8' || timeSignature === '7/8';
  const beatsPerMeasureMap: Record<string, number> = {
    '2/4': 2, '3/4': 3, '4/4': 4, '5/4': 5, '6/8': 6, '7/8': 7,
  };
  const beatsPerMeasure = beatsPerMeasureMap[timeSignature] ?? 4;

  // Keep refs in sync with store
  isRepeatingRef.current = playback.isRepeating;
  const progressionsRef = useRef(progressions);
  progressionsRef.current = progressions;

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

    // Load piano sampler
    let pianoSampler: Tone.Sampler | null = null;
    try {
      pianoSampler = await getPianoSampler();
    } catch {
      // Piano failed to load — continue with clicks only
    }

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

    // Track last triggered chord to avoid double-firing
    let lastChordKey = '';
    const halfBeats = Math.floor(beatsPerMeasure / 2);

    loopRef.current = new Tone.Loop((time) => {
      // Play click
      const isAccent = beatRef.current === 0;
      const freq = isAccent ? 1200 : 800;
      (isAccent ? clickHigh : clickLow).triggerAttackRelease(freq, '32n', time);

      // Play piano chord voicing
      // Structure: measureInProg 0,2 = II-V bar (II first half, V second half)
      //            measureInProg 1,3 = I bar (full measure)
      if (pianoSampler) {
        const progs = progressionsRef.current;
        const progIndex = Math.floor(currentMeasure / 4);
        const measureInProg = currentMeasure % 4;
        const isIIVBar = measureInProg % 2 === 0; // measures 0,2 = II-V

        let chordIndex: number | null = null;
        if (isIIVBar && beatRef.current === 0) {
          chordIndex = 0; // II chord at beat 0
        } else if (isIIVBar && beatRef.current === halfBeats) {
          chordIndex = 1; // V chord at half-measure
        } else if (!isIIVBar && beatRef.current === 0) {
          chordIndex = 2; // I chord at beat 0
        }

        if (chordIndex !== null && progIndex < progs.length) {
          const chordKey = `${currentMeasure}-${chordIndex}`;
          if (chordKey !== lastChordKey) {
            lastChordKey = chordKey;
            const prog = progs[progIndex];
            const voicing = prog.chords[chordIndex];
            if (voicing) {
              const allNotes = [...voicing.leftHand, ...voicing.rightHand];
              const noteNames = allNotes.map(p => midiToNoteName(p.midi));
              const dur = isIIVBar ? '2n' : '1m'; // 2 beats for II/V, full bar for I
              pianoSampler.triggerAttackRelease(noteNames, dur, time, 0.6);
            }
          }
        }
      }

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
            lastChordKey = ''; // allow re-triggering chords
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
