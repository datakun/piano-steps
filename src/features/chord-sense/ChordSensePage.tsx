import { useEffect } from 'react';
import { useChordSenseStore } from './chordSenseStore';
import { useChordSense } from './useChordSense';
import SpectrumCanvas from './SpectrumCanvas';
import type { Instrument } from '../../lib/audio/pitchDetector';

// ---------------------------------------------------------------------------
// Instrument button config
// ---------------------------------------------------------------------------

const INSTRUMENTS: { id: Instrument; label: string; emoji: string }[] = [
  { id: 'piano', label: 'Piano', emoji: '🎹' },
  { id: 'guitar', label: 'Guitar', emoji: '🎸' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChordSensePage() {
  const {
    instrument,
    isListening,
    micError,
    currentChord,
    volume,
    history,
    stopReason,
    setInstrument,
    clearHistory,
    removeFromHistory,
  } = useChordSenseStore();

  const { start, stop, analyserNodeRef } = useChordSense();

  // iOS: switch audioSession to 'play-and-record' on page enter,
  // restore to 'playback' on page leave
  useEffect(() => {
    try {
      if (navigator.audioSession) {
        navigator.audioSession.type = 'play-and-record';
      }
    } catch { /* not supported */ }

    return () => {
      try {
        if (navigator.audioSession) {
          navigator.audioSession.type = 'playback';
        }
      } catch { /* not supported */ }
    };
  }, []);

  const handleToggle = () => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  };

  const handleInstrumentChange = (id: Instrument) => {
    if (isListening) stop();
    setInstrument(id);
  };

  const chordDisplay = currentChord
    ? `${currentChord.root}${currentChord.pattern.display}`
    : null;
  const confidence = currentChord ? Math.round(currentChord.confidence * 100) : 0;
  const accentColor = instrument === 'piano' ? 'blue' : 'emerald';

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-50 px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <h1 className="text-lg font-bold">Chord Sense</h1>
        <p className="text-xs text-gray-400 mt-0.5">Real-time chord recognition</p>
      </div>

      <div className="px-4 md:px-6 pb-6 flex flex-col gap-4">
        {/* Instrument selector */}
        <div className="flex gap-2 justify-center">
          {INSTRUMENTS.map(({ id, label, emoji }) => (
            <button
              key={id}
              onClick={() => handleInstrumentChange(id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                instrument === id
                  ? id === 'piano'
                    ? 'bg-blue-50 border-blue-300 text-blue-700'
                    : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {emoji} {label}
            </button>
          ))}
        </div>

        {/* Spectrum visualizer */}
        <SpectrumCanvas
          analyserRef={analyserNodeRef}
          isListening={isListening}
          instrument={instrument}
        />

        {/* Current chord display */}
        <div className="flex flex-col items-center py-4">
          <div
            className={`w-40 h-40 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-300 ${
              isListening
                ? chordDisplay
                  ? instrument === 'piano'
                    ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100'
                    : 'border-emerald-400 bg-emerald-50 shadow-lg shadow-emerald-100'
                  : 'border-gray-300 bg-gray-50 animate-pulse'
                : 'border-gray-200 bg-white'
            }`}
          >
            {chordDisplay ? (
              <>
                <span className="text-3xl font-bold text-gray-800">
                  {chordDisplay}
                </span>
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        instrument === 'piano' ? 'bg-blue-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${confidence}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{confidence}%</span>
                </div>
              </>
            ) : isListening ? (
              <span className="text-sm text-gray-400">Listening...</span>
            ) : null}
          </div>
        </div>

        {/* Volume bar + Mic button */}
        <div className="flex flex-col items-center gap-3">
          {/* Volume meter */}
          <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-75 ${
                instrument === 'piano' ? 'bg-blue-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${volume * 100}%` }}
            />
          </div>

          {/* Mic toggle button */}
          <button
            onClick={handleToggle}
            className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              isListening
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
                : instrument === 'piano'
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
            }`}
          >
            {/* Mic icon */}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            {isListening ? 'Stop' : 'Start Listening'}
          </button>

          {/* Status messages */}
          {stopReason === 'no-input' && (
            <p className="text-xs text-amber-600">
              Stopped automatically — no input for 30 seconds
            </p>
          )}
          {micError && (
            <p className="text-xs text-red-500">{micError}</p>
          )}
          {isListening && !stopReason && (
            <p className="text-xs text-gray-400">
              Auto-stops after 30s of silence
            </p>
          )}
        </div>

        {/* Algorithm info */}
        <div className="bg-white rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-400 leading-relaxed">
          <span className={instrument === 'piano' ? 'text-blue-500 font-medium' : 'text-emerald-500 font-medium'}>
            {instrument === 'piano' ? 'Piano mode' : 'Guitar mode'}
          </span>
          {instrument === 'piano'
            ? ' — HPS (Harmonic Product Spectrum)'
            : ' — FFT Peak Detection + Harmonic Suppression'}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-medium text-gray-600">History</h2>
              <button
                onClick={clearHistory}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded-lg"
              >
                Clear
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {history.map((entry, i) => (
                <div
                  key={`${entry.name}-${i}`}
                  className="group relative flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <span className="font-medium text-gray-700">{entry.name}</span>
                  <button
                    onClick={() => removeFromHistory(i)}
                    className="text-gray-300 hover:text-gray-500 text-xs ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    &#x2715;
                  </button>
                  {i < history.length - 1 && (
                    <span className="absolute -right-2.5 text-gray-300 text-xs pointer-events-none">
                      &rarr;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
