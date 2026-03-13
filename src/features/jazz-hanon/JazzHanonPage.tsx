import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { useJazzHanonStore } from './jazzHanonStore';
import { useHanonPlayback } from './useHanonPlayback';
import { EXERCISES, DIATONIC_CHORD_LABELS, DEGREE_LABELS, degreesToPatterns, transposeExercise, getDiatonicBassChords } from '../../data/exercises';
import type { ExercisePattern } from '../../data/exercises';
import { ALL_ROOTS } from '../../data/chords';
import HanonGrandStaff from '../../components/notation/HanonGrandStaff';
import PianoKeyboard from '../../components/piano/PianoKeyboard';
import type { NoteHighlight } from '../../components/piano/PianoKeyboard';
import { noteToSemitone, transposePitch } from '../../lib/music/noteUtils';
import PlaybackControls from '../../components/playback/PlaybackControls';
import MetronomeWidget from '../../components/metronome/MetronomeWidget';
import { useModuleMetronome } from '../metronome/useModuleMetronome';
import type { NoteName } from '../../types/music';
import { loadCustomPatterns, saveCustomPattern, updateCustomPattern, deleteCustomPattern } from './customPatternStorage';
import type { StoredPattern } from './customPatternStorage';
import PatternBuilder from './PatternBuilder';

