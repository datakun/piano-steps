import { useTwoFiveOneStore } from './twoFiveOneStore';
import { usePracticePlayback } from './usePracticePlayback';
import ProgressionDisplay from './ProgressionDisplay';
import PlaybackControls from '../../components/playback/PlaybackControls';
import MetronomeWidget from '../../components/metronome/MetronomeWidget';
import { useModuleMetronome } from '../metronome/useModuleMetronome';
import { ALL_ROOTS } from '../../data/chords';
import type { NoteName } from '../../types/music';

export default function TwoFiveOnePage() {
  useModuleMetronome('two-five-one');

  const {
    mode, form, startKey, progressions, playback, isSessionStarted,
    setMode, setForm, setStartKey, startSession, resetSession,
    toggleRepeat, nextMeasure, prevMeasure,
  } = useTwoFiveOneStore();

  const { startPlayback, pausePlayback, stopPlayback } = usePracticePlayback();

  // Calculate which progression and local measure is active
  // Each progression = 4 measures (2 bars × 2 repeats)
  const currentProgIdx = Math.floor(playback.currentMeasure / 4);
  const measureInProg = playback.currentMeasure % 4;
  const nextProgIdx = Math.min(currentProgIdx + 1, progressions.length - 1);

  if (!isSessionStarted) {
    return (
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-xl font-bold mb-4">II-V-I Practice</h1>

        {/* Metronome (tempo setting) */}
        <div className="mb-4">
          <MetronomeWidget compact />
        </div>

        {/* Settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div>
            <label className="text-sm text-gray-500 block mb-1">Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setMode('chromatic')}
                className={`flex-1 py-2 rounded-lg text-sm border ${
                  mode === 'chromatic' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200'
                }`}
              >
                Chromatic Down
              </button>
              <button
                onClick={() => setMode('random')}
                className={`flex-1 py-2 rounded-lg text-sm border ${
                  mode === 'random' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200'
                }`}
              >
                Random
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500 block mb-1">Form</label>
            <div className="flex gap-2">
              <button
                onClick={() => setForm('A')}
                className={`flex-1 py-2 rounded-lg text-sm border ${
                  form === 'A' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200'
                }`}
              >
                A (Open / Drop 2)
              </button>
              <button
                onClick={() => setForm('B')}
                className={`flex-1 py-2 rounded-lg text-sm border ${
                  form === 'B' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-gray-200'
                }`}
              >
                B (Close)
              </button>
            </div>
          </div>

          {mode === 'chromatic' && (
            <div>
              <label className="text-sm text-gray-500 block mb-1">Start Key</label>
              <select
                value={startKey}
                onChange={e => setStartKey(e.target.value as NoteName)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white w-full"
              >
                {ALL_ROOTS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          )}

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

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">II-V-I Practice</h1>
        <button
          onClick={() => { stopPlayback(); resetSession(); }}
          className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 border border-gray-200 rounded-lg"
        >
          New Session
        </button>
      </div>

      {/* Metronome widget */}
      <div className="mb-3">
        <MetronomeWidget compact />
      </div>

      {/* Form toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setForm('A')}
          className={`px-3 py-1 rounded text-sm ${
            form === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          A form
        </button>
        <button
          onClick={() => setForm('B')}
          className={`px-3 py-1 rounded text-sm ${
            form === 'B' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          B form
        </button>
        <span className="text-xs text-gray-400 self-center ml-auto">
          Progression {currentProgIdx + 1} / {progressions.length}
        </span>
      </div>

      {/* Current progression */}
      {progressions[currentProgIdx] && (
        <ProgressionDisplay
          progression={progressions[currentProgIdx]}
          label="Current"
          activeMeasureInProgression={playback.status !== 'stopped' ? measureInProg : undefined}
          isCurrent
        />
      )}

      {/* Next progression (look-ahead) */}
      {progressions[nextProgIdx] && nextProgIdx !== currentProgIdx && (
        <div className="mt-3">
          <ProgressionDisplay
            progression={progressions[nextProgIdx]}
            label="Next"
          />
        </div>
      )}

      {/* Progression overview */}
      <div className="mt-4 flex gap-1.5 flex-wrap">
        {progressions.map((p, i) => (
          <button
            key={i}
            onClick={() => useTwoFiveOneStore.getState().setCurrentMeasure(i * 4)}
            className={`px-2 py-1 rounded text-xs border ${
              i === currentProgIdx
                ? 'bg-blue-100 border-blue-300 text-blue-700'
                : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {p.key}
          </button>
        ))}
      </div>

      {/* Playback controls */}
      <div className="mt-4 flex justify-center">
        <PlaybackControls
          status={playback.status}
          currentMeasure={playback.currentMeasure}
          totalMeasures={playback.totalMeasures}
          isRepeating={playback.isRepeating}
          onPlay={startPlayback}
          onPause={pausePlayback}
          onStop={stopPlayback}
          onRepeatToggle={toggleRepeat}
          onPrev={prevMeasure}
          onNext={nextMeasure}
        />
      </div>
    </div>
  );
}
