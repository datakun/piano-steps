import { useEffect, useRef } from 'react';
import { useTwoFiveOneStore } from './twoFiveOneStore';
import { usePracticePlayback } from './usePracticePlayback';
import ProgressionDisplay from './ProgressionDisplay';
import PlaybackControls from '../../components/playback/PlaybackControls';
import MetronomeWidget from '../../components/metronome/MetronomeWidget';
import { useMetronomeStore } from '../metronome/metronomeStore';
import { useModuleMetronome } from '../metronome/useModuleMetronome';
import { ALL_ROOTS } from '../../data/chords';
import type { NoteName } from '../../types/music';
import type { TimeSignature } from '../../types/metronome';

const BEATS_MAP: Record<TimeSignature, number> = {
  '2/4': 2, '3/4': 3, '4/4': 4, '5/4': 5, '6/8': 6, '7/8': 7,
};

export default function TwoFiveOnePage() {
  useModuleMetronome('two-five-one');

  const {
    mode, form, startKey, guideMode, progressions, playback, isSessionStarted,
    setMode, setForm, setStartKey, setGuideMode, startSession, resetSession,
    toggleRepeat, nextMeasure, prevMeasure,
  } = useTwoFiveOneStore();

  const { startPlayback, pausePlayback, stopPlayback } = usePracticePlayback();
  const { timeSignature, setTimeSignature } = useMetronomeStore();

  // Beat indicator uses playback state from twoFiveOneStore (not metronomeStore)
  const practiceIsPlaying = playback.status === 'playing';
  const practiceBeat = playback.currentBeat;
  const controlsDisabled = playback.status !== 'stopped';

  // Calculate which progression and local measure is active
  // Each progression = 4 measures (2 bars × 2 repeats)
  const currentProgIdx = Math.floor(playback.currentMeasure / 4);
  const measureInProg = playback.currentMeasure % 4;

  // Calculate active chord index for guide mode (0=II, 1=V, 2=I)
  const activeChordIdx = (() => {
    if (!guideMode || playback.status === 'stopped') return undefined;
    const staffMeasureIdx = measureInProg % 2; // 0=II-V bar, 1=I bar
    if (staffMeasureIdx === 1) return 2; // I chord
    // II-V bar: split by half of beats
    const beatsPerMeasure = BEATS_MAP[timeSignature] ?? 4;
    const half = Math.floor(beatsPerMeasure / 2);
    return playback.currentBeat < half ? 0 : 1; // II or V
  })();

  // Auto-scroll to current progression during playback
  const progRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const el = progRefs.current[currentProgIdx];
    if (el && playback.status !== 'stopped') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentProgIdx, playback.status]);

  if (!isSessionStarted) {
    return (
      <div className="max-w-lg mx-auto">
        {/* Action bar */}
        <div className="sticky top-0 z-30 bg-gray-50 px-4 md:px-6 pt-4 md:pt-6 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">II-V-I Practice</h1>
            <button
              onClick={startSession}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Start
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className="px-4 md:px-6 pb-6">
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

            <div>
              <label className="text-sm text-gray-500 block mb-1">Guide Mode</label>
              <button
                onClick={() => setGuideMode(!guideMode)}
                className={`w-full py-2 rounded-lg text-sm border transition-colors ${
                  guideMode
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'border-gray-200 text-gray-500'
                }`}
              >
                {guideMode ? 'ON — 재생 중 운지 자동 표시' : 'OFF'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Sticky header: unified control panel */}
      <div className="sticky top-0 z-30 bg-gray-50 px-3 md:px-5 pt-3 md:pt-5 pb-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm space-y-2.5">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">II-V-I Practice</h1>
            <button
              onClick={() => { stopPlayback(); resetSession(); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1 border border-gray-200 rounded-lg"
            >
              New Session
            </button>
          </div>

          {/* Time sig + BPM + slider + beat indicator — single row */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 flex-1 min-w-0${controlsDisabled ? ' opacity-50 pointer-events-none' : ''}`}>
              <select
                value={timeSignature}
                onChange={e => setTimeSignature(e.target.value as TimeSignature)}
                disabled={controlsDisabled}
                className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white shrink-0"
              >
                <option value="2/4">2/4</option>
                <option value="3/4">3/4</option>
                <option value="4/4">4/4</option>
                <option value="5/4">5/4</option>
                <option value="6/8">6/8</option>
              </select>
              <MetronomeWidget compact hidePlayButton unstyled hideBeatIndicator />
            </div>
            <div className="flex gap-1.5 shrink-0">
              {Array.from({ length: BEATS_MAP[timeSignature] ?? 4 }, (_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-75 ${
                    practiceIsPlaying && practiceBeat === i
                      ? i === 0 ? 'bg-red-500 scale-125' : 'bg-blue-500 scale-125'
                      : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Playback controls */}
          <div className="flex justify-center">
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
              unstyled
            />
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-4 md:pb-6 pt-3">

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
      </div>

      {/* All progressions */}
      <div className="space-y-3">
        {progressions.map((prog, i) => (
          <div
            key={`${prog.key}-${i}`}
            ref={(el) => { progRefs.current[i] = el; }}
            onClick={() => useTwoFiveOneStore.getState().setCurrentMeasure(i * 4)}
            className="cursor-pointer"
          >
            <ProgressionDisplay
              progression={prog}
              label={`${i + 1}. ${prog.key}`}
              activeMeasureInProgression={
                i === currentProgIdx && playback.status !== 'stopped'
                  ? measureInProg
                  : undefined
              }
              isCurrent={i === currentProgIdx}
              activeChordIndex={
                i === currentProgIdx && playback.status !== 'stopped'
                  ? activeChordIdx
                  : undefined
              }
            />
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