export default function JazzHanonPage() {
  useModuleMetronome('jazz-hanon');

  const {
    selectedExercise, selectedKey, guideMode, playback, isSessionStarted,
    setExercise, setKey, setGuideMode, startSession, resetSession,
    toggleRepeat, nextMeasure, prevMeasure,
  } = useJazzHanonStore();

  const [showFingerings, setShowFingerings] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingPattern, setEditingPattern] = useState<StoredPattern | undefined>();
  const [customVersion, setCustomVersion] = useState(0);

  const practiceIsPlaying = playback.status === 'playing';
  const controlsDisabled = playback.status !== 'stopped';
  const quarterBeat = Math.floor(playback.currentBeat / 2);

  // Load custom patterns from localStorage
  const storedPatterns = useMemo(() => loadCustomPatterns(), [customVersion]);

  const customExercises = useMemo<ExercisePattern[]>(() => {
    return storedPatterns.map(stored => ({
      id: stored.id,
      name: stored.name,
      description: stored.degrees.map(d => DEGREE_LABELS[d]).join('-'),
      patterns: degreesToPatterns(stored.degrees),
      fingerings: [],
      isCustom: true,
      degrees: stored.degrees,
    }));
  }, [storedPatterns]);

  const allExercises = useMemo(() => [...EXERCISES, ...customExercises], [customExercises]);

  const exercise = useMemo(() => {
    const base = allExercises.find(e => e.id === selectedExercise) ?? EXERCISES[0];
    return transposeExercise(base, selectedKey);
  }, [selectedExercise, selectedKey, allExercises]);

  // Bass chords (7th chord voicings) transposed to selected key
  const bassChords = useMemo(() => {
    const base = getDiatonicBassChords();
    const semitones = noteToSemitone(selectedKey as any) - noteToSemitone('C' as any);
    if (semitones === 0) return base;
    return base.map(chord =>
      chord.map(p => transposePitch(p, semitones, true))
    );
  }, [selectedKey]);

  const { startPlayback, pausePlayback, stopPlayback } = useHanonPlayback(exercise.patterns, bassChords);

  // Degree labels for notation (always visible)
  const degreeLabels = useMemo(() => {
    if (!exercise.degrees) return undefined;
    return exercise.degrees.map(d => DEGREE_LABELS[d]);
  }, [exercise.degrees]);

  // Piano keyboard data for guide mode
  const staffContainerRef = useRef<HTMLDivElement>(null);
  const [staffWidth, setStaffWidth] = useState(0);
  useEffect(() => {
    if (!staffContainerRef.current) return;
    const ro = new ResizeObserver(entries => {
      setStaffWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(staffContainerRef.current);
    return () => ro.disconnect();
  }, []);

  const keyboardData = useMemo(() => {
    if (!guideMode) return null;
    const currentPattern = exercise.patterns[playback.currentMeasure] ?? exercise.patterns[0];
    const activeIdx = playback.status === 'playing' ? playback.currentBeat : undefined;
    const activeNote = activeIdx !== undefined ? currentPattern[activeIdx] : undefined;

    const highlights: NoteHighlight[] = currentPattern.map(p => ({
      note: p.name,
      octave: p.octave,
      color: activeNote && p.midi === activeNote.midi ? '#2563eb' : '#93c5fd',
    }));

    const minOct = Math.min(...currentPattern.map(p => p.octave));
    const maxOct = Math.max(...currentPattern.map(p => p.octave));
    return {
      highlights,
      startOctave: minOct,
      octaves: Math.max(2, maxOct - minOct + 1),
    };
  }, [guideMode, exercise.patterns, playback.currentMeasure, playback.currentBeat, playback.status]);

  const handleSavePattern = useCallback((pattern: StoredPattern) => {
    if (editingPattern) {
      updateCustomPattern(pattern.id, { name: pattern.name, degrees: pattern.degrees });
    } else {
      saveCustomPattern(pattern);
    }
    setCustomVersion(v => v + 1);
    setShowBuilder(false);
    setEditingPattern(undefined);
    // Auto-select the new/updated pattern
    setExercise(pattern.id);
  }, [editingPattern, setExercise]);

  const handleCancelBuilder = useCallback(() => {
    setShowBuilder(false);
    setEditingPattern(undefined);
  }, []);

  const handleEditPattern = useCallback((stored: StoredPattern) => {
    setEditingPattern(stored);
    setShowBuilder(true);
  }, []);

  const handleDeletePattern = useCallback((id: string) => {
    deleteCustomPattern(id);
    setCustomVersion(v => v + 1);
    // If deleted pattern was selected, reset to pattern 1
    const current = useJazzHanonStore.getState().selectedExercise;
    if (current === id) {
      setExercise(1);
    }
  }, [setExercise]);

  // Pattern Builder view
  if (showBuilder) {
    return (
      <PatternBuilder
        onSave={handleSavePattern}
        onCancel={handleCancelBuilder}
        editingPattern={editingPattern}
      />
    );
  }

  // Setup screen
  if (!isSessionStarted) {
    return (
      <div className="max-w-lg mx-auto">
        {/* Action bar */}
        <div className="sticky top-0 z-30 bg-gray-50 px-4 md:px-6 pt-4 md:pt-6 pb-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold shrink-0">Jazz Hanon</h1>
            <div className="flex items-center gap-2">
              <select
                value={selectedKey}
                onChange={e => setKey(e.target.value as NoteName)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
              >
                {ALL_ROOTS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button
                onClick={startSession}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                Start
              </button>
            </div>
          </div>
        </div>

        {/* Settings */}
        <div className="px-4 md:px-6 pb-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm text-gray-500 block mb-1">Guide Mode</label>
            <button
              onClick={() => setGuideMode(!guideMode)}
              className={`w-full py-2 rounded-lg text-sm border transition-colors ${
                guideMode
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-gray-200 text-gray-500'
              }`}
            >
              {guideMode ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Pattern list */}
        <div className="px-4 md:px-6 pb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <label className="text-sm text-gray-500 block mb-1">Exercise Pattern</label>
            <div className="space-y-2">
              {/* Built-in patterns */}
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
                  <span className="font-medium block">{ex.name}</span>
                  <span className="text-gray-400 text-xs">{ex.description}</span>
                </button>
              ))}

              {/* Custom patterns */}
              {customExercises.length > 0 && (
                <div className="border-t border-gray-100 pt-2 mt-1">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Custom</span>
                </div>
              )}
              {customExercises.map(ex => {
                const stored = storedPatterns.find(s => s.id === ex.id);
                return (
                  <div key={ex.id} className="flex gap-1.5">
                    <button
                      onClick={() => setExercise(ex.id)}
                      className={`flex-1 text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                        selectedExercise === ex.id
                          ? 'bg-green-50 border-green-200 text-green-700'
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-medium block">{ex.name}</span>
                      <span className="text-gray-400 text-xs">{ex.description}</span>
                    </button>
                    {stored && (
                      <>
                        <button
                          onClick={() => handleEditPattern(stored)}
                          className="flex items-center justify-center w-10 border border-gray-200 rounded-lg text-gray-400 hover:text-blue-500 active:bg-blue-50 text-base"
                          title="Edit"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => handleDeletePattern(ex.id as string)}
                          className="flex items-center justify-center w-10 border border-gray-200 rounded-lg text-gray-400 hover:text-red-500 active:bg-red-50 text-base"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Add pattern button */}
              <button
                onClick={() => setShowBuilder(true)}
                className="w-full text-center px-3 py-2 rounded-lg text-sm border border-dashed border-gray-300 text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors"
              >
                + Create Pattern
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentChordLabel = DIATONIC_CHORD_LABELS[playback.currentMeasure] ?? '';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Sticky header: unified control panel */}
      <div className="sticky top-0 z-30 bg-gray-50 px-3 md:px-5 pt-3 md:pt-5 pb-3">
        <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm space-y-2.5">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Jazz Hanon</h1>
            <button
              onClick={() => { stopPlayback(); resetSession(); }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2.5 py-1 border border-gray-200 rounded-lg"
            >
              New Session
            </button>
          </div>

          {/* BPM + slider + beat indicator — single row */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 flex-1 min-w-0${controlsDisabled ? ' opacity-50 pointer-events-none' : ''}`}>
              <MetronomeWidget compact hidePlayButton unstyled hideBeatIndicator />
            </div>
            <div className="flex gap-1.5 shrink-0">
              {Array.from({ length: 4 }, (_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-75 ${
                    practiceIsPlaying && quarterBeat === i
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

          {/* Exercise info + fingering toggle */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <span className="font-medium">{exercise.name}</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-500">Key of {selectedKey}</span>
              <span className="text-gray-400">|</span>
              <span className="text-blue-600 font-medium">{currentChordLabel}</span>
            </div>
            {exercise.fingerings.length > 0 && (
              <button
                onClick={() => setShowFingerings(v => !v)}
                className={`px-2 py-0.5 rounded text-xs border transition-colors ${
                  showFingerings
                    ? 'bg-blue-50 border-blue-200 text-blue-600'
                    : 'border-gray-200 text-gray-400'
                }`}
                title="Toggle fingering numbers"
              >
                1-2-3
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-4 md:pb-6 pt-3">
        {/* Diatonic chord buttons */}
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

        {/* Staff notation — grand staff with treble arpeggio + bass 7th chord */}
        <div ref={staffContainerRef} className="bg-white border border-gray-200 rounded-xl p-3">
          <HanonGrandStaff
            trebleNotes={exercise.patterns[playback.currentMeasure] ?? exercise.patterns[0]}
            bassChord={bassChords[playback.currentMeasure] ?? bassChords[0]}
            keySignature={selectedKey}
            activeNoteIndex={playback.status === 'playing' ? playback.currentBeat : undefined}
            fingeringLabels={showFingerings && exercise.fingerings.length > 0 ? exercise.fingerings : undefined}
            degreeLabels={degreeLabels}
          />

          {/* Piano keyboard guide */}
          {guideMode && keyboardData && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <PianoKeyboard
                startOctave={keyboardData.startOctave}
                octaves={keyboardData.octaves}
                highlightedNotes={keyboardData.highlights}
                width={staffWidth > 0 ? staffWidth - 24 : undefined}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
