import { useEffect } from 'react';
import { useChordDetectStore } from './chordDetectStore';
import { useChordDetection } from './useChordDetection';

export default function ChordDetectPage() {
  const {
    isListening, micError, currentChord, history, stopReason,
    clearHistory, removeFromHistory,
  } = useChordDetectStore();
  const { start, stop } = useChordDetection();

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

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-50 px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <h1 className="text-lg font-bold">Chord Detector</h1>
      </div>

      <div className="px-4 md:px-6 pb-6">
        {/* Current chord display */}
        <div className="flex flex-col items-center py-8">
          <div className={`w-44 h-44 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-300 ${
            isListening
              ? currentChord
                ? 'border-blue-400 bg-blue-50 shadow-lg shadow-blue-100'
                : 'border-gray-300 bg-gray-50 animate-pulse'
              : 'border-gray-200 bg-white'
          }`}>
            {currentChord ? (
              <>
                <span className="text-3xl font-bold text-gray-800">
                  {currentChord.symbol}
                </span>
                <div className="mt-2 flex items-center gap-1.5">
                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-150"
                      style={{ width: `${Math.round(currentChord.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {Math.round(currentChord.confidence * 100)}%
                  </span>
                </div>
              </>
            ) : isListening ? (
              <span className="text-sm text-gray-400">Listening...</span>
            ) : null}
          </div>

          {/* Mic button */}
          <button
            onClick={handleToggle}
            className={`mt-6 px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
              isListening
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-md'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
            }`}
          >
            {/* Mic icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            {isListening ? 'Stop' : 'Start Listening'}
          </button>

          {/* Status messages */}
          {stopReason === 'no-input' && (
            <p className="mt-3 text-xs text-amber-600">
              Stopped automatically — no input for 30 seconds
            </p>
          )}
          {micError && (
            <p className="mt-3 text-xs text-red-500">
              {micError}
            </p>
          )}
          {isListening && (
            <p className="mt-3 text-xs text-gray-400">
              Auto-stops after 30s of silence
            </p>
          )}
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
              {history.map((chord, i) => (
                <div
                  key={`${chord.symbol}-${chord.timestamp}`}
                  className="group relative flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <span className="font-medium text-gray-700">{chord.symbol}</span>
                  <button
                    onClick={() => removeFromHistory(i)}
                    className="text-gray-300 hover:text-gray-500 text-xs ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    ✕
                  </button>
                  {/* Arrow between chords */}
                  {i < history.length - 1 && (
                    <span className="absolute -right-2.5 text-gray-300 text-xs pointer-events-none">→</span>
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
