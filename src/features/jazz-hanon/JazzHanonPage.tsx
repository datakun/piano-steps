import { useMemo } from 'react';
import { useJazzHanonStore } from './jazzHanonStore';
import { EXERCISES, DIATONIC_CHORD_LABELS, transposeExercise } from '../../data/exercises';
import { ALL_ROOTS } from '../../data/chords';
import StaffRenderer from '../../components/notation/StaffRenderer';
import type { MeasureData } from '../../components/notation/StaffRenderer';
import PlaybackControls from '../../components/playback/PlaybackControls';
import MetronomeWidget from '../../components/metronome/MetronomeWidget';
import { useModuleMetronome } from '../metronome/useModuleMetronome';
import type { NoteName } from '../../types/music';

export default function JazzHanonPage() {
  useModuleMetronome('jazz-hanon');

  const {
    selectedExercise, selectedKey, playback, isSessionStarted,
    setExercise, setKey, startSession, resetSession,
    toggleRepeat, nextMeasure, prevMeasure, play, pause, stop,
  } = useJazzHanonStore();

  const exercise = useMemo(() => {
    const base = EXERCISES.find(e => e.id === selectedExercise) ?? EXERCISES[0];
    return transposeExercise(base, selectedKey);
  }, [selectedExercise, selectedKey]);

  // Convert exercise patterns to staff measures
  const measures = useMemo<MeasureData[]>(() => {
    return exercise.patterns.map(pattern => ({
      notes: pattern.map(p => [p]),
      durations: pattern.map(() => '8'),
    }));
  }, [exercise]);

  if (!isSessionStarted) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">Jazz Hanon</h1>

        <div className="mb-4">
          <MetronomeWidget compact />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1">Exercise Pattern</label>
            <div className="space-y-2">
              {EXERCISES.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => setExercise(ex.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                    selectedExercise === ex.id
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-medium">{ex.name}</span>
                  <span className="text-gray-500 ml-2">{ex.description}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 block mb-1">Key</label>
            <select
              value={selectedKey}
              onChange={e => setKey(e.target.value as NoteName)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white w-full"
            >
              {ALL_ROOTS.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <button
            onClick={startSession}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Start Practice
          </button>
        </div>
      </div>
    );
  }

  const currentChordLabel = DIATONIC_CHORD_LABELS[playback.currentMeasure] ?? '';

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">Jazz Hanon</h1>
        <button
          onClick={() => { stop(); resetSession(); }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-200 rounded-lg"
        >
          New Session
        </button>
      </div>

      <div className="mb-3">
        <MetronomeWidget compact />
      </div>

      <div className="flex items-center gap-3 mb-3 text-sm">
        <span className="font-medium">{exercise.name}</span>
        <span className="text-gray-400">|</span>
        <span className="text-gray-500">Key of {selectedKey}</span>
        <span className="text-gray-400">|</span>
        <span className="text-blue-600 font-medium">{currentChordLabel}</span>
      </div>

      <div className="flex gap-2 mb-2 flex-wrap">
        {DIATONIC_CHORD_LABELS.map((label, i) => (
          <button
            key={i}
            onClick={() => useJazzHanonStore.getState().setCurrentMeasure(i)}
            className={`px-2 py-1 rounded text-xs border ${
              playback.currentMeasure === i
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3 overflow-x-auto">
        <StaffRenderer
          measures={[measures[playback.currentMeasure] ?? measures[0]]}
          clef="treble"
          height={140}
          staveWidth={500}
          activeNoteIndex={playback.status === 'playing' ? playback.currentBeat : undefined}
        />
      </div>

      <div className="mt-4 flex justify-center">
        <PlaybackControls
          status={playback.status}
          currentMeasure={playback.currentMeasure}
          totalMeasures={playback.totalMeasures}
          isRepeating={playback.isRepeating}
          onPlay={play}
          onPause={pause}
          onStop={stop}
          onRepeatToggle={toggleRepeat}
          onPrev={prevMeasure}
          onNext={nextMeasure}
        />
      </div>
    </div>
  );
}
