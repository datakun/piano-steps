import { useState, useCallback, useEffect, useRef } from 'react';
import { useHummingStore } from './hummingStore';
import { useHummingRecording } from './useHummingRecording';
import { useTapTempo } from './useTapTempo';
import { downloadMidi } from '../../lib/audio/melodyExtractor';
import PianoRollPreview from './PianoRollPreview';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds as mm:ss */
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Map rhythmic duration to a symbol (rough display) */
function rhythmIcon(duration: number, bpm: number): string {
  const beat = 60 / bpm;
  const ratio = duration / beat;
  if (ratio >= 1.8) return '○';  // half/whole
  if (ratio >= 0.9) return '♩';  // quarter
  if (ratio >= 0.45) return '♪'; // eighth
  return '♬'; // sixteenth
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HummingPage() {
  const {
    bpm, subdivision,
    modelStatus, modelError,
    recordingStatus, recordingDuration, transcriptionProgress,
    processingPhase, transcriptionError, countInBeat, countInEnabled,
    melodyNotes, rawNotes, processingTimeMs,
    setBpm, setSubdivision, setCountInEnabled, reset,
  } = useHummingStore();

  const { startRecording, stopRecording, loadModel, analyserRef } = useHummingRecording();

  // Tap tempo
  const handleTapBpm = useCallback((newBpm: number) => setBpm(newBpm), [setBpm]);
  const { tap, tapCount } = useTapTempo(handleTapBpm);
  const [tapFlash, setTapFlash] = useState(false);

  const handleTap = () => {
    tap();
    setTapFlash(true);
    setTimeout(() => setTapFlash(false), 120);
  };

  // Audio level meter (RAF loop)
  const [audioLevel, setAudioLevel] = useState(0);
  const rafRef = useRef(0);
  const timeDomainBuf = useRef<Uint8Array | null>(null);

  useEffect(() => {
    if (recordingStatus !== 'recording') {
      setAudioLevel(0);
      return;
    }

    const loop = () => {
      const analyser = analyserRef.current;
      if (!analyser) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      if (!timeDomainBuf.current || timeDomainBuf.current.length !== analyser.fftSize) {
        timeDomainBuf.current = new Uint8Array(analyser.fftSize);
      }
      analyser.getByteTimeDomainData(timeDomainBuf.current as Uint8Array<ArrayBuffer>);

      // Calculate RMS (0–1)
      let sum = 0;
      for (let i = 0; i < timeDomainBuf.current.length; i++) {
        const v = (timeDomainBuf.current[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeDomainBuf.current.length);
      // Amplify and clamp to 0–1
      setAudioLevel(Math.min(1, rms * 3));

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [recordingStatus, analyserRef]);

  const isCountIn = recordingStatus === 'count-in';
  const isRecording = recordingStatus === 'recording';
  const isProcessing = recordingStatus === 'processing';
  const isDone = recordingStatus === 'done';
  const isError = recordingStatus === 'error';
  const modelReady = modelStatus === 'ready';

  // -----------------------------------------------------------------------
  // Event handlers
  // -----------------------------------------------------------------------

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else if (!isCountIn) {
      startRecording();
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (melodyNotes.length === 0 || isDownloading) return;
    setIsDownloading(true);
    try {
      // yield to let React render the loading state
      await new Promise((r) => requestAnimationFrame(r));
      downloadMidi(melodyNotes, bpm);
    } catch (e) {
      console.error('MIDI download failed:', e);
      alert('MIDI 다운로드에 실패했습니다.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReset = () => {
    reset();
  };

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-50 px-4 md:px-6 pt-4 md:pt-6 pb-3">
        <h1 className="text-lg font-bold">Humming</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          Hum a melody, get MIDI
        </p>
      </div>

      <div className="px-4 md:px-6 pb-6">
        {/* Settings — 2 rows */}
        <div className="grid grid-cols-2 gap-2 mb-6">
          {/* Row 1 Left: BPM */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">BPM</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setBpm(bpm - 1)}
                disabled={isRecording || isProcessing}
                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm flex items-center justify-center"
              >
                ◀
              </button>
              <span className="w-10 text-center font-semibold text-sm tabular-nums">
                {bpm}
              </span>
              <button
                onClick={() => setBpm(bpm + 1)}
                disabled={isRecording || isProcessing}
                className="w-7 h-7 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 disabled:opacity-40 text-sm flex items-center justify-center"
              >
                ▶
              </button>
            </div>
          </div>

          {/* Row 1 Right: Tap Tempo */}
          <div className="flex justify-end">
            <button
              onClick={handleTap}
              disabled={isRecording || isProcessing}
              className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-100 disabled:opacity-40 ${
                tapFlash
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              TAP{tapCount >= 2 ? '' : ''}
            </button>
          </div>

          {/* Row 2 Left: Subdivision */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Grid</span>
            <select
              value={subdivision}
              onChange={(e) => setSubdivision(Number(e.target.value) as 4 | 8 | 16)}
              disabled={isRecording || isProcessing}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-40"
            >
              <option value={4}>♩ Quarter</option>
              <option value={8}>♪ Eighth</option>
              <option value={16}>♬ 16th</option>
            </select>
          </div>

          {/* Row 2 Right: Count-in toggle */}
          <div className="flex justify-end">
            <button
              onClick={() => setCountInEnabled(!countInEnabled)}
              disabled={isRecording || isProcessing || isCountIn}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-40 ${
                countInEnabled
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'border-gray-200 text-gray-400 hover:bg-gray-100'
              }`}
            >
              Count-in
            </button>
          </div>
        </div>

        {/* Model status */}
        <div className="mb-6">
          {modelStatus === 'loading' && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <span className="animate-spin">⏳</span>
              Loading ML model…
            </div>
          )}
          {modelStatus === 'error' && (
            <div className="flex items-center justify-between gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <span>❌ {modelError || 'Model load failed'}</span>
              <button
                onClick={loadModel}
                className="text-red-700 underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}
          {modelStatus === 'ready' && !isCountIn && !isRecording && !isProcessing && !isDone && (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">
              <span>✅</span>
              Model ready
            </div>
          )}
        </div>

        {/* Recording area */}
        <div className="flex flex-col items-center py-4">
          {/* Count-in display */}
          {isCountIn && (
            <div className="mb-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-3">
                {[0, 1, 2, 3].map((beat) => (
                  <span
                    key={beat}
                    className={`text-3xl font-bold tabular-nums transition-all duration-100 ${
                      countInBeat === beat
                        ? 'text-blue-600 scale-125'
                        : countInBeat > beat
                          ? 'text-gray-300'
                          : 'text-gray-300'
                    }`}
                  >
                    {beat + 1}
                  </span>
                ))}
              </div>
              <span className="text-xs text-gray-400">Count-in…</span>
            </div>
          )}

          {/* Record button */}
          <button
            onClick={handleRecordToggle}
            disabled={!modelReady || isProcessing || isCountIn}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
              isRecording
                ? 'bg-red-500 shadow-lg shadow-red-200'
                : isCountIn
                  ? 'bg-gray-300 shadow-none cursor-wait'
                  : 'bg-red-500 hover:bg-red-600 shadow-md disabled:opacity-40 disabled:shadow-none'
            }`}
          >
            {isRecording ? (
              /* Stop icon (square) */
              <div className="w-7 h-7 bg-white rounded-sm" />
            ) : isCountIn ? (
              /* Pulse icon during count-in */
              <div className="w-7 h-7 bg-white rounded-full animate-pulse" />
            ) : (
              /* Record icon (circle) */
              <div className="w-7 h-7 bg-white rounded-full" />
            )}
          </button>

          {/* Audio level meter bar */}
          {isRecording && (
            <div className="mt-4 w-48 flex items-center gap-1.5">
              {/* Mic icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={audioLevel > 0.05 ? '#ef4444' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ transition: 'stroke 100ms' }}>
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
              {/* Bar track */}
              <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(2, audioLevel * 100)}%`,
                    background: audioLevel > 0.7
                      ? '#ef4444'
                      : audioLevel > 0.3
                        ? '#f59e0b'
                        : '#22c55e',
                    transition: 'width 80ms ease-out, background 150ms',
                  }}
                />
              </div>
            </div>
          )}

          {/* Recording duration */}
          {isRecording && (
            <div className="mt-4 flex flex-col items-center gap-1">
              <span className="text-2xl font-mono font-semibold text-gray-800 tabular-nums">
                {fmtTime(recordingDuration)}
              </span>
              <span className="text-xs text-gray-400">
                / {fmtTime(60)}
              </span>
              {/* Duration bar */}
              <div className="w-48 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full transition-all duration-200"
                  style={{ width: `${(recordingDuration / 60) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Processing */}
          {isProcessing && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">
                {processingPhase || 'Processing…'}
              </span>
              <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-200"
                  style={{ width: `${transcriptionProgress * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 tabular-nums">
                {Math.round(transcriptionProgress * 100)}%
              </span>
            </div>
          )}

          {/* Error */}
          {isError && (
            <div className="mt-4 flex flex-col items-center gap-3">
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-2.5 text-center">
                <p className="font-medium">Transcription failed</p>
                <p className="text-xs text-red-500 mt-0.5">
                  {transcriptionError || 'Unknown error'}
                </p>
              </div>
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Status text */}
          {!isRecording && !isProcessing && !isDone && !isError && modelReady && (
            <p className="mt-4 text-xs text-gray-400">
              Tap to start recording (max 60s)
            </p>
          )}
        </div>

        {/* Results */}
        {isDone && (
          <div className="mt-4 space-y-4">
            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{rawNotes.length} notes detected</span>
              <span>→</span>
              <span>{melodyNotes.length} quantized</span>
              {processingTimeMs != null && (
                <>
                  <span>·</span>
                  <span>{(processingTimeMs / 1000).toFixed(1)}s</span>
                </>
              )}
            </div>

            {/* Piano Roll Preview */}
            {melodyNotes.length > 0 ? (
              <PianoRollPreview notes={melodyNotes} bpm={bpm} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-4">
                No melody detected. Try humming louder or closer to the mic.
              </p>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              {melodyNotes.length > 0 && (
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-wait shadow-sm flex items-center gap-1.5"
                >
                  {isDownloading ? (
                    <>
                      <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" />
                      </svg>
                      Downloading...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download MIDI
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-100"
              >
                Record Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
